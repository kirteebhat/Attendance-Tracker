# REST API Contract & Data Specification — VorldX Attendance System

This document specifies the exact contract for all HTTP endpoints. Every endpoint documents the method, route, authorization role, request/response schema, potential errors, atomic database queries (compatible with standalone MongoDB), and real-time WebSocket events.

---

## 1. Authentication, Self-Registration & Simulated OTP Verification

### 1.1 `POST /api/auth/register-start`

- **Role**: `Public` (Rate-limited via `authRateLimiter`)
- **Aliases**: `POST /api/auth/register`
- **Description**: Initiates self-registration for an employee using their assigned `employeeId`. Validates that the employee exists in the company directory, is active, and has no registered user account. Generates a 6-digit OTP, securely hashes it with bcrypt, and stores the hash with a 10-minute expiry and 3-attempt limit.
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "employeeId": "EMP-1001"
  }
  ```
- **Response (200 OK — Demo Mode: `DEMO_OTP_MODE=true` & `NODE_ENV !== "production"`)**:
  ```json
  {
    "success": true,
    "message": "Verification code generated. Complete registration using the simulated OTP.",
    "employeeId": "EMP-1001",
    "email": "aarav.sharma@vorldx.demo",
    "expiresInMinutes": 10,
    "simulatedDemoOtp": "492018",
    "demoNotice": "SIMULATED OTP FOR DEMO ENVIRONMENT ONLY — NEVER RETURNED IN PRODUCTION"
  }
  ```
- **Response (200 OK — Production Mode: `NODE_ENV === "production"`)**:
  ```json
  {
    "success": true,
    "message": "Verification code sent to registered employee email.",
    "employeeId": "EMP-1001",
    "email": "aarav.sharma@vorldx.demo",
    "expiresInMinutes": 10
  }
  ```
- **Errors**:
  - `400 Bad Request`: `{"code": "ERR_INVALID_INPUT", "message": "Employee ID must be at least 3 characters."}`
  - `404 Not Found`: `{"code": "ERR_EMPLOYEE_NOT_FOUND", "message": "Employee ID does not exist in company directory."}`
  - `403 Forbidden`: `{"code": "ERR_EMPLOYEE_INACTIVE", "message": "Employee profile is inactive. Please contact Human Resources."}`
  - `409 Conflict`: `{"code": "ERR_ACCOUNT_ALREADY_REGISTERED", "message": "Account is already registered for this Employee ID. Please log in."}`
- **DB Changes (Atomic Standalone)**:
  ```javascript
  db.registrationotps.deleteMany({ employeeId: "EMP-1001" });
  db.registrationotps.insertOne({
    employeeId: "EMP-1001",
    email: employee.email,
    hashedCode: bcryptHash,
    expiresAt: new Date(Date.now() + 600000),
    attempts: 0,
    isUsed: false,
    createdAt: new Date(),
  });
  ```
- **Events**: None.

---

### 1.2 `POST /api/auth/register-verify`

- **Role**: `Public` (Rate-limited via `authRateLimiter`)
- **Aliases**: `POST /api/auth/verify-otp`
- **Description**: Verifies the single-use OTP code, sets the permanent account password, creates the `User` account, links it to `Employee`, and immediately establishes an authenticated session.
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "employeeId": "EMP-1001",
    "otp": "492018",
    "password": "SecurePassword123!"
  }
  ```
- **Response (201 Created)**:
  - **Set-Cookie**: `refreshToken=<random-hex>; HttpOnly; Secure (prod); SameSite=Lax; Path=/; Max-Age=604800`
  ```json
  {
    "success": true,
    "message": "Account registered and verified successfully.",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "84d720c78a01f56b...",
    "user": {
      "_id": "6714a8b...",
      "employeeId": "EMP-1001",
      "email": "aarav.sharma@vorldx.demo",
      "role": "EMPLOYEE",
      "status": "ACTIVE"
    },
    "employee": {
      "_id": "6714a8c...",
      "employeeId": "EMP-1001",
      "name": "Aarav Sharma",
      "email": "aarav.sharma@vorldx.demo",
      "department": "Engineering",
      "designation": "Lead Systems Architect",
      "workType": "FULL_TIME",
      "shiftId": "6714a8a..."
    }
  }
  ```
- **Errors**:
  - `400 Bad Request`: `{"code": "ERR_INVALID_OTP", "message": "Incorrect verification code. 2 attempt(s) remaining."}`
  - `400 Bad Request`: `{"code": "ERR_OTP_EXPIRED", "message": "Verification code has expired. Please request a new code."}`
  - `400 Bad Request`: `{"code": "ERR_OTP_ATTEMPTS_EXCEEDED", "message": "Maximum verification attempts exceeded. Please request a new verification code."}`
  - `404 Not Found`: `{"code": "ERR_EMPLOYEE_NOT_FOUND", "message": "Employee ID does not exist in company directory."}`
  - `403 Forbidden`: `{"code": "ERR_EMPLOYEE_INACTIVE", "message": "Employee profile is inactive. Please contact Human Resources."}`
  - `409 Conflict`: `{"code": "ERR_ACCOUNT_ALREADY_REGISTERED", "message": "Account is already registered for this Employee ID. Please log in."}`
- **DB Changes (Atomic Standalone)**:
  ```javascript
  // 1. Invalidate OTP (single-use)
  db.registrationotps.deleteOne({ _id: otpRecord._id });
  // 2. Create User account
  db.users.insertOne({
    employeeId: "EMP-1001",
    email: employee.email,
    passwordHash: bcryptHash,
    role: "EMPLOYEE",
    status: "ACTIVE",
    failedLoginAttempts: 0,
    lockoutUntil: null,
    refreshTokenHash: sha256(refreshToken),
    lastLoginAt: new Date(),
  });
  // 3. Link Employee
  db.employees.updateOne({ employeeId: "EMP-1001" }, { $set: { userId: user._id } });
  ```
- **Events**: None.

---

### 1.3 `POST /api/auth/login`

- **Role**: `Public` (Rate-limited: 10 attempts/min per IP)
- **Description**: Authenticates employee, HR, or admin credentials. Issues short-lived access token and secure refresh token.
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "employeeId": "ADM-001",
    "password": "Admin@VorldX2026!"
  }
  ```
  _(Note: Can also supply `"email"` or `"identifier"` in lieu of `"employeeId"`)_
- **Response (200 OK)**:
  - **Set-Cookie**: `refreshToken=<random-hex-40>; HttpOnly; Secure (prod); SameSite=Lax; Path=/; Max-Age=604800`
  ```json
  {
    "success": true,
    "message": "Login successful",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "84d720c78a01f56b...",
    "user": {
      "_id": "6714a8b...",
      "employeeId": "ADM-001",
      "email": "admin@vorldx.demo",
      "role": "ADMIN",
      "status": "ACTIVE"
    },
    "employee": {
      "_id": "6714a8c...",
      "employeeId": "ADM-001",
      "name": "System Administrator",
      "email": "admin@vorldx.demo",
      "department": "Executive",
      "designation": "Platform Super Admin",
      "workType": "FULL_TIME",
      "shiftId": "6714a8a..."
    }
  }
  ```
- **Errors**:
  - `400 Bad Request`: `{"code": "ERR_INVALID_INPUT", "message": "Employee ID or email and password are required."}`
  - `401 Unauthorized`: `{"code": "ERR_INVALID_CREDENTIALS", "message": "Invalid credentials."}`
  - `423 Locked`: `{"code": "ERR_ACCOUNT_LOCKED", "message": "Account is temporarily locked due to 5 consecutive failed login attempts. Please try again after 15 minutes."}`
  - `403 Forbidden`: `{"code": "ERR_FORBIDDEN", "message": "Account is disabled. Please contact HR."}`
- **DB Changes (Atomic)**:
  - On failure: `db.users.updateOne({ _id: user._id }, { $inc: { failedLoginAttempts: 1 }, $set: { lockoutUntil: calculatedLockout } })`
  - On success: `db.users.updateOne({ _id: user._id }, { $set: { failedLoginAttempts: 0, lockoutUntil: null, lastLoginAt: new Date(), refreshTokenHash: sha256(refreshToken) } })`
- **Events**: None.

---

### 1.4 `POST /api/auth/refresh`

- **Role**: `Public` (Requires valid refresh token in `httpOnly` cookie or JSON body)
- **Description**: Rotates refresh token and issues fresh JWT access token.
- **Request Headers**: `Content-Type: application/json`
- **Request Body** _(Optional if cookie is supplied)_:
  ```json
  {
    "refreshToken": "84d720c78a01f56b..."
  }
  ```
- **Response (200 OK)**:
  - **Set-Cookie**: Rotated `refreshToken=<new-random-hex-40>; HttpOnly; Secure (prod); SameSite=Lax; Path=/; Max-Age=604800`
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "e3b0c44298fc1c14..."
  }
  ```
