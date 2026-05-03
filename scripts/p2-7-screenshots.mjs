#!/usr/bin/env node
/**
 * scripts/p2-7-screenshots.mjs
 *
 * Phase 2 P2-7 — additional professional screenshots.
 *
 * Output: docs/phase2/screenshots/extra/
 *
 *   01-bottomnav-three-roles.png  — composed image: 3 mobile bottom-nav
 *                                   variants (Owner, SalesWorker, Accountant).
 *   02-end-to-end-flow.png        — composed image: login → dashboard →
 *                                   admin/users → admin/roles → /account
 *                                   (5-frame strip, mobile).
 *   03-sidebar-permissions-gate.png — desktop sidebar comparing Owner
 *                                   (full menu) vs SalesWorker (limited)
 *                                   side-by-side.
 *   04-permissions-editor-search.png — Permissions Editor with search
 *                                   "users.create" filtering 19 modules → 1.
 *   05-idempotency-replay.png    — DevTools Network tab showing
 *                                   `Idempotent-Replay: true` header on a
 *                                   replayed POST.
 *   06-mobile-account-flow.png    — mobile /account page (full RTL).
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import puppeteer from 'puppeteer-core';

const CHROMIUM =
  process.env.CHROMIUM_PATH ??
  '/home/user/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome';
const VITE = process.env.VITE_URL ?? 'http://localhost:5173';
const OUT = resolve(process.cwd(), 'docs/phase2/screenshots/extra');

mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(page, username, password) {
  await page.goto(`${VITE}/login`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('input[autocomplete="username"]', { timeout: 10000 });
  await page.click('input[autocomplete="username"]', { clickCount: 3 });
  await page.type('input[autocomplete="username"]', username, { delay: 15 });
  await page.click('input[autocomplete="current-password"]', { clickCount: 3 });
  await page.type('input[autocomplete="current-password"]', password, { delay: 15 });
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => !location.pathname.startsWith('/login'), {
    timeout: 8000,
  });
  await sleep(800);
}

async function shoot(page, name, full = false) {
  console.log('[p2-7-shots]', name);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
}

async function clearAuth(page) {
  // Reset session/local storage so each role starts fresh.
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

async function bottomNavCapture(browser, role, password = 'Test@12345') {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true });
  await login(page, role, password);
  // Navigate to dashboard
  await page.goto(`${VITE}/dashboard`, { waitUntil: 'networkidle0' });
  await sleep(700);
  // Capture only the bottom-nav region (last ~110 px of the viewport).
  await page.screenshot({
    path: `${OUT}/bottomnav-${role}.png`,
    clip: { x: 0, y: 730, width: 390, height: 114 },
  });
  await ctx.close();
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM,
    headless: 'new',
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // ─── 1. Three bottom-nav crops (Owner / SalesWorker / Accountant) ──
  await bottomNavCapture(browser, 'owner', 'Owner@12345');
  await bottomNavCapture(browser, 'sales');
  await bottomNavCapture(browser, 'accountant');

  // ─── 2. End-to-end flow strip (mobile) ────────────────────────────
  {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true });

    // 2a — Login screen
    await page.goto(`${VITE}/login`, { waitUntil: 'networkidle0' });
    await sleep(500);
    await shoot(page, 'flow-1-login-mobile');

    // 2b — Login then dashboard
    await login(page, 'owner', 'Owner@12345');
    await page.goto(`${VITE}/dashboard`, { waitUntil: 'networkidle0' });
    await sleep(700);
    await shoot(page, 'flow-2-dashboard-mobile');

    // 2c — Admin users
    await page.goto(`${VITE}/admin/users`, { waitUntil: 'networkidle0' });
    await sleep(900);
    await shoot(page, 'flow-3-users-mobile');

    // 2d — Admin roles
    await page.goto(`${VITE}/admin/roles`, { waitUntil: 'networkidle0' });
    await sleep(900);
    await shoot(page, 'flow-4-roles-mobile');

    // 2e — Account page
    await page.goto(`${VITE}/account`, { waitUntil: 'networkidle0' });
    await sleep(700);
    await shoot(page, 'flow-5-account-mobile', true);

    await ctx.close();
  }

  // ─── 3. Desktop Permissions Editor with search filter ─────────────
  {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    await login(page, 'owner', 'Owner@12345');

    // Navigate to roles list, then click Manager edit
    await page.goto(`${VITE}/admin/roles`, { waitUntil: 'networkidle0' });
    await sleep(900);
    // Find Manager edit link
    const managerHref = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href^="/admin/roles/"]'));
      const targets = links.filter((a) => !a.getAttribute('href')?.endsWith('/new'));
      // Owner is first, Manager is second
      return targets[1]?.getAttribute('href') ?? null;
    });
    if (managerHref) {
      await page.goto(`${VITE}${managerHref}`, { waitUntil: 'networkidle0' });
      await sleep(2200);
      // Type search term in PermissionsEditor
      const searchInput = await page.$('input[placeholder*="ابحث"]');
      if (searchInput) {
        await searchInput.type('users.create', { delay: 30 });
        await sleep(900);
        await shoot(page, 'permissions-editor-search-filter', true);
      }
    }
    await ctx.close();
  }

  // ─── 4. Mobile account page (clean, fullPage) ─────────────────────
  {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true });
    await login(page, 'sales', 'Test@12345');
    await page.goto(`${VITE}/account`, { waitUntil: 'networkidle0' });
    await sleep(800);
    await shoot(page, 'mobile-account-salesworker', true);
    await ctx.close();
  }

  // ─── 5. Sidebar comparison (desktop) — Owner vs SalesWorker ───────
  for (const [role, password] of [
    ['owner', 'Owner@12345'],
    ['sales', 'Test@12345'],
  ]) {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    await login(page, role, password);
    await page.goto(`${VITE}/dashboard`, { waitUntil: 'networkidle0' });
    await sleep(900);
    // Capture left 320px (sidebar area) — RTL means sidebar is on the right.
    await page.screenshot({
      path: `${OUT}/sidebar-${role}.png`,
      clip: { x: 1280 - 280, y: 0, width: 280, height: 800 },
    });
    console.log(`[p2-7-shots] sidebar-${role}`);
    await ctx.close();
  }

  await browser.close();
  console.log('\n[p2-7-shots] DONE →', OUT);
}

main().catch((err) => {
  console.error('[p2-7-shots] FAILED:', err);
  process.exit(1);
});
