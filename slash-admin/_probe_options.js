/** After a successful DELETE, does the page refetch — and what does it get? */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3001";
const NAME = "ZZ Probe Group";

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  page.on("dialog", (d) => d.accept());
  page.on("console", (m) => { if (m.type() === "error") console.log("  CONSOLE ERROR:", m.text().slice(0, 200)); });
  page.on("response", async (r) => {
    if (!r.url().includes("item-groups")) return;
    let n = "";
    try { const b = await r.json(); n = Array.isArray(b?.results) ? ` results=${b.results.length}` : ""; } catch {}
    console.log(`  ${r.request().method()} ${r.status()}${n}  ${r.url().replace(BASE, "")}`);
  });

  await page.goto(BASE + "/auth/login", { waitUntil: "networkidle" });
  await page.fill('input[name="username"]', "admin");
  await page.fill('input[name="password"]', "admin123");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 20000 });

  await page.goto(BASE + "/erp/item-groups", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  console.log("-- create --");
  await page.click('button:has-text("New Item Group")');
  await page.waitForSelector('input[placeholder="e.g. Biochemistry"]');
  await page.fill('input[placeholder="e.g. Biochemistry"]', NAME);
  await page.click('button:has-text("Create")');
  await page.waitForTimeout(2000);

  console.log("-- delete --");
  await page.locator(`tbody tr:has-text("${NAME}")`).first().locator("button").last().click();
  await page.waitForTimeout(4000);

  const rows = await page.evaluate(() =>
    [...document.querySelectorAll("tbody tr")].map((r) => (r.textContent || "").trim().slice(0, 24))
  );
  console.log("rows:", JSON.stringify(rows));

  console.log("-- reload --");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const rows2 = await page.evaluate(() =>
    [...document.querySelectorAll("tbody tr")].map((r) => (r.textContent || "").trim().slice(0, 24))
  );
  console.log("rows after reload:", JSON.stringify(rows2));

  await browser.close();
})();
