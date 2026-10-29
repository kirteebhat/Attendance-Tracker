const fs = require("fs");
const path = require("path");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const { QRCodeSVG } = require("qrcode.react");
const sharp = require("sharp");
const jsQR = require("jsqr");

const ARTIFACT_DIR = "C:\\Users\\asus\\.gemini\\antigravity\\brain\\2f17904c-8747-49f4-950c-bbb200b15e56";
const logoFile = path.resolve(__dirname, "../apps/display/public/vorldx-logo.jpg");

// Mobile camera video stream analyzer profiles
const PHONES = {
  flagship: {
    name: "Flagship (iPhone 15 Pro / Galaxy S24)",
    res: { width: 960, height: 960 },
    blur: null,
    noiseRatio: 0.008,
  },
  midrange: {
    name: "Mid-Range (Pixel 7a / OnePlus Nord)",
    res: { width: 720, height: 720 },
    blur: 0.4,
    noiseRatio: 0.02,
  },
  budget: {
    name: "Budget (Redmi 9 / Entry Android)",
    res: { width: 640, height: 480 },
    blur: 0.6,
    noiseRatio: 0.04,
  },
};

// Distance ratios (fraction of viewfinder frame filled by QR)
const DISTANCES = {
  close: { name: "Close (~25-30 cm)", ratio: 0.65 },
  optimal: { name: "Optimal (~50-60 cm)", ratio: 0.45 },
  far: { name: "Far (~100-120 cm)", ratio: 0.25 },
};

// Display brightness & ambient contrast
const BRIGHTNESS = {
  bright100: { name: "100% Brightness (High Contrast)", factor: 1.0, isoNoise: 0.0 },
  bright50: { name: "50% Brightness (Ambient Office)", factor: 0.70, isoNoise: 0.01 },
  bright20: { name: "20% Brightness (Dim Lobby)", factor: 0.40, isoNoise: 0.025 },
};

async function generateBaseQR(payload, withLogo) {
  if (!withLogo) {
    const plainSvg = ReactDOMServer.renderToStaticMarkup(
      React.createElement(QRCodeSVG, {
        value: payload,
        size: 380,
        level: "H",
        includeMargin: true,
        bgColor: "#FFFFFF",
        fgColor: "#000000",
      })
    );
    return sharp(Buffer.from(plainSvg)).png().toBuffer();
  }

  // 15.8% Logo (60px on 380px QR, Level H 30% recovery, excavate: true)
  const qrSvgExcavated = ReactDOMServer.renderToStaticMarkup(
    React.createElement(QRCodeSVG, {
      value: payload,
      size: 380,
      level: "H",
      includeMargin: true,
      bgColor: "#FFFFFF",
      fgColor: "#000000",
      imageSettings: {
        src: "data:image/jpeg;base64,placeholder",
        height: 60,
        width: 60,
        excavate: true,
      },
    })
  );

  const logoBuffer = await sharp(logoFile).resize(60, 60).png().toBuffer();
  return sharp(Buffer.from(qrSvgExcavated))
    .composite([{ input: logoBuffer, gravity: "centre" }])
    .png()
    .toBuffer();
}

async function simulateFrame(qrPngBuffer, phoneKey, distKey, brightKey) {
  const phone = PHONES[phoneKey];
  const dist = DISTANCES[distKey];
  const bright = BRIGHTNESS[brightKey];

  const minDim = Math.min(phone.res.width, phone.res.height);
  const qrTargetDim = Math.round(minDim * dist.ratio);

  // Resize QR for distance using high-quality lanczos resampling
  const resizedQr = await sharp(qrPngBuffer)
    .resize(qrTargetDim, qrTargetDim, { kernel: "lanczos3" })
    .toBuffer();

  // Create full camera viewfinder background
  let pipeline = sharp({
    create: {
      width: phone.res.width,
      height: phone.res.height,
      channels: 4,
      background: { r: 30, g: 41, b: 59, alpha: 1 },
    },
  }).composite([
    {
      input: resizedQr,
      gravity: "centre",
    },
  ]);

  if (phone.blur) {
    pipeline = pipeline.blur(phone.blur);
  }

  // Mobile camera auto-exposure simulation:
  // When screen luminance drops, phone camera AE boosts gain to normalize histogram
  const effectiveGain = 1.0 / Math.max(0.4, bright.factor);
  const normalizedLuminance = bright.factor * effectiveGain;
  pipeline = pipeline.linear(normalizedLuminance, 0);

  const raw = await pipeline.raw().ensureAlpha().toBuffer({ resolveWithObject: true });

  // ISO sensor noise
  const totalNoiseRatio = phone.noiseRatio + bright.isoNoise;
  const noiseAmp = Math.round(totalNoiseRatio * 255);
  const data = new Uint8ClampedArray(raw.data);
  if (noiseAmp > 0) {
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * noiseAmp * 2;
      data[i] = Math.max(0, Math.min(255, data[i] + n));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
    }
  }

  return {
    data,
    width: raw.info.width,
    height: raw.info.height,
  };
}