- **Errors**:
  - `401 Unauthorized`: `{"code": "ERR_UNAUTHORIZED", "message": "Invalid or expired refresh token"}`
- **DB Changes (Atomic)**:
  - Updates `refreshTokenHash` to SHA-256 hash of rotated token.
- **Events**: None.

---

### 1.5 `POST /api/auth/logout`

- **Role**: `Public` / `Authenticated`
- **Description**: Invalidates active refresh token in database and wipes session cookie.
- **Response (200 OK)**:
  - **Set-Cookie**: `refreshToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
  ```json
  {
    "success": true,
    "message": "Logged out successfully"
  }
  ```
- **DB Changes (Atomic)**:
  - `db.users.updateOne({ _id: userId }, { $set: { refreshTokenHash: null } })`
- **Events**: None.

---

### 1.6 `GET /api/auth/me`

- **Role**: `Authenticated` (`ADMIN`, `HR`, `EMPLOYEE`, `HR_ADMIN`)
- **Headers**: `Authorization: Bearer <access_jwt>`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "user": {
      "_id": "6714a8b...",
      "employeeId": "ADM-001",
      "email": "admin@vorldx.demo",
      "role": "ADMIN",
      "status": "ACTIVE",
      "lastLoginAt": "2026-10-20T19:00:00.000Z",
      "createdAt": "2026-10-20T18:00:00.000Z",
      "updatedAt": "2026-10-20T19:00:00.000Z"
    },
    "employee": {
      "_id": "6714a8c...",
      "employeeId": "ADM-001",
      "name": "System Administrator",
      "email": "admin@vorldx.demo",
      "department": "Executive",
      "designation": "Platform Super Admin",
      "workType": "FULL_TIME",
      "shiftId": "6714a8a...",
      "joiningDate": "2022-01-01",
      "isActive": true
    }
  }
  ```
- **Errors**:
  - `401 Unauthorized`: `{"code": "ERR_TOKEN_EXPIRED", "message": "Access token has expired"}` _(Clients use this to invoke `/api/auth/refresh` without logging user out)_
  - `401 Unauthorized`: `{"code": "ERR_UNAUTHORIZED", "message": "Invalid or malformed authentication token"}`
- **Events**: None.

---

## 2. Terminal Pairing & Dynamic QR Endpoints

The system supports both `/api/displays` and `/api/terminals` routing paths interchangeably.

### 2.1 `POST /api/displays` (or `/api/terminals`)

- **Role**: `HR` / `ADMIN`
- **Description**: Registers a new office display screen and mints a short-lived one-time pairing code (valid for 15 minutes).
- **Headers**: `Authorization: Bearer <jwt>`
- **Request Body**:
  ```json
  {
    "name": "Lucknow HQ Ground Floor Entrance",
    "location": "Lobby Terminal A"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Display terminal registered successfully",
    "data": {
      "_id": "6714a8b...",
      "terminalId": "disp_8f1a2c4e",
      "displayId": "disp_8f1a2c4e",
      "name": "Lucknow HQ Ground Floor Entrance",
      "location": "Lobby Terminal A",
      "pairingCode": "VX-7842",
      "pairingCodeExpiresAt": "2026-10-20T18:25:00.000Z",
      "isPaired": false,
      "isActive": true,
      "status": "UNPAIRED",
      "tokenEpoch": 1,
      "createdAt": "2026-10-20T18:10:00.000Z"
    }
  }
  ```
- **DB Changes (Atomic)**:
  - Inserts document into `qrdisplays` with unique `terminalId` and sparse indexed `pairingCode`.
  - Appends to `auditevents`: `{ entityType: "TERMINAL", action: "CREATE" }`.

---

### 2.2 `GET /api/displays` (or `/api/terminals`)

- **Role**: `HR` / `ADMIN`
- **Description**: Lists all registered display terminals with their current active/paired/revoked status and `lastSeen` heartbeat timestamp.
- **Headers**: `Authorization: Bearer <jwt>`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "6714a8b...",
        "terminalId": "disp_8f1a2c4e",
        "name": "Lucknow HQ Ground Floor Entrance",
        "location": "Lobby Terminal A",
        "status": "ACTIVE",
        "isPaired": true,
        "isActive": true,
        "lastSeen": "2026-10-20T18:14:32.000Z",
        "createdAt": "2026-10-20T18:10:00.000Z"
      }
    ]
  }
  ```

---

### 2.3 `POST /api/displays/pair` (or `/api/terminals/pair`)

- **Role**: `Display Screen Kiosk` (Public Setup)
- **Description**: Claims a one-time pairing code from the physical office screen setup view. Atomically consumes the code, generates a cryptographically secure 256-bit credential, stores only its SHA-256 hash in MongoDB, marks the terminal as paired, and returns the raw secret credential once.
- **Request Body**:
  ```json
  {
    "pairingCode": "VX-7842"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "displayId": "disp_8f1a2c4e",
    "terminalId": "disp_8f1a2c4e",
    "credential": "disp_cred_8a92f0b7c4d1...",
    "name": "Lucknow HQ Ground Floor Entrance",
    "location": "Lobby Terminal A"
  }
  ```
- **Errors**:
  - `400 Bad Request`: `{"code": "ERR_INVALID_PAIRING_CODE", "message": "Invalid or expired pairing code."}`
  - `403 Forbidden`: `{"code": "ERR_DISPLAY_DISABLED", "message": "Cannot pair a disabled display terminal."}`
  - `403 Forbidden`: `{"code": "ERR_DISPLAY_REVOKED", "message": "Cannot pair a revoked display terminal."}`

---

### 2.4 `GET /api/displays/token` (or `POST /api/displays/token`, `POST /api/displays/challenge`)

- **Role**: `Authorized Display Screen Kiosk`
- **Description**: Office kiosk requests rotating short-lived QR challenge tokens (default 45s). The returned QR payload contains strictly an opaque token string with zero employee details, email, or reusable credentials.
- **Headers**:
  - `x-display-id: disp_8f1a2c4e` (or `x-terminal-id`)
  - `x-display-credential: disp_cred_8a92f0...` (or `x-terminal-secret` or `Authorization: Bearer <credential>`)
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "token": "qrt_f9a8b2c41d7e305...",
    "qrPayload": "qrt_f9a8b2c41d7e305...",
    "displayId": "disp_8f1a2c4e",
    "terminalId": "disp_8f1a2c4e",
    "issuedAt": "2026-10-20T18:15:00.000Z",
    "expiresAt": "2026-10-20T18:15:45.000Z",
    "ttlSeconds": 45,
    "serverTime": 1774092900000
  }
  ```
- **Errors**:
  - `401 Unauthorized`: `{"code": "ERR_TERMINAL_UNAUTHORIZED", "message": "Invalid display credentials."}`
  - `403 Forbidden`: `{"code": "ERR_DISPLAY_DISABLED", "message": "Display terminal is currently disabled."}`
  - `403 Forbidden`: `{"code": "ERR_DISPLAY_REVOKED", "message": "Display has been revoked. Reauthorization required."}`
  - `403 Forbidden`: `{"code": "ERR_DISPLAY_UNPAIRED", "message": "Display terminal is not paired."}`

---

### 2.5 `PATCH /api/displays/:id/status` (or `/api/terminals/:id/status`)

- **Role**: `HR` / `ADMIN`
- **Description**: Enables or disables a display terminal. Disabling blocks the kiosk from requesting new tokens, and any existing unexpired tokens issued by it stop being valid for punch check-ins.
- **Headers**: `Authorization: Bearer <jwt>`
- **Request Body**:
  ```json
  {
    "isActive": false,
    "reason": "Display screen hardware inspection"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Display terminal disabled successfully",
    "data": { ... }
  }
  ```

---

### 2.6 `POST /api/displays/:id/revoke` (or `/api/terminals/:id/revoke`)

- **Role**: `HR` / `ADMIN`
- **Description**: Permanently revokes display credentials and invalidates all issued QR tokens. Increments `tokenEpoch`, wipes stored credential hashes, and marks status as `REVOKED`. The display cannot be re-enabled without reauthorization.
- **Headers**: `Authorization: Bearer <jwt>`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Display terminal revoked successfully; all issued tokens invalidated",
    "data": { ... }
  }
  ```

---

### 2.7 `POST /api/displays/:id/authorize` (or `/api/terminals/:id/authorize`)

- **Role**: `HR` / `ADMIN`
- **Description**: Reauthorizes a revoked or unpaired display by generating a fresh pairing code, resetting pairing status, and advancing `tokenEpoch`.
- **Headers**: `Authorization: Bearer <jwt>`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Display terminal reauthorized with new pairing code",
    "data": {
      "pairingCode": "VX-9124",
      "status": "UNPAIRED",
      "tokenEpoch": 2
    }
  }
  ```

