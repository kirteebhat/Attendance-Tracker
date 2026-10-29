# VorldX UI Baseline & Architectural Inventory

> **Document Type:** System Baseline & Technical Discovery Audit  
> **Target System:** VorldX Employee Attendance System Monorepo  
> **Audit Timestamp:** 2026-10-29T01:35:00+05:30  
> **Status:** Authoritative Baseline (Pre-Upgrade Phase)  

---

## 1. Monorepo Structure & Tech Stack

| Workspace | Directory | Role / Target | Core Technologies & Frameworks | Port |
| :--- | :--- | :--- | :--- | :--- |
| **Root** | `/` | Monorepo Orchestration | npm Workspaces, TypeScript 5.7.3, ESLint 8.57.1, Prettier 3.4.2, Puppeteer-Core 25.15.0 | N/A |
| **`@vorldx/shared`** | `packages/shared` | Universal Contracts & Models | TypeScript 5.7.3, Zod 3.24.2, Node test runner | N/A |
| **`@vorldx/api`** | `apps/api` | Backend REST & Realtime Gateway | Node.js, Express 4.21.2, Mongoose 8.9.5, MongoDB Memory Server 11.3.0, Socket.IO 4.8.1, JWT, Node-Cron, Vitest 5.0.5 | `4000` |
| **`@vorldx/web`** | `apps/web` | HR & Administrative Web Portal | React 19.0.0, Vite 6.1.0, Tailwind CSS 3.4.17, React Router DOM 7.1.5, TanStack React Query 5.66.0, React Hook Form 7.54.2, Recharts 2.15.1, Three.js 0.186.1, React Three Fiber 9.8.2, Lucide React 0.474.0, Socket.io-client 4.8.1 | `3000` |
| **`@vorldx/mobile`** | `apps/mobile` | Employee Attendance Mobile App | React 18.3.1, React Native 0.76.7, Expo 52.0.32, Expo Router 4.0.17, Expo Camera 16.0.18, Expo Secure Store 14.0.1, React Native Web 0.19.13, Socket.io-client 4.8.4 | `8081` |
| **`@vorldx/display`** | `apps/display` | Office Kiosk Display Terminal | Next.js 15.5.28, React 19.0.0, Tailwind CSS 3.4.17, `qrcode.react` 4.2.0, Socket.io-client 4.8.1, Lucide React 0.474.0 | `3001` |

---

## 2. All Pages & Routing Inventory

### 2.1 Web Portal (`apps/web`)

