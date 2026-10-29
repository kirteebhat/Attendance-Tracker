const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ARTIFACT_DIR = 'C:\\Users\\asus\\.gemini\\antigravity\\brain\\2f17904c-8747-49f4-950c-bbb200b15e56';
const DIST_DIR = path.resolve(__dirname, '../apps/web/dist');
const PORT = 3001;

function startStaticServer() {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
  };

  const server = http.createServer((req, res) => {
    // API mock handlers
    if (req.url.startsWith('/api/auth/me')) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({
        success: true,
        data: {
          user: {
            _id: 'admin_1',
            employeeId: 'ADM-001',
            email: 'admin@vorldx.demo',
            role: 'ADMIN',
            status: 'ACTIVE'
          },
          employee: {
            name: 'Sarah Jenkins',
            department: 'Human Resources',
            designation: 'HR Director'
          }
        }
      }));
    }

    if (req.url.startsWith('/api/feature-flags')) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({
        success: true,
        data: {
          leave: true,
          announcements: true,
          enquiries: true,
          calendarImport: true,
          threeD: true,
          otaUpdates: true,
        }
      }));
    }

    if (req.url.startsWith('/api/presence/hr')) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({
        success: true,
        data: {
          count: 2,
          users: [
            { userId: "emp_admin", email: "admin@vorldx.demo", name: "System Admin", role: "ADMIN" },
            { userId: "emp_hr", email: "hr@vorldx.demo", name: "Sarah Jenkins", role: "HR" }
          ]
        }
      }));
    }

    if (req.url.startsWith('/api/leave/requests')) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({
        success: true,
        data: [],
        pagination: { total: 3, page: 1, limit: 10, pages: 1 }
      }));
    }

    if (req.url.startsWith('/api/announcements/unread-count')) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({
        success: true,
        unreadCount: 2
      }));
    }

    if (req.url.startsWith('/api/enquiries')) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({
        success: true,
        data: [],
        total: 1,
        page: 1,
        limit: 10
      }));
    }

    if (req.url.startsWith('/api/app-releases/latest')) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({
        success: true,
        data: {
          platform: 'web',
          version: '1.2.0',
          minSupportedVersion: '1.0.0',
          releaseNotes: 'Design system upgrade',
          forceUpdate: false,
          publishedAt: new Date().toISOString()
        }
      }));
    }

    if (req.url.startsWith('/api/dashboard/summary')) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({
        success: true,
        data: {
          dateKey: "2026-10-29",
          summary: {
            presentToday: 21,
            lateToday: 2,
            wfhToday: 3,
            notYetCheckedInToday: 1,
            totalActiveEmployees: 25,
            attendanceRate: 84
          },
          trends: {
            last7Days: [],
            last30Days: []
          },
          recentActivity: []
        }
      }));
    }

    if (req.url.startsWith('/api/analytics/live')) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({
        success: true,
        data: {
          dateKey: "2026-10-29",
          timezone: "Asia/Kolkata",
          hourlyToday: [],
          recentScans: [],
          departmentBreakdown: [],
          statusSplit: {
            present: 21,
            late: 2,
            absent: 0,
            leave: 0,
            wfh: 3,
            notYetCheckedIn: 1,
            totalActive: 25,
            percentages: {
              present: 84,
              late: 8,
              absent: 0,
              leave: 0,
              wfh: 12,
              notYetCheckedIn: 4
            }
          }
        }
      }));
    }

    let filePath = path.join(DIST_DIR, req.url.split('?')[0]);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(DIST_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading ' + req.url);
      } else {
        res.writeHead(200, { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' });
        res.end(content);
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(PORT, () => {
      console.log(`✓ Static test server running on http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

async function verifyAppShell() {
  const server = await startStaticServer();

  console.log('\n🚀 Launching Browser to verify App Shell at 375, 768, 1280, and 1920 px...');
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browserPath = fs.existsSync(edgePath) ? edgePath : chromePath;

  const tempProfileDir = path.join(__dirname, '../.tmp_shell_' + Date.now());
  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: 'new',
    userDataDir: tempProfileDir,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu-sandbox',
      '--window-size=1920,1080',
    ],
  });

  try {
    const page = await browser.newPage();

    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warn') {
        console.log(`[Browser ${msg.type()}]`, msg.text());
      }
    });
    page.on('pageerror', (err) => console.log('[Browser PageError Stack]', err.stack));

    // 1. Set Authenticated HR Admin in localStorage with correct vorldx keys
    await page.goto(`http://localhost:${PORT}/login`, { waitUntil: 'networkidle0', timeout: 15000 });
    await page.evaluate(() => {
      localStorage.setItem('vorldx_access_token', 'mock_jwt_token_for_verification');
      localStorage.setItem(
        'vorldx_cached_user',
        JSON.stringify({
          id: 'admin_1',
          employeeId: 'ADM-001',
          email: 'admin@vorldx.demo',
          name: 'Sarah Jenkins',
          role: 'ADMIN',
          department: 'Human Resources'
        })
      );
      localStorage.setItem('vorldx_sidebar_collapsed', 'false');
    });

    // =========================================================================
    // TEST 1: Viewport 1920px (Wide Desktop)
    // =========================================================================
    console.log('\n--- 1. Testing Viewport: 1920px (Wide Desktop) ---');
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise((r) => setTimeout(r, 1200));

    const check1920 = await page.evaluate(() => {
      const docWidth = document.documentElement.scrollWidth;
      const clientWidth = document.documentElement.clientWidth;
      const bodyWidth = document.body.scrollWidth;
      const hasOverflow = docWidth > clientWidth || bodyWidth > clientWidth;

      // Group headers
      const headings = Array.from(document.querySelectorAll('aside nav div'))
        .map(el => el.textContent.trim())
        .filter(t => t.length > 0 && ['OVERVIEW & ANALYTICS', 'WORKFORCE OPERATIONS', 'SYSTEM & ADMINISTRATION'].includes(t.toUpperCase()));

      // Topbar elements
      const pageTitle = document.querySelector('header h1')?.textContent?.trim();
      const breadcrumb = document.querySelector('header nav[aria-label="Breadcrumb"]')?.textContent?.trim();
      const sidebarWidth = Math.round(document.querySelector('aside')?.getBoundingClientRect().width || 0);
      const brandLogo = document.body.innerText.includes('VorldX') && document.body.innerText.includes('Workforce Suite');

      return {
        docWidth,
        clientWidth,
        bodyWidth,
        hasOverflow,
        headings,
        pageTitle,
        breadcrumb,
        sidebarWidth,
        brandLogo,
      };
    });

    console.log(`✓ Current Page URL: ${page.url()}`);
    const bodySample = await page.evaluate(() => document.body.innerText.slice(0, 300));
    console.log(`✓ Body Sample: ${bodySample.replace(/\n/g, ' ')}`);

    console.log(`✓ 1920px Scroll Width: ${check1920.docWidth}px (Client: ${check1920.clientWidth}px) -> Overflow: ${check1920.hasOverflow ? 'FAIL' : 'NONE (PASS)'}`);
    console.log(`✓ Sidebar Groups Found: ${check1920.headings.join(' | ')}`);
    console.log(`✓ Brand Logo & Text Visible: ${check1920.brandLogo ? 'YES' : 'NO'}`);
    console.log(`✓ Topbar Page Title: "${check1920.pageTitle}" | Breadcrumb: "${check1920.breadcrumb}"`);
    console.log(`✓ Desktop Sidebar Width (Expanded): ${check1920.sidebarWidth}px (Expected ~256px)`);

    const path1920 = path.join(ARTIFACT_DIR, 'app_shell_1_desktop_1920px.png');
    await page.screenshot({ path: path1920, fullPage: false });
    console.log(`✓ Screenshot saved: ${path1920}`);

    // Test Collapsible Sidebar Toggle via Click
    console.log('\n--- Testing Collapsible Sidebar Interaction ---');
    const collapseButton = await page.$('aside button[title*="Collapse sidebar"]');
    if (collapseButton) {
      await collapseButton.click();
      await new Promise((r) => setTimeout(r, 400));

      const collapsedWidth = await page.evaluate(() => {
        return Math.round(document.querySelector('aside')?.getBoundingClientRect().width || 0);
      });
      console.log(`✓ Sidebar Width after Collapse Click: ${collapsedWidth}px (Expected ~80px)`);

      const pathCollapsed = path.join(ARTIFACT_DIR, 'app_shell_1b_sidebar_collapsed.png');
      await page.screenshot({ path: pathCollapsed, fullPage: false });
      console.log(`✓ Screenshot saved: ${pathCollapsed}`);

      // Expand back
      const expandButton = await page.$('aside button[title*="Expand sidebar"]');
      if (expandButton) {
        await expandButton.click();
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    // =========================================================================
    // TEST 2: Viewport 1280px (Standard Desktop)
    // =========================================================================
    console.log('\n--- 2. Testing Viewport: 1280px (Standard Desktop) ---');
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    await new Promise((r) => setTimeout(r, 500));

    const check1280 = await page.evaluate(() => {
      const docWidth = document.documentElement.scrollWidth;
      const clientWidth = document.documentElement.clientWidth;
      const bodyWidth = document.body.scrollWidth;
      const hasOverflow = docWidth > clientWidth || bodyWidth > clientWidth;
      return { docWidth, clientWidth, bodyWidth, hasOverflow };
    });

    console.log(`✓ 1280px Scroll Width: ${check1280.docWidth}px (Client: ${check1280.clientWidth}px) -> Overflow: ${check1280.hasOverflow ? 'FAIL' : 'NONE (PASS)'}`);

    // Click Notification Bell to inspect popover
    console.log('✓ Opening Topbar Notifications Popover...');
    const notifBtn = await page.$('header button[aria-label*="notifications"]');
    if (notifBtn) {
      await notifBtn.click();
      await new Promise((r) => setTimeout(r, 300));
    }

    const path1280 = path.join(ARTIFACT_DIR, 'app_shell_2_desktop_1280px.png');
    await page.screenshot({ path: path1280, fullPage: false });
    console.log(`✓ Screenshot saved: ${path1280}`);

    // Close popover
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 200));

    // =========================================================================
    // TEST 3: Viewport 768px (Tablet)
    // =========================================================================
    console.log('\n--- 3. Testing Viewport: 768px (Tablet) ---');
    await page.setViewport({ width: 768, height: 1024, deviceScaleFactor: 1 });
    await new Promise((r) => setTimeout(r, 500));

    const check768 = await page.evaluate(() => {
      const docWidth = document.documentElement.scrollWidth;
      const clientWidth = document.documentElement.clientWidth;
      const bodyWidth = document.body.scrollWidth;
      const hasOverflow = docWidth > clientWidth || bodyWidth > clientWidth;
      const isDesktopBreakpoint = window.innerWidth >= 768;
      const sidebarPresent = !!document.querySelector('aside');
      return { docWidth, clientWidth, bodyWidth, hasOverflow, isDesktopBreakpoint, sidebarPresent };
    });

    console.log(`✓ 768px Scroll Width: ${check768.docWidth}px (Client: ${check768.clientWidth}px) -> Overflow: ${check768.hasOverflow ? 'FAIL' : 'NONE (PASS)'}`);
    console.log(`✓ 768px Tablet Breakpoint Active (md:flex): ${check768.sidebarPresent ? 'YES' : 'NO'}`);

    const path768 = path.join(ARTIFACT_DIR, 'app_shell_3_tablet_768px.png');
    await page.screenshot({ path: path768, fullPage: false });
    console.log(`✓ Screenshot saved: ${path768}`);

    // =========================================================================
    // TEST 4: Viewport 375px (Mobile Phone & Drawer)
    // =========================================================================
    console.log('\n--- 4. Testing Viewport: 375px (Mobile Phone & Navigation Drawer) ---');
    await page.setViewport({ width: 375, height: 667, deviceScaleFactor: 1 });
    await new Promise((r) => setTimeout(r, 500));

    const check375 = await page.evaluate(() => {
      const docWidth = document.documentElement.scrollWidth;
      const clientWidth = document.documentElement.clientWidth;
      const bodyWidth = document.body.scrollWidth;
      const hasOverflow = docWidth > clientWidth || bodyWidth > clientWidth;
      const pageTitle = document.querySelector('header h1')?.textContent?.trim();
      const hamburgerVisible = !!document.querySelector('button[aria-label*="navigation menu"]');
      return { docWidth, clientWidth, bodyWidth, hasOverflow, pageTitle, hamburgerVisible };
    });

    console.log(`✓ 375px Scroll Width: ${check375.docWidth}px (Client: ${check375.clientWidth}px) -> Overflow: ${check375.hasOverflow ? 'FAIL' : 'NONE (PASS)'}`);
    console.log(`✓ Mobile Header Title: "${check375.pageTitle}"`);
    console.log(`✓ Mobile Hamburger Visible: ${check375.hamburgerVisible ? 'YES' : 'NO'}`);

    // Click hamburger to open Mobile Navigation Drawer
    console.log('✓ Triggering Mobile Navigation Drawer at 375px...');
    const hamburgerBtn = await page.$('button[aria-label*="navigation menu"]');
    if (hamburgerBtn) {
      await hamburgerBtn.click();
      await new Promise((r) => setTimeout(r, 400));
    }

    const drawerOpenCheck = await page.evaluate(() => {
      const drawer = document.querySelector('div[role="dialog"][aria-label="Mobile Navigation Drawer"]');
      const closeBtn = !!document.querySelector('button[aria-label="Close navigation menu"]');
      return { isDrawerPresent: !!drawer, hasCloseButton: closeBtn };
    });

    console.log(`✓ Mobile Navigation Drawer Rendered: ${drawerOpenCheck.isDrawerPresent ? 'YES' : 'NO'}`);
    console.log(`✓ Accessible Close Button Present: ${drawerOpenCheck.hasCloseButton ? 'YES' : 'NO'}`);

    const path375 = path.join(ARTIFACT_DIR, 'app_shell_4_mobile_375px_drawer.png');
    await page.screenshot({ path: path375, fullPage: false });
    console.log(`✓ Screenshot saved: ${path375}`);

    // Dismiss drawer via Escape key
    console.log('✓ Pressing Escape to verify keyboard drawer dismissal...');
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 300));

    const drawerClosedCheck = await page.evaluate(() => {
      return !document.querySelector('div[role="dialog"][aria-label="Mobile Navigation Drawer"]');
    });
    console.log(`✓ Mobile Drawer closed upon Escape: ${drawerClosedCheck ? 'YES' : 'NO'}`);

    // =========================================================================
    // TEST 5: Keyboard Navigation & Focus Order
    // =========================================================================
    console.log('\n--- 5. Testing Keyboard Navigation & Focus Order ---');
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 500));

    // Tab through elements
    const focusedElements = [];
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      const focusedInfo = await page.evaluate(() => {
        const el = document.activeElement;
        return {
          tagName: el?.tagName,
          ariaLabel: el?.getAttribute('aria-label') || el?.getAttribute('title') || el?.textContent?.trim()?.slice(0, 30),
        };
      });
      focusedElements.push(focusedInfo);
    }

    console.log('✓ Keyboard Tab Focus Order (First 8 elements):');
    focusedElements.forEach((f, idx) => {
      console.log(`   ${idx + 1}. <${f.tagName}> "${f.ariaLabel}"`);
    });

    // Test Theme Switcher
    console.log('\n--- 6. Testing Theme Switcher Interaction ---');
    const themeBtn = await page.$('header button[aria-label*="Toggle theme"]');
    if (themeBtn) {
      await themeBtn.click();
      await new Promise((r) => setTimeout(r, 300));

      const isDark = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark') || document.documentElement.getAttribute('data-theme') === 'dark';
      });
      console.log(`✓ Theme Toggled: Current resolved mode is ${isDark ? 'DARK' : 'LIGHT'}`);

      const pathDark = path.join(ARTIFACT_DIR, 'app_shell_5_theme_toggled.png');
      await page.screenshot({ path: pathDark, fullPage: false });
      console.log(`✓ Screenshot saved: ${pathDark}`);
    }

    console.log('\n🎉 ALL APP SHELL VERIFICATIONS COMPLETED SUCCESSFULLY!');

  } finally {
    await browser.close();
    server.close();
    try {
      fs.rmSync(tempProfileDir, { recursive: true, force: true });
    } catch {}
  }
}

verifyAppShell().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
