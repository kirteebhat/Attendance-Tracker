# VorldX Attendance Tracker: Presentation Study Material & Quick Reference Guide

> **Entity:** VorldX Industries Private Limited (CIN: `U62099UP2026PTC245598`)  
> **Prepared for:** Final Project Evaluation & Google Meet Demonstration

---

## 1. Executive Summary & Core Identity

- **What is it?** A privacy-first, enterprise-grade attendance and workforce management ecosystem featuring dynamic cryptographic QR verification, real-time manager approval queues, and automated punctuality evaluation.
- **Strict Architectural Exclusions (Privacy-First):**
  - **No GPS or Geofencing:** Preserves employee battery life and civil privacy off-premise.
  - **No BLE / Wi-Fi Sniffing:** Avoids hardware-dependent network sniffing vulnerabilities.
  - **No Biometrics:** Eliminates regulatory liabilities associated with facial recognition/fingerprint storage.
  - **No Payroll / Productivity Ranking:** Strictly focuses on transparent attendance ledger accounting without punitive scoring.

---

## 2. Complete Technology Stack & Implementation Details

| Layer | Technology | Exact Version | How It Is Implemented in Code |
| :--- | :--- | :--- | :--- |
| **Monorepo** | NPM Workspaces | 10.x / Node 20+ | Multi-package structure (`apps/*`, `packages/*`) with shared TypeScript types (`@vorldx/shared`). |
| **Backend Runtime** | Node.js + Express | Express 4.21 | Modular architecture with controllers, services, middleware, and route handlers (`apps/api/src`). |
| **Language** | TypeScript | 5.7+ | Strict typing across API contracts, database models, and UI components; 100% typecheck pass. |
| **Schema Validation** | Zod | 3.24 | Request payload parsing, query string validation, and runtime environment variable assertion (`env.ts`). |
| **Database** | MongoDB Atlas | MongoDB 7.0+ | Hosted NoSQL database using Mongoose 8.9 ODM. Enforces compound indexes, unique constraints, and schema validations. |
| **Authentication** | JWT + bcryptjs | `jsonwebtoken` 9.0, `bcryptjs` 2.4 | Dual-token authentication (15-minute access token + 7-day refresh token), salted password hashing (rounds = 10). |
| **Security Middleware** | Helmet, CORS, Rate-Limit | `express-rate-limit` 7.5 | Custom CORS origin matcher, strict HTTP response headers, IP rate-limiting, and 5-attempt account lockout. |
| **Real-Time Engine** | Socket.IO | 4.8.4 | WebSocket server handling room isolation (`hr`, `kiosk:{id}`, `employee:{id}`) for instant event dispatching. |
| **Admin/HR Web Portal** | React + Vite | React 18.3, Vite 6.1 | SPA with Tailwind CSS, Lucide icons, and TanStack React Query for background caching and optimistic updates. |
| **Kiosk Display App** | React + Vite | React 18.3, Vite 6.1 | Web kiosk displaying 30–45s rotating cryptographic QR challenges via canvas rendering with sound cues. |
| **Employee Mobile App** | React Native + Expo | Expo SDK 52, React Native 0.76 | File-based routing (`expo-router` v4), cross-platform mobile and web rendering (`react-native-web`). |
| **Cloud Hosting** | Render + Vercel | Production Clouds | Render serves the unified API & Web SPA; Vercel hosts the dynamic Display Kiosk; Atlas hosts MongoDB. |

---

## 3. How the Core Modules Work (Under the Hood)

### A. Dynamic Cryptographic QR Check-In Workflow
1. **Challenge Generation (`KioskService.ts`):**
   - The office kiosk requests a challenge via `GET /api/kiosk/challenge`.
   - The backend signs a payload containing `kioskId`, timestamp `t`, and a random cryptographic `nonce` using HMAC-SHA256:
     $$\text{Token} = \text{HMAC-SHA256}(\text{kioskId} + t + \text{nonce}, \text{JWT\_SECRET})$$
   - Challenge expires strictly after **45 seconds** (with a 15-second grace window to absorb clock skew).
