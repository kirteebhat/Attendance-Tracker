# VorldX Employee Attendance System — Master Engineering Brief

## 1. Executive Summary & Purpose

The **VorldX Employee Attendance System** is an enterprise-grade attendance solution engineered for **VorldX Industries Private Limited** (CIN: `U62099UP2026PTC245598`). It bridges daily employee attendance tracking with robust HR administration, replacing manual and unreliable methods with a modern, dynamic QR-code-driven workflow, transparent Work From Home (WFH) management, and deep attendance analytics.

The system is strictly designed and built as a **full-stack, connected application** encompassing frontend user experiences, resilient backend business logic, and persistent relational data storage. All decisions and attendance evaluations are controlled server-side.

---

## 2. Core Project Components

| Component                   | Target Audience            | Primary Functionality                                                                                                                                                                          | Deployment / Form Factor                                |
| --------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **VorldX Employee Website** | HR / Admin                 | Attendance overview, sample employee management, attendance policy & shift configuration, WFH request review & approvals, attendance record auditing, manual corrections, report generation.   | Responsive Web Application (Desktop / Tablet optimized) |
| **VorldX Employee App**     | Employees                  | Simulated OTP account verification, QR code scanner (camera/input), real-time attendance status, personal attendance history, attendance stats & charts, WFH request submission & tracking.    | Mobile-First Web / PWA / Responsive View                |
| **Office QR Display**       | Office Entrance / Terminal | Standalone fullscreen office display rendering short-lived, dynamically rotating QR codes paired to a registered physical terminal. Supporting system component (not a 3rd distinct user app). | Dedicated Screen / Kiosk / Browser View                 |

---

## 3. High-Level Architecture & Tech Stack

```
+-----------------------------------------------------------------------------------+
|                                  CLIENT LAYER                                     |
|  +------------------------+  +------------------------+  +---------------------+  |
|  | VorldX Employee Web    |  | VorldX Employee App    |  | Office QR Display   |  |
|  | (HR / Admin Portal)    |  | (Mobile Attendance)    |  | (Kiosk Terminal)    |  |
|  +-----------+------------+  +-----------+------------+  +----------+----------+  |
+--------------|---------------------------|--------------------------|-------------+
               |                           |                          |
               v                           v                          v
+-----------------------------------------------------------------------------------+
|                             API & BACKEND LAYER                                  |
|  - Route Handlers & REST Endpoints                                                |
|  - Auth & Demo OTP Verification Engine                                            |
|  - Dynamic QR Session Manager (Time-based rotation, cryptographic token hash)     |
|  - Attendance Evaluation Engine (Shift schedules, late rules, grace periods)       |
|  - WFH Workflow & State Engine (Request submission, quota, policy check, reviews) |
|  - Audit Logger & Reporting Subsystem                                             |
+-----------------------------------------------------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------+
|                             DATABASE LAYER (PERSISTENT)                          |
|  - Employees & Departments               - Attendance Records & Daily Logs        |
|  - Attendance Policies & Shifts          - WFH Requests & Approvals               |
|  - QR Terminals & Active Rotations       - Audit Trails & Correction Logs         |
+-----------------------------------------------------------------------------------+
```

---

## 4. Detailed Functional Requirements

### 4.1 Employee Account & Verification

- **Identifier**: Employees register and log in using their assigned company Employee ID (e.g., `VX-1001`).
- **Demo Verification**: Real third-party SMS/email gateways are omitted. Instead, a clean simulated OTP verification flow is implemented:
  - System generates a mock OTP (e.g., deterministic or displayed directly in UI helper banner for demo clarity).
  - Employee verifies OTP to activate and authenticate their session.
- **Privacy & Demo Scope**: Pre-seeded dummy employees with realistic profiles, job titles, and departments. No real-world PII is used or exposed.

### 4.2 Dynamic Office QR Attendance

- **Office QR Display Screen**:
  - Displays a high-contrast dynamic QR code alongside office identification, current time, and a countdown timer.
  - Generates short-lived tokens (e.g., valid for 15–30 seconds) rotating automatically.
  - QR payload contains an encrypted/signed token containing terminal ID, generation timestamp, and nonce.
