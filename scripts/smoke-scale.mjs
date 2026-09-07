import { chromium } from "playwright-core";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
page.on("pageerror", (err) => logs.push(err.message));

await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
if (await page.getByRole("button", { name: "Usar modelo01.png" }).count()) {
  await page.getByRole("button", { name: "Usar modelo01.png" }).click();
  await page.waitForTimeout(800);
}
if (await page.getByRole("button", { name: "Aplicar alterações" }).count()) {
  await page.getByRole("button", { name: "Aplicar alterações" }).click();
  await page.waitForTimeout(600);
}
await page.getByRole("button", { name: /Calibrar/ }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: "Escala", exact: true }).click();
if (await page.getByRole("button", { name: "Limpar", exact: true }).count()) {
  await page.getByRole("button", { name: "Limpar", exact: true }).first().click();
  await page.waitForTimeout(200);
}

const stage = page.locator(".stage");
const box = await stage.boundingBox();
const click = async (x, y) => {
  await page.mouse.click(box.x + x, box.y + y);
};
await click(220, 200);
await page.waitForTimeout(150);
await click(420, 200);
await page.waitForTimeout(300);

const afterMark = await page.locator(".notice").innerText();
const labels = await page.locator("svg text").allInnerTexts();

await page.getByRole("button", { name: "Conferir escala" }).click();
await page.waitForTimeout(250);
const afterCheck = {
  notice: await page.locator(".notice").innerText(),
  labels: await page.locator("svg text").allInnerTexts(),
  chip: await page.locator(".chip.ok, .chip.bad").allInnerTexts(),
};
await page.screenshot({ path: "scripts/smoke-scale-check.png" });

await page.getByRole("button", { name: "Limpar", exact: true }).first().click();
await page.waitForTimeout(200);
const afterClear = {
  notice: await page.locator(".notice").innerText(),
  chip: await page.locator(".chip.bad, .chip.ok").first().innerText(),
};

await page.screenshot({ path: "scripts/smoke-ui.png" });
console.log(JSON.stringify({ afterMark, labels, afterCheck, afterClear, logs }, null, 2));
await browser.close();