2. **Scan & Ingestion (`PunchService.ts`):**
   - The employee scans the QR code from their mobile app.
   - The payload is sent via `POST /api/attendance/punch`.
   - Backend verifies:
     - Has the token already been consumed? *(Replay attack defense prevents photo sharing via Slack/WhatsApp).*
     - Is the timestamp within the valid TTL window?
     - Has the employee already punched in within the cooldown window (2 minutes)?
3. **Punctuality Calculation (`PunctualityEngine.ts`):**
   - The server compares punch time against the employee's assigned shift (`09:30 AM`).
   - If punch $\le \text{09:45 AM}$ (15-min grace): Marked **`PRESENT`**.
   - If punch $> \text{09:45 AM}$ and $\le \text{11:00 AM}$: Marked **`LATE`** with exact late minutes recorded.
   - If punch $> \text{11:00 AM}$: Evaluated as **`HALF_DAY`**.
   - WebSocket events `attendance.created` and `kiosk.punch.success` are emitted immediately to update both HR and Kiosk screens.

---

### B. Work-From-Home (WFH) Management Workflow
1. **Policy Enforcement & Request Creation:**
   - Employee opens the WFH tab. The server verifies monthly quota ($\le 4\text{ days/month}$).
   - Date validation blocks past dates (`date >= currentDate`).
   - On submission (`POST /api/wfh/requests`), status is set to `PENDING` and a real-time event `wfh.created` is emitted to the `hr` room.
2. **HR Manager Review:**
   - The HR dashboard updates live with a pulsing row and notification toast without page refresh.
   - HR clicks **Approve** or **Reject** with optional reviewer notes (`PATCH /api/wfh/requests/:id/review`).
3. **Automated Ledger Reconciliation:**
   - Once approved, the backend atomically creates or updates an `AttendanceRecord` for that employee with status **`WFH_APPROVED`**.
   - Emits `wfh.decided` to the employee's private channel and updates their remaining quota in real time.

---

### C. Enterprise Authentication & Security Defense
- **Account Lockout:** 5 consecutive incorrect passwords trigger a 15-minute temporary lockout (`ERR_ACCOUNT_LOCKED`).
- **Simulated OTP Activation:** New employees activate accounts using an internal OTP system (`DEMO_OTP_MODE=true` with fixed OTP `123456`) before setting their corporate password.
- **Role-Based Access Control (RBAC):**
  - `ADMIN`: Full system configuration, policy modifications, shift creation, employee provisioning.
  - `HR`: View all attendance logs, manage WFH queue, pair kiosks, export CSV reports.
  - `EMPLOYEE`: Scan QR, view personal punch history, submit WFH requests, check personal quota.

---

## 4. Key Questions & Rebuttals for Evaluators

### Q1: "Why not use Geofencing or Biometrics?"
> *"Biometric databases represent significant regulatory liabilities (GDPR/DPDP) and facial recognition fails under varied lighting conditions. GPS drains mobile batteries and cannot verify vertical presence in high-rise offices. Our 30-second cryptographic rotating QR code proves physical presence inside the office lobby while guaranteeing 100% employee privacy outside work hours."*

### Q2: "Can an employee take a photo of the QR code and send it to a friend to punch in for them?"
> *"No. The QR token incorporates a cryptographically signed HMAC timestamp with a 45-second TTL. Furthermore, the token is single-use: upon ingestion, the backend records the nonce in an in-memory cache. Any replay attempt receives HTTP 409 Conflict ('Challenge expired or already consumed')."*

### Q3: "What happens if the internet goes down on the employee's mobile phone?"
> *"The mobile client features an offline-resilient event architecture. The app caches user credentials locally using encrypted SecureStore/AsyncStorage, and upon reconnection, the Socket.IO client automatically emits a resync signal to restore state consistency with MongoDB Atlas."*

---

## 5. Live Demonstration Links & Test Accounts

- **Direct Cloud Web Portal:** `https://attendance-tracker-56du.onrender.com`
- **Dynamic Office Kiosk:** `https://attendance-tracker-qq8u.vercel.app`
- **Employee Mobile Web:** `http://localhost:8081` (`npm run dev:mobile:web`)
- **Verified Credentials:**
  - **Admin:** `admin@vorldx.demo` / `Admin@VorldX2026!`
  - **HR:** `hr@vorldx.demo` / `Hr@VorldX2026!`
  - **Employee:** `aarav.sharma@vorldx.demo` / `Employee@2026!`

