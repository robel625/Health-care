/**
 * Browser check for the Lab Test Template form.
 *
 * Drives the real page and asserts the Marley behaviour the form was built to
 * reproduce: the tab strip, the `depends_on` gating that decides which Result
 * Format section shows for each template type, the Sample Collection tab
 * hiding for Imaging, and the `lab_test_name` trigger that fills the item code
 * and description.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3001";
const TABS = ["Details", "Result Format", "Sample Collection", "Medical Coding", "Worksheet & Legend"];
// Marley's `lab_test_template_type` values, and the section each one reveals.
const SECTIONS = {
  Single: "Lab Routine",
  Compound: "Compound",
  Descriptive: "Descriptive Test",
  Grouped: "Group Tests",
  Imaging: "Descriptive Result",
  "No Result": null,
};

let OK = 0;
let FAIL = 0;
function check(label, cond, detail = "") {
  OK += cond ? 1 : 0;
  FAIL += cond ? 0 : 1;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? `  - ${detail}` : ""}`);
}

async function tabLabels(page) {
  // Scoped to the tab strip: the sidebar has a "Sample Collection" nav item of
  // its own, so a bare `button:has-text(...)` matches that too.
  return page.evaluate((wanted) =>
    [...document.querySelectorAll("button")]
      .filter((b) => (b.className || "").includes("border-b-2"))
      .map((b) => b.textContent.trim())
      .filter((t) => wanted.includes(t)),
    TABS
  );
}

async function headings(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("h1,h2,h3,h4")].map((h) => h.textContent?.trim())
  );
}

async function clickTab(page, label) {
  await page.locator(`button:has-text("${label}")`).last().click();
  await page.waitForTimeout(400);
}

/** Pick a value from the form's Combobox: open it, then click the option. */
async function chooseType(page, value) {
  await clickTab(page, "Result Format");
  await page.locator('button:has-text("Select..."), button:has-text("Single"), button:has-text("Compound"), button:has-text("Descriptive"), button:has-text("Grouped"), button:has-text("Imaging"), button:has-text("No Result")').first().click();
  await page.waitForTimeout(300);
  await page.locator(`[role="option"]:has-text("${value}"), li:has-text("${value}")`).first().click();
  await page.waitForTimeout(400);
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  page.on("pageerror", (e) => check("no page error", false, e.message));

  await page.goto(BASE + "/auth/login", { waitUntil: "networkidle" });
  await page.fill('input[name="username"]', "admin");
  await page.fill('input[name="password"]', "admin123");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 20000 });

  await page.goto(BASE + "/healthcare/lab-test-templates/new", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // ── The tab strip ──
  const tabs = await tabLabels(page);
  check(`all five tabs render (${tabs.length})`, TABS.every((t) => tabs.includes(t)), tabs.join(", "));

  // ── The name trigger ──
  const name = page.locator('input').first();
  await name.click();
  await name.pressSequentially("Full Blood Count", { delay: 30 });
  await page.waitForTimeout(500);
  const filled = await page.evaluate(() => {
    const vals = [...document.querySelectorAll("input")].map((i) => i.value);
    const boxes = [...document.querySelectorAll('input[type="checkbox"]')].map((c) => c.checked);
    return { vals, anyChecked: boxes.filter(Boolean).length, boxes };
  });
  check(
    "typing the test name fills the item code",
    filled.vals.includes("Full Blood Count"),
    JSON.stringify(filled.vals.filter(Boolean).slice(0, 4))
  );
  check("the name trigger ticks a checkbox (change_in_item)", filled.anyChecked > 0,
    `checked=${filled.anyChecked}`);

  // ── Gating, type by type ──
  for (const [type, section] of Object.entries(SECTIONS)) {
    await chooseType(page, type);

    const shown = await headings(page);
    if (section) {
      check(`"${type}" reveals the "${section}" section`, shown.includes(section), shown.join(" | "));
    } else {
      check(`"${type}" reveals no result section`,
        !["Lab Routine", "Compound", "Descriptive Test", "Group Tests", "Descriptive Result"].some((s) => shown.includes(s)),
        shown.join(" | "));
    }

    // The Sample Collection tab hides for Imaging only.
    const after = await tabLabels(page);
    const hasSample = after.includes("Sample Collection");
    check(`"${type}" ${type === "Imaging" ? "hides" : "keeps"} the Sample Collection tab`,
      type === "Imaging" ? !hasSample : hasSample, after.join(", "));
  }

  await browser.close();
  console.log(`\n${OK} passed, ${FAIL} failed`);
  process.exit(FAIL ? 1 : 0);
})();
