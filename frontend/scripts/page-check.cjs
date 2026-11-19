/*
 * Page check: signs in as each demo account, opens every page at desktop and
 * phone width, and reports console errors, failed API calls and sideways
 * scrolling. With --shots it also saves screenshots to docs/screenshots/.
 *
 *   npm i -g playwright   (or any install that `require("playwright")` finds)
 *   node frontend/scripts/page-check.cjs http://localhost:8000 --shots
 *
 * Exit code 1 when any page has a problem.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = (process.argv[2] || "http://localhost:8000").replace(/\/+$/, "");
const SHOTS = process.argv.includes("--shots");
const PASSWORD = process.env.DEMO_PASSWORD || "backstop-demo";
const ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD || "admin";
const OUT = path.join(__dirname, "..", "..", "docs", "screenshots");

const ACCOUNTS = [
  { user: "lead", login: "/login", password: PASSWORD,
    pages: ["overview", "projects", "records", "review", "debrief", "handover", "check", "backtest", "trust"] },
  { user: "dev", login: "/login", password: PASSWORD, pages: ["overview", "handover", "check", "review"] },
  { user: "pm", login: "/login", password: PASSWORD, pages: ["handover"] },
  { user: "admin", login: "/admin/login", password: ADMIN_PASSWORD, pages: ["accounts", "overview"] },
];
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 390, height: 844 },
];

async function signIn(page, acct, attempt = 1) {
  await page.goto(BASE + acct.login, { waitUntil: "networkidle" });
  await page.getByLabel("Username").fill(acct.user);
  await page.getByLabel("Password").fill(acct.password);
  const answer = page.waitForResponse((r) => r.url().includes("/api/auth/") && r.request().method() === "POST");
  await page.locator('button[type="submit"]').click();
  // Sign-in allows 10 attempts a minute per address; wait the minute out once if a run trips it.
  if ((await answer).status() === 429 && attempt === 1) {
    await page.waitForTimeout(61000);
    return signIn(page, acct, 2);
  }
  await page.waitForFunction(() => !["/login", "/admin/login"].includes(location.pathname), null, { timeout: 15000 });
}

(async () => {
  if (SHOTS) fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const problems = [];
  let checked = 0;

  for (const vp of VIEWPORTS) {
    // Sign-in pages, signed out.
    for (const p of ["/login", "/admin/login"]) {
      const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      await page.goto(BASE + p, { waitUntil: "networkidle" });
      checked++;
      if (SHOTS) await page.screenshot({ path: path.join(OUT, `${vp.name}-${p.replace(/\//g, "-").slice(1)}.jpg`), type: "jpeg", quality: 82 });
      await ctx.close();
    }

    for (const acct of ACCOUNTS) {
      const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      let errors = [];
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      page.on("pageerror", (e) => errors.push(String(e)));
      page.on("response", (r) => {
        // 401/403 on a page the role may not open is expected; anything 5xx is not.
        if (r.url().includes("/api/") && r.status() >= 500) errors.push(`${r.status()} ${r.url()}`);
      });

      await signIn(page, acct);
      for (const tab of acct.pages) {
        errors = [];
        await page.goto(`${BASE}/#/${tab}`, { waitUntil: "networkidle" });
        await page.waitForTimeout(600);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (overflow > 1) errors.push(`page scrolls sideways by ${overflow}px`);
        const label = `${vp.name} ${acct.user} #/${tab}`;
        checked++;
        if (errors.length) problems.push({ page: label, errors: [...new Set(errors)] });
        if (SHOTS && vp.name === "desktop") {
          // Walk down the page so sections that reveal on scroll are drawn in the full-page shot.
          await page.evaluate(async () => {
            for (let y = 0; y < document.body.scrollHeight; y += 400) {
              window.scrollTo(0, y);
              await new Promise((r) => setTimeout(r, 120));
            }
            window.scrollTo(0, 0);
          });
          await page.waitForTimeout(1500);
        }
        if (SHOTS) await page.screenshot({ path: path.join(OUT, `${vp.name}-${acct.user}-${tab}.jpg`), type: "jpeg", quality: 82, fullPage: vp.name === "desktop" });
      }
      await ctx.close();
    }
  }
  await browser.close();

  console.log(`Checked ${checked} page views.`);
  for (const p of problems) console.log(`\n${p.page}\n  - ${p.errors.join("\n  - ")}`);
  console.log(problems.length ? `\n${problems.length} page views with problems.` : "No problems found.");
  process.exit(problems.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