---

### 2.8 `POST /api/displays/validate` (or `/api/terminals/validate`)

- **Role**: `System / Attendance Punch / Diagnostic`
- **Description**: Validates a scanned QR token string. Performs token lookup, checks expiry date, verifies display active status and revocation epoch.
- **Request Body**:
  ```json
  {
    "token": "qrt_f9a8b2c41d7e305..."
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "QR token is valid",
    "displayId": "disp_8f1a2c4e",
    "terminalId": "disp_8f1a2c4e"
  }
  ```
- **Errors**:
  - `400 Bad Request`: `{"code": "ERR_INVALID_QR_TOKEN", "message": "Invalid or forged QR token."}`
  - `400 Bad Request`: `{"code": "ERR_QR_EXPIRED", "message": "QR token has expired. Please scan the current code on screen."}`
  - `400 Bad Request`: `{"code": "ERR_DISPLAY_DISABLED", "message": "Associated display terminal is currently disabled."}`
  - `400 Bad Request`: `{"code": "ERR_DISPLAY_REVOKED", "message": "Associated display terminal has been revoked."}`

---

## 3. Attendance Punch & Metrics Endpoints

Routes are mounted under both `/attendance` and `/api/attendance` (e.g. `/attendance/scan` and `/api/attendance/scan`).

### 3.1 `POST /attendance/scan` (or `/api/attendance/scan`, `/api/attendance/punch`)

- **Role**: `Employee` (or any authenticated user with an active employee roster profile)
- **Description**: Client submits only the scanned QR token string. The server performs all evaluations: validates the token via `validateQrToken`, enforces per-employee single-redemption replay defense, computes server timestamp and `dateKey`, evaluates punctuality (on-time vs late), matches cross-midnight overnight shift checkouts, and applies atomic concurrency-safe state transitions.
- **Headers**: `Authorization: Bearer <jwt>`
- **Request Body**:
  ```json
  {
    "token": "qrt_8f91b2c4e1...",
    "action": "CHECK_IN"
  }
  ```
  _(Note: `action` is optional; if omitted, the state machine auto-determines check-in vs check-out based on current session state. `simulatedNow` is accepted in test/demo environments.)_
- **Response (200 OK - Check-In)**:
  ```json
  {
    "success": true,
    "punchType": "CHECK_IN",
    "status": "PRESENT",
    "isLate": false,
    "lateMinutes": 0,
    "durationMinutes": 0,
    "record": {
      "_id": "6714a8b...",
      "employeeId": "EMP-1001",
      "department": "Engineering",
      "dateKey": "2026-10-20",
      "checkInTime": "2026-10-20T03:30:00.000Z",
      "checkOutTime": null,
      "status": "PRESENT",
      "durationMinutes": 0,
      "isLate": false,
      "lateMinutes": 0
    },
    "message": "Check-in successful. Welcome to VorldX!"
  }
  ```
- **Response (200 OK - Check-Out)**:
  ```json
  {
    "success": true,
    "punchType": "CHECK_OUT",
    "status": "CHECKED_OUT",
    "isLate": false,
    "lateMinutes": 0,
    "durationMinutes": 540,
    "record": {
      "_id": "6714a8b...",
      "employeeId": "EMP-1001",
      "dateKey": "2026-10-20",
      "checkInTime": "2026-10-20T03:30:00.000Z",
      "checkOutTime": "2026-10-20T12:30:00.000Z",
      "status": "CHECKED_OUT",
      "durationMinutes": 540
    },
    "message": "Check-out successful. Total duration: 9h 0m."
  }
  ```
- **Errors**:
  - `400 Bad Request`: `{"code": "ERR_INVALID_QR_TOKEN", "message": "Invalid or forged QR token."}`
  - `400 Bad Request`: `{"code": "ERR_QR_EXPIRED", "message": "QR token has expired. Please scan the current code on screen."}`
  - `400 Bad Request`: `{"code": "ERR_DISPLAY_DISABLED", "message": "Associated display terminal is currently disabled."}`
  - `400 Bad Request`: `{"code": "ERR_DISPLAY_REVOKED", "message": "Associated display terminal has been revoked."}`
  - `400 Bad Request`: `{"code": "ERR_NO_ACTIVE_CHECKIN", "message": "Cannot check out. No active check-in session found for this employee today."}`
  - `403 Forbidden`: `{"code": "ERR_EMPLOYEE_INACTIVE", "message": "Your employee account is inactive. Please contact HR."}`
  - `404 Not Found`: `{"code": "ERR_EMPLOYEE_NOT_FOUND", "message": "Employee profile not found."}`
  - `409 Conflict`: `{"code": "ERR_QR_REPLAY_DETECTED", "message": "You have already scanned this specific QR code token."}`
  - `409 Conflict`: `{"code": "ERR_ALREADY_CHECKED_IN", "message": "Employee is already checked in for today. Your next scan will be processed as Check-Out."}`
  - `409 Conflict`: `{"code": "ERR_ALREADY_WFH_APPROVED", "message": "Attendance already recorded as Work From Home for today. Contact HR if you wish to revoke WFH."}`
- **Atomic Standalone DB Operations**:
  1. **Replay Defense Log**:
     `QrChallenge.create({ employee, employeeId, qrNonce: token, terminalId, redeemedAt })`
     Guarded by unique compound index `{ employee: 1, qrNonce: 1 }`.
  2. **Atomic Check-In Upsert**:
     `AttendanceRecord.findOneAndUpdate({ employee, dateKey }, { $setOnInsert: { ... } }, { upsert: true, new: true, rawResult: true })`
     Guarded by unique compound index `{ employee: 1, dateKey: 1 }`.
  3. **Atomic Check-Out Update**:
     `AttendanceRecord.findOneAndUpdate({ _id: record._id, checkOutTime: null }, { $set: { checkOutTime: now, durationMinutes, status } }, { new: true })`

---

### 3.2 `GET /attendance/today` (or `/api/attendance/today`)

- **Role**: `Employee`
- **Description**: Returns today's live punch card state for the employee, including whether check-in or check-out is currently available.
- **Headers**: `Authorization: Bearer <jwt>`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "dateKey": "2026-10-20",
    "hasPunched": true,
    "punchType": "CHECKED_IN",
    "status": "PRESENT",
    "record": { ... },
    "canCheckIn": false,
    "canCheckOut": true
  }
  ```

---

### 3.3 `GET /attendance/me` (or `/api/attendance/me`, `/api/attendance/history`)

- **Role**: `Employee`
- **Description**: Returns paginated attendance history and aggregate statistics (present days, late days, half days, WFH days, total work minutes, and attendance percentage).
- **Headers**: `Authorization: Bearer <jwt>`
- **Query Parameters**:
  - `month` (string, optional): Filter by month, e.g. `2026-10`.
  - `dateKey` (string, optional): Filter by exact date, e.g. `2026-10-20`.
  - `status` (string, optional): Filter by `AttendanceStatus`.
  - `page` (number, default: 1)
  - `limit` (number, default: 20)
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "6714a8b...",
        "dateKey": "2026-10-20",
        "checkInTime": "2026-10-20T03:30:00.000Z",
        "checkOutTime": "2026-10-20T12:30:00.000Z",
        "status": "CHECKED_OUT",
        "durationMinutes": 540,
        "isLate": false
      }
    ],
    "stats": {
      "totalDays": 15,
      "presentDays": 13,
      "lateDays": 2,
      "halfDays": 0,
      "wfhDays": 2,
      "absentDays": 0,
      "totalWorkMinutes": 7020,
      "attendancePercentage": 100
    },
    "pagination": {
      "total": 15,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
  ```

---

### 3.4 `GET /attendance` (or `/api/attendance`, `/api/admin/attendance`)

