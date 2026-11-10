// Records a walkthrough video of LendLoop with Playwright.
// Needs the app on BASE_URL, Convex, n8n, and the demo users (pnpm demo-users).
// Usage: node scripts/record-demo.mjs  ->  demo/*.webm (convert with ffmpeg)
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3001";
const PASSWORD = process.env.DEMO_PASSWORD ?? "lendloop-demo-2026";
const size = { width: 1440, height: 900 };

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: size, recordVideo: { dir: "demo", size } });
const page = await context.newPage();
const pause = (ms = 1600) => page.waitForTimeout(ms);

/** On-screen caption so the viewer knows what each step shows. */
async function caption(text) {
  for (let i = 0; i < 5; i++) {
    try {
      await page.waitForLoadState("domcontentloaded");
      return await showCaption(text);
    } catch {
      await page.waitForTimeout(500);
    }
  }
}

async function showCaption(text) {
  await page.evaluate((t) => {
    let el = document.getElementById("demo-caption");
    if (!el) {
      el = document.createElement("div");
      el.id = "demo-caption";
      Object.assign(el.style, {
        position: "fixed", left: "50%", bottom: "28px", transform: "translateX(-50%)", zIndex: "99999",
        background: "#f2c230", color: "#1a2a20", padding: "12px 22px", borderRadius: "8px",
        font: "600 20px var(--font-archivo), system-ui, sans-serif", boxShadow: "0 6px 24px rgba(0,0,0,.35)",
        maxWidth: "80vw", textAlign: "center", pointerEvents: "none",
      });
      document.body.appendChild(el);
    }
    el.textContent = t;
  }, text);
}

async function go(path, text) {
  await page.goto(BASE + path);
  await page.waitForLoadState("networkidle");
  await pause(1200);
  if (text) await caption(text);
}

async function signIn(email) {
  await page.locator("header").getByRole("button", { name: /Sign in/ }).click();
  await page.getByRole("textbox", { name: "Email address" }).pressSequentially(email, { delay: 25 });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await pause(2000);
  const pw = page.getByPlaceholder("Enter your password");
  if (await pw.isVisible()) {
    await pw.fill(PASSWORD);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await pause(2500);
  }
  if (await page.getByText("Check your email").isVisible().catch(() => false)) {
    await page.keyboard.type("424242", { delay: 60 });
  }
  await page.locator("header").getByRole("link", { name: "My listings" }).waitFor({ timeout: 20000 });
  await pause(1500);
}

async function signOut() {
  await page.evaluate(() => {
    document.getElementById("demo-caption")?.remove();
    return window.Clerk.signOut();
  });
  await pause(2000);
}

// 1. Public board
await go("/", "Signed out: the public board shows tool name and category only");
await pause(2500);
await page.getByRole("button", { name: /^Garden/ }).click();
await caption("Filter by category");
await pause(2000);
await page.getByRole("button", { name: /^All/ }).click();
await pause(800);

// 2. Jordan lists a tool
await caption("Sign in with Clerk (Jordan, an admin)");
await signIn("jordan+clerk_test@example.com");
await caption("Signed in: owners, and which tools are home or out on loan");
await pause(3500);
await go("/listings", "My listings: put a new tool on the board");
await page.getByLabel("Name").pressSequentially("Circular saw", { delay: 40 });
await page.getByLabel("Category").selectOption("power");
await page.getByLabel("Note (optional)").pressSequentially("Blade guard on. Please bring it back clean.", { delay: 15 });
await pause(800);
await page.getByRole("button", { name: "Put it on the board" }).click();
await pause(2500);
await signOut();

// 3. Casey asks to borrow it
await caption("Now Casey, a normal user, signs in");
await signIn("casey+clerk_test@example.com");
await caption("The new saw is on the board");
await pause(2000);
await page.getByRole("link", { name: /Circular saw/ }).click();
await page.waitForLoadState("networkidle");
await pause(1200);
await caption("Ask to borrow it for a date range");
const from = page.getByLabel("From");
const to = page.getByLabel("To (last day)");
const iso = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
await from.fill(iso(1));
await to.fill(iso(3));
await page.getByLabel(/Message to Jordan/).pressSequentially("For the new shelves this weekend.", { delay: 25 });
await pause(1000);
await page.getByRole("button", { name: "Ask to borrow" }).click();
await pause(3000);
await go("/requests", "My requests: n8n wrote back that Jordan got a notice");
await pause(4000);
await go("/", "Casey can't see that another loan is late; only its owner, borrower and admins can");
await pause(3500);
await signOut();

// 4. Jordan answers
await caption("Jordan signs in again");
await signIn("jordan+clerk_test@example.com");
await go("/incoming", "Incoming: Jordan approves the request");
await pause(2500);
await page.getByRole("button", { name: "Approve" }).first().click();
await pause(3500);
await caption("Approved. n8n sent Casey a notice and recorded it");
await pause(3000);
await page.getByRole("button", { name: "Mark returned" }).first().click();
await pause(2500);
await caption("Mark returned when the saw is back");
await pause(2500);

// 5. Admin
await go("/admin", "Admin: every loan, with the daily overdue reminder from n8n");
await pause(4500);
await page.getByRole("tab", { name: "Neighbors" }).click();
await caption("Admins mark Trusted Lenders. These rules are enforced in Convex, not just the UI");
await pause(1500);
await page.getByRole("tabpanel").locator("li").filter({ has: page.getByText("Tom", { exact: true }) }).getByRole("switch").click();
await pause(2500);
await page.getByRole("tab", { name: "Listings" }).click();
await caption("Admins can remove any listing");
await pause(1500);
await page.getByRole("button", { name: "Remove Socket set" }).click();
await pause(1000);
await page.getByRole("button", { name: /Yes, remove/ }).click();
await pause(2500);
await go("/");
await page.getByText(/tools are home right now/).waitFor();
await caption("Back on the board: filled = home, yellow outline = out, red outline = late");
await pause(5000);

await context.close();
await browser.close();
console.log("video saved in demo/");
