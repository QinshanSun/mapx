#!/usr/bin/env node

const DEFAULT_AK = "invalid-ak";

const OBSERVED_RUNTIME_DOMAINS = {
  script: ["api.map.baidu.com", "dlswbr.baidu.com"],
  style: ["api.map.baidu.com"],
  img: [
    "api.map.baidu.com",
    "webmap0.bdimg.com",
    "apimaponline0.bdimg.com",
    "apimaponline1.bdimg.com",
    "apimaponline2.bdimg.com",
    "apimaponline3.bdimg.com",
  ],
  connect: ["api.map.baidu.com", "reports.baidu.com"],
};

const ak = process.env.BAIDU_MAP_AK?.trim() || DEFAULT_AK;
const akSource = ak === DEFAULT_AK ? "placeholder invalid-ak" : "BAIDU_MAP_AK (redacted)";

function redactAk(rawUrl) {
  const url = new URL(rawUrl, "https://api.map.baidu.com");
  if (url.searchParams.has("ak")) {
    url.searchParams.set("ak", "<redacted>");
  }
  return url.toString();
}

async function fetchText(rawUrl) {
  const response = await fetch(rawUrl, {
    headers: {
      "user-agent": "MapX MAP-006 domain capture",
    },
  });
  if (!response.ok) {
    throw new Error(`Request failed ${response.status} for ${redactAk(rawUrl)}`);
  }
  return response.text();
}

function unique(values) {
  return [...new Set(values)].sort();
}

function extractResourceUrls(text) {
  const urls = [];
  const patterns = [
    /https?:\/\/[^'"\s)<>]+/g,
    /\/\/[^'"\s)<>]+/g,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const value = match[0].startsWith("//") ? `https:${match[0]}` : match[0];
      try {
        urls.push(new URL(value).toString());
      } catch {
        // Ignore strings that look URL-ish inside minified third-party code.
      }
    }
  }

  return unique(urls);
}

function hostnamesFrom(urls) {
  return unique(urls.map((url) => new URL(url).hostname).filter((host) => host.includes(".")));
}

function isBaiduResourceHost(host) {
  return ["baidu.com", "bdimg.com", "bdstatic.com", "bcebos.com"].some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

function findGetScriptUrl(loaderJs) {
  return extractResourceUrls(loaderJs).find((url) => new URL(url).pathname === "/getscript");
}

function findCssUrl(loaderJs) {
  return extractResourceUrls(loaderJs).find((url) => url.endsWith("/res/webgl/10/bmap.css"));
}

const loaderUrl = new URL("https://api.map.baidu.com/api");
loaderUrl.searchParams.set("v", "1.0");
loaderUrl.searchParams.set("type", "webgl");
loaderUrl.searchParams.set("ak", ak);
loaderUrl.searchParams.set("callback", "initMap");

const loaderJs = await fetchText(loaderUrl.toString());
const getScriptUrl = findGetScriptUrl(loaderJs);
const cssUrl = findCssUrl(loaderJs);

if (!getScriptUrl || !cssUrl) {
  throw new Error("Baidu loader did not expose getscript and bmap.css URLs");
}

const [getScriptJs, css] = await Promise.all([fetchText(getScriptUrl), fetchText(cssUrl)]);

const loaderResources = extractResourceUrls(loaderJs);
const scriptResources = extractResourceUrls(getScriptJs);
const cssResources = extractResourceUrls(css);
const extractedBaiduHosts = hostnamesFrom([
  loaderUrl.toString(),
  getScriptUrl,
  cssUrl,
  ...loaderResources,
  ...scriptResources,
  ...cssResources,
]).filter(isBaiduResourceHost);

const output = {
  generatedAt: new Date().toISOString(),
  akSource,
  fetched: [redactAk(loaderUrl.toString()), redactAk(getScriptUrl), redactAk(cssUrl)],
  extractedBaiduHosts,
  recommendedProductionDomains: OBSERVED_RUNTIME_DOMAINS,
  cspDraft: {
    "default-src": ["'self'"],
    "script-src": ["'self'", ...OBSERVED_RUNTIME_DOMAINS.script.map((host) => `https://${host}`)],
    "style-src": ["'self'", "'unsafe-inline'", ...OBSERVED_RUNTIME_DOMAINS.style.map((host) => `https://${host}`)],
    "img-src": ["'self'", "data:", ...OBSERVED_RUNTIME_DOMAINS.img.map((host) => `https://${host}`)],
    "connect-src": ["'self'", ...OBSERVED_RUNTIME_DOMAINS.connect.map((host) => `https://${host}`)],
  },
  notes: [
    "The script never prints the AK value.",
    "Use BAIDU_MAP_AK for a real capture; without it the result is useful for loader/static-resource evidence only.",
    "The production recommendation intentionally uses explicit hosts, not wildcard domains.",
  ],
};

console.log(JSON.stringify(output, null, 2));
