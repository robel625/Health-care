/**
 * Focus regression check for the healthcare forms.
 *
 * Logs in, then types a multi-character value into each free-text field one
 * key at a time and asserts that (a) the value accumulates and (b) the field is
 * still the document's active element afterwards. Before the fix, a `Field`
 * declared inside the page body was a new component type on every render, so
 * React remounted its subtree on each keystroke: only the first character
 * landed and the caret was gone.
 *
 * The final URL is checked too — a redirect (e.g. to sign-in) would otherwise
 * let this pass against the wrong form.
 *
 * Drives the system Chrome, so no browser download is needed.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3001";
const USER = process.env.ERP_USER || "admin";
const PASS = process.env.ERP_PASS || "admin123";

/** Each page, and how to reach the fields the user types into. */
const CASES = [
  { path: "/healthcare/patients/new", label: "Patient" },
  { path: "/healthcare/practitioners/new", label: "Practitioner" },
  { path: "/healthcare/lab-tests/new", label: "Lab Test" },
  { path: "/healthcare/lab-test-templates/new", label: "Lab Test Template" },
  { path: `/healthcare/observations/${process.env.OBS_ID || 1}`, label: "Observation" },
  { path: "/healthcare/encounters/new", label: "Encounter" },
];

async function login(page) {
  await page.goto(BASE + "/auth/login", { waitUntil: "networkidle" });
  await page.fill('input[name="username"]', USER);
  await page.fill('input[name="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 20000 });
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  const results = [];

  await login(page);
  console.log(`logged in, landed on ${new URL(page.url()).pathname}`);

  for (const c of CASES) {
    await page.goto(BASE + c.path, { waitUntil: "networkidle" });

    const landedOn = new URL(page.url()).pathname;
    const redirected = landedOn !== c.path;

    // Free-text inputs only: a date/time/number input legitimately rejects
    // letters, which would look like a failure but is correct behaviour.
    const inputs = page.locator(
      "input:not([type]):not([readonly]):not([disabled]), input[type=text]:not([readonly]):not([disabled]), textarea:not([readonly]):not([disabled])"
    );
    const count = await inputs.count();
    if (count === 0) {
      results.push({ ...c, ok: false, reason: `no editable input (landed on ${landedOn})` });
      continue;
    }

    const input = inputs.first();
    const marker = await input.evaluate((el) => ({
      name: el.getAttribute("name"),
      placeholder: el.getAttribute("placeholder"),
      type: el.getAttribute("type"),
    }));

    await input.click();
    // Clear any pre-filled value so the assertion is exact.
    await input.press("Control+a");
    await input.press("Delete");
    const prefilled = await input.inputValue();
    // pressSequentially types one key at a time, so a remount between
    // keystrokes shows up exactly as the user described.
    await input.pressSequentially("Abebe", { delay: 60 });

    const value = await input.inputValue();
    const focused = await input.evaluate((el) => document.activeElement === el);

    results.push({
      page: c.label,
      landedOn,
      redirected,
      field: JSON.stringify(marker),
      value,
      stillFocused: focused,
      ok: !redirected && prefilled === "" && value === "Abebe" && focused,
    });
  }

  await browser.close();

  let failed = 0;
  for (const r of results) {
    const status = r.ok ? "PASS" : "FAIL";
    if (!r.ok) failed++;
    console.log(`\n${status}  ${r.page}  (landed on ${r.landedOn}${r.redirected ? "  <-- REDIRECTED" : ""})`);
    console.log(`      field: ${r.field}`);
    console.log(`      value=${JSON.stringify(r.value)}  stillFocused=${r.stillFocused}`);
    if (r.reason) console.log(`      reason: ${r.reason}`);
  }
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
