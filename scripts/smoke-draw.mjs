import { chromium } from "playwright-core";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForTimeout(700);
if (await page.getByRole("button", { name: "Aplicar alterações" }).count()) {
  await page.getByRole("button", { name: "Aplicar alterações" }).click();
  await page.waitForTimeout(500);
}
await page.getByRole("button", { name: "Ir para a escala" }).click();
await page.waitForTimeout(300);
const stage = page.locator(".stage");
const box = await stage.boundingBox();
const click = (x, y) => page.mouse.click(box.x + x, box.y + y);
await page.getByRole("button", { name: "Escala", exact: true }).click();
await click(240, 180);
await click(440, 180);
await page.waitForTimeout(200);
await page.getByRole("button", { name: "Continuar para o desenho" }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Área", exact: true }).click();
await page.waitForTimeout(150);
const picker = await page.locator(".area-picker").innerText();
await page.getByRole("button", { name: /Área útil/ }).click();
await click(200, 220);
await click(420, 220);
await click(420, 400);
await click(200, 400);
await click(200, 220);
await page.waitForTimeout(400);
const notice = await page.locator(".notice").innerText();
const chip = await page.locator(".list-item .chip").first().innerText().catch(() => "");
const height = await page.locator(".list-item input").nth(1).inputValue().catch(() => "");
const label = await page.locator("svg text").allInnerTexts();
await page.screenshot({ path: "scripts/smoke-ui.png" });
console.log(JSON.stringify({ picker, notice, chip, height, label, errors }, null, 2));
await browser.close();