- **Role**: `HR` / `ADMIN`
- **Description**: Retrieves the organization-wide attendance ledger with multi-column filtering, date range lookups, full-text search, and pagination.
- **Headers**: `Authorization: Bearer <jwt>`
- **Query Parameters**:
  - `startDate` (string, optional, format: `YYYY-MM-DD`): Start date of range.
  - `endDate` (string, optional, format: `YYYY-MM-DD`): End date of range.
  - `dateKey` (string, optional, format: `YYYY-MM-DD`): Single exact date.
  - `from` / `to` (string, optional): Aliases for date range boundaries.
  - `department` (string, optional): Department filter.
  - `employee` / `employeeId` (string, optional): Employee ID or MongoDB ObjectId.
  - `status` (string, optional): Filter by `AttendanceStatus` (`PRESENT`, `LATE`, `HALF_DAY`, `ABSENT`, `WFH_APPROVED`, `INCOMPLETE`, etc.).
  - `workType` (string, optional): Filter by employment type (`FULL_TIME`, `PART_TIME`, `CONTRACT`, `INTERN`).
  - `search` (string, optional): Case-insensitive search on `employeeId`, `department`, or employee name.
  - `page` (number, default: 1): Pagination page number.
  - `limit` (number, default: 20, max: 100): Page size limit.
  - `sortBy` (string, default: `dateKey`): Field to sort by (`dateKey`, `createdAt`, `employeeId`, `status`).
  - `sortOrder` (string, default: `desc`): Sort direction (`asc` or `desc`).
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "6714a8b...",
        "employee": {
          "_id": "6714a1...",
          "name": "Rohan Verma",
          "email": "rohan.verma@vorldx.demo",
          "department": "Engineering",
          "designation": "Software Engineer",
          "workType": "FULL_TIME"
        },
        "employeeId": "EMP-1001",
        "department": "Engineering",
        "dateKey": "2026-10-20",
        "checkInTime": "2026-10-20T03:30:00.000Z",
        "checkOutTime": "2026-10-20T12:00:00.000Z",
        "durationMinutes": 510,
        "status": "CHECKED_OUT",
        "isLate": false,
        "isMissingCheckout": false,
        "isManuallyCorrected": false,
        "corrections": []
      }
    ],
    "pagination": {
      "total": 45,
      "page": 1,
      "limit": 20,
      "totalPages": 3
    }
  }
  ```
- **Errors**:
  - `403 Forbidden`: `{"code": "ERR_FORBIDDEN", "message": "Insufficient permissions to access this resource."}`

---

### 3.5 `PATCH /attendance/:id/correct` (or `/attendance/:id`, `/api/attendance/:id/correct`)

- **Role**: `HR` / `ADMIN`
- **Description**: Performs an administrative correction on an attendance record. Enforces a mandatory justification reason, validates that `checkOutTime` is strictly after `checkInTime`, snapshots original pre-correction values in `originalValues`, appends a complete audit history entry to `corrections`, recomputes duration and punctuality status, and records an immutable `AuditEvent`. Regular employees are strictly blocked.
- **Headers**: `Authorization: Bearer <jwt>`
- **Request Body**:
  ```json
  {
    "checkInTime": "2026-10-20T03:30:00.000Z",
    "checkOutTime": "2026-10-20T12:00:00.000Z",
    "isLate": false,
    "reason": "Biometric terminal network failure during morning shift entry"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Attendance record successfully corrected.",
    "record": {
      "_id": "6714a8b...",
      "employeeId": "EMP-1001",
      "dateKey": "2026-10-20",
      "checkInTime": "2026-10-20T03:30:00.000Z",
      "checkOutTime": "2026-10-20T12:00:00.000Z",
      "durationMinutes": 510,
      "status": "CHECKED_OUT",
      "isLate": false,
      "isManuallyCorrected": true,
      "correctionReason": "Biometric terminal network failure during morning shift entry",
      "correctedBy": "6714a9...",
      "correctedAt": "2026-10-20T14:00:00.000Z",
      "originalValues": {
        "checkInTime": "2026-10-20T04:30:00.000Z",
        "checkOutTime": null,
        "status": "LATE",
        "durationMinutes": 0,
        "isLate": true,
        "lateMinutes": 60
      },
      "corrections": [
        {
          "correctionReason": "Biometric terminal network failure during morning shift entry",
          "correctedBy": "6714a9...",
          "correctedAt": "2026-10-20T14:00:00.000Z",
          "previousValues": { ... },
          "newValues": { ... }
        }
      ]
    }
  }
  ```
- **Errors**:
  - `400 Bad Request`: `{"code": "ERR_CORRECTION_REASON_REQUIRED", "message": "A justification reason of at least 5 characters is required for administrative corrections."}`
  - `400 Bad Request`: `{"code": "ERR_BAD_REQUEST", "message": "Check-out time must be strictly after check-in time."}`
  - `403 Forbidden`: `{"code": "ERR_FORBIDDEN", "message": "Insufficient permissions to access this resource."}`
  - `404 Not Found`: `{"code": "ERR_NOT_FOUND", "message": "Attendance record not found."}`
- **Audit**: Appends an entry to `auditevents` with `entityType: "ATTENDANCE_RECORD"`, `action: "CORRECTION"`, previous and new value snapshots, and reason.

---

### 3.6 `POST /attendance/jobs/evaluate-day` (or `/api/attendance/jobs/evaluate-day`, `/api/admin/attendance/evaluate`)

- **Role**: `ADMIN` (Demo & Manual Trigger)
- **Description**: Triggers automated absence and incomplete checkout evaluation for a specific date or today.
  1. **Cutoff Guard**: Refuses to mark absentees before the daily policy cutoff time (e.g. `20:00` or `23:59`) unless `force: true` is passed for demo simulation.
  2. **Exclusions**: Skips non-working weekend days (`isWorkday`), official company holidays (`isHoliday`), and employees with approved WFH requests (`WfhRequest.status === "APPROVED"`).
  3. **Incomplete Checkout Tagging**: Employees with check-in timestamps but missing check-outs are marked with status `INCOMPLETE` and `isMissingCheckout: true`.
  4. **Absence Marking**: Employees with no check-in punch and no approved WFH are atomically marked as `ABSENT`.
  5. **Idempotent Execution**: Subsequent executions on the same date produce zero additional modifications and create zero duplicate records.
- **Headers**: `Authorization: Bearer <jwt>`
- **Request Body**:
  ```json
  {
    "dateKey": "2026-10-20",
    "force": false,
    "simulatedNow": "2026-10-20T21:00:00.000Z"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "evaluatedDateKey": "2026-10-20",
    "absenteesMarked": 3,
    "incompleteMarked": 1,
    "skipped": false,
    "message": "Absence evaluation completed for 2026-10-20. Marked 3 absentee(s) and 1 incomplete checkout(s)."
  }
  ```
- **Errors**:
  - `400 Bad Request`: `{"code": "ERR_CUTOFF_NOT_REACHED", "message": "Cannot evaluate absences before the daily policy cutoff time (20:00). Current local time is 11:30."}`
  - `403 Forbidden`: `{"code": "ERR_FORBIDDEN", "message": "Insufficient permissions to access this resource."}`

---

## 4. Work From Home (WFH) Management

Mounted at `/api/wfh`, `/wfh`, and `/api/admin/wfh`.

### 4.1 `GET /api/wfh/eligibility`

- **Role**: `Employee`
- **Description**: Evaluates authenticated employee's WFH eligibility against organizational policy, work type (e.g. Interns restricted), and monthly quota.
- **Headers**: `Authorization: Bearer <jwt>`
- **Response (200 OK)**:
  ```json
  {
    "isEligible": true,
    "employeeId": "EMP-1001",
    "department": "Engineering",
    "workType": "FULL_TIME",
    "monthlyQuota": 4,
    "usedDays": 1,
    "remainingQuota": 3,
    "advanceNoticeDays": 1,
    "allowedDaysPerWeek": 2,
    "rules": "Requests require at least 1 day(s) advance notice. Monthly quota is 4 days.",
    "reasons": []
  }
  ```

---

### 4.2 `POST /api/wfh/requests` (or `/wfh/requests`)

- **Role**: `Employee`
- **Description**: Submits a new WFH request. Enforces advance notice, past date restrictions, non-workday/weekend checks, official holiday checks, in-office presence conflicts, monthly quota limits, and duplicate request prevention.
- **Headers**: `Authorization: Bearer <jwt>`
- **Request Body**:
  ```json
  {
    "dateKey": "2026-10-22",
    "reason": "Home broadband installation and client calls."
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Work From Home request submitted successfully.",
    "request": {
      "_id": "6714a8...",
      "employee": "6714a1...",
      "employeeId": "EMP-1001",
      "department": "Engineering",
      "dateKey": "2026-10-22",
      "reason": "Home broadband installation and client calls.",
      "status": "PENDING",
      "createdAt": "2026-10-20T18:15:00.000Z"
    }
  }
  ```
- **Errors**:
  - `400 Bad Request`: `{"code": "ERR_WFH_INELIGIBLE", "message": "Cannot submit WFH request for past dates."}`
  - `400 Bad Request`: `{"code": "ERR_WFH_INELIGIBLE", "message": "WFH requests require at least 1 day(s) advance notice."}`
  - `400 Bad Request`: `{"code": "ERR_WFH_INELIGIBLE", "message": "Interns are not eligible for Work From Home under organizational policy."}`
  - `400 Bad Request`: `{"code": "ERR_NON_WORKING_DAY", "message": "Today is a non-working weekend or company holiday. Office attendance is not required."}`
  - `400 Bad Request`: `{"code": "ERR_WFH_CURRENTLY_IN_OFFICE", "message": "Cannot apply for Work From Home while currently punched in at the office."}`
  - `400 Bad Request`: `{"code": "ERR_WFH_ALREADY_WORKED", "message": "Cannot submit WFH request for a date where an office attendance record is already completed."}`
  - `400 Bad Request`: `{"code": "ERR_QUOTA_EXCEEDED", "message": "Monthly Work From Home quota of 4 days has been reached."}`
  - `409 Conflict`: `{"code": "ERR_DUPLICATE_WFH_REQUEST", "message": "A WFH request for this date already exists."}`
- **Audit**: Writes `AuditEvent` with `entityType: "WFH_REQUEST"`, `action: "CREATE"`, and `performedByEmployeeId`.

---

### 4.3 `GET /api/wfh/my-requests` (or `/api/wfh/me`)

- **Role**: `Employee`
- **Description**: Returns a paginated list of the authenticated employee's own WFH requests sorted by `dateKey` descending.
- **Headers**: `Authorization: Bearer <jwt>`
- **Query Parameters**:
  - `status` (string, optional): `PENDING` | `APPROVED` | `REJECTED` | `CANCELLED` | `ALL`
  - `month` (string, optional): Filter by month (`YYYY-MM`)
  - `page` (number, default: 1)
  - `limit` (number, default: 20, max: 100)
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "6714a8...",
        "employeeId": "EMP-1001",
        "dateKey": "2026-10-22",
        "reason": "Home broadband installation and client calls.",
        "status": "APPROVED",
        "reviewedBy": "6714b9...",
        "reviewerRemarks": "Approved",
        "reviewedAt": "2026-10-21T09:00:00.000Z",
        "createdAt": "2026-10-20T18:15:00.000Z"
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
  ```

