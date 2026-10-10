import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const profile = mkdtempSync(join(tmpdir(), "lifeevent-edge-"));
const port = 9339;
const appUrl = process.env.UI_BASE_URL ?? "http://127.0.0.1:3000";
const child = spawn(edge, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "about:blank",
], { stdio: "ignore", windowsHide: true });

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForDebugger() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json`);
      if (response.ok) return response.json();
    } catch { /* browser is starting */ }
    await delay(250);
  }
  throw new Error("Edge remote debugger did not start");
}

async function session(target) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    id += 1;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  return { socket, send };
}

async function capture(send, { url, file, width, height, mobile, waitMs = 2500, afterNavigate }) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
    screenWidth: width,
    screenHeight: height,
  });
  await send("Page.enable");
  await send("Page.navigate", { url });
  await delay(waitMs);
  if (afterNavigate) {
    await send("Runtime.evaluate", { expression: afterNavigate, awaitPromise: true, returnByValue: true });
    await delay(1200);
  }
  const layout = await send("Runtime.evaluate", {
    expression: "({innerWidth, scrollWidth: document.documentElement.scrollWidth, title: document.title})",
    returnByValue: true,
  });
  const screenshot = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
    fromSurface: true,
  });
  writeFileSync(file, Buffer.from(screenshot.data, "base64"));
  console.log(`${file}: viewport=${layout.result.value.innerWidth}, scrollWidth=${layout.result.value.scrollWidth}`);
}

try {
  const targets = await waitForDebugger();
  const page = targets.find((target) => target.type === "page");
  if (!page) throw new Error("No Edge page target found");
  const { socket, send } = await session(page);
  await capture(send, { url: `${appUrl}/login`, file: "mobile-login.png", width: 390, height: 844, mobile: true });
  await capture(send, { url: `${appUrl}/login`, file: "desktop-login.png", width: 1440, height: 1000, mobile: false });
  await send("Runtime.evaluate", {
    expression: `fetch('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'demo',password:'demo1234'})}).then(r=>r.json())`,
    awaitPromise: true,
    returnByValue: true,
  });
  await capture(send, { url: `${appUrl}/`, file: "mobile-home.png", width: 390, height: 844, mobile: true });
  await capture(send, {
    url: `${appUrl}/?goal=${encodeURIComponent("بدي أجدد هويتي")}`,
    file: "mobile-unsupported.png",
    width: 390,
    height: 844,
    mobile: true,
    afterNavigate: "document.querySelector('form[aria-label=\"وصف هدف المشروع\"]')?.requestSubmit()",
  });
  await capture(send, {
    url: `${appUrl}/?goal=${encodeURIComponent("عقد الاجيار المصدق")}`,
    file: "mobile-rag-phrase.png",
    width: 390,
    height: 844,
    mobile: true,
    afterNavigate: "document.querySelector('form[aria-label=\"وصف هدف المشروع\"]')?.requestSubmit()",
  });
  await capture(send, {
    url: `${appUrl}/?goal=${encodeURIComponent("بدي أفتح كشك قهوة بخلدا")}`,
    file: "mobile-random-service.png",
    width: 390,
    height: 844,
    mobile: true,
    afterNavigate: "document.querySelector('form[aria-label=\"وصف هدف المشروع\"]')?.requestSubmit()",
  });
  await capture(send, { url: `${appUrl}/?mode=ask`, file: "mobile-ask.png", width: 390, height: 844, mobile: true });
  await capture(send, { url: `${appUrl}/explore?goal=${encodeURIComponent("بدي أفتح محل حلويات بخلدا")}`, file: "mobile-explore.png", width: 390, height: 844, mobile: true, waitMs: 2500 });
  await capture(send, {
    url: `${appUrl}/journey?activityId=clothing-retail&municipalityId=amman&legalForm=sole-proprietorship&premisesTenure=rent`,
    file: "mobile-journey.png",
    width: 390,
    height: 844,
    mobile: true,
  });
  await capture(send, { url: `${appUrl}/sources`, file: "mobile-sources.png", width: 390, height: 844, mobile: true });
  await capture(send, { url: `${appUrl}/`, file: "desktop-home.png", width: 1440, height: 1000, mobile: false });
  await capture(send, {
    url: `${appUrl}/?goal=${encodeURIComponent("بدي أجدد هويتي")}`,
    file: "desktop-unsupported.png",
    width: 1440,
    height: 1000,
    mobile: false,
    afterNavigate: "document.querySelector('form[aria-label=\"وصف هدف المشروع\"]')?.requestSubmit()",
  });
  await capture(send, { url: `${appUrl}/explore?goal=${encodeURIComponent("بدي أفتح محل حلويات بخلدا")}`, file: "desktop-explore.png", width: 1440, height: 1000, mobile: false, waitMs: 2500 });
  await capture(send, {
    url: `${appUrl}/journey?activityId=clothing-retail&municipalityId=amman&legalForm=sole-proprietorship&premisesTenure=rent`,
    file: "desktop-journey.png",
    width: 1440,
    height: 1000,
    mobile: false,
  });
  socket.close();
} finally {
  child.kill();
  await delay(1000);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      rmSync(profile, { recursive: true, force: true });
      break;
    } catch (error) {
      if (attempt === 4) console.warn(`تعذر تنظيف مجلد Edge المؤقت: ${error.message}`);
      else await delay(500);
    }
  }
}
