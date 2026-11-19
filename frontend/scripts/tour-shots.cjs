/*
 * Tour screenshots: walks the app in the order a first-time reader would,
 * from the sign-in page to every screen, and saves numbered screenshots to
 * docs/screenshots/tour/. The README's Screenshots section shows these.
 *
 * Run against a fresh local server with demo accounts on (DEMO_ACCOUNTS=1).
 * The tour approves the quote-matched claims, so the handover has content.
 *
 *   node frontend/scripts/tour-shots.cjs http://localhost:8000
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = (process.argv[2] || "http://localhost:8000").replace(/\/+$/, "");
const PASSWORD = process.env.DEMO_PASSWORD || "backstop-demo";
const ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD || "admin";
const OUT = path.join(__dirname, "..", "..", "docs", "screenshots", "tour");
const VIEWPORT = { width: 1440, height: 900 };

let page;
const shot = async (name, opts = {}) => {
  await page.waitForTimeout(opts.wait ?? 700);
  const file = path.join(OUT, `${name}.jpg`);
  if (opts.locator) await opts.locator.screenshot({ path: file, type: "jpeg", quality: 85 });
  else await page.screenshot({ path: file, type: "jpeg", quality: 85, fullPage: !!opts.full });
  console.log("saved", path.relative(process.cwd(), file));
};
const go = async (tab) => {
  await page.goto(`${BASE}/#/${tab}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
};
const scrollWalk = () =>
  page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 100));
    }
    window.scrollTo(0, 0);
  });

async function signIn(loginPath, user, password, before) {
  await page.goto(BASE + loginPath, { waitUntil: "networkidle" });
  await page.getByLabel("Username").fill(user);
  await page.getByLabel("Password").fill(password);
  if (before) await before();
  await page.locator('button[type="submit"]').click();
  await page.waitForFunction(() => !["/login", "/admin/login"].includes(location.pathname), null, { timeout: 15000 });
  await page.waitForLoadState("networkidle");
}

async function newSession(browser) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  page = await ctx.newPage();
  return ctx;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  // ---- Lead: the main walkthrough ----
  let ctx = await newSession(browser);
  await signIn("/login", "lead", PASSWORD, () => shot("01-team-sign-in", { wait: 200 }));

  await go("overview");
  await shot("02-overview");

  await go("records");
  await shot("03-records");
  await scrollWalk();
  const map = page.locator('section[aria-labelledby="map-h"]');
  await map.scrollIntoViewIfNeeded();
  await shot("04-repository-map", { locator: map, wait: 1500 });
  const replay = page.getByRole("button", { name: /Replay history/ });
  if (await replay.count()) {
    await replay.first().click();
    await page.waitForTimeout(2500);
    await shot("05-repository-map-replay", { locator: map, wait: 0 });
  }
  await page.evaluate(() => window.scrollTo(0, 0));

  await go("review");
  await shot("06-check-the-claims");
  const conflict = page.locator("li, button, [role=option]").filter({ hasText: /^#\d+\s*Conflicting/ }).first();
  const conflictRow = (await conflict.count()) ? conflict : page.getByText("Conflicting", { exact: true }).nth(1);
  await conflictRow.click();
  await shot("07-conflicting-claim");

  await page.getByRole("button", { name: /Reject/ }).first().click();
  await page.getByLabel("Why is it wrong?").fill("Kabir took over payments in January; this is out of date.");
  await shot("08-reject-with-reason");
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.locator("#approve-all-btn").click();
  await shot("09-approve-all-dialog");
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /Approve/ }).last().click();
  await page.waitForLoadState("networkidle");
  await shot("10-claims-approved", { wait: 1500 });

  await go("debrief");
  await shot("11-debrief-questions");

  await go("handover");
  await shot("12-handover-new-developer", { wait: 1200 });
  await page.getByRole("radio", { name: /New project manager/ }).first().click();
  await shot("13-handover-new-pm", { wait: 1200 });
  await page.getByRole("radio", { name: /^Lead/ }).first().click();
  await shot("14-handover-lead", { wait: 1200 });
  await page.getByRole("button", { name: /Sign for receipt/ }).first().click();
  await shot("15-sign-for-receipt");
  await page.keyboard.press("Escape");

  await go("check");
  await page.getByRole("button", { name: "Rewrite the deploy scripts" }).click();
  await page.getByRole("button", { name: /Check the change/ }).click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  await page.getByText(/tripwires? matched/).first().evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 90));
  await shot("16-check-a-change", { wait: 600 });
  const replaySummary = page.getByText("Do tripwires work? Replay on past history");
  if (await replaySummary.count()) {
    await replaySummary.click();
    await page.waitForLoadState("networkidle");
    await replaySummary.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 90));
    await shot("17-tripwire-replay", { wait: 1200 });
  }

  await go("backtest");
  await scrollWalk();
  await shot("18-backtest", { wait: 1500 });

  await go("trust");
  await scrollWalk();
  await shot("19-trust-report", { wait: 1500 });

  await go("projects");
  await shot("20-projects");

  await go("overview");
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(300);
  await page.keyboard.type("payments");
  await shot("21-search-palette");
  await page.keyboard.press("Escape");
  await ctx.close();

  // ---- Newcomer: what a developer may and may not see ----
  ctx = await newSession(browser);
  await signIn("/login", "dev", PASSWORD);
  await go("handover");
  await shot("22-dev-handover", { wait: 1200 });
  await go("review");
  await shot("23-dev-locked-screen");
  await ctx.close();

  // ---- Admin ----
  ctx = await newSession(browser);
  await signIn("/admin/login", "admin", ADMIN_PASSWORD, () => shot("24-admin-sign-in", { wait: 200 }));
  await go("accounts");
  await shot("25-admin-accounts");
  await ctx.close();

  // ---- Phone width ----
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page = await ctx.newPage();
  await signIn("/login", "lead", PASSWORD);
  await go("review");
  await shot("26-phone-check-the-claims");
  await go("handover");
  await shot("27-phone-handover", { wait: 1200 });
  await ctx.close();

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
