# Real-Time WebSocket Protocol & Event Schema — VorldX Attendance System

This document specifies the Socket.io WebSocket architecture, authentication handshakes, room partitions, event payload schemas, centralized event emitter service, and reconnection/resynchronization behaviors.

---

## 1. Connection & Handshake Authentication

The Socket.io gateway runs alongside the Express REST server on the long-running host (`apps/api`). Every incoming connection must present valid credentials in the connection handshake payload (`socket.handshake.auth` or HTTP headers). Unauthenticated connections are rejected immediately during the handshake before room entry.

### Authentication Types

```typescript
interface SocketAuthHandshake {
  // Option A: Employee or HR Admin User
  token?: string; // Bearer JWT access token (in auth.token or Authorization header)

  // Option B: Office QR Display Terminal
  terminalId?: string; // Public terminal ID (e.g., "disp_a1b2c3d4") or in headers
  terminalSecret?: string; // Private terminal secret credential or in headers
  displayId?: string;
  credential?: string;
}
```

### Handshake Middleware Logic (`apps/api/src/sockets/socketServer.ts`)

1. **User Connection (Employee or HR Admin)**:
   - Verifies the JWT using `JWT_SECRET`.
   - Extracts `{ userId, employeeId, email, role }`.
   - Automatically joins scoped room `employee:${employeeId}` (and `employee:${userId}`).
   - If `role === "HR"` or `role === "ADMIN"` or `role === "HR_ADMIN"`:
     - Automatically joins room `hr` and room `hr:dashboard`.
2. **Terminal Display Connection**:
   - Queries MongoDB via `qrService.authenticateDisplay(displayId, credential)`.
   - Verifies SHA-256 credential hash in constant time, ensures `isActive === true` and `status !== "REVOKED"`.
   - Joins room `display:${terminalId}` (and `display:${_id}`).
3. **Unauthenticated Sockets**:
   - Rejects connection with `ERR_UNAUTHORIZED` (for invalid/missing JWT) or `ERR_TERMINAL_UNAUTHORIZED` (for invalid display credentials).

---

## 2. Room Architecture & Scoped Partitions

```
+-----------------------------------------------------------------------------------+
|                              SOCKET.IO ROOM TOPOLOGY                              |
+-----------------------------------------------------------------------------------+
| Room Identifier            | Subscribers             | Purpose                    |
+----------------------------+-------------------------+----------------------------+
| display:${terminalId}      | Specific physical       | Pushes dynamic rotating QR |
|                            | display screen          | tokens, countdown triggers,|
|                            |                         | and remote deactivations.  |
+----------------------------+-------------------------+----------------------------+
| employee:${employeeId}     | Authenticated employee  | Delivers personal punch    |
|                            | mobile sessions         | confirmations, duration    |
|                            |                         | updates, WFH decisions.    |
+----------------------------+-------------------------+----------------------------+
| hr                         | Authenticated HR Admin  | Broadcasts live punch feed |
| (and hr:dashboard)         | portal web clients      | items, new WFH alerts, and |
|                            |                         | real-time executive counts.|
+-----------------------------------------------------------------------------------+
```

### Privacy & Room Isolation Guarantee

- **Strict Employee Isolation**: An employee connected in `employee:EMP-001` receives only their own punch confirmations and WFH decisions. Sockets in `employee:EMP-002` receive **zero** packets from Employee A's activities.
- **Administrative Visibility**: Sockets in the `hr` room receive events across all employees for dashboard and ledger synchronization.

---

## 3. Centralized Event Emitter Service (`EventEmitterService`)