---

### 4.4 `PATCH /api/wfh/requests/:id/cancel` (or `POST /api/wfh/requests/:id/cancel`)

- **Role**: `Employee`
- **Description**: Cancels a submitted WFH request. Strictly permits cancelling only requests that are in `PENDING` state.
- **Headers**: `Authorization: Bearer <jwt>`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "WFH request cancelled successfully.",
    "request": {
      "_id": "6714a8...",
      "status": "CANCELLED"
    }
  }
  ```
- **Errors**:
  - `400 Bad Request`: `{"code": "ERR_BAD_REQUEST", "message": "Only pending WFH requests can be cancelled."}`
  - `404 Not Found`: `{"code": "ERR_NOT_FOUND", "message": "WFH request not found."}`
- **Audit**: Writes `AuditEvent` with `entityType: "WFH_REQUEST"`, `action: "CANCEL"`.

---

### 4.5 `GET /api/wfh/admin/requests` (or `/api/admin/wfh/requests`)

- **Role**: `HR` / `ADMIN`
- **Description**: Paginated query of all organizational WFH requests with multi-column filtering.
- **Headers**: `Authorization: Bearer <jwt>`
- **Query Parameters**:
  - `status` (string, optional): `PENDING` | `APPROVED` | `REJECTED` | `CANCELLED` | `ALL`
  - `department` (string, optional)
  - `month` (string, optional, format: `YYYY-MM`)
  - `search` (string, optional): Case-insensitive match on `employeeId`, `department`, or `reason`
  - `page` (number, default: 1)
  - `limit` (number, default: 20, max: 100)
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "6714a8...",
        "employee": {
          "_id": "6714a1...",
          "name": "Aarav Sharma",
          "email": "aarav.sharma@vorldx.demo",
          "department": "Engineering",
          "designation": "Backend Engineer"
        },
        "employeeId": "EMP-1001",
        "department": "Engineering",
        "dateKey": "2026-10-22",
        "reason": "Home broadband installation and client calls.",
        "status": "PENDING",
        "createdAt": "2026-10-20T18:15:00.000Z"
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
  ```

---

### 4.6 `PATCH /api/wfh/requests/:id/review` (or `/api/admin/wfh/requests/:id/review`)

- **Role**: `HR` / `ADMIN`
- **Description**: Reviews a pending WFH request. The status transition is atomic (`findOneAndUpdate({ _id, status: PENDING })`), permanently preventing double decisions. On approval, automatically applies WFH attendance treatment by creating or updating `attendance_records` with status `WFH_APPROVED`, `isWfh: true`, and 480 minutes duration credit without requiring a QR scan.
- **Headers**: `Authorization: Bearer <jwt>`
- **Request Body**:
  ```json
  {
    "status": "APPROVED",
    "remarks": "Approved as per team schedule."
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "WFH request approved. Attendance record credited.",
    "request": {
      "_id": "6714a8...",
      "status": "APPROVED",
      "reviewedBy": "6714b9...",
      "reviewerRemarks": "Approved as per team schedule.",
      "reviewedAt": "2026-10-21T09:00:00.000Z"
    }
  }
  ```
- **Errors**:
  - `403 Forbidden`: `{"code": "ERR_FORBIDDEN", "message": "Insufficient permissions to access this resource."}`
  - `404 Not Found`: `{"code": "ERR_NOT_FOUND", "message": "WFH request not found."}`
  - `409 Conflict`: `{"code": "ERR_BAD_REQUEST", "message": "WFH request has already been decided (APPROVED). Double review is prohibited."}`
- **DB Changes (Atomic Standalone)**:
  1. Atomic review state change:
     ```javascript
     const updatedRequest = await db.wfhrequests.findOneAndUpdate(
       { _id: new ObjectId(requestId), status: "PENDING" },
       {
         $set: {
           status: req.body.status,
           reviewedBy: adminUserId,
           reviewerRemarks: req.body.remarks,
           reviewedAt: new Date(),
         },
       },
       { new: true }
     );
     ```
  2. If approved, atomic attendance auto-credit:
     ```javascript
     if (review.status === "APPROVED") {
       await db.attendancerecords.findOneAndUpdate(
         { employee: updatedRequest.employee, dateKey: updatedRequest.dateKey },
         {
           $set: {
             status: "WFH_APPROVED",
             isWfh: true,
             durationMinutes: 480,
             systemNotes: `Auto-credited via approved WFH request. Reviewer remarks: ${updatedRequest.reviewerRemarks}`,
             policyId: policy._id,
             policyVersion: policy.version,
           },
           $setOnInsert: {
             employee: updatedRequest.employee,
             employeeId: updatedRequest.employeeId,
             department: updatedRequest.department,
             dateKey: updatedRequest.dateKey,
             checkInTime: null,
             checkOutTime: null,
             isLate: false,
             lateMinutes: 0,
             isMissingCheckout: false,
             isManuallyCorrected: false,
           },
         },
         { upsert: true, new: true }
       );
     }
     ```
- **Audit**: Writes `AuditEvent` with `entityType: "WFH_REQUEST"`, `action: "UPDATE"`, `performedBy: adminUserId`, `performedByEmployeeId: actor.employeeId`, `previousValue: { status: "PENDING" }`, `newValue: { status: updatedRequest.status }`.

---

## 5. HR / Admin Operations & Reports

### 5.1 `GET /dashboard/summary` (or `/api/dashboard/summary`, `/api/admin/dashboard/summary`)

- **Role**: `HR` / `ADMIN`
- **Description**: Real-time executive attendance metrics, punctuality breakdown, 7-day and 30-day historical trend series, and recent system audit log events. Computed directly from the database using state machine definitions.
- **Headers**: `Authorization: Bearer <jwt>`
- **Query Parameters**:
  - `dateKey` (string, optional, format: `YYYY-MM-DD`): Target operational date (defaults to today in company timezone).
  - `simulatedNow` (string, optional): ISO timestamp for demo simulation.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "dateKey": "2026-10-20",
    "summary": {
      "totalActiveEmployees": 48,
      "presentToday": 38,
      "lateToday": 4,
      "wfhToday": 5,
      "notYetCheckedInToday": 5,
      "pendingWfhRequests": 2,
      "attendanceRate": 89.6
    },
    "trends": {
      "last7Days": [
        {
          "dateKey": "2026-10-14",
          "totalEmployees": 48,
          "presentCount": 40,
          "lateCount": 3,
          "wfhCount": 4,
          "absentCount": 4,
          "attendanceRate": 91.7
        }
      ],
      "last30Days": [ ... ]
    },
    "recentActivity": [
      {
        "id": "6714a8b...",
        "action": "CORRECTION",
        "entityType": "ATTENDANCE_RECORD",
        "entityId": "rec_1001",
        "performedByEmployeeId": "HR-9001",
        "reason": "Adjusted missing checkout",
        "timestamp": "2026-10-20T10:00:00.000Z"
      }
    ]
  }
  ```
- **Errors**:
  - `401 Unauthorized`: `{"code": "ERR_UNAUTHORIZED", "message": "Authentication required"}`
  - `403 Forbidden`: `{"code": "ERR_FORBIDDEN", "message": "Insufficient permissions to access this resource."}`

---

### 5.2 Employee Management & Directory Endpoints

#### 5.2.1 `GET /api/employees`

- **Role**: `HR` / `ADMIN`
- **Description**: Retrieves a paginated list of employees with multi-field search, department/status/workType filtering, and flexible sorting.
- **Query Parameters**:
  - `page` (number, default: 1): Page number.
  - `limit` (number, default: 20, max: 100): Page size.
  - `search` (string, optional): Case-insensitive search across `name`, `employeeId`, and `email`.
  - `department` (string, optional): Filter by department name.
  - `designation` (string, optional): Filter by designation title.
  - `status` (string, optional): Filter by active state (`active`, `inactive`, `all`).
  - `workType` (string, optional): Filter by `FULL_TIME`, `PART_TIME`, `CONTRACT`, `INTERN`.
  - `shiftId` (string, optional): Filter by assigned shift ObjectId.
  - `sortBy` (string, default: `createdAt`): Column to sort by (`name`, `employeeId`, `department`, `designation`, `joiningDate`, `createdAt`, `updatedAt`).
  - `sortOrder` (string, default: `desc`): `asc` or `desc`.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "6714a8b...",
        "employeeId": "EMP-1001",
        "name": "Aarav Sharma",
        "email": "aarav.sharma@vorldx.demo",
        "department": "Engineering",
        "designation": "Lead Systems Architect",
        "workType": "FULL_TIME",
        "shiftId": "6714a8a...",
        "joiningDate": "2023-01-15",
        "isActive": true,
        "userId": {
          "_id": "6714a8c...",
          "role": "EMPLOYEE",
          "status": "ACTIVE",
          "lastLoginAt": "2026-10-20T10:00:00.000Z"
        },
        "createdAt": "2026-10-20T08:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 27,
      "page": 1,
      "limit": 20,
      "totalPages": 2,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
  ```