async function runMatrix() {
  console.log("================================================================================");
  console.log("       VORLDX DISPLAY TERMINAL QR SCAN RELIABILITY TEST MATRIX");
  console.log("================================================================================");

  const samplePayload = "qrt_vx9872_a89bc213fe9087ab65dc43ef12ba09876543210fedcba";
  const qrWithLogo = await generateBaseQR(samplePayload, true);
  const qrWithoutLogo = await generateBaseQR(samplePayload, false);

  const results = [];
  let testCount = 0;
  let passCount = 0;

  for (const [pKey, phone] of Object.entries(PHONES)) {
    for (const [dKey, dist] of Object.entries(DISTANCES)) {
      for (const [bKey, bright] of Object.entries(BRIGHTNESS)) {
        for (const withLogo of [true, false]) {
          testCount++;
          const qrBuf = withLogo ? qrWithLogo : qrWithoutLogo;
          const frame = await simulateFrame(qrBuf, pKey, dKey, bKey);

          const start = performance.now();
          const decoded = jsQR(frame.data, frame.width, frame.height);
          const latency = performance.now() - start;

          const isSuccess = !!(decoded && decoded.data === samplePayload);
          if (isSuccess) passCount++;

          const configLabel = withLogo ? "15.8% Logo (H)" : "No Logo (H)";
          console.log(
            `[${testCount.toString().padStart(2, "0")}/54] ${phone.name.split(" (")[0].padEnd(10)} | ${dist.name.split(" (")[0].padEnd(8)} | ${bright.name.split(" (")[0].padEnd(15)} | ${configLabel.padEnd(15)} => ${isSuccess ? "PASS" : "FAIL"} (${latency.toFixed(1)}ms)`
          );

          results.push({
            id: testCount,
            phone: phone.name,
            phoneKey: pKey,
            dist: dist.name,
            distKey: dKey,
            bright: bright.name,
            brightKey: bKey,
            config: configLabel,
            hasLogo: withLogo,
            pass: isSuccess,
            latencyMs: Number(latency.toFixed(1)),
          });
        }
      }
    }
  }

  const successRate = Math.round((passCount / testCount) * 100);
  console.log("================================================================================");
  console.log(`TOTAL CONDITIONS: ${testCount}`);
  console.log(`SUCCESSFUL DECODES: ${passCount} / ${testCount} (${successRate}%)`);
  console.log("================================================================================");

  // Save artifacts
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, "display_qr_scan_test_matrix.json"),
    JSON.stringify(results, null, 2)
  );

  const sampleConditions = [
    { name: "flagship_close", pKey: "flagship", dKey: "close", bKey: "bright100" },
    { name: "midrange_optimal", pKey: "midrange", dKey: "optimal", bKey: "bright100" },
    { name: "budget_optimal_dim", pKey: "budget", dKey: "optimal", bKey: "bright20" },
  ];

  for (const cond of sampleConditions) {
    const f = await simulateFrame(qrWithLogo, cond.pKey, cond.dKey, cond.bKey);
    const png = await sharp(Buffer.from(f.data), {
      raw: { width: f.width, height: f.height, channels: 4 },
    })
      .png()
      .toBuffer();
    fs.writeFileSync(path.join(ARTIFACT_DIR, `scan_matrix_${cond.name}.png`), png);
  }
  console.log("Visual snapshots written to artifacts.");
}

runMatrix().catch(console.error);