Business code interacts exclusively with [`eventEmitterService`](file:///c:/Attendance%20Tracker/apps/api/src/services/eventEmitter.service.ts), never raw socket instances directly:

> [!IMPORTANT]
> **Post-Database Write Guarantee**: Events are emitted strictly **after** MongoDB transactions and document writes (`.save()`, `.findOneAndUpdate()`, `.create()`) have committed successfully. If a database operation fails or throws an exception, zero socket events are emitted.

```typescript
// Business logic calls one service method:
eventEmitterService.emitAttendanceUpdated(payload);
eventEmitterService.emitWfhCreated(payload);
eventEmitterService.emitWfhDecided(payload);
eventEmitterService.emitEmployeeRegistered(payload);
eventEmitterService.emitPolicyUpdated(payload);
eventEmitterService.emitQrRotated(payload);
eventEmitterService.emitDisplayStatus(payload);

// Or via generic event dispatcher:
eventEmitterService.emit("attendance.updated", payload);
```

---

## 4. Event Catalog & Payload Schemas

### 4.1 Attendance Events

#### `attendance.updated` (Alias: `attendance:punched` / `attendance:feed_item`)

- **Emitted When**: Employee completes check-in/check-out via QR scan, HR modifies attendance with a manual correction, or the scheduled cutoff job marks an incomplete checkout or absence.
- **Target Rooms**: `employee:${employeeId}`, `hr`, `hr:dashboard`.

```typescript
interface AttendanceUpdatedPayload {
  recordId: string;
  employeeId: string;
  employeeName?: string;
  department?: string;
  designation?: string;
  dateKey: string; // "YYYY-MM-DD"
  punchType: "CHECK_IN" | "CHECK_OUT" | "CORRECTION" | "WFH_AUTO_CREDIT" | "ABSENT" | "INCOMPLETE";
  status:
    "PRESENT" | "LATE" | "HALF_DAY" | "CHECKED_OUT" | "WFH_APPROVED" | "ABSENT" | "INCOMPLETE";
  isLate: boolean;
  lateMinutes?: number;
  timestamp: string; // ISO 8601 UTC
  checkInTime?: string | null;
  checkOutTime?: string | null;
  durationMinutes: number;
  message?: string;
}
```

---

### 4.2 Work From Home (WFH) Events

#### `wfh.created` (Alias: `wfh:new_request`)

- **Emitted When**: Employee submits or resubmits a WFH request.
- **Target Rooms**: `hr`, `hr:dashboard`, `employee:${employeeId}`.

```typescript
interface WfhCreatedPayload {
  requestId: string;
  employeeId: string;
  employeeName?: string;
  department?: string;
  dateKey: string; // "YYYY-MM-DD"
  reason: string;
  status: "PENDING";
  createdAt: string; // ISO 8601 UTC
}
```

#### `wfh.decided` (Alias: `wfh:status_updated`)

- **Emitted When**: HR/Admin reviews a WFH request (approves or rejects).
- **Target Rooms**: `employee:${employeeId}`, `hr`, `hr:dashboard`.
- **Note**: When approved, an `attendance.updated` event with `punchType: "WFH_AUTO_CREDIT"` is also emitted.

```typescript
interface WfhDecidedPayload {
  requestId: string;
  employeeId: string;
  employeeName?: string;
  department?: string;
  dateKey: string;
  status: "APPROVED" | "REJECTED";
  reviewedBy?: string;
  reviewerRemarks?: string | null;
  reviewedAt: string; // ISO 8601 UTC
}
```

---

### 4.3 Employee Registration Events

#### `employee.registered`

- **Emitted When**: Employee verifies their single-use OTP and creates their User credentials.
- **Target Rooms**: `hr`, `hr:dashboard`, `employee:${employeeId}`.

```typescript
interface EmployeeRegisteredPayload {
  employeeId: string;
  email: string;
  name?: string;
  role: string;
  status: string;
  registeredAt: string; // ISO 8601 UTC
}
```

---

### 4.4 Policy Events

#### `policy.updated`

- **Emitted When**: HR updates the active AttendancePolicy (shifts, grace periods, cutoffs, or WFH quotas).
- **Target Rooms**: Broadcast to all connected clients.

```typescript
interface PolicyUpdatedPayload {
  policyId: string;
  version: number;
  name: string;
  timezone: string;
  updatedAt: string; // ISO 8601 UTC
  updatedBy?: string;
}
```

---

### 4.5 Display Terminal Events

#### `qr.rotated` (Alias: `qr:token_rotate`)

- **Emitted When**: A display terminal requests a fresh rotating challenge or the 30-second rotation occurs.
- **Target Rooms**: `display:${terminalId}`.

```typescript
interface QrRotatedPayload {
  terminalId: string;
  displayId: string;
  token: string; // Opaque base64url challenge string
  qrPayload?: string;
  issuedAt: string; // ISO 8601 UTC
  expiresAt: string; // ISO 8601 UTC
  ttlSeconds: number; // 45
  serverTime: number; // Unix epoch ms for client countdown synchronization
}
```

#### `display.status` (Alias: `terminal:status_changed`)

- **Emitted When**: Administrator activates, disables, or revokes an office display terminal.
- **Target Rooms**: `display:${terminalId}`, `hr`, `hr:dashboard`.

```typescript
interface DisplayStatusPayload {
  terminalId: string;
  displayId: string;
  name?: string;
  isActive: boolean;
  status: "ACTIVE" | "DISABLED" | "REVOKED" | "UNPAIRED";
  message: string;
}
```

---

## 5. Reconnection & State Resynchronization Protocol

Because mobile devices experience network transitions and display terminals reboot, the system implements a dual-layer resynchronization mechanism:

### 1. In-Socket `resync` Event Handshake

Clients emit the `resync` event over their active socket upon reconnection:

- **Employee Sockets**: The server queries the database for today's active attendance session (`GET /attendance/today` equivalent) and acknowledges with `{ success: true, type: "attendance", data: record }`.
- **HR Sockets**: The server queries authoritative dashboard metrics (`GET /dashboard/summary` equivalent) and acknowledges with `{ success: true, type: "summary", data: summary }`.
- **Display Sockets**: The server emits `qr.rotated` to refresh the dynamic QR canvas without a full browser reload.

### 2. REST Fallback Protocol on Reconnect

1. **Employee App**:
   - Listens for Socket.io `connect` event.
   - Re-fetches `GET /api/attendance/today` to reconcile local UI cards.
2. **HR Portal**:
   - Listens for Socket.io `connect` event.
   - Re-fetches `GET /api/admin/dashboard/summary` to catch up on unread feed items and update daily counters.
3. **Display Screen Kiosk**:
   - Dispatches `display:request_token` or calls `GET /api/displays/token`.
