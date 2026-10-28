# VorldX Application Release & OTA Update Procedure

## 1. Architecture Overview

The VorldX Update System provides multi-platform release governance, Over-The-Air (OTA) updates, and forced minimum-supported version barriers across Mobile, Web, and Display Kiosks.

The entire subsystem is protected by the `otaUpdates` enterprise feature flag:
- **Feature Flag Key**: `otaUpdates`
- **Environment Variable**: `FEATURE_FLAG_OTA_UPDATES` (defaults to `false`, overridable in DB by administrators via `PATCH /api/admin/feature-flags`)
- **API Base Route**: `/api/updates`

---

## 2. Release Fields & Semantic Versioning

Every release record published to the platform contains the following parameters:

| Field | Type | Description |
|---|---|---|
| `platform` | Enum | `MOBILE`, `ANDROID`, `IOS`, `WEB`, `DISPLAY` |
| `version` | String (SemVer) | Semantic version format `X.Y.Z` (e.g. `1.3.0`) |
| `versionCode` | Number | Monotonically increasing build integer (e.g. `13`) |
| `minSupportedVersion` | String (SemVer) | Minimum required client version (e.g. `1.0.0`) |
| `minSupportedVersionCode` | Number | Minimum required build code (e.g. `1`) |
| `notes` | String | User-facing changelog and release notes |
| `channel` | Enum | `production`, `development`, `staging` |
| `forceUpdate` | Boolean | Whether update is mandatory (blocks older clients) |
| `downloadUrl` | String (URL) | Optional APK direct download or App Store / Play Store URL |
| `bundleUrl` | String (URL) | Optional EAS bundle asset URL |

### Version Evaluation Rules:
1. **Update Available**: `compareSemver(clientVersion, latestRelease.version) < 0`
2. **Mandatory Blocking Update**:
   - `compareSemver(clientVersion, latestRelease.minSupportedVersion) < 0`, OR
   - `latestRelease.forceUpdate === true`

---

## 3. Native Builds vs. Over-The-Air (OTA) Updates

> [!IMPORTANT]
> **Native Changes Require a New Binary Build (`eas build`)**
> OTA updates only push JavaScript, TypeScript, and asset bundles. They CANNOT modify native device binaries.

### When an OTA Update is Sufficient:
- React Native component updates, styling, and navigation flow changes.
- Business logic, state management, and validation updates.
- API endpoint integrations and bug fixes.
- Translations and static text adjustments.

### When a Native Binary Build is Mandatory:
- Adding, removing, or upgrading libraries with native code (e.g. camera, biometrics, secure storage, bluetooth).
- Modifying `android/app/src/main/AndroidManifest.xml` or `ios/Info.plist`.
- Adding or changing device OS permissions (Camera, Location, Notifications).
- Upgrading React Native version or Expo SDK version.
- Changing `app.json` native bundle identifiers or schemes (`vorldx://`).

Attempting to push native dependency changes via OTA will cause standalone app crashes on launch due to missing native symbols.

---

## 4. Mobile EAS Update Setup & Workflow

### 4.1 Configuration Files

1. **`apps/mobile/eas.json`**:
```json
{
  "cli": { "version": ">= 12.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "channel": "development"
    },
    "production": {
      "channel": "production",
      "autoIncrement": true
    }
  }
}
```

2. **`apps/mobile/app.json`**:
```json
"updates": {
  "enabled": true,
  "checkAutomatically": "ON_LOAD",
  "fallbackToCacheTimeout": 0,
  "url": "https://u.expo.dev/vorldx-attendance"
},
"runtimeVersion": {
  "policy": "appVersion"
}
```

### 4.2 Publishing an OTA Update to Mobile:
```bash
# Push an OTA update to production
eas update --branch production --message "Fix biometric checkout flow"

# Push an OTA update to development channel
eas update --branch development --message "Testing enquiry ticket attachments"
```

### 4.3 Building a New Native Binary (When Native Code Changes):
```bash
# Android production bundle (AAB/APK)
eas build --platform android --profile production

# iOS production archive (IPA)
eas build --platform ios --profile production
```

---

## 5. Web Portal & Display Kiosk Update Mechanics

### 5.1 Web Portal Polling & Real-Time Alerts
- **Polling Interval**: Web clients poll `GET /api/updates/check?platform=WEB` every 3 minutes.
- **WebSocket Broadcast**: Publishing a release immediately emits `app_release.published` via WebSockets.
- **Non-blocking Update**: When an optional update is detected, a banner appears across the top:
  `"New Version Available (v1.3.0)! Refresh to update."` with a **Refresh** button.
- **Mandatory Update**: If `forceUpdate: true` or client is below `minSupportedVersion`, a full-screen blocking modal overlay requires refreshing before any further actions can be taken.

### 5.2 Display Kiosk Safe Quiet-Moment Reload
Lobby kiosk screens must never reboot while an employee is actively clocking in or scanning a QR code:
- **Quiet Moment Detection**: Kiosks listen to `attendance.punched` and track `lastPunchTime`.
- **Safe Transition**: When a new display release is published, the kiosk waits until it has been idle for **at least 30 seconds**.
- Once idle, it displays a gentle message: *"Quiet Interval Detected: Safely applying display update to vX.Y.Z..."* and reloads cleanly.

---

## 6. How to Publish a Release (Admin Portal)

1. Sign in to the VorldX HR & Admin Portal as an Administrator (`/login`).
2. Navigate to **App Releases & OTA** in the sidebar (`/releases`).
3. Click the **Publish New Release** button in the top-right toolbar.
4. Fill in:
   - **Target Platform**: `MOBILE`, `ANDROID`, `IOS`, `WEB`, or `DISPLAY`.
   - **Channel**: `production`, `development`, or `staging`.
   - **Version String**: SemVer format (e.g. `1.3.0`).
   - **Min Supported Version**: Minimum version allowed without forced block (e.g. `1.0.0`).
   - **Force Update**: Check if older versions must be blocked immediately.
   - **Release Notes**: Multi-line summary of changes.
5. Click **Publish Release**.
   - An audit record `PUBLISH_APP_RELEASE` is logged.
   - An auto-announcement hook triggers a global broadcast: *"Update available: vX.Y.Z"*.
   - A real-time `app_release.published` socket event notifies all connected devices.

