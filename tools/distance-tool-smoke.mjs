#!/usr/bin/env node

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const APP_PORT = Number(process.env.MAPX_DISTANCE_SMOKE_PORT ?? 1432);
const DEBUG_PORT = Number(process.env.MAPX_DISTANCE_SMOKE_DEBUG_PORT ?? 9332);
const APP_URL = `http://127.0.0.1:${APP_PORT}`;
const DEFAULT_TIMEOUT_MS = 30_000;
const OVERALL_TIMEOUT_MS = Number(process.env.MAPX_DISTANCE_SMOKE_TIMEOUT_MS ?? 75_000);
const BAIDU_MAP_AK = process.env.BAIDU_MAP_AK?.trim();

if (!BAIDU_MAP_AK) {
  throw new Error("Set BAIDU_MAP_AK to run the MapX distance measurement smoke. The script redacts it from output.");
}

const chromePath = findChromePath();
const userDataDir = mkdtempSync(path.join(tmpdir(), "mapx-distance-smoke-chrome-"));
const processes = [];

const watchdog = setTimeout(() => {
  process.stderr.write(`[distance-smoke] timed out after ${OVERALL_TIMEOUT_MS}ms\n`);
  for (const child of processes.reverse()) {
    terminateProcess(child, "SIGKILL");
  }
  process.exit(124);
}, OVERALL_TIMEOUT_MS);
watchdog.unref();

