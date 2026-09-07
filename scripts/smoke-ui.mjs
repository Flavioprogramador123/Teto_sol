import { chromium } from "playwright-core";

const url = "http://localhost:5173/";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
page.on("console", (msg) => logs.push(`${msg.type()}: ${msg.text()}`));
page.on("pageerror", (err) => logs.push(`pageerror: ${err.message}`));
page.on("response", (res) => {
  if (res.status() >= 400) logs.push(`http ${res.status()}: ${res.url()}`);
});

await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(1200);

const before = {
  title: await page.title(),
  heading: await page.locator(".sidebar h2").innerText(),
  step: await page.locator(".step.active").innerText(),
  notice: await page.locator(".notice").first().innerText().catch(() => ""),
  cropLabel: await page.locator("svg text").first().innerText().catch(() => ""),
  status: await page.locator(".statusbar").innerText(),
};

await page.getByRole("button", { name: "Aplicar alterações" }).click();
await page.waitForTimeout(1500);

const after = {
  heading: await page.locator(".sidebar h2").innerText(),
  notice: await page.locator(".notice").first().innerText().catch(() => ""),
  status: await page.locator(".statusbar").innerText(),
  step: await page.locator(".step.active").innerText(),
};

await page.screenshot({ path: "scripts/smoke-ui.png", fullPage: true });
console.log(JSON.stringify({ before, after, logs }, null, 2));
await browser.close();
