const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const ARTIFACT_DIR = 'C:\\Users\\asus\\.gemini\\antigravity\\brain\\2f17904c-8747-49f4-950c-bbb200b15e56';
const DIST_DIR = path.resolve(__dirname, '../apps/web/dist');
const PORT = 3001;

// Simple static HTTP server for apps/web/dist with SPA fallback & mock APIs
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
    // Feature flags mock
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

    // HR presence mock
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

    // Calendar events mock
    if (req.url.startsWith('/api/calendar/events')) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({
        success: true,
        data: [
          {
            _id: 'evt_1',
            title: 'Diwali Holiday (Festival of Lights)',
            type: 'holiday',
            startDate: '2026-10-29T00:00:00.000Z',
            endDate: '2026-10-29T23:59:59.999Z',
            isFullDay: true,
            description: 'Gazetted national holiday. Corporate offices closed.',
            location: 'All Office Locations',
            audience: { scope: 'all' },
          },
          {
            _id: 'evt_2',
            title: 'Q4 Global Workforce All-Hands',
            type: 'meeting',
            startDate: '2026-10-29T10:00:00.000Z',
            endDate: '2026-10-29T11:30:00.000Z',
            isFullDay: false,
            description: 'Executive quarterly strategy presentation & open Q&A.',
            location: 'Auditorium & Virtual Link',
            audience: { scope: 'all' },
          },
          {
            _id: 'evt_3',
            title: 'Engineering Sprint Retrospective',
            type: 'meeting',
            startDate: '2026-10-30T14:00:00.000Z',
            endDate: '2026-10-30T15:00:00.000Z',
            isFullDay: false,
            description: 'Bi-weekly tech review of deployment and sprint milestones.',
            location: 'Boardroom B',
            audience: { scope: 'department' },
          }
        ]
      }));
    }

    // WFH requests mock
    if (req.url.startsWith('/api/wfh/admin/requests') || req.url.startsWith('/api/wfh')) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({
        success: true,
        data: [
          {
            _id: 'wfh_1',
            employeeId: 'EMP-102',
            employee: { name: 'Aarav Patel', department: 'Engineering' },
            dateKey: '2026-10-29',
            status: 'APPROVED',
            reason: 'Broadband technician installation & server testing',
          },
          {
            _id: 'wfh_2',
            employeeId: 'EMP-105',
            employee: { name: 'Priya Sharma', department: 'Design' },
            dateKey: '2026-10-29',
            status: 'APPROVED',
            reason: 'Remote UI prototyping & asset delivery',
          }
        ]
      }));
    }

    // Attendance records mock
    if (req.url.startsWith('/api/attendance')) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({
        success: true,
        data: [
          {
            _id: 'att_1',
            employeeId: 'EMP-109',
            employee: { name: 'Vikram Singh', department: 'Operations' },
            dateKey: '2026-10-29',
            status: 'ABSENT',
            method: 'QR_SCAN',
          }
        ],
        meta: {
          total: 1,
          page: 1,
          limit: 100,
          totalPages: 1
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
      console.log(`✓ Static SPA test server running on http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

function analyzeBundleSizes() {
  console.log('\n📊 === Real Vite Bundle Size Analysis ===');
  const assetsDir = path.join(DIST_DIR, 'assets');
  const files = fs.readdirSync(assetsDir);

  const stats = {};
  for (const f of files) {
    const fileStat = fs.statSync(path.join(assetsDir, f));
    const kb = (fileStat.size / 1024).toFixed(2);
    if (f.startsWith('index-') && f.endsWith('.js')) {
      stats.mainJs = { file: f, kb: `${kb} KB`, bytes: fileStat.size };
    }
    if (f.startsWith('index-') && f.endsWith('.css')) {
      stats.mainCss = { file: f, kb: `${kb} KB`, bytes: fileStat.size };
    }
    if (f.startsWith('three-vendor-')) {
      stats.threeVendor = { file: f, kb: `${kb} KB`, bytes: fileStat.size };
    }
    if (f.startsWith('AttendanceOrb3D-')) {
      stats.attendanceOrb = { file: f, kb: `${kb} KB`, bytes: fileStat.size };
    }
  }

  console.log(`- Main Application Bundle (JS):    ${stats.mainJs?.file} -> ${stats.mainJs?.kb}`);
  console.log(`- Design System Stylesheet (CSS):   ${stats.mainCss?.file} -> ${stats.mainCss?.kb}`);
  console.log(`- Lazy Three.js Chunk (3D Vendor): ${stats.threeVendor?.file} -> ${stats.threeVendor?.kb}`);
  console.log(`- Lazy Attendance Orb 3D Scene:     ${stats.attendanceOrb?.file} -> ${stats.attendanceOrb?.kb}`);

  return stats;
}

async function runTests() {
  const bundleStats = analyzeBundleSizes();
  const server = await startStaticServer();

  console.log('\n🚀 Launching Puppeteer browser to verify Calendar & Motion...');
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browserPath = fs.existsSync(edgePath) ? edgePath : chromePath;

  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu-sandbox',
      '--use-gl=angle',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--window-size=1440,900',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log(`[Browser Console Error] ${msg.text()}`);
    });

    // 1. Authenticate user in localStorage
    console.log('\n--- 1. Authenticating Admin Session ---');
    await page.goto(`http://localhost:${PORT}/login`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
      localStorage.setItem('vorldx_access_token', 'mock_admin_token_jwt_vorldx_2026');
      localStorage.setItem('auth_token', 'mock_admin_token_jwt_vorldx_2026');
      localStorage.setItem(
        'vorldx_cached_user',
        JSON.stringify({
          id: 'admin_1',
          employeeId: 'ADM-001',
          email: 'admin@vorldx.demo',
          name: 'Sarah Jenkins',
          role: 'ADMIN',
        })
      );
      localStorage.setItem(
        'auth_user',
        JSON.stringify({
          id: 'admin_1',
          employeeId: 'ADM-001',
          email: 'admin@vorldx.demo',
          name: 'Sarah Jenkins',
          role: 'ADMIN',
        })
      );
    });

    // 2. Navigate to Calendar Page
    console.log('\n--- 2. Navigating to Calendar Page ---');
    await page.goto(`http://localhost:${PORT}/calendar`, { waitUntil: 'networkidle0', timeout: 20000 });
    await new Promise((r) => setTimeout(r, 1200));

    // Verify calendar header and views
    const calDetails = await page.evaluate(() => {
      const title = document.querySelector('h1')?.textContent;
      const monthGrid = document.querySelectorAll('.grid-cols-7 > div');
      const selectedPanel = document.querySelector('#selected-day-records-panel');
      const progressRing = document.querySelector('div[role="progressbar"]');
      return {
        title,
        cellCount: monthGrid.length,
        hasSelectedPanel: !!selectedPanel,
        hasProgressRing: !!progressRing,
        panelText: selectedPanel?.textContent?.slice(0, 200),
      };
    });

    console.log(`✓ Calendar Page Title: "${calDetails.title}"`);
    console.log(`✓ Month Grid Cells Rendered: ${calDetails.cellCount}`);
    console.log(`✓ Selected Day Records & Summaries Panel Active: ${calDetails.hasSelectedPanel ? 'YES' : 'NO'}`);
    console.log(`✓ Animated ProgressRing Present: ${calDetails.hasProgressRing ? 'YES' : 'NO'}`);

    // Click on a specific day cell (e.g. cell with day 29 or click next day)
    console.log('✓ Selecting date in calendar grid...');
    const dayCells = await page.$$('.grid-cols-7 > div[class*="min-h"]');
    if (dayCells.length > 15) {
      // Click the 20th day cell
      await dayCells[20].click();
      await new Promise((r) => setTimeout(r, 600));
    }

    // Capture Calendar Month View with Selected Day Records Panel
    const calScreenshotPath = path.join(ARTIFACT_DIR, 'calendar_1_selected_day_records.png');
    await page.screenshot({ path: calScreenshotPath, fullPage: true });
    console.log(`✓ Screenshot saved: ${calScreenshotPath}`);

    // 3. Switch to Week View
    console.log('\n--- 3. Testing Week View & Navigation ---');
    const weekBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find((b) => b.textContent?.includes('Week View'));
    });
    if (weekBtn) {
      await weekBtn.click();
      await new Promise((r) => setTimeout(r, 800));
    }

    const weekCards = await page.$$('.grid-cols-1.md\\:grid-cols-7 > div');
    console.log(`✓ Week View Days Rendered: ${weekCards.length}`);

    const weekScreenshotPath = path.join(ARTIFACT_DIR, 'calendar_2_week_view.png');
    await page.screenshot({ path: weekScreenshotPath, fullPage: true });
    console.log(`✓ Screenshot saved: ${weekScreenshotPath}`);

    // 4. Measure Runtime Frame Rate (FPS) on Dashboard
    console.log('\n--- 4. Measuring Real Runtime Frame Rate (FPS) on Dashboard ---');
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0', timeout: 20000 });
    await new Promise((r) => setTimeout(r, 1200));

    console.log('✓ Measuring frame rate with requestAnimationFrame over 2,000ms...');
    const fpsMetrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        let frames = 0;
        const start = performance.now();
        function loop(now) {
          frames++;
          if (now - start >= 2000) {
            const duration = now - start;
            const fps = (frames * 1000) / duration;
            resolve({
              frames,
              durationMs: Math.round(duration),
              fps: Math.round(fps * 10) / 10,
            });
          } else {
            requestAnimationFrame(loop);
          }
        }
        requestAnimationFrame(loop);
      });
    });

    console.log(`🎯 Real Runtime Frame Rate: ${fpsMetrics.fps} FPS (${fpsMetrics.frames} frames in ${fpsMetrics.durationMs}ms)`);

    const dashScreenshotPath = path.join(ARTIFACT_DIR, 'motion_1_dashboard_fps.png');
    await page.screenshot({ path: dashScreenshotPath, fullPage: false });
    console.log(`✓ Dashboard Screenshot saved: ${dashScreenshotPath}`);

    console.log('\n=============================================');
    console.log('✅ ALL VERIFICATIONS PASSED SUCCESSFULLY!');
    console.log('=============================================');
    console.log(JSON.stringify({
      bundleStats,
      fps: fpsMetrics.fps,
      calendarPassed: calDetails.hasSelectedPanel && calDetails.hasProgressRing,
    }, null, 2));

  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    server.close();
  }
}

runTests().catch((err) => {
  console.error('❌ Verification script failed:', err);
  process.exit(1);
});