- **Errors**:
  - `401 Unauthorized`: `{"code": "ERR_UNAUTHORIZED", "message": "Authentication required"}`
  - `403 Forbidden`: `{"code": "ERR_FORBIDDEN", "message": "Access denied: required role in [HR, ADMIN]"}`

---

#### 5.2.2 `GET /api/employees/me`

- **Role**: `Authenticated` (Any authenticated employee or administrator)
- **Description**: Returns the authenticated caller's own employee record.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "_id": "6714a8b...",
      "employeeId": "EMP-1001",
      "name": "Aarav Sharma",
      "email": "aarav.sharma@vorldx.demo",
      "department": "Engineering",
      "designation": "Lead Systems Architect",
      "workType": "FULL_TIME",
      "joiningDate": "2023-01-15",
      "isActive": true
    }
  }
  ```
- **Errors**:
  - `401 Unauthorized`: `{"code": "ERR_UNAUTHORIZED", "message": "Authentication required"}`

---

#### 5.2.3 `GET /api/employees/:id`

- **Role**: `HR` / `ADMIN`
- **Description**: Retrieves full employee profile by Mongo ObjectId or unique `employeeId`.
- **Response (200 OK)**: Full employee document populated with assigned user credentials status.
- **Errors**:
  - `404 Not Found`: `{"code": "ERR_EMPLOYEE_NOT_FOUND", "message": "Employee 'EMP-999' not found"}`

---

#### 5.2.4 `POST /api/employees`

- **Role**: `HR` / `ADMIN`
- **Description**: Onboards a new employee into the company roster, preventing duplicates and writing an AuditEvent.
- **Request Body**:
  ```json
  {
    "employeeId": "EMP-1050",
    "name": "Sunita Rao",
    "email": "sunita.rao@vorldx.demo",
    "department": "Engineering",
    "designation": "Staff Security Engineer",
    "workType": "FULL_TIME",
    "shiftId": "6714a8a...",
    "joiningDate": "2026-11-01"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Employee created successfully",
    "data": { ... }
  }
  ```
- **Errors**:
  - `400 Bad Request`: `{"code": "ERR_INVALID_INPUT", "message": "Request validation failed"}`
  - `409 Conflict`: `{"code": "ERR_BAD_REQUEST", "message": "Employee ID 'EMP-1050' already exists in company roster"}`
  - `409 Conflict`: `{"code": "ERR_BAD_REQUEST", "message": "Email address already assigned to another employee"}`
- **Audit Logging (Atomic)**:
  - Appends to `auditevents` collection: `{ entityType: "EMPLOYEE", entityId: emp._id, action: "CREATE", performedBy: user._id, previousValue: null, newValue: emp, timestamp: now }`.

---

#### 5.2.5 `PATCH /api/employees/:id`

- **Role**: `HR` / `ADMIN`
- **Description**: Updates profile details (department, designation, workType, shift) and records previous/new state in AuditEvent.
- **Request Body**: Partial update object (`EmployeeUpdateSchema`).
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Employee updated successfully",
    "data": { ... }
  }
  ```
- **Audit Logging (Atomic)**:
  - Appends to `auditevents`: `{ entityType: "EMPLOYEE", action: "UPDATE", previousValue: beforeState, newValue: afterState }`.

---

#### 5.2.6 `PATCH /api/employees/:id/status`

- **Role**: `HR` / `ADMIN`
- **Description**: Activates or deactivates an employee. Deactivation immediately invalidates refresh tokens and marks User status as `INACTIVE`, blocking login and QR attendance punches without deleting historical records.
- **Request Body**:
  ```json
  {
    "isActive": false,
    "reason": "Resigned from company as of Oct 2026"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Employee deactivated successfully",
    "data": { ... }
  }
  ```
- **Audit Logging (Atomic)**:
  - Appends to `auditevents`: `{ entityType: "EMPLOYEE", action: "DEACTIVATE", previousValue: { isActive: true }, newValue: { isActive: false }, reason: "..." }`.

---

### 5.3 `POST /api/admin/attendance/:id/correct`

- **Role**: `HR_Admin`
- **Description**: Manual correction of an attendance record with mandatory justification.
- **Request Body**:
  ```json
  {
    "status": "PRESENT",
    "checkInTime": "2026-10-20T03:30:00.000Z",
    "checkOutTime": "2026-10-20T11:30:00.000Z",
    "reason": "Employee badge scanner failure during morning rush; verified with CCTV."
  }
  ```
- **Response (200 OK)**: Updated attendance record and created audit log entry.
- **Errors**:
  - `400 Bad Request`: `{"code": "ERR_MISSING_REASON", "message": "A non-empty justification reason is required."}`
- **DB Changes (Atomic Standalone Operations)**:
  1. Update attendance record:
     ```javascript
     const prev = await db.attendance_records.findOneAndUpdate(
       { _id: req.params.id },
       {
         $set: {
           status: req.body.status,
           checkInTime: new Date(req.body.checkInTime),
           checkOutTime: new Date(req.body.checkOutTime),
           isManuallyCorrected: true,
           updatedAt: new Date(),
         },
       }
     );
     ```
  2. Append immutable audit log:
     ```javascript
     await db.audit_logs.insertOne({
       entityType: "ATTENDANCE_RECORD",
       entityId: req.params.id,
       performedBy: admin._id,
       action: "MANUAL_CORRECTION",
       previousValue: prev,
       newValue: req.body,
       reason: req.body.reason,
       timestamp: new Date(),
     });
     ```
- **Events**: Emits `stats:daily_updated` to room `hr:dashboard`.

---

### 5.4 Reporting & CSV Export Endpoints

Mounted under `/reports`, `/api/reports`, and `/api/admin/reports`. All endpoints require `HR` or `ADMIN` role.

#### 5.4.1 `GET /reports/attendance` (and `/attendance/export`)

- **Query Parameters**: `startDate`, `endDate`, `department`, `status`, `workType`, `search`, `page`, `limit`, `format` (`json` or `csv`).
- **JSON Response**: Returns paginated attendance records and aggregated summary statistics (`presentCount`, `lateCount`, `halfDayCount`, `wfhCount`, `absentCount`, `totalHours`).
- **CSV Response**: Streams RFC 4180 compliant CSV with UTF-8 BOM. Cells containing formula injection triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) are automatically escaped with a leading single quote (`'`).

#### 5.4.2 `GET /reports/employee-wise` (and `/employee-wise/export`)

- **Query Parameters**: `startDate`, `endDate`, `department`, `workType`, `search`, `page`, `limit`, `format`.
- **Description**: Aggregate work metrics grouped per employee across the specified date window (`totalDays`, `presentDays`, `lateDays`, `halfDays`, `wfhDays`, `absentDays`, `totalWorkHours`, `attendanceRate`).
- **CSV Response**: Downloadable `employee_wise_attendance_*.csv`.

#### 5.4.3 `GET /reports/department-wise` (and `/department-wise/export`)

- **Query Parameters**: `startDate`, `endDate`, `department`, `format`.
- **Description**: Aggregate attendance metrics grouped by department (`headcount`, `totalRecords`, `presentCount`, `lateCount`, `wfhCount`, `absentCount`, `totalWorkHours`, `attendanceRate`).
- **CSV Response**: Downloadable `department_wise_attendance_*.csv`.

