#!/usr/bin/env node

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const APP_PORT = Number(process.env.MAPX_SMOKE_PORT ?? 1431);
const DEBUG_PORT = Number(process.env.MAPX_SMOKE_DEBUG_PORT ?? 9331);
const APP_URL = `http://127.0.0.1:${APP_PORT}`;
const DEFAULT_TIMEOUT_MS = 30_000;
const OVERALL_TIMEOUT_MS = Number(process.env.MAPX_SMOKE_TIMEOUT_MS ?? 60_000);

const chromePath = findChromePath();
const userDataDir = mkdtempSync(path.join(tmpdir(), "mapx-smoke-chrome-"));
const processes = [];

const watchdog = setTimeout(() => {
  process.stderr.write(`[smoke] timed out after ${OVERALL_TIMEOUT_MS}ms\n`);
  for (const child of processes.reverse()) {
    terminateProcess(child, "SIGKILL");
  }
  process.exit(124);
}, OVERALL_TIMEOUT_MS);
watchdog.unref();

try {
  const vite = spawnProcess("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(APP_PORT), "--strictPort"], {
    MAPX_SMOKE: "1",
  });
  processes.push(vite);

  await waitForHttp(APP_URL, DEFAULT_TIMEOUT_MS, vite);

  const chrome = spawnProcess(chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${userDataDir}`,
    APP_URL,
  ]);
  processes.push(chrome);

  const pageInfo = await waitForPageInfo(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
  const cdp = await connectCdp(pageInfo.webSocketDebuggerUrl);

  try {
    await cdp.send("Runtime.enable");
    await waitForText(cdp, "MapX");
    await waitForText(cdp, "百度 AK：未配置");
    await waitForSelector(cdp, '[data-testid="map-canvas-action-settings"]');

    await clickByAriaLabel(cdp, "打开新建项目表单");
    await setInputByPlaceholder(cdp, "新项目名称", "Smoke 项目");
    await clickSubmitInFormWithPlaceholder(cdp, "新项目名称");
    await waitForText(cdp, "Smoke 项目");

    await clickButtonByText(cdp, "设置");
    await waitForText(cdp, "本地目录");
    await waitForText(cdp, "备份目录：浏览器预览模式");
    await waitForText(cdp, "最近备份：暂无备份");
    await waitForText(cdp, "打开备份目录");
    await waitForText(cdp, "打开日志目录");

    await clickButtonByText(cdp, "中心点");
    await waitForText(cdp, "待保存点位");
    await waitForText(cdp, "新建点位");

    console.log(
      JSON.stringify(
        {
          status: "passed",
          appUrl: APP_URL,
          checks: [
            "app-started",
            "missing-ak-settings-entry",
            "project-created",
            "backup-settings-visible",
            "log-directory-entry-visible",
            "marker-create-form-opened",
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    await cdp.close();
  }
} finally {
  clearTimeout(watchdog);
  for (const child of processes.reverse()) {
    if (child.exitCode === null) {
      terminateProcess(child, "SIGTERM");
      await waitForProcessExit(child);
    }
  }
  try {
    rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch (error) {
    process.stderr.write(`[smoke] warning: failed to remove temporary Chrome profile ${userDataDir}: ${error.message}\n`);
  }
}

function findChromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.GOOGLE_CHROME_BIN,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate && commandExists(candidate)) {
      return candidate;
    }
  }

  throw new Error("Chrome executable not found. Set CHROME_PATH to run MapX smoke tests.");
}

function commandExists(command) {
  const result = spawnSync(command, ["--version"], { stdio: "ignore", shell: false });
  return result.status === 0;
}

function spawnProcess(command, args, env = {}) {
  const child = spawn(command, args, {
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
    shell: false,
  });

  child.stdout.on("data", (chunk) => process.stdout.write(prefixOutput(command, chunk)));
  child.stderr.on("data", (chunk) => process.stderr.write(prefixOutput(command, chunk)));
  child.on("exit", (code) => {
    if (code !== null && code !== 0) {
      process.stderr.write(`[${path.basename(command)}] exited with ${code}\n`);
    }
  });

  return child;
}

function terminateProcess(child, signal) {
  if (child.exitCode !== null) {
    return;
  }

  if (process.platform !== "win32" && child.pid) {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // Fall back to killing the direct child below.
    }
  }

  child.kill(signal);
}

function waitForProcessExit(child, timeoutMs = 5000) {
  if (child.exitCode !== null) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      terminateProcess(child, "SIGKILL");
      resolve();
    }, timeoutMs);

    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

function prefixOutput(command, chunk) {
  return String(chunk)
    .split("\n")
    .map((line) => (line ? `[${path.basename(command)}] ${line}` : line))
    .join("\n");
}

async function waitForHttp(url, timeoutMs = DEFAULT_TIMEOUT_MS, serverProcess = null) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (serverProcess?.exitCode !== null) {
      throw new Error(`Server exited before ${url} became available`);
    }

    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Server is still booting.
    }

    await delay(250);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForJson(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response.json();
      }
    } catch {
      // Chrome debugging endpoint is still booting.
    }

    await delay(250);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForPageInfo(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const pages = await waitForJson(url, timeoutMs);
    const page = pages.find((item) => item.type === "page" && item.webSocketDebuggerUrl);

    if (page) {
      return page;
    }

    await delay(250);
  }

  throw new Error("Timed out waiting for Chrome page target");
}

function connectCdp(webSocketUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketUrl);
    const pending = new Map();
    let nextId = 1;

    socket.addEventListener("open", () => {
      resolve({
        send(method, params = {}) {
          const id = nextId++;
          socket.send(JSON.stringify({ id, method, params }));

          return new Promise((resolveCommand, rejectCommand) => {
            pending.set(id, { resolve: resolveCommand, reject: rejectCommand });
          });
        },
        close() {
          return new Promise((resolveClose) => {
            if (socket.readyState === WebSocket.CLOSED) {
              resolveClose();
              return;
            }

            const timeout = setTimeout(resolveClose, 1000);
            socket.addEventListener(
              "close",
              () => {
                clearTimeout(timeout);
                resolveClose();
              },
              { once: true },
            );
            socket.close();
          });
        },
      });
    });

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      const command = pending.get(message.id);

      if (!command) {
        return;
      }

      pending.delete(message.id);

      if (message.error) {
        command.reject(new Error(message.error.message));
        return;
      }

      command.resolve(message.result);
    });

    socket.addEventListener("error", () => reject(new Error("Chrome DevTools websocket failed")));
  });
}

async function waitForText(cdp, text, timeoutMs = DEFAULT_TIMEOUT_MS) {
  await waitForExpression(cdp, `document.body && document.body.innerText.includes(${JSON.stringify(text)})`, timeoutMs, `text ${text}`);
}

async function waitForSelector(cdp, selector, timeoutMs = DEFAULT_TIMEOUT_MS) {
  await waitForExpression(cdp, `Boolean(document.querySelector(${JSON.stringify(selector)}))`, timeoutMs, `selector ${selector}`);
}

async function waitForExpression(cdp, expression, timeoutMs, label) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const result = await evaluate(cdp, expression);
    if (result.value) {
      return;
    }

    await delay(250);
  }

  throw new Error(`Timed out waiting for ${label}`);
}

async function clickByAriaLabel(cdp, ariaLabel) {
  await evaluateOrThrow(
    cdp,
    `(() => {
      const element = document.querySelector('[aria-label=${JSON.stringify(ariaLabel)}]');
      if (!element) throw new Error('Missing aria-label: ${ariaLabel}');
      element.click();
      return true;
    })()`,
  );
}

async function clickButtonByText(cdp, text) {
  await evaluateOrThrow(
    cdp,
    `(() => {
      const buttons = [...document.querySelectorAll('button')];
      const button = buttons.find((item) => item.innerText.trim().includes(${JSON.stringify(text)}));
      if (!button) throw new Error('Missing button text: ${text}');
      button.click();
      return true;
    })()`,
  );
}

async function setInputByPlaceholder(cdp, placeholder, value) {
  await evaluateOrThrow(
    cdp,
    `(() => {
      const input = document.querySelector('input[placeholder=${JSON.stringify(placeholder)}]');
      if (!input) throw new Error('Missing input placeholder: ${placeholder}');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`,
  );
}

async function clickSubmitInFormWithPlaceholder(cdp, placeholder) {
  await evaluateOrThrow(
    cdp,
    `(() => {
      const input = document.querySelector('input[placeholder=${JSON.stringify(placeholder)}]');
      const form = input && input.closest('form');
      const submit = form && form.querySelector('button[type="submit"]');
      if (!submit) throw new Error('Missing submit button for placeholder: ${placeholder}');
      submit.click();
      return true;
    })()`,
  );
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });

  return result.result ?? {};
}

async function evaluateOrThrow(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });

  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text ?? "Runtime evaluation failed");
  }

  return result.result;
}