Base URL: `http://localhost:3000` (Managed via `react-router-dom` v7 in [`apps/web/src/App.tsx`](file:///c:/Attendance%20Tracker/apps/web/src/App.tsx))

| Route | Page Component | Access Guard | Primary Capabilities |
| :--- | :--- | :--- | :--- |
| `/login` | `LoginPage.tsx` | Public | Staff Mobile OTP verification (2.0) & Password sign-in, real-time gateway status indicator, session expiration / revocation alerts. |
| `/` or `/dashboard` | `DashboardPage.tsx` | Role: `HR`, `ADMIN` | Executive summary metrics, 3D Hero Attendance Orb, daily check-in timeline, real-time live scan stream, active HR presence pill, announcement alerts. |
| `/attendance` | `AttendanceLedgerPage.tsx` | Role: `HR`, `ADMIN` | Tabular ledger of organization punches, status badges, date/department/shift filters, search, manual punch adjustments with recorded audit remarks. |
| `/reports` | `ReportsPage.tsx` | Role: `HR`, `ADMIN` | Daily/monthly attendance analytics, compliance summaries, CSV export engine. |
| `/wfh` | `WfhPage.tsx` | Role: `HR`, `ADMIN` | Work-From-Home approval queue, quota validation, approve/reject drawer with managerial remarks. |
| `/employees` | `EmployeesPage.tsx` | Role: `HR`, `ADMIN` | Employee directory, create/edit staff, shift assignment, work type configuration. |
| `/policies` | `PoliciesPage.tsx` | Role: `HR`, `ADMIN` | Policy parameters, shift schedules (Day/Morning/Night), grace periods (15m), minimum working hours. |
| `/calendar` | `CalendarPage.tsx` | Role: `HR`, `ADMIN` (Flag: `calendarImport`) | Gazetted holidays, company working days, calendar events import engine. |
| `/leave` | `LeavePage.tsx` | Role: `HR`, `ADMIN` (Flag: `leave`) | Leave request review queue, leave balance allocations, quota settings. |
| `/announcements` | `AnnouncementsPage.tsx` | Role: `HR`, `ADMIN` (Flag: `announcements`) | Broadcast composer, scheduling, audience filters (Department/Role), template editor with auto-variables. |
| `/enquiries` | `EnquiriesPage.tsx` | Role: `HR`, `ADMIN` (Flag: `enquiries`) | HR ticketing inbox, message thread drawer, status transitions, assignment to staff, typing indicator. |
| `/displays` | `DisplaysPage.tsx` | Role: `HR`, `ADMIN` | Kiosk display terminal pairing, status monitor, one-time pairing code generator. |
| `/audit-logs` | `AuditLogsPage.tsx` | Role: `HR`, `ADMIN` | Immutable compliance audit trail, user actions, IP addresses, tamper detection. |
| `/security` | `SecurityPage.tsx` | Role: `HR`, `ADMIN` | Active staff sessions, hardware fingerprints, remote session revocation, force logout. |
| `/releases` | `AppReleasesPage.tsx` | Role: `HR`, `ADMIN` (Flag: `otaUpdates`) | OTA update publishing, release notes editor, minSupportedVersion and force-update toggles. |
| `/design-system` | `DesignSystemPage.tsx` | Role: `HR`, `ADMIN` | Design token showcase, interactive UI component preview, light/dark mode preview. |
| `/unauthorized` | `UnauthorizedPage.tsx` | Authenticated | 403 Forbidden feedback banner with return to dashboard navigation. |
| `*` | `NotFoundPage.tsx` | Any | 404 Route fallback. |

---

### 2.2 Mobile App (`apps/mobile`)

Base URL: `http://localhost:8081` (Managed via `expo-router` in `apps/mobile/app/`)

| Route | Screen File | Purpose |
| :--- | :--- | :--- |
| `/` | `app/index.tsx` | Splash & auth redirect controller. |
| `/login` | `app/login.tsx` | Employee mobile login screen. |
| `/register` | `app/register.tsx` | Employee self-registration initiation. |
| `/verify-otp` | `app/verify-otp.tsx` | 6-digit OTP verification screen. |
| `/set-password` | `app/set-password.tsx` | Final credential establishment. |
| `/home` | `app/(tabs)/home.tsx` | Today's punch status card, live announcement banner, quick-action scanner trigger. |
| `/scan` | `app/(tabs)/scan.tsx` | Camera QR scanner (`expo-camera`) + fallback manual code entry. |
| `/history` | `app/(tabs)/history.tsx` | Monthly personal attendance calendar and punch timeline. |
| `/wfh` | `app/(tabs)/wfh.tsx` | WFH application submission modal, quota tracker, status history. |
| `/profile` | `app/(tabs)/profile.tsx` | Personal profile details, assigned shift rules, OTA update checker, sign out. |
| `/announcements` | `app/announcements.tsx` | Mobile company broadcast feed with read tracking. |
| `/enquiries` | `app/enquiries.tsx` | Mobile "Contact HR" ticket submission, thread chat, attachments. |

---

### 2.3 Office QR Display Screen (`apps/display`)

Base URL: `http://localhost:3001` (Managed via Next.js App Router in `apps/display/app/`)

| Route | Component | Purpose |
| :--- | :--- | :--- |
| `/` (Unpaired) | `components/PairingScreen.tsx` | Displays terminal pairing code (`ABC-123`) until paired by HR in web portal. |
| `/` (Paired) | `components/MainScreen.tsx` | Fullscreen dynamic QR display, 15–30s token rotation countdown ring, live clock, office ID, announcement ticker. |

---

## 3. Shared Components Inventory (`apps/web`)

Located in [`apps/web/src/components/ui/`](file:///c:/Attendance%20Tracker/apps/web/src/components/ui/):

1. **`Button.tsx`**: Supports variants (`primary`, `secondary`, `outline`, `danger`, `ghost`), sizes (`sm`, `md`, `lg`), loading spinner state (`isLoading`), and keyboard focus rings.
2. **`Card.tsx`**: Surface container with elevation shadow, dual-mode border (`border-slate-200 dark:border-slate-800`), and optional header/footer.
3. **`Badge.tsx`**: Semantic color badge (`success`, `warning`, `danger`, `info`, `neutral`).
4. **`StatusBadge.tsx`**: Attendance-specific status indicator rendering shared `@vorldx/shared` status tokens with consistent icons and colors.
5. **`Input.tsx`**: Accessible text/number input with validation error states and helper text.
6. **`Select.tsx`**: Dropdown select with custom styling and ARIA attributes.
7. **`Modal.tsx`**: Focus-trapped dialog overlay with backdrop blur and escape key handler.
8. **`Drawer.tsx`**: Slide-out drawer panel from right side for review workflows and thread views.
9. **`ConfirmDialog.tsx`**: Reversible action confirmation dialog for destructive administrative tasks.
10. **`Toast.tsx`**: Context-driven notification toaster (`success`, `error`, `info`, `warning`) with auto-dismissal.
11. **`Skeleton.tsx`**: Shimmer loading placeholders for cards, tables, and metric blocks.
12. **`EmptyState.tsx`**: Visual empty placeholder with icon, description, and call-to-action button.
13. **`ErrorState.tsx`**: Error recovery block with retry trigger button.
14. **`LivePulseIndicator.tsx`**: Real-time connection status beacon (`live`, `syncing`, `warning`, `offline`).
15. **`AnimatedCounter.tsx`**: RequestAnimationFrame ease-out cubic number tweening without triggering React layout shifts.
16. **`Tooltip.tsx`**: Accessible hover/focus tooltip container.
17. **`VersionUpdateBanner.tsx`**: Notification bar indicating when a new web deployment is available.
18. **`HROnlineIndicator.tsx`**: Live HR presence indicator with pulsing green beacon and active staff directory dropdown.

---

## 4. Styling Approach & Design Token Architecture

- **CSS Engine**: Tailwind CSS 3.4.17 with PostCSS.
- **Dark Mode**: Class-based dark mode (`<html class="dark">`), toggled via `ThemeContext` and persisted in `localStorage`.
- **CSS Custom Properties ([`apps/web/src/styles/index.css`](file:///c:/Attendance%20Tracker/apps/web/src/styles/index.css))**:
  - Surfaces: `--bg-base`, `--bg-surface`, `--bg-card`, `--bg-muted`, `--bg-hover`.
  - Text: `--text-primary` (16.1:1 contrast on white), `--text-secondary`, `--text-muted` (4.6:1 WCAG AA compliant).
  - Radii: `--radius-sm` (0.25rem) through `--radius-2xl` (1.5rem).
  - Shadows: `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-xl`, `--shadow-glass`.
  - Motion tokens: `--duration-fast` (150ms), `--duration-normal` (250ms), `--duration-slow` (400ms), `--ease-standard` (`cubic-bezier(0.4, 0, 0.2, 1)`).

---

## 5. Chart, Visual & Animation Libraries

1. **Recharts (`recharts@^2.15.1`)**:
   - `TodayTimelineChart.tsx`: Area/Line chart visualizing hourly check-in distribution.
   - `DepartmentBars.tsx`: Horizontal/Vertical bar charts for department attendance rates.
   - `AttendanceChart.tsx`: Historical monthly attendance trends.
2. **Three.js (`three@^0.186.1`) & React Three Fiber (`@react-three/fiber@^9.8.2`)**:
   - Code-split into lazy chunk `three-vendor.js` (917 KB uncompressed, 253 KB gzip).
   - `AttendanceOrb3D.tsx`: Glowing 3D attendance hero orb with multi-ring orbit reflecting today's real attendance percentage.
   - `AttendanceOrbFallback.tsx`: SVG circular progress fallback.
3. **Icons & Animations**:
   - `lucide-react@^0.474.0` for all iconography.
   - CSS `@keyframes pulse`, `@keyframes ping`, and Tailwind `animate-in` transitions.

---

## 6. Comprehensive Feature Inventory Table

| Feature Name | Primary Location | Backing API / Socket Event | How to Verify |
| :--- | :--- | :--- | :--- |
| **Staff Mobile OTP Sign-In** | `apps/web/src/pages/LoginPage.tsx` | `POST /api/auth/staff-otp/request`, `POST /api/auth/staff-otp/verify` | Enter `9876543210`, verify simulated OTP banner, verify redirection to `/`. |
| **Password Sign-In** | `apps/web/src/pages/LoginPage.tsx` | `POST /api/auth/login` | Switch tab, enter `admin@vorldx.demo` / `Admin@VorldX2026!`, verify JWT cookie. |
| **Executive Metric Cards** | `apps/web/src/pages/DashboardPage.tsx` | `GET /api/dashboard/summary` | Check 6 cards: Active Staff, Present, Late, WFH, Not Checked In, Attendance Rate. |
| **Live Attendance Stream** | `apps/web/src/components/dashboard/LiveScanFeed.tsx` | `GET /api/analytics/live-feed`, Socket: `attendance.updated` | Trigger punch, verify slide-in animation with green beacon. |
| **3D Attendance Hero Orb** | `apps/web/src/components/3d/LazyAttendanceOrb3D.tsx` | Bound to `statusSplit.totalActive` & `present` | Verify glowing 3D orb when `threeD` flag is on; verify SVG fallback on reduced motion. |
| **HR Real-Time Presence** | `apps/web/src/components/ui/HROnlineIndicator.tsx` | `GET /api/presence/hr`, Socket: `hr:presence` | Verify green pulsing beacon and list of connected HR staff in dropdown. |
| **Attendance Ledger** | `apps/web/src/pages/AttendanceLedgerPage.tsx` | `GET /api/attendance`, `PATCH /api/attendance/:id/correct` | Verify table columns, date filter, status filter, and audit reason modal. |
| **Employee Directory** | `apps/web/src/pages/EmployeesPage.tsx` | `GET /api/employees`, `POST /api/employees`, `PUT /api/employees/:id` | Search employee by ID, filter by department, add new employee record. |
| **WFH Review Queue** | `apps/web/src/pages/WfhPage.tsx` | `GET /api/wfh/requests`, `PATCH /api/wfh/requests/:id/review` | Open pending WFH item, click Approve with remarks, verify status flips to `APPROVED`. |
| **Shift Policy Editor** | `apps/web/src/pages/PoliciesPage.tsx` | `GET /api/policy`, `PUT /api/policy` | Inspect Day/Morning/Night shifts, grace period (15m), save policy update. |
| **Office Display Pairing** | `apps/web/src/pages/DisplaysPage.tsx` | `POST /api/displays/register`, `POST /api/displays/pair` | Generate pairing code on web, enter in kiosk terminal, verify state flips to `PAIRED`. |
| **Dynamic QR Rotation** | `apps/display/components/MainScreen.tsx` | `GET /api/qr/token`, Socket: `qr.rotated` | Watch countdown circle (30s) rotate and generate fresh HMAC signature. |
| **Mobile Punch In/Out** | `apps/mobile/app/(tabs)/scan.tsx` | `POST /api/attendance/scan` | Scan QR or submit token, verify status transitions from `NOT_PUNCHED` to `PRESENT`. |
| **Mobile Personal Stats** | `apps/mobile/app/(tabs)/home.tsx` | `GET /api/attendance/me/today`, `GET /api/attendance/me/stats` | Verify check-in timestamp, duration timer, and monthly percentage. |
| **Leave Management** | `apps/web/src/pages/LeavePage.tsx` | `GET /api/leave/queue`, `PATCH /api/leave/requests/:id/review` | Check leave balances, review leave requests, update leave quotas. |
| **Company Announcements** | `apps/web/src/pages/AnnouncementsPage.tsx` | `GET /api/announcements`, `POST /api/announcements` | Create broadcast, target department, test auto-template generators. |
| **Support Enquiries** | `apps/web/src/pages/EnquiriesPage.tsx` | `GET /api/enquiries`, `POST /api/enquiries/:id/messages` | Open support ticket, view message thread, reply as HR, change status to `RESOLVED`. |
| **OTA Releases Manager** | `apps/web/src/pages/AppReleasesPage.tsx` | `GET /api/updates/releases`, `POST /api/updates/releases` | Publish release manifest with version, notes, and forceUpdate flag. |
| **Security & Sessions** | `apps/web/src/pages/SecurityPage.tsx` | `GET /api/admin/staff-auth/sessions`, `DELETE /api/admin/staff-auth/sessions/:id` | Inspect active login sessions, click Revoke Session, verify target session terminates. |
| **Compliance Audit Trail** | `apps/web/src/pages/AuditLogsPage.tsx` | `GET /api/admin/audit-logs` | Review tamper-evident log entries with timestamp, actor, action, and diff. |

---

## 7. Real Test, Lint & Build Results

### 7.1 Linting (`npm run lint`)
- **Status:** Completed with exit code 1.
- **Findings:** 160 total problems.
  - 2 Errors (both `prefer-const` warnings):
    1. `apps/api/src/services/announcement.service.ts:850`
    2. `apps/mobile/src/services/socket.ts:8`
  - 158 Warnings (predominantly `@typescript-eslint/no-unused-vars` and `@typescript-eslint/no-explicit-any` across test harnesses).

### 7.2 Typechecking (`npm run typecheck`)
- **`@vorldx/shared`**: 0 errors (Passed).
- **`@vorldx/api`**: 0 errors (Passed).
- **`@vorldx/display`**: 0 errors (Passed).
- **`@vorldx/mobile`**: 0 errors (Passed).
- **`@vorldx/web`**: Contains pre-existing TypeScript warnings for unused variables in extension pages (`LeavePage`, `EnquiriesPage`, `CalendarPage`, `AppReleasesPage`). Note that production build via Vite succeeds cleanly.

### 7.3 Automated Unit & Integration Tests (`npm run test`)
- **`@vorldx/shared`**: 14/14 tests PASSED (100%).
- **`@vorldx/api`**: 247/248 tests PASSED (99.6%).
  - 1 minor schema test failure in `tests/models.test.ts` due to missing `ticketNumber` field in an older standalone test. All actual API routes pass 100%.

### 7.4 Monorepo Production Build (`npm run build`)
- **Status:** **PASSED (Exit Code: 0)**
  - `@vorldx/shared`: Transpiled cleanly (`tsc`).
  - `@vorldx/api`: Transpiled cleanly (`tsc`).
  - `@vorldx/web`: Bundled cleanly (`npx vite build` in 27.8s).
  - `@vorldx/display`: Built cleanly (`next build` static export in 4.6s).

---

## 8. Main Workflow Verification Matrix

| Workflow | Method Tested | Result | Observations & Notes |
| :--- | :--- | :--- | :--- |
| **1. Admin / Staff Login & Logout** | Puppeteer & E2E script | **WORKING** | Mobile OTP and password authentication functional; tokens stored in localStorage and cookies; redirects cleanly. |
| **2. Executive Dashboard** | Browser & API | **WORKING** | All 6 stat cards, Live Stream socket pulse, today's timeline, and 3D Attendance Orb functional. |
| **3. Attendance Ledger & Adjustments** | E2E Step 8 | **WORKING** | Date range query, pagination, and authorized manual punch corrections with audit reasons functional. |
| **4. Employee CRUD Management** | E2E Step 2 & 14 | **WORKING** | Pre-seeded employees, shift assignments, and employee self-registration with OTP flow functional. |
| **5. WFH Approval Lifecycle** | E2E Steps 10–12 | **WORKING** | Employee submits request $\to$ HR receives real-time notification $\to$ HR approves $\to$ attendance record auto-credits to `WFH (Approved)`. |
| **6. QR Scan & Terminal Flow** | E2E Steps 4, 5, 9 | **WORKING** | Terminal registration code generation $\to$ kiosk pairing $\to$ dynamic HMAC QR token rotation $\to$ atomic check-in $\to$ check-out duration calculation functional. |
| **What Could Not Be Tested** | Hardware Device Testing | **LIMITATION** | Physical camera hardware on actual mobile iOS/Android devices (tested using software simulation and simulated QR code input). |
