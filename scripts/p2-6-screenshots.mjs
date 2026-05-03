#!/usr/bin/env node
/**
 * scripts/p2-6-screenshots.mjs
 *
 * Captures Phase 2 P2-6 (Admin UI) screenshots via puppeteer-core.
 *
 * Output: docs/phase2/screenshots/p2-6/
 *   01-users-list-desktop.png      — /admin/users (desktop, owner)
 *   02-users-list-mobile.png       — /admin/users (mobile)
 *   03-create-user-modal.png       — Create user modal w/ password meter
 *   04-user-detail.png             — /admin/users/:id (effective permissions)
 *   05-roles-grid.png              — /admin/roles (3-col grid)
 *   06-permissions-editor.png      — /admin/roles/:id (edit Manager role)
 *   07-edit-system-role-warning.png — Owner role (read-only key warning)
 *   08-account-page.png            — /account (profile + change password)
 *   09-change-password-strength.png — /account with password meter at "good"
 *   10-create-role-empty.png        — /admin/roles/new (clean editor)
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import puppeteer from 'puppeteer-core';

const CHROMIUM =
  process.env.CHROMIUM_PATH ??
  '/home/user/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome';
const VITE = process.env.VITE_URL ?? 'http://localhost:5173';
const OUT = resolve(process.cwd(), 'docs/phase2/screenshots/p2-6');

mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function login(page, username, password) {
  await page.goto(`${VITE}/login`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('input[autocomplete="username"]');
  await page.click('input[autocomplete="username"]', { clickCount: 3 });
  await page.type('input[autocomplete="username"]', username, { delay: 15 });
  await page.click('input[autocomplete="current-password"]', { clickCount: 3 });
  await page.type('input[autocomplete="current-password"]', password, { delay: 15 });
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => !location.pathname.startsWith('/login'), { timeout: 8000 });
  await sleep(800);
}

async function shoot(page, name) {
  console.log('[shots]', name);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
}

async function main() {
  console.log('[shots] launching Chromium…');
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  // Reset owner lockout up-front so logins succeed even after a prior bad run.
  const { spawnSync } = await import('node:child_process');
  spawnSync(
    'psql',
    [
      '-U',
      'postgres',
      '-h',
      'localhost',
      '-d',
      'grocery_dev',
      '-c',
      "UPDATE users SET failed_login_attempts=0, locked_until=NULL WHERE username IN ('owner','sales','manager');",
    ],
    { env: { ...process.env, PGPASSWORD: 'postgres' }, stdio: 'inherit' },
  );

  // ─── Desktop session (Owner) ────────────────────────────────────────
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await login(page, 'owner', 'Owner@12345');

    // 1. Users list (desktop)
    await page.goto(`${VITE}/admin/users`, { waitUntil: 'networkidle0' });
    await sleep(1500);
    await shoot(page, '01-users-list-desktop');

    // 3. Create user modal — find the green "إضافة مستخدم" button by text
    const opened = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const target = btns.find((b) => b.textContent?.includes('إضافة مستخدم'));
      if (target) {
        target.click();
        return true;
      }
      return false;
    });
    if (opened) {
      // Wait for dialog to actually mount.
      await page.waitForSelector('div[role="dialog"]', { timeout: 4000 }).catch(() => null);
      await sleep(700);
      // Pre-fill some fields so the modal looks alive.
      await page.evaluate(() => {
        const setVal = (el, value) => {
          const setter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'value',
          )?.set;
          setter?.call(el, value);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        };
        const dlg = document.querySelector('div[role="dialog"]');
        if (!dlg) return;
        const inputs = Array.from(dlg.querySelectorAll('input'));
        const byName = (n) => inputs.find((i) => i.name === n);
        if (byName('fullName')) setVal(byName('fullName'), 'علي محمد');
        if (byName('username')) setVal(byName('username'), 'ali_test');
        if (byName('phone')) setVal(byName('phone'), '0501234567');
      });
      // Type a sample password into the modal's first password input to trigger the meter.
      const pwd = await page.$('div[role="dialog"] input[type="password"]');
      if (pwd) {
        await pwd.click({ clickCount: 3 });
        await pwd.type('Strong@2026', { delay: 20 });
        await sleep(500);
      }
      await shoot(page, '03-create-user-modal');
      // close
      await page.keyboard.press('Escape');
      await sleep(400);
    } else {
      console.warn('[shots] add user button not found — skipping 03');
    }

    // 4. User detail — navigate via direct URL (more reliable than DOM clicks)
    const firstId = await page.evaluate(() => {
      const a = document.querySelector('a[href^="/admin/users/"]');
      return a ? a.getAttribute('href') : null;
    });
    if (firstId) {
      await page.goto(`${VITE}${firstId}`, { waitUntil: 'networkidle0' });
      await sleep(1800);
      console.log('[shots] 04-user-detail (fullPage)');
      await page.screenshot({
        path: `${OUT}/04-user-detail.png`,
        fullPage: true,
      });
    } else {
      console.warn('[shots] no user detail link found — skipping 04');
    }

    // 5. Roles grid
    await page.goto(`${VITE}/admin/roles`, { waitUntil: 'networkidle0' });
    await sleep(1500);
    await shoot(page, '05-roles-grid');

    // Collect role links once for reuse.
    const roleLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href^="/admin/roles/"]'))
        .map((a) => ({ href: a.getAttribute('href'), text: a.textContent?.trim() ?? '' }))
        .filter((l) => l.href && !l.href.endsWith('/new'));
    });
    console.log('[shots] role links:', roleLinks.map((l) => l.text).join(' | '));

    // 6. Permissions editor — Manager role has 178 perms (great visual density).
    // The role-detail link text on the cards is "تعديل" (edit). Pick the first
    // unique-href tied to the Manager card by ordering: links repeat in pairs
    // (view + edit). Use the second link (index 3) which is Manager's edit.
    const uniqueRoleLinks = [...new Map(roleLinks.map((l) => [l.href, l])).values()];
    console.log('[shots] unique role links:', uniqueRoleLinks.map((l) => l.href).join(', '));
    // Order from API: Owner, Manager, SalesWorker, Accountant, InventoryOfficer, PurchasingOfficer
    const managerLink = uniqueRoleLinks[1] ?? uniqueRoleLinks[0];
    if (managerLink?.href) {
      await page.goto(`${VITE}${managerLink.href}`, { waitUntil: 'networkidle0' });
      await sleep(2500); // allow framer stagger + 178 permissions to render
      await shoot(page, '06-permissions-editor');
    }

    // 7. Edit Owner role (system) — read-only key warning
    const ownerLink2 = uniqueRoleLinks[0];
    if (ownerLink2?.href) {
      await page.goto(`${VITE}${ownerLink2.href}`, { waitUntil: 'networkidle0' });
      await sleep(2200);
      await shoot(page, '07-edit-system-role-warning');
    }

    // 10. Create role (empty editor)
    await page.goto(`${VITE}/admin/roles/new`, { waitUntil: 'networkidle0' });
    await sleep(1500);
    await shoot(page, '10-create-role-empty');

    // 8. Account page (fullPage to include the Logout-all section).
    await page.goto(`${VITE}/account`, { waitUntil: 'networkidle0' });
    await sleep(1200);
    console.log('[shots] 08-account-page (fullPage)');
    await page.screenshot({
      path: `${OUT}/08-account-page.png`,
      fullPage: true,
    });

    // 9. Change password with meter at "good".
    // Click into the field, then type via keyboard so RHF sees real input events.
    const newPwdInput = await page.$('input[autocomplete="new-password"]');
    if (newPwdInput) {
      await newPwdInput.click();
      await page.keyboard.type('Good@Password1', { delay: 60 });
      // Poll until the strength label shows up (max ~3 s) so we know RHF re-rendered.
      try {
        await page.waitForFunction(
          () => {
            const text = document.body.innerText;
            return /قوية|جيدة|متوسط|ضعيف/.test(text);
          },
          { timeout: 3000 },
        );
      } catch {
        // Fallback: try the React-native setter.
        await page.evaluate(() => {
          const setter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'value',
          )?.set;
          const input = Array.from(document.querySelectorAll('input')).find(
            (i) => i.getAttribute('autocomplete') === 'new-password',
          );
          if (input && setter) {
            setter.call(input, 'Good@Password1');
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
        await new Promise((r) => setTimeout(r, 800));
      }
    }
    await shoot(page, '09-change-password-strength');

    await page.close();
  }

  // ─── Mobile session ──────────────────────────────────────────────────
  {
    // Use a fresh incognito context so refresh cookies from the desktop
    // session don't bypass the login page selector wait.
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true });
    await login(page, 'owner', 'Owner@12345');
    await page.goto(`${VITE}/admin/users`, { waitUntil: 'networkidle0' });
    await sleep(1500);
    await shoot(page, '02-users-list-mobile');
    await page.close();
    await ctx.close();
  }

  await browser.close();
  console.log('[shots] done →', OUT);
}

main().catch((err) => {
  console.error('[shots] FAILED:', err);
  process.exit(1);
});
