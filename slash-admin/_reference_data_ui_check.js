/**
 * Checks that the Lab Test Template's Department and Item Group pickers are fed
 * by reference data — i.e. that a value managed on the reference/master pages is
 * the value the form offers.
 *
 * Also covers the two surfaces that were missing: the reference-data cards, and
 * the new Item Groups page at /erp/item-groups.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3001";
const NEW_GROUP = process.env.NEW_GROUP || "ZZ Probe Group";

let OK = 0;
let FAIL = 0;
function check(label, cond, detail = "") {
  OK += cond ? 1 : 0;
  FAIL += cond ? 0 : 1;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? `  - ${detail}` : ""}`);
}

async function login(page) {
  await page.goto(BASE + "/auth/login", { waitUntil: "networkidle" });
  await page.fill('input[name="username"]', "admin");
  await page.fill('input[name="password"]', "admin123");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 20000 });
}

const OPEN_POPOVER = '[data-slot="popover-content"][data-state="open"]';

/**
 * The form field whose label is `label` — not the nav link that shares its name.
 *
 * The row has to be labelled by `label` *and* carry more than this one button:
 * the sidebar has a plain "Departments" link and now an "Item Groups" one, and
 * those match a bare `startsWith` just as well as the field's
 * "Department *Select..." row does. On a field row the button's own text is the
 * placeholder, so row text and button text differ; on a link they are the same.
 */
async function comboboxFor(page, label) {
  const idx = await page.evaluate((lbl) => {
    const btns = [...document.querySelectorAll('button[type="button"]')];
    return btns.findIndex((b) => {
      const own = (b.textContent || "").trim();
      let row = b.parentElement;
      for (let i = 0; i < 3 && row; i++, row = row.parentElement) {
        const text = (row.textContent || "").trim();
        if (text.startsWith(lbl) && text !== own) return true;
      }
      return false;
    });
  }, label);
  if (idx < 0) return null;
  return page.locator('button[type="button"]').nth(idx);
}

async function optionsFor(page, label) {
  // A popover from the previous check keeps its overlay on screen while it
  // animates out, and that overlay swallows the next click — so make sure the
  // stage is clear before clicking, and confirm the popover really opened
  // rather than trusting a fixed delay.
  await page.waitForSelector(OPEN_POPOVER, { state: "detached", timeout: 2000 }).catch(() => {});

  const trigger = await comboboxFor(page, label);
  if (!trigger) return null;

  let opts = [];
  for (let attempt = 0; attempt < 2 && opts.length === 0; attempt++) {
    await trigger.click();
    const opened = await page
      .waitForSelector(OPEN_POPOVER, { timeout: 4000 })
      .then(() => true)
      .catch(() => false);
    if (opened) {
      // Radix leaves a closed popover mounted, so its items are still in the DOM
      // — read only from the one that is open, or the previous field's options
      // get mixed in.
      opts = await page.evaluate(() => {
        const open = document.querySelector('[data-slot="popover-content"][data-state="open"]');
        return [...(open?.querySelectorAll("[cmdk-item]") ?? [])].map((o) => o.textContent?.trim());
      });
    }
    await page.keyboard.press("Escape");
    await page.waitForSelector(OPEN_POPOVER, { state: "detached", timeout: 3000 }).catch(() => {});
  }
  return opts;
}

/** Wait until the table stops showing a group by this name. */
async function waitForGroup(page, name, present) {
  await page
    .waitForFunction(
      ([n, want]) =>
        [...document.querySelectorAll("tbody tr")].some((r) =>
          (r.textContent || "").includes(n)
        ) === want,
      [name, present],
      { timeout: 10000 }
    )
    .catch(() => {});
}

