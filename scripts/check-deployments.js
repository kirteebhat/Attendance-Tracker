const https = require('https');

async function testUrl(name, url, options = {}) {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers: options.headers || { 'User-Agent': 'Mozilla/5.0' },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const duration = Date.now() - start;
    let text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}

    return {
      name,
      url,
      status: res.status,
      statusText: res.statusText,
      duration,
      data: json || text.slice(0, 300),
      ok: res.ok
    };
  } catch (err) {
    return {
      name,
      url,
      status: 0,
      statusText: 'FETCH_ERROR',
      duration: Date.now() - start,
      error: err.message,
      ok: false
    };
  }
}

async function main() {
  console.log('====================================================');
  console.log('🔍 CHECKING ALL LIVE CLOUD DEPLOYMENTS (VorldX)');
  console.log('====================================================\n');

  // 1. Backend Health
  console.log('1. Checking Render Backend Health...');
  const healthRes = await testUrl('Render Healthcheck', 'https://attendance-tracker-56du.onrender.com/health');
  console.log(`   Status: ${healthRes.status} ${healthRes.statusText} (${healthRes.duration}ms)`);
  console.log('   Response:', healthRes.data);
  console.log('');

  // 2. Backend Login API (Live Authentication)
  console.log('2. Checking Backend Live Authentication (POST /api/auth/login)...');
  const loginRes = await testUrl('Admin Login API', 'https://attendance-tracker-56du.onrender.com/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      email: 'admin@vorldx.demo',
      password: 'Admin@VorldX2026!'
    }
  });
  console.log(`   Status: ${loginRes.status} ${loginRes.statusText} (${loginRes.duration}ms)`);
  console.log('   Response Success:', loginRes.data?.success);
  let token = loginRes.data?.data?.tokens?.accessToken;
  console.log('   Access Token Received:', !!token);
  console.log('');

  // 3. Backend Authenticated Endpoint (/api/displays)
  if (token) {
    console.log('3. Checking Protected Endpoint with Token (GET /api/displays)...');
    const displayApiRes = await testUrl('Displays API', 'https://attendance-tracker-56du.onrender.com/api/displays', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`   Status: ${displayApiRes.status} ${displayApiRes.statusText} (${displayApiRes.duration}ms)`);
    console.log('   Displays Count:', Array.isArray(displayApiRes.data?.data) ? displayApiRes.data.data.length : 'N/A');
    if (Array.isArray(displayApiRes.data?.data)) {
      displayApiRes.data.data.forEach(d => {
        console.log(`     - Terminal: ${d.terminalId} | Name: ${d.name} | Status: ${d.status} | HasActivePairingCode: ${!!d.pairingCode}`);
      });
    }
    console.log('');

    // 4. Checking Attendance Ledger (/api/attendance)
    console.log('4. Checking Protected Attendance Ledger (GET /api/attendance)...');
    const attendanceRes = await testUrl('Attendance API', 'https://attendance-tracker-56du.onrender.com/api/attendance', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`   Status: ${attendanceRes.status} ${attendanceRes.statusText} (${attendanceRes.duration}ms)`);
    console.log('   Attendance Records Returned:', Array.isArray(attendanceRes.data?.data) ? attendanceRes.data.data.length : 'N/A');
    console.log('');
  }

  // 5. HR Web Portal Frontend
  console.log('5. Checking HR Web Portal on Vercel...');
  const webRes = await testUrl('HR Web Portal', 'https://attendance-tracker-apps-rehu9vems-kirtee.vercel.app');
  console.log(`   Status: ${webRes.status} ${webRes.statusText} (${webRes.duration}ms)`);
  console.log('   Contains HTML Document:', typeof webRes.data === 'string' && webRes.data.includes('<html'));
  console.log('');

  // 6. Office QR Display Kiosk Frontend
  console.log('6. Checking Office QR Display Kiosk on Vercel...');
  const displayRes = await testUrl('Office QR Display', 'https://attendance-tracker-qq8u.vercel.app');
  console.log(`   Status: ${displayRes.status} ${displayRes.statusText} (${displayRes.duration}ms)`);
  console.log('   Contains HTML Document:', typeof displayRes.data === 'string' && displayRes.data.includes('<html'));
  console.log('');

  // 7. GitHub Repository
  console.log('7. Checking GitHub Public Repository...');
  const repoRes = await testUrl('GitHub Repository', 'https://github.com/kirteebhat/Attendance-Tracker');
  console.log(`   Status: ${repoRes.status} ${repoRes.statusText} (${repoRes.duration}ms)`);
  console.log('');

  console.log('====================================================');
  console.log('🏁 DEPLOYMENT CHECK COMPLETE');
  console.log('====================================================');
}

main().catch(console.error);
