const puppeteer = require('puppeteer-core');

async function testLiveWeb() {
  console.log('🚀 Launching Chrome to test live Vercel deployments...');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  // TEST 1: HR Web Portal
  console.log('\n--- TEST 1: HR Web Portal (https://attendance-tracker-apps-rehu9vems-kirtee.vercel.app) ---');
  const page1 = await browser.newPage();
  
  const consoleLogs1 = [];
  const errors1 = [];
  page1.on('console', msg => consoleLogs1.push(`[${msg.type()}] ${msg.text()}`));
  page1.on('pageerror', err => errors1.push(err.message));

  try {
    await page1.goto('https://attendance-tracker-apps-rehu9vems-kirtee.vercel.app', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    console.log('✓ Page loaded successfully. Title:', await page1.title());

    // Check if login form is present
    const emailInput = await page1.$('input[type="email"]');
    const passwordInput = await page1.$('input[type="password"]');
    const submitBtn = await page1.$('button[type="submit"]');

    if (emailInput && passwordInput && submitBtn) {
      console.log('✓ Login form inputs detected. Attempting live login...');
      await emailInput.type('admin@vorldx.demo');
      await passwordInput.type('Admin@VorldX2026!');
      await submitBtn.click();

      // Wait for navigation or state update
      await new Promise(r => setTimeout(r, 4000));
      console.log('✓ Current URL after login attempt:', page1.url());

      // Check if logged in (look for dashboard elements or sign out)
      const pageText = await page1.evaluate(() => document.body.innerText);
      if (pageText.includes('Dashboard') || pageText.includes('Employees') || pageText.includes('Sign Out') || page1.url().includes('dashboard')) {
        console.log('✅ HR WEB PORTAL LOGIN & DASHBOARD VERIFIED OPERATIONAL!');
      } else {
        console.log('⚠️ Login check result. Visible text snapshot:', pageText.slice(0, 200));
      }
    } else {
      console.log('⚠️ Could not find email/password inputs on page. URL:', page1.url());
      const bodySnippet = await page1.evaluate(() => document.body.innerText);
      console.log('Body snippet:', bodySnippet.slice(0, 200));
    }
  } catch (err) {
    console.error('❌ Failed testing HR Web Portal:', err.message);
  }

  if (errors1.length > 0) {
    console.log('Console Page Errors:', errors1);
  }

  // TEST 2: Office QR Display Kiosk
  console.log('\n--- TEST 2: Office QR Display (https://attendance-tracker-qq8u.vercel.app) ---');
  const page2 = await browser.newPage();
  const consoleLogs2 = [];
  const errors2 = [];
  page2.on('console', msg => consoleLogs2.push(`[${msg.type()}] ${msg.text()}`));
  page2.on('pageerror', err => errors2.push(err.message));

  try {
    await page2.goto('https://attendance-tracker-qq8u.vercel.app', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    console.log('✓ Display Page loaded successfully. Title:', await page2.title());
    const displayBody = await page2.evaluate(() => document.body.innerText);
    console.log('Display Page Content Snapshot:', displayBody.slice(0, 300).replace(/\n+/g, ' '));

    if (displayBody.includes('VorldX') || displayBody.includes('Display') || displayBody.includes('Pairing') || displayBody.includes('TERMINAL')) {
      console.log('✅ OFFICE QR DISPLAY KIOSK VERIFIED OPERATIONAL!');
    }
  } catch (err) {
    console.error('❌ Failed testing Display Kiosk:', err.message);
  }

  if (errors2.length > 0) {
    console.log('Display Console Page Errors:', errors2);
  }

  await browser.close();
  console.log('\n====================================================');
  console.log('🎉 BROWSER VERIFICATION RUN COMPLETE');
  console.log('====================================================');
}

testLiveWeb().catch(console.error);