/** Create a group through the new page's own dialog. */
async function createGroupOnPage(page, name) {
  await page.goto(BASE + "/erp/item-groups", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.click('button:has-text("New Item Group")');
  await page.waitForSelector('input[placeholder="e.g. Biochemistry"]', { timeout: 5000 });
  await page.fill('input[placeholder="e.g. Biochemistry"]', name);
  await page.click('button:has-text("Create")');
  await waitForGroup(page, name, true);
}

async function groupNames(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("tbody tr")]
      .map((r) => (r.textContent || "").trim())
      .filter((t) => t.length > 0)
  );
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  page.on("pageerror", (e) => check("no page error", false, e.message));
  page.on("dialog", (d) => d.accept()); // the page's delete confirmation

  await login(page);

  // ── reference-data: the two cards ──
  await page.goto(BASE + "/healthcare/reference-data", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  const cards = await page.evaluate(() =>
    [...document.querySelectorAll("h3, a")].map((e) => e.textContent?.trim()).filter(Boolean)
  );
  check("reference-data shows the Departments card", cards.includes("Departments"), cards.length + " entries");
  check("reference-data shows the Item Groups card", cards.includes("Item Groups"));

  const counts = await page.evaluate(() => {
    const out = {};
    for (const card of document.querySelectorAll("div")) {
      const h = card.querySelector(":scope > div > div > a, :scope > div > div > h3");
      const n = card.querySelector(":scope > div > span");
      if (h && n && /^\d+ items$/.test(n.textContent.trim())) out[h.textContent.trim()] = n.textContent.trim();
    }
    return out;
  });
  check("Departments card lists real departments", /^(1[0-9]|[1-9]) items$/.test(counts["Departments"] || ""), counts["Departments"]);
  check("Item Groups card lists real groups", /^([1-9]|[1-9][0-9]) items$/.test(counts["Item Groups"] || ""), counts["Item Groups"]);

  const deptHref = await page.evaluate(() => {
    const a = [...document.querySelectorAll("a")].find((x) => x.textContent?.trim() === "Departments");
    return a?.getAttribute("href") || null;
  });
  check("Departments card links to the full page", deptHref === "/healthcare/departments", String(deptHref));

  // ── the new Item Groups page ──
  await page.goto(BASE + "/erp/item-groups", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const rows = await groupNames(page);
  check("/erp/item-groups renders", rows.length > 0, `${rows.length} rows`);
  check("the page lists item groups from the API",
    rows.some((r) => r.includes("Biochemistry")),
    rows.find((r) => r.includes("Biochemistry")) || rows[0] || "none");

  // ── the point of it all: a group made on the page reaches the form ──
  await createGroupOnPage(page, NEW_GROUP);
  const afterCreate = await groupNames(page);
  check(`the page creates "${NEW_GROUP}"`, afterCreate.some((r) => r.includes(NEW_GROUP)));

  await page.goto(BASE + "/healthcare/lab-test-templates/new", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  const itemGroupOpts = await optionsFor(page, "Item Group");
  check("Item Group dropdown opens", Array.isArray(itemGroupOpts) && itemGroupOpts.length > 0,
    `${itemGroupOpts?.length ?? 0} options`);
  check("dropdown offers the groups from /stock/item-groups/",
    (itemGroupOpts || []).includes("Biochemistry"), JSON.stringify((itemGroupOpts || []).slice(0, 5)));
  check(`dropdown offers the group just created on the page ("${NEW_GROUP}")`,
    (itemGroupOpts || []).includes(NEW_GROUP));

  const deptOpts = await optionsFor(page, "Department");
  check("Department dropdown offers the departments from /healthcare/departments/",
    (deptOpts || []).includes("Cardiology"),
    `${deptOpts?.length ?? 0} options: ${JSON.stringify((deptOpts || []).slice(0, 5))}`);

  // ── deleting on the page takes it back out of the form ──
  await page.goto(BASE + "/erp/item-groups", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const row = page.locator(`tbody tr:has-text("${NEW_GROUP}")`).first();
  await row.locator("button").last().click();
  // The delete goes through a confirm dialog and a refetch; wait for the row to
  // actually leave rather than guessing at a delay.
  await waitForGroup(page, NEW_GROUP, false);
  const afterDelete = await groupNames(page);
  check(`the page deletes "${NEW_GROUP}"`, !afterDelete.some((r) => r.includes(NEW_GROUP)));

  await browser.close();
  console.log(`\n${OK} passed, ${FAIL} failed`);
  process.exit(FAIL ? 1 : 0);
})();