#### 5.4.4 `GET /reports/late` (and `/late/export`)

- **Query Parameters**: `startDate`, `endDate`, `department`, `employeeId`, `format`.
- **Description**: Detailed late arrivals report listing individual late check-in punches, scheduled start times, and late minutes.
- **CSV Response**: Downloadable `late_arrivals_report_*.csv`.

#### 5.4.5 `GET /reports/wfh` (and `/wfh/export`)

- **Query Parameters**: `startDate`, `endDate`, `department`, `status` (`PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`, `ALL`), `search`, `format`.
- **Description**: Work From Home utilization report with submission reasons, reviewer details, remarks, and approval timestamps.
- **CSV Response**: Downloadable `wfh_utilization_report_*.csv`.

---

### 5.5 `GET /audit-logs` (or `/api/audit-logs`, `/api/admin/audit-logs`)

- **Role**: `HR` / `ADMIN`
- **Description**: Queries the immutable organizational audit trail with comprehensive filtering and pagination.
- **Headers**: `Authorization: Bearer <jwt>`
- **Query Parameters**:
  - `actor` / `performedBy`: ObjectId or actorEmployeeId.
  - `action`: Filter by action type (`CREATE`, `UPDATE`, `DELETE`, `CORRECTION`, `CANCEL`, `RESUBMIT`).
  - `entity` / `entityType`: Filter by audited entity (`ATTENDANCE_RECORD`, `WFH_REQUEST`, `EMPLOYEE`, `POLICY`, `TERMINAL`, `AUTH`).
  - `entityId`: Filter by target entity ID.
  - `startDate` & `endDate` (or `from` & `to`): Filter by event timestamp.
  - `search`: Free-text search on reasons or employee IDs.
  - `page` (number, default: 1)
  - `limit` (number, default: 20, max: 100)
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "6714a8b...",
        "entityType": "ATTENDANCE_RECORD",
        "entityId": "rec_1001",
        "performedBy": {
          "_id": "6714a1...",
          "employeeId": "HR-9001",
          "email": "hr.director@vorldx.demo",
          "role": "HR"
        },
        "performedByEmployeeId": "HR-9001",
        "action": "CORRECTION",
        "previousValue": { ... },
        "newValue": { ... },
        "reason": "Adjusted missing checkout",
        "timestamp": "2026-10-20T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 128,
      "page": 1,
      "limit": 20,
      "totalPages": 7
    }
  }
  ```
- **Errors**:
  - `401 Unauthorized`: `{"code": "ERR_UNAUTHORIZED", "message": "Authentication required"}`
  - `403 Forbidden`: `{"code": "ERR_FORBIDDEN", "message": "Insufficient permissions to access this resource."}`

---

## 6. Attendance Policy & Holiday Management

### 6.1 `GET /api/policy`

- **Role**: `EMPLOYEE` / `HR` / `ADMIN` (Any authenticated user)
- **Description**: Retrieves the active organizational attendance policy, including configured shifts, workdays, grace period minutes, check-in/out windows, absence evaluation cutoff time, timezone, and WFH quotas. If no policy exists yet in the database, automatically seeds and returns the default version 1 policy.
- **Headers**: `Authorization: Bearer <jwt>`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "_id": "6714b1000...",
      "name": "Default Attendance Policy",
      "version": 1,
      "timezone": "Asia/Kolkata",
      "workDays": [1, 2, 3, 4, 5],
      "gracePeriodMinutes": 15,
      "halfDayThresholdMinutes": 240,
      "fullDayThresholdMinutes": 480,
      "absenceEvaluationCutoffTime": "23:59",
      "shifts": [
        {
          "shiftId": "SHIFT-DAY",
          "name": "Standard General Shift",
          "startTime": "09:00",
          "endTime": "18:00",
          "isOvernight": false,
          "checkInStartMinutesBefore": 60,
          "checkInEndMinutesAfter": 120,
          "checkOutStartMinutesBefore": 60,
          "checkOutEndMinutesAfter": 180
        }
      ],
      "wfhRules": {
        "maxMonthlyAllowed": 4,
        "requiresAdvanceNoticeDays": 1,
        "requireDocument": false
      },
      "isActive": true,
      "createdAt": "2026-10-20T10:00:00.000Z",
      "updatedAt": "2026-10-20T10:00:00.000Z"
    }
  }
  ```

---

### 6.2 `PATCH /api/policy` (or `PUT /api/policy`)

- **Role**: `HR` / `ADMIN`
- **Description**: Updates the active attendance policy configuration. Enforces strict shift timing validation (shift end must be after start unless `isOvernight: true`, grace periods between 0–60 minutes, and no overlapping daytime shift windows). Increments the policy `version` counter atomically so existing attendance records maintain their historical policy snapshot (`policyVersion`). Appends an immutable `AuditEvent`.
- **Headers**: `Authorization: Bearer <jwt>`
- **Request Body**:
  ```json
  {
    "gracePeriodMinutes": 20,
    "wfhRules": {
      "maxMonthlyAllowed": 5,
      "requiresAdvanceNoticeDays": 2
    },
    "reason": "Updated grace period for winter commuting and increased WFH allowance"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Attendance policy updated successfully (version 2)",
    "data": {
      "_id": "6714b1000...",
      "name": "Default Attendance Policy",
      "version": 2,
      "timezone": "Asia/Kolkata",
      "gracePeriodMinutes": 20,
      "wfhRules": {
        "maxMonthlyAllowed": 5,
        "requiresAdvanceNoticeDays": 2,
        "requireDocument": false
      },
      "updatedAt": "2026-10-20T11:00:00.000Z"
    }
  }
  ```
- **Errors**:
  - `400 Bad Request`: `{"code": "ERR_VALIDATION", "message": "Validation failed", "details": [...]}` (e.g., negative grace period, invalid shift times).
  - `403 Forbidden`: `{"code": "ERR_FORBIDDEN", "message": "HR or Admin privileges required."}`
- **Audit Logging**:
  - Appends to `auditevents`: `{ entityType: "POLICY", entityId: policy._id, action: "UPDATE", previousValue: before, newValue: after, reason: req.body.reason }`.

---

### 6.3 `GET /api/holidays`

- **Role**: `EMPLOYEE` / `HR` / `ADMIN` (Any authenticated user)
- **Description**: Lists all organizational public and company holidays, sorted chronologically. Supports optional filtering by calendar year.
- **Headers**: `Authorization: Bearer <jwt>`
- **Query Parameters**:
  - `year` (number, optional): E.g., `2026`. Filters by `dateKey` matching `^2026-` or `isRecurring: true`.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "6714c000...",
        "name": "Republic Day",
        "dateKey": "2026-01-26",
        "isRecurring": true,
        "description": "National holiday commemorating Constitution of India",
        "createdAt": "2026-10-20T10:00:00.000Z",
        "updatedAt": "2026-10-20T10:00:00.000Z"
      }
    ]
  }
  ```

---

### 6.4 `POST /api/holidays`

- **Role**: `HR` / `ADMIN`
- **Description**: Declares a new organization holiday. Validates `dateKey` (format `YYYY-MM-DD`) and prevents duplicate holiday declarations on the same date.
- **Headers**: `Authorization: Bearer <jwt>`
- **Request Body**:
  ```json
  {
    "name": "Diwali Festival",
    "dateKey": "2026-11-08",
    "isRecurring": false,
    "description": "Festival of Lights holiday"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Holiday created successfully",
    "data": {
      "_id": "6714c001...",
      "name": "Diwali Festival",
      "dateKey": "2026-11-08",
      "isRecurring": false,
      "description": "Festival of Lights holiday",
      "createdAt": "2026-10-20T12:00:00.000Z",
      "updatedAt": "2026-10-20T12:00:00.000Z"
    }
  }
  ```
- **Errors**:
  - `409 Conflict`: `{"code": "ERR_HOLIDAY_CONFLICT", "message": "A holiday already exists for date 2026-11-08."}`
- **Audit Logging**:
  - Appends to `auditevents`: `{ entityType: "POLICY", entityId: holiday._id, action: "CREATE", newValue: holiday }`.

---

### 6.5 `PATCH /api/holidays/:id` (or `PUT /api/holidays/:id`)

- **Role**: `HR` / `ADMIN`
- **Description**: Updates an existing holiday's details or dateKey.
- **Headers**: `Authorization: Bearer <jwt>`
- **Request Body**:
  ```json
  {
    "name": "Deepavali Festival",
    "description": "Updated holiday description"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Holiday updated successfully",
    "data": { ... }
  }
  ```
- **Audit Logging**:
  - Appends to `auditevents`: `{ entityType: "POLICY", entityId: holiday._id, action: "UPDATE", previousValue: before, newValue: after }`.

---

### 6.6 `DELETE /api/holidays/:id`

- **Role**: `HR` / `ADMIN`
- **Description**: Removes a declared holiday from the calendar.
- **Headers**: `Authorization: Bearer <jwt>`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Holiday deleted successfully"
  }
  ```
