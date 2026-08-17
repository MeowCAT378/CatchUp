const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const apiUrl = 'http://localhost:3001';
const webUrl = 'http://localhost:3000';
let api;
let web;
let token;
let activityId;
const waitFor = async (url) => {
  for (let i = 0; i < 80; i++) {
    try { const response = await fetch(url); if (response.ok || response.status === 401) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
};
(async () => {
  try {
    try { await waitFor(`${apiUrl}/quizzes`); } catch { api = spawn(process.execPath, ['dist/main'], { stdio: 'ignore' }); await waitFor(`${apiUrl}/quizzes`); }
    web = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', '3000'], { cwd: '../web', stdio: 'ignore' });
    await waitFor(`${webUrl}/login`);
    const email = `delete-browser-${Date.now()}@example.test`;
    const register = await fetch(`${apiUrl}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, name: 'Browser Teacher', password: 'password123' }) });
    token = (await register.json()).data.accessToken;
    const activity = (await (await fetch(`${apiUrl}/quizzes`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ title: 'Delete activity browser test', type: 'QUIZ' }) })).json()).data;
    activityId = activity.id;
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    let deleteRequests = 0;
    page.on('request', (request) => { if (request.method() === 'DELETE') deleteRequests++; });
    await page.goto(`${webUrl}/login`);
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill('password123');
    await page.locator('form button').click();
    await page.waitForURL('**/teacher');
    await page.getByText(activity.title, { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    if (deleteRequests || !(await page.getByText(activity.title, { exact: true }).count())) throw new Error('Cancel sent DELETE or removed the activity');
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('button', { name: 'Delete activity', exact: true }).click();
    await page.getByText(activity.title, { exact: true }).waitFor({ state: 'detached' });
    if (deleteRequests !== 1) throw new Error('Expected one DELETE request');
    await browser.close();
    console.log('Activity delete cancel browser smoke: passed');
  } finally {
    if (token && activityId) await fetch(`${apiUrl}/quizzes/${activityId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    web?.kill();
    api?.kill();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