- **Check-In / Check-Out Logic**:
  - Scanning when no active check-in exists records **Check-In**.
  - Scanning when an active check-in exists records **Check-Out** and computes daily active duration.
  - Backend verifies token validity, expiration, and terminal pairing. Expired or replayed QR tokens are rejected.
- **Punctuality & Shift Rules**:
  - Shift start times and customizable grace periods (e.g., 15 minutes).
  - Punching in after `Shift Start + Grace Period` flags the attendance record as `Late`.
  - Punctuality, early departure, and minimum half-day / full-day durations are computed strictly on the backend.

### 4.3 Work From Home (WFH) Management

- **Eligibility**: Employees can view whether their profile/department is eligible for WFH.
- **Application**: Employees submit requests specifying date, duration (full-day / half-day), and mandatory justification reason.
- **Status Tracking**: Employees track pending, approved, and rejected statuses in real-time.
- **HR Review**: Admins review requests in a dedicated queue, approving or rejecting with remarks.
- **Attendance Impact**: Approved WFH requests automatically create or convert attendance records for that day to `WFH (Approved)`.

### 4.4 Employee Attendance Dashboard & Information

- **Daily Status**: Live status card showing today's attendance state (`Not Punched`, `Present`, `Late`, `WFH`, `Checked Out`), check-in time, check-out time, and elapsed hours.
- **History & Records**: Filterable date-wise attendance log with color-coded status badges.
- **Personal Metrics**:
  - Total Present Days
  - Late Arrivals Count
  - Approved WFH Days
  - Overall Attendance Percentage (Present + Approved WFH / Total Working Days)
- **Profile Summary**: Employee ID, name, designation, department, assigned shift, and manager/work type.

### 4.5 HR & Admin Management Capabilities

- **Employee Directory**: Manage sample employee records (ID, name, email, department, designation, shift assignment, work type, joining date).
- **Policy Management**: Configure shift start/end times, grace periods, minimum full-day working hours, and WFH limits.
- **Attendance Record Control**: View all organization-wide punches, filter by department/shift/status/date, and perform authorized manual corrections with recorded justification.
- **Terminal Management**: Pair, monitor, and refresh office QR display instances.
- **Reporting & Auditing**: Detailed daily/monthly attendance summaries, exportable tabular records, and complete audit log of all manual edits and administrative actions.

---

## 5. Scope Boundaries & Strict Exclusions (per Section 6 of PDF)

To keep the application focused on attendance and compliance, the following items are **explicitly out of scope**:

1. GPS or geolocation-based geofencing / tracking.
2. Wi-Fi SSID or Bluetooth BLE proximity beacons.
3. Facial recognition, biometric fingerprint, or iris scanners.
4. Payroll processing, salary slips, or full HRMS leave encashment.
5. Complex multi-tier leave management or employee grading/ranking systems.
6. Multi-level hierarchical manager sign-offs.

---

## 6. UX & Visual Identity Specifications

- **Design Philosophy**: Modern, high-trust enterprise dashboard adhering to clean mobile-first responsiveness.
- **Color Palette**:
  - Primary: Deep Slate & Navy (`#0F172A`, `#1E293B`)
  - Accent Cool Hues: Electric Blue (`#2563EB`, `#3B82F6`), Cyan (`#06B6D4`), Indigo (`#6366F1`), and Violet (`#8B5CF6`)
  - Semantic Statuses: Emerald Green for On-Time/Present (`#10B981`), Amber for Late (`#F59E0B`), Indigo for WFH (`#6366F1`), Rose for Absent/Rejected (`#EF4444`).
- **Styling Elements**: Selective subtle glassmorphism (`backdrop-blur`), crisp card borders (`border-slate-200 / border-slate-800`), refined typography, tactile button states, and distinct empty/loading/error feedback.

---

## 7. Deliverables & Documentation Standard

Per Section 7 of the assignment specification:

1. **Full-Stack Working Software**: Web portal, mobile view, QR display screen, backend API, database.
2. **Project Report**: Comprehensive technical document covering architecture, schema, features, demo data, test runs, and screenshots.
3. **Living Tracking Artifacts**:
   - `docs/REQUIREMENTS_MATRIX.md`
   - `docs/AMBIGUITIES.md`
   - `docs/PROGRESS.md`