- **Audit Logging**:
  - Appends to `auditevents`: `{ entityType: "POLICY", entityId: holiday._id, action: "DELETE", previousValue: deletedHoliday }`.


---

## 7. Enterprise Extension API Specifications

### 7.1 Leave Management System

#### 7.1.1 `GET /api/leaves/types`
- **Role**: `Authenticated (All)`
- **Description**: Returns all active leave types (e.g. Casual Leave, Sick Leave, Earned Leave) with quota and carry-forward configuration.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "6714c100...",
        "name": "Casual Leave",
        "code": "CL",
        "paid": true,
        "annualQuota": 12,
        "carryForwardRule": { "allowed": true, "maxDays": 5, "expiryMonths": 3 },
        "halfDayAllowed": true
      }
    ]
  }
  ```

#### 7.1.2 `GET /api/leaves/balances`
- **Role**: `Employee` (Own balances) / `HR` (Query with `?employeeId=...`)
- **Description**: Returns annual leave entitlement, used, pending, and carried-over days for the requested year.
- **Query Params**: `year` (defaults to current year)
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "year": 2026,
    "data": [
      {
        "type": { "_id": "6714c100...", "name": "Casual Leave", "code": "CL" },
        "allotted": 12,
        "used": 3,
        "pending": 1,
        "carriedOver": 2,
        "remaining": 10
      }
    ]
  }
  ```

#### 7.1.3 `POST /api/leaves/requests`
- **Role**: `Employee`
- **Description**: Submits a new leave request. Server calculates working days excluding public holidays and scheduled weekend off-days.
- **Request Body**:
  ```json
  {
    "type": "6714c100...",
    "startDate": "2026-05-11",
    "endDate": "2026-05-13",
    "isHalfDay": false,
    "reason": "Personal family function"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Leave request submitted successfully",
    "data": {
      "_id": "6714c200...",
      "employee": "6714c000...",
      "type": "6714c100...",
      "startDate": "2026-05-11T00:00:00.000Z",
      "endDate": "2026-05-13T23:59:59.999Z",
      "workingDays": 3,
      "status": "PENDING"
    }
  }
  ```
- **Socket Event Dispatched**: `leave.requested` -> `hr`, `employee:${employeeId}`.

#### 7.1.4 `PATCH /api/leaves/requests/:id/decision`
- **Role**: `HR` / `ADMIN`
- **Request Body**:
  ```json
  {
    "status": "APPROVED",
    "decisionNote": "Approved as per team coverage schedule"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Leave request status updated",
    "data": { "status": "APPROVED", "decidedBy": "6714c...", "decidedAt": "2026-10-27T12:00:00.000Z" }
  }
  ```
- **Socket Events Dispatched**: `leave.decided`, `leave.balance_updated`.

---

### 7.2 Working Calendar & Events API

#### 7.2.1 `GET /api/calendar/events`
- **Role**: `Authenticated (All)`
- **Query Params**: `startDate` (ISO), `endDate` (ISO), `type` (optional: `holiday|companyOffDay|meeting|event`)
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "6714c300...",
        "type": "holiday",
        "title": "Republic Day",
        "startDate": "2026-01-26T00:00:00.000Z",
        "endDate": "2026-01-26T23:59:59.999Z",
        "isFullDay": true,
        "source": "manual",
        "audience": { "scope": "all" }
      }
    ]
  }
  ```

#### 7.2.2 `POST /api/calendar/import`
- **Role**: `HR` / `ADMIN`
- **Description**: Imports holidays and off-days via standard iCal (.ics) or JSON format.
- **Request Body**: `{ "format": "json", "events": [ ... ] }`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "importedCount": 14,
    "skippedCount": 2
  }
  ```

---

### 7.3 Announcements API

#### 7.3.1 `GET /api/announcements`
- **Role**: `Authenticated (All)`
- **Description**: Returns active announcements sorted by pinned status, priority, and date. Automatically filters out expired items.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "6714c400...",
        "title": "Town Hall Meeting Tomorrow",
        "body": "Executive briefing at 1:00 PM on Google Meet.",
        "priority": "HIGH",
        "pinned": true,
        "startsAt": "2026-10-27T00:00:00.000Z",
        "expiresAt": "2026-10-28T23:59:59.000Z",
        "source": "manual",
        "isRead": false
      }
    ]
  }
  ```

#### 7.3.2 `POST /api/announcements`
- **Role**: `HR` / `ADMIN`
- **Request Body**:
  ```json
  {
    "title": "Office Deep Clean Schedule",
    "body": "Office sanitization scheduled for Friday evening.",
    "priority": "MEDIUM",
    "pinned": false,
    "startsAt": "2026-10-30T10:00:00.000Z"
  }
  ```
- **Socket Event Dispatched**: `announcement.published` -> `all`.

#### 7.3.3 `POST /api/announcements/:id/read`
- **Role**: `Authenticated`
- **Description**: Marks announcement as read by the calling user.

---

### 7.4 Support Enquiries & Tickets API

#### 7.4.1 `GET /api/enquiries`
- **Role**: `Employee` (Own tickets) / `HR` (All department tickets)
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "6714c500...",
        "category": "PAYROLL",
        "subject": "Form 16 Tax Certificate Download",
        "status": "OPEN",
        "priority": "MEDIUM",
        "lastMessageAt": "2026-10-27T10:30:00.000Z"
      }
    ]
  }
  ```

#### 7.4.2 `POST /api/enquiries`
- **Role**: `Employee`
- **Request Body**:
  ```json
  {
    "category": "ATTENDANCE",
    "subject": "Missing Punch In Correction",
    "message": "Badge reader was calibrating when I arrived at 9:02 AM."
  }
  ```
- **Response (201 Created)**: Ticket initialized with embedded thread entry.
- **Socket Event Dispatched**: `enquiry.created` -> `hr`.

#### 7.4.3 `POST /api/enquiries/:id/messages`
- **Role**: `Requester` / `HR Staff`
- **Request Body**: `{ "message": "We have updated your punch log." }`
- **Socket Event Dispatched**: `enquiry.message_received`.

---

### 7.5 Staff Mobile OTP & Device Security API

#### 7.5.1 `POST /api/auth/staff/otp-start`
- **Role**: `Public` (Rate-limited)
- **Description**: Generates a 6-digit OTP sent via SMS to verified staff mobile numbers for passwordless admin/HR login.
- **Request Body**: `{ "mobileNumber": "+919876543210", "purpose": "LOGIN" }`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Security code dispatched via SMS",
    "expiresInSeconds": 300
  }
  ```

#### 7.5.2 `POST /api/auth/staff/otp-verify`
- **Role**: `Public`
- **Request Body**:
  ```json
  {
    "mobileNumber": "+919876543210",
    "otp": "849201",
    "deviceFingerprint": "hw_mac_fp_88291a",
    "deviceName": "Kirtee MacBook Pro",
    "trustDevice": true
  }
  ```
- **Response (200 OK)**: Returns JWT access token, refresh token, and registers device in `TrustedDevice`.

---

### 7.6 App Release & OTA Management API

#### 7.6.1 `GET /api/releases/check-update`
- **Role**: `Public`
- **Query Params**: `platform=ANDROID&currentVersion=1.0.0&currentVersionCode=10000`
- **Response (200 OK)**:
  ```json
  {
    "updateAvailable": true,
    "forceUpdate": false,
    "latestVersion": "1.2.0",
    "latestVersionCode": 10200,
    "notes": "Fast QR scanner engine and offline punch cache",
    "downloadUrl": "https://cdn.vorldx.demo/releases/app-v1.2.0.apk"
  }
  ```

---

### 7.7 Saved Views API

#### 7.7.1 `GET /api/saved-views`
- **Role**: `Authenticated`
- **Query Params**: `page=attendance`
- **Response (200 OK)**: Returns list of user's saved filter views for that table.

#### 7.7.2 `POST /api/saved-views`
- **Role**: `Authenticated`
- **Request Body**:
  ```json
  {
    "page": "attendance",
    "name": "Only Late Employees",
    "filters": { "status": "LATE" },
    "isDefault": false
  }
  ```

---

### 7.8 Notifications API

#### 7.8.1 `GET /api/notifications`
- **Role**: `Authenticated`
- **Response (200 OK)**: Returns unread & recent notifications with payload metadata.

#### 7.8.2 `PATCH /api/notifications/:id/read`
- **Role**: `Authenticated`
- **Description**: Marks a notification as read and synchronizes read status via `notification.read`.