try {
  const vite = spawnProcess("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(APP_PORT), "--strictPort"]);
  processes.push(vite);

  await waitForHttp(APP_URL, DEFAULT_TIMEOUT_MS, vite);

  const chrome = spawnProcess(chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=960,720",
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${userDataDir}`,
    APP_URL,
  ]);
  processes.push(chrome);

  const pageInfo = await waitForPageInfo(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
  const cdp = await connectCdp(pageInfo.webSocketDebuggerUrl);

  try {
    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");
    await waitForExpression(cdp, "document.readyState !== 'loading'", DEFAULT_TIMEOUT_MS, "document ready");

    const setup = await evaluateOrThrow(
      cdp,
      `(() => import(${JSON.stringify(`${APP_URL}/src/services/baidu-map-provider.ts`)}).then(async ({ createBaiduMapProvider }) => {
        document.body.innerHTML = '<div id="mapx-distance-smoke-map" style="position:fixed;inset:0;width:960px;height:720px;background:#eef2f7"></div>';
        const container = document.getElementById('mapx-distance-smoke-map');
        const provider = createBaiduMapProvider(${JSON.stringify(BAIDU_MAP_AK)});
        const state = {
          addedPoints: [],
          cleared: 0,
          completedSet: false,
          completed: null,
          start: null,
          domEvents: [],
        };
        for (const eventName of ['mousedown', 'mouseup', 'click', 'dblclick']) {
          container.addEventListener(eventName, (event) => {
            state.domEvents.push({ type: event.type, x: event.clientX, y: event.clientY, detail: event.detail });
          });
        }
        const startMeasurement = () => provider.startDistanceMeasurement({
          onPointAdded: (point) => state.addedPoints.push(point),
          onCompleted: (result) => {
            state.completedSet = true;
            state.completed = result;
          },
          onCleared: () => {
            state.cleared += 1;
          },
        });
        window.__mapxDistanceSmoke = { provider, state, startMeasurement };
        await provider.init(container, { center: { lng: 121.4737, lat: 31.2304 }, zoom: 15 });
        state.start = await startMeasurement();
        return { start: state.start, hasBMapGL: Boolean(window.BMapGL) };
      }))()`,
    );

    if (setup.value?.start?.status !== "ready") {
      throw new Error(`MapX distance measurement did not start: ${JSON.stringify(setup.value?.start)}`);
    }

    await delay(2000);
    await dispatchClick(cdp, 350, 330);
    await dispatchMouseMove(cdp, 410, 350);
    await waitForExpression(cdp, "Boolean(window.__mapxDistanceSmoke && window.__mapxDistanceSmoke.provider.distanceMeasurementSession && window.__mapxDistanceSmoke.provider.distanceMeasurementSession.previewOverlay)", DEFAULT_TIMEOUT_MS, "MapX measurement preview line");
    const previewAfterFirstPoint = await readSmokeState(cdp);
    await dispatchClick(cdp, 470, 330);
    await waitForExpression(cdp, "window.__mapxDistanceSmoke && window.__mapxDistanceSmoke.state.addedPoints.length >= 2", DEFAULT_TIMEOUT_MS, "MapX measurement cancel points");
    const beforeCancel = await readSmokeState(cdp);
    await evaluateOrThrow(cdp, "window.__mapxDistanceSmoke.provider.stopDistanceMeasurement(); true");
    await dispatchClick(cdp, 590, 390);
    await delay(500);
    const afterCancel = await readSmokeState(cdp);

    if (afterCancel.addedPointCount !== beforeCancel.addedPointCount) {
      throw new Error(`Measurement stop left active click listeners: ${JSON.stringify({ beforeCancel, afterCancel }, null, 2)}`);
    }

    const restart = await evaluateOrThrow(
      cdp,
      `(() => {
        const smoke = window.__mapxDistanceSmoke;
        smoke.state.addedPoints = [];
        smoke.state.cleared = 0;
        smoke.state.completedSet = false;
        smoke.state.completed = null;
        smoke.state.domEvents = [];
        return smoke.startMeasurement().then((start) => {
          smoke.state.start = start;
          return start;
        });
      })()`,
    );

    if (restart.value?.status !== "ready") {
      throw new Error(`MapX distance measurement did not restart: ${JSON.stringify(restart.value)}`);
    }

    await dispatchClick(cdp, 350, 330);
    await dispatchClick(cdp, 470, 330);
    await dispatchDoubleClick(cdp, 590, 390);
    try {
      await waitForExpression(cdp, "Boolean(window.__mapxDistanceSmoke && window.__mapxDistanceSmoke.state.completedSet)", DEFAULT_TIMEOUT_MS, "MapX measurement completion");
    } catch (error) {
      const diagnostics = await readSmokeState(cdp).catch((diagnosticError) => ({ diagnosticError: String(diagnosticError) }));
      throw new Error(`${error.message}: ${JSON.stringify(diagnostics, null, 2)}`);
    }

    const beforeStop = await readSmokeState(cdp);
    await evaluateOrThrow(cdp, "window.__mapxDistanceSmoke.provider.stopDistanceMeasurement(); true");
    await delay(500);
    const afterStop = await readSmokeState(cdp);
    const destroy = await evaluate(
      cdp,
      `(() => {
        try {
          window.__mapxDistanceSmoke.provider.destroy();
          return { ok: true };
        } catch (error) {
          return { ok: false, message: String(error && error.message ? error.message : error) };
        }
      })()`,
    );

    if (!destroy.value?.ok) {
      throw new Error(`Provider destroy failed after measurement completion: ${destroy.value?.message ?? "unknown error"}`);
    }

    console.log(
      JSON.stringify(
        {
          status: "passed",
          appUrl: APP_URL,
          akSource: "BAIDU_MAP_AK (redacted)",
          setup: setup.value,
          previewAfterFirstPoint,
          beforeCancel,
          afterCancel,
          beforeStop,
          afterStop,
          destroy: destroy.value,
          conclusion: {
            canStartProviderMeasurement: setup.value?.start?.status === "ready",
            canPreviewNextSegment: Boolean(previewAfterFirstPoint.previewOverlayActive),
            stopDuringDrawingRemovedListeners: afterCancel.addedPointCount === beforeCancel.addedPointCount,
            canCapturePointsAndDistance: Boolean(beforeStop.completed && beforeStop.completed.points.length >= 2 && beforeStop.completed.totalDistanceMeters > 0),
            destroyDidNotThrow: destroy.value.ok,
          },
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
  rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}

async function readSmokeState(cdp) {
  const result = await evaluateOrThrow(
    cdp,
    `(() => {
      const state = window.__mapxDistanceSmoke.state;
      const map = document.getElementById('mapx-distance-smoke-map');
      return {
        addedPointCount: state.addedPoints.length,
        cleared: state.cleared,
        completedSet: state.completedSet,
        completed: state.completed,
        previewOverlayActive: Boolean(window.__mapxDistanceSmoke.provider.distanceMeasurementSession && window.__mapxDistanceSmoke.provider.distanceMeasurementSession.previewOverlay),
        domEvents: state.domEvents,
        mapDomNodeCount: map ? map.querySelectorAll('*').length : 0,
        bodyText: document.body.innerText.slice(0, 300),
      };
    })()`,
  );

  return result.value;
}

async function dispatchMouseMove(cdp, x, y) {
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await delay(250);
}

async function dispatchClick(cdp, x, y) {
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
  await delay(250);
}

async function dispatchDoubleClick(cdp, x, y) {
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 2 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 2 });
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

  throw new Error("Chrome executable not found. Set CHROME_PATH to run MapX distance smoke tests.");
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
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? "Runtime evaluation failed");
  }

  return result.result;
}
