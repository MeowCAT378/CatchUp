const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const webUrl = process.env.CATCHUP_WEB_URL ?? 'http://localhost:3000';
let web;
const fail = (error) => { web?.kill(); throw error; };
(async () => {
  try { await fetch(webUrl); } catch { web = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', '3000'], { cwd: '../web', stdio: 'pipe' }); }
  for (let i = 0; i < 30; i++) { try { if ((await fetch(webUrl)).ok) break; } catch {} await new Promise((resolve) => setTimeout(resolve, 250)); }
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const assertFont = async (language, fontName) => {
    if (await page.locator('html').getAttribute('lang') !== language) throw new Error(`Expected lang=${language}`);
    const font = await page.locator('body').evaluate((element) => getComputedStyle(element).fontFamily);
    if (!font.includes(fontName)) throw new Error(`Expected ${fontName}, received ${font}`);
  };
  await page.goto(`${webUrl}/login`);
  await page.getByRole('link', { name: String.fromCodePoint(0xe22, 0xe49, 0xe2d, 0xe19, 0xe01, 0xe25, 0xe31, 0xe1a) }).waitFor();
  await page.locator('a[href="/"]').first().click();
  await page.waitForURL(`${webUrl}/`);
  await page.goto(`${webUrl}/register`);
  await page.locator('a[href="/login"]').first().click();
  await page.waitForURL(`${webUrl}/login`);
  await page.goto(webUrl);
  await page.getByRole('heading', { name: 'ทำให้ทุกการเรียนรู้มีส่วนร่วม' }).waitFor();
  await page.waitForTimeout(1000);
  await assertFont('th', 'Noto Sans Thai Looped');
  const thaiButton = await page.locator('button').first().evaluate((element) => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }));
  if (thaiButton.scrollHeight > thaiButton.clientHeight) throw new Error('Thai language button text is clipped');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.getByRole('heading', { name: 'Make every learning moment interactive' }).waitFor();
  await assertFont('en', 'Exo');
  await page.goto(`${webUrl}/login`);
  await page.getByRole('link', { name: 'Back' }).waitFor();
  await page.goto(webUrl);
  await page.reload();
  await page.getByRole('heading', { name: 'Make every learning moment interactive' }).waitFor();
  await page.getByRole('button', { name: 'ไทย', exact: true }).click();
  await page.getByRole('heading', { name: 'ทำให้ทุกการเรียนรู้มีส่วนร่วม' }).waitFor();
  await page.reload();
  await page.getByRole('heading', { name: 'ทำให้ทุกการเรียนรู้มีส่วนร่วม' }).waitFor();
  await browser.close(); web?.kill(); console.log('Browser i18n smoke: passed');
})().catch(fail);
