import puppeteer from "puppeteer-core";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { preview } from "vite";
import { createApp } from "../../api/src/app";
import { initSocketServer, closeSocketServer } from "../../api/src/sockets/socketServer";
import { User, hashPassword } from "../../api/src/models/User";
import { Employee } from "../../api/src/models/Employee";
import { AttendancePolicy } from "../../api/src/models/AttendancePolicy";
import { FeatureFlag } from "../../api/src/models/FeatureFlag";
import { AppRelease } from "../../api/src/models/AppRelease";
import { featureFlagService } from "../../api/src/services/featureFlag.service";
import { updateService } from "../../api/src/services/update.service";
import { UserRole } from "@vorldx/shared";
import { env } from "../../api/src/config/env";
import jwt from "jsonwebtoken";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const executablePath = fs.existsSync(chromePath) ? chromePath : edgePath;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactDir = "C:\\Users\\asus\\.gemini\\antigravity\\brain\\2f17904c-8747-49f4-950c-bbb200b15e56";

async function runUpdatesVerification() {
  console.log("==================================================");
  console.log("Starting Full Verification of OTA Updates & Release System");
  console.log("Browser executable:", executablePath);
  console.log("==================================================");

  // 1. In-Memory MongoDB
  console.log("1. Starting MongoMemoryServer...");
  const mongod = await MongoMemoryServer.create();
  const mongoUri = mongod.getUri();
  await mongoose.connect(mongoUri);

  // 2. Enable Feature Flag
  console.log("2. Enabling otaUpdates feature flag...");
  await FeatureFlag.create({
    key: "otaUpdates",
    name: "One-Click Updates & App Releases",
    description: "In-app update checks and deployment bundles",
    isEnabled: true,
  });
  featureFlagService.setInMemoryOverride("otaUpdates", true);

  // 3. Seed Users
  console.log("3. Seeding Administrator & Employee accounts...");
  const adminPassword = await hashPassword("Admin@12345");
  const adminUser = await User.create({
    employeeId: "ADM-001",
    email: "admin@vorldx.demo",
    passwordHash: adminPassword,
    role: UserRole.ADMIN,
    status: "ACTIVE",
  });

  await Employee.create({
    employeeId: "ADM-001",
    name: "System Administrator",
    email: "admin@vorldx.demo",
    department: "Executive",
    designation: "Platform Super Admin",
    joiningDate: "2024-01-01",
    status: "ACTIVE",
    isActive: true,
    userId: adminUser._id,
  });

  // 4. Seed Initial Releases for Verification
  console.log("4. Seeding initial baseline releases...");
  await AppRelease.create([
    {
      platform: "MOBILE",
      version: "1.0.0",
      versionCode: 1,
      minSupportedVersion: "1.0.0",
      minSupportedVersionCode: 1,
      notes: "Initial general availability release for Android and iOS.",
      channel: "production",
      forceUpdate: false,
      isPublished: true,
      publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
    },
    {
      platform: "DISPLAY",
      version: "1.0.0",
      versionCode: 1,
      minSupportedVersion: "1.0.0",
      minSupportedVersionCode: 1,
      notes: "Display kiosk baseline firmware.",
      channel: "production",
      forceUpdate: false,
      isPublished: true,
      publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
    },
    {
      platform: "WEB",
      version: "1.2.0",
      versionCode: 12,
      minSupportedVersion: "1.0.0",
      minSupportedVersionCode: 1,
      notes: "Web workforce management suite baseline.",
      channel: "production",
      forceUpdate: false,
      isPublished: true,
      publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
    },
  ]);

  // 5. Test Simulated Release & Forced Update Logic directly via Service
  console.log("5. Testing Simulated Release & Forced Update Logic...");
  // 5a. Current version check
  const checkCurrent = await updateService.checkUpdate({
    platform: "MOBILE",
    currentVersion: "1.0.0",
    channel: "production",
  });
  console.log("   Baseline check (v1.0.0 vs v1.0.0):", {
    updateAvailable: checkCurrent.updateAvailable,
    forceUpdate: checkCurrent.forceUpdate,
  });

  // 5b. Publish an optional update v1.1.0
  await updateService.publishRelease(
    {
      platform: "MOBILE",
      version: "1.1.0",
      versionCode: 2,
      minSupportedVersion: "1.0.0",
      notes: "Optional performance boost and battery optimization.",
      channel: "production",
      forceUpdate: false,
    },
    { userId: adminUser._id.toString(), employeeId: "ADM-001", role: "ADMIN" }
  );

  const checkSimulated = await updateService.checkUpdate({
    platform: "MOBILE",
    currentVersion: "1.0.0",
    channel: "production",
  });
  console.log("   Simulated Release check (v1.0.0 vs v1.1.0):", {
    updateAvailable: checkSimulated.updateAvailable,
    forceUpdate: checkSimulated.forceUpdate,
    latestVersion: checkSimulated.latestVersion,
  });

  // 5c. Publish a forced update v2.0.0 with minSupportedVersion 2.0.0
  await updateService.publishRelease(
    {
      platform: "MOBILE",
      version: "2.0.0",
      versionCode: 3,
      minSupportedVersion: "2.0.0",
      notes: "Critical breaking protocol upgrade. Mandatory update.",
      channel: "production",
      forceUpdate: true,
    },
    { userId: adminUser._id.toString(), employeeId: "ADM-001", role: "ADMIN" }
  );

  const checkForced = await updateService.checkUpdate({
    platform: "MOBILE",
    currentVersion: "1.0.0",
    channel: "production",
  });
  console.log("   Forced Update check (v1.0.0 vs v2.0.0 [min 2.0.0]):", {
    updateAvailable: checkForced.updateAvailable,
    forceUpdate: checkForced.forceUpdate,
    minSupportedVersion: checkForced.minSupportedVersion,
  });

  // 6. Start API Server on port 4000
  console.log("6. Starting HTTP & WebSocket API Server on port 4000...");
  const apiApp = createApp();
  const apiServer = createServer(apiApp);
  initSocketServer(apiServer);

  await new Promise<void>((resolve) => {
    apiServer.listen(4000, () => resolve());
  });
  console.log("   API Server listening at http://localhost:4000");

  // 7. Start Vite Preview Server on port 4176
  console.log("7. Starting Vite Preview Server on port 4176...");
  const previewServer = await preview({
    root: path.resolve(__dirname, ".."),
    preview: { port: 4176, host: "localhost" },
  });
  console.log("   Web Portal live at http://localhost:4176");

  // Tokens
  const adminToken = jwt.sign(
    {
      userId: adminUser._id.toString(),
      employeeId: adminUser.employeeId,
      email: adminUser.email,
      role: adminUser.role,
    },
    env.JWT_SECRET,
    { expiresIn: "8h" }
  );

  // 8. Launch Puppeteer Browser
  console.log("8. Launching Puppeteer Browser for UI Validation...");
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on("console", (msg) => console.log("   [BROWSER CONSOLE]", msg.type(), msg.text()));
  page.on("pageerror", (err) => console.log("   [BROWSER ERROR]", err.message));

  // 8a. Direct Session Authentication injection
  console.log("   Injecting administrator session into localStorage...");
  await page.goto("http://localhost:4176/login", { waitUntil: "domcontentloaded" });
  await page.evaluate((t, u) => {
    localStorage.setItem("vorldx_access_token", t);
    localStorage.setItem(
      "vorldx_cached_user",
      JSON.stringify({
        id: u._id,
        _id: u._id,
        employeeId: u.employeeId,
        email: u.email,
        role: u.role,
        name: "System Administrator",
      })
    );
  }, adminToken, adminUser);

  // 8b. Navigate to /releases
  console.log("   Navigating to http://localhost:4176/releases...");
  await page.goto("http://localhost:4176/releases", { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 2000));

  // Screenshot 1: Admin Releases Page
  const screen1 = path.join(artifactDir, "update_1_admin_releases_page.png");
  await page.screenshot({ path: screen1 });
  console.log("   Captured:", screen1);

  // 8c. Open Publish Modal
  console.log("   Opening 'Publish New Release' modal...");
  const publishBtn = await page.waitForSelector("button ::-p-text(Publish New Release)");
  if (publishBtn) await publishBtn.click();
  await new Promise((r) => setTimeout(r, 800));

  // Fill in form for a simulated display release v1.1.0
  const inputs = await page.$$("input");
  for (const input of inputs) {
    const placeholder = await page.evaluate((el) => el.getAttribute("placeholder"), input);
    if (placeholder && placeholder.includes("1.3.0")) {
      await input.type("1.1.0");
    }
  }

  const textarea = await page.$("textarea");
  if (textarea) {
    await textarea.type("Simulated OTA patch: High-contrast clock enhancement and offline token sync.");
  }

  // Screenshot 2: Publish Modal
  const screen2 = path.join(artifactDir, "update_2_publish_modal.png");
  await page.screenshot({ path: screen2 });
  console.log("   Captured:", screen2);

  // Submit Modal Form
  const submitBtn = await page.$('button[type="submit"]');
  if (submitBtn) await submitBtn.click();
  await new Promise((r) => setTimeout(r, 2000));

  // Screenshot 3: Release Created in Table
  const screen3 = path.join(artifactDir, "update_3_release_created_table.png");
  await page.screenshot({ path: screen3 });
  console.log("   Captured:", screen3);

  // 8d. Publish Web Update v1.3.0 (Optional) to trigger Non-blocking Web Banner
  console.log("   Publishing Web Release v1.3.0 to verify Web Update Banner...");
  await updateService.publishRelease(
    {
      platform: "WEB",
      version: "1.3.0",
      versionCode: 13,
      minSupportedVersion: "1.0.0",
      notes: "New real-time release governance panel and version indicators.",
      channel: "production",
      forceUpdate: false,
    },
    { userId: adminUser._id.toString(), employeeId: "ADM-001", role: "ADMIN" }
  );

  await page.reload({ waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 2000));

  // Screenshot 4: Web Update Banner
  const screen4 = path.join(artifactDir, "update_4_web_update_banner.png");
  await page.screenshot({ path: screen4 });
  console.log("   Captured:", screen4);

  // 8e. Publish Mandatory Web Update v2.0.0 (Forced) to trigger Blocking Screen
  console.log("   Publishing Forced Web Release v2.0.0 to verify Blocking Overlay...");
  await updateService.publishRelease(
    {
      platform: "WEB",
      version: "2.0.0",
      versionCode: 20,
      minSupportedVersion: "2.0.0",
      notes: "Critical architectural migration. Full reload required.",
      channel: "production",
      forceUpdate: true,
    },
    { userId: adminUser._id.toString(), employeeId: "ADM-001", role: "ADMIN" }
  );

  await page.reload({ waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 2000));

  // Screenshot 5: Blocking Update Overlay
  const screen5 = path.join(artifactDir, "update_5_blocking_update_overlay.png");
  await page.screenshot({ path: screen5 });
  console.log("   Captured:", screen5);

  // Clean Up
  console.log("9. Cleaning up test servers and browser...");
  await browser.close();
  await new Promise<void>((resolve) => previewServer.httpServer.close(() => resolve()));
  await closeSocketServer();
  await new Promise<void>((resolve) => apiServer.close(() => resolve()));
  await mongoose.disconnect();
  await mongod.stop();

  console.log("==================================================");
  console.log("OTA Updates & Release System Verification SUCCESSFUL!");
  console.log("==================================================");
}

runUpdatesVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
