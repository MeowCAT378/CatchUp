const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const web = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', '3001'], { cwd: '../web', stdio: 'pipe' });
const fail = (error) => { web.kill(); throw error; };
(async () => {
  for (let i = 0; i < 30; i++) { try { if ((await fetch('http://localhost:3001')).ok) break; } catch {} await new Promise((resolve) => setTimeout(resolve, 250)); }
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:3001');
  await page.getByRole('heading', { name: 'ทำให้ทุกการเรียนรู้มีส่วนร่วม' }).waitFor();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.getByRole('heading', { name: 'Make every learning moment interactive' }).waitFor();
  await page.reload();
  await page.getByRole('heading', { name: 'Make every learning moment interactive' }).waitFor();
  await page.getByRole('button', { name: 'ไทย', exact: true }).click();
  await page.getByRole('heading', { name: 'ทำให้ทุกการเรียนรู้มีส่วนร่วม' }).waitFor();
  await page.reload();
  await page.getByRole('heading', { name: 'ทำให้ทุกการเรียนรู้มีส่วนร่วม' }).waitFor();
  await browser.close(); web.kill(); console.log('Browser i18n smoke: passed');
})().catch(fail);
