const { spawn } = require('node:child_process');
const bcrypt = require('bcrypt');
const { PrismaClient, Role } = require('@prisma/client');
const { chromium } = require('playwright');

const databaseUrl = process.env.CATCHUP_TEST_DATABASE_URL;
if (!databaseUrl || !/test/i.test(new URL(databaseUrl).pathname))
  throw new Error(
    'CATCHUP_TEST_DATABASE_URL must point to a database whose name contains "test".',
  );

process.env.DATABASE_URL = databaseUrl;
process.env.DIRECT_URL = databaseUrl;
const prisma = new PrismaClient();
const stamp = `${Date.now()}-${process.pid}`;
const adminEmail = `browser-admin-${stamp}@example.test`;
const hostEmail = `browser-host-${stamp}@example.test`;
const oldPassword = 'password123';
const newPassword = 'new-password123';
const apiPort = 32000 + (process.pid % 500);
const webPort = apiPort + 500;
const apiUrl = `http://localhost:${apiPort}`;
const webUrl = `http://localhost:${webPort}`;
let apiProcess;
let webProcess;
let browser;

const waitFor = async (url) => {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 401) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
};

const verifyPasswordControls = async (dialog, password, confirmation) => {
  if (
    (await password.getAttribute('type')) !== 'password' ||
    (await confirmation.getAttribute('type')) !== 'password'
  )
    throw new Error('Password fields must start hidden');
  await dialog.getByRole('button', { name: 'Show password' }).first().click();
  if (
    (await password.getAttribute('type')) !== 'text' ||
    (await confirmation.getAttribute('type')) !== 'password'
  )
    throw new Error('Password visibility controls must be independent');
  await dialog.getByRole('button', { name: 'Hide password' }).waitFor();
};

(async () => {
  try {
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Browser Admin',
        passwordHash: await bcrypt.hash(oldPassword, 12),
        role: Role.ADMIN,
      },
    });
    apiProcess = spawn(process.execPath, ['dist/main'], {
      cwd: process.cwd(),
      stdio: 'ignore',
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        DIRECT_URL: databaseUrl,
        JWT_SECRET: 'browser-e2e-secret-at-least-32-characters',
        WEB_ORIGIN: webUrl,
        PORT: String(apiPort),
      },
    });
    webProcess = spawn(
      process.execPath,
      ['node_modules/next/dist/bin/next', 'dev', '-p', String(webPort)],
      {
        cwd: '../web',
        stdio: 'ignore',
        env: {
          ...process.env,
          NEXTAUTH_SECRET: 'browser-e2e-nextauth-secret',
          NEXTAUTH_URL: webUrl,
          NEXT_PUBLIC_API_URL: apiUrl,
        },
      },
    );
    await Promise.all([waitFor(`${apiUrl}/auth/me`), waitFor(`${webUrl}/login`)]);

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`${webUrl}/login`);
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await page.locator('input[name="email"]').fill(adminEmail);
    await page.locator('input[name="password"]').fill(oldPassword);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/admin');
    await page.getByRole('link', { name: 'Teachers' }).click();

    await page.getByRole('button', { name: 'Create user' }).click();
    let dialog = page.getByRole('dialog');
    let password = dialog.getByLabel('Password', { exact: true });
    let confirmation = dialog.getByLabel('Confirm password', { exact: true });
    await verifyPasswordControls(dialog, password, confirmation);
    await password.fill(oldPassword);
    await confirmation.fill(oldPassword);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Create user' }).click();
    dialog = page.getByRole('dialog');
    password = dialog.getByLabel('Password', { exact: true });
    confirmation = dialog.getByLabel('Confirm password', { exact: true });
    if (
      (await password.inputValue()) ||
      (await confirmation.inputValue()) ||
      (await password.getAttribute('type')) !== 'password' ||
      (await confirmation.getAttribute('type')) !== 'password'
    )
      throw new Error('Create dialog did not reset password state');
    await dialog.getByLabel('Name').fill('Browser Host');
    await dialog.getByLabel('Email').fill(hostEmail);
    await password.fill(oldPassword);
    await confirmation.fill(oldPassword);
    await dialog.getByRole('button', { name: 'Create user' }).click();
    await dialog.waitFor({ state: 'detached' });

    const row = page.getByRole('row', { name: /Browser Host/ });
    await row.getByRole('link', { name: 'Teacher details' }).click();
    await page.getByRole('button', { name: 'Reset password' }).click();
    dialog = page.getByRole('dialog');
    password = dialog.getByLabel('Password', { exact: true });
    confirmation = dialog.getByLabel('Confirm password', { exact: true });
    await verifyPasswordControls(dialog, password, confirmation);
    await password.fill(newPassword);
    await confirmation.fill(newPassword);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Reset password' }).click();
    dialog = page.getByRole('dialog');
    password = dialog.getByLabel('Password', { exact: true });
    confirmation = dialog.getByLabel('Confirm password', { exact: true });
    if (
      (await password.inputValue()) ||
      (await confirmation.inputValue()) ||
      (await password.getAttribute('type')) !== 'password' ||
      (await confirmation.getAttribute('type')) !== 'password'
    )
      throw new Error('Reset dialog did not reset password state');
    await password.fill(newPassword);
    await confirmation.fill(newPassword);
    await dialog.getByRole('button', { name: 'Reset password' }).click();
    await page.getByText('Password reset', { exact: true }).waitFor();

    await page.getByRole('button', { name: 'Logout' }).click();
    await page.goto(`${webUrl}/login`);
    await page.locator('input[name="email"]').fill(hostEmail);
    await page.locator('input[name="password"]').fill(oldPassword);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page
      .getByRole('alert')
      .filter({ hasText: 'Invalid email or password' })
      .waitFor();
    await page.locator('input[name="password"]').fill(newPassword);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/teacher');

    console.log('Admin user creation and password reset browser E2E: passed');
  } finally {
    await browser?.close();
    webProcess?.kill();
    apiProcess?.kill();
    await prisma.adminAuditLog.deleteMany({
      where: {
        OR: [
          { admin: { email: adminEmail } },
          { targetUser: { email: { in: [adminEmail, hostEmail] } } },
        ],
      },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [adminEmail, hostEmail] } },
    });
    await prisma.$disconnect();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
