const http = require("http");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");
const axeCore = require("axe-core");

const DIST_DIR = path.resolve(__dirname, "../apps/web/dist");
const PORT = 3007;
const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

function createStaticServer() {
  return http.createServer((req, res) => {
    if (req.url.startsWith("/api/")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ success: true, user: { role: "ADMIN", name: "Priya" }, data: [] }));
    }
    let filePath = path.join(DIST_DIR, req.url.split("?")[0]);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(DIST_DIR, "index.html");
    }
    const ext = path.extname(filePath);
    const contentTypeMap = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css" };
    res.writeHead(200, { "Content-Type": contentTypeMap[ext] || "text/plain" });
    fs.createReadStream(filePath).pipe(res);
  });
}

async function diagnose() {
  const server = createStaticServer();
  await new Promise((resolve) => server.listen(PORT, resolve));

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // Authenticate properly before visiting
  await page.goto(`http://localhost:${PORT}/login`, { waitUntil: "networkidle0" });
  await page.evaluate(() => {
    localStorage.setItem("vorldx_access_token", "mock-jwt-token-admin");
    localStorage.setItem(
      "vorldx_cached_user",
      JSON.stringify({
        id: "usr-admin-1",
        employeeId: "HR-001",
        name: "Priya Sharma",
        email: "admin@vorldx.demo",
        role: "ADMIN",
        department: "Human Resources",
      })
    );
  });

  const testPaths = [
    "/leave",
    "/enquiries",
    "/displays",
    "/releases",
  ];

  for (const tPath of testPaths) {
    console.log(`\n================== DIAGNOSING ${tPath} ==================`);
    await page.goto(`http://localhost:${PORT}${tPath}`, { waitUntil: "networkidle0" });
    await page.evaluate(axeCore.source);
    const results = await page.evaluate(async () => {
      return await window.axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
      });
    });

    console.log(`Violations found on ${tPath}:`, results.violations.length);
    for (const v of results.violations) {
      if (v.impact === "critical" || v.impact === "serious") {
        console.log(`\n=== Rule: ${v.id} (${v.impact}) - ${v.description} ===`);
        for (const node of v.nodes) {
          console.log(`  Selector: ${node.target.join(" ")}`);
          console.log(`  HTML: ${node.html.slice(0, 150)}`);
          console.log(`  Failure: ${node.failureSummary ? node.failureSummary.replace(/\n/g, " ") : ""}`);
        }
      }
    }
  }

  await browser.close();
  server.close();
}

diagnose().catch(console.error);
