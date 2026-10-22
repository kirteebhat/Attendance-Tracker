# VorldX Mobile Application (`@vorldx/mobile`)

Cross-platform employee mobile application built with **Expo (SDK 52)**, **TypeScript**, **Expo Router v4**, and **React Native Safe Area Context**, adhering to the dark-slate/cyan **VorldX design system**.

---

## 📱 Features

1. **VorldX Design System & Reusable Components**:
   - Strictly tokenized colors (`brand`, `accent`, `status`, `text`), 8-pt spacing, radii, and glow shadows in `src/theme/tokens.ts`.
   - Accessible, high-contrast components: `Button`, `Input`, `Card`, `StatusBadge`, `Skeleton`, `Toast`, `OfflineBanner`, and `SafeAreaWrapper`.
   - Safe-area inset handling and keyboard-avoiding scroll behavior on native and web viewports.

2. **Network & Security Client**:
   - Environment-based base URL resolver (`EXPO_PUBLIC_API_URL`).
   - Secure token persistence using `expo-secure-store` with automatic local web/in-memory fallback.
   - Transparent access-token refresh interceptor queuing simultaneous requests during token rotation.
   - Network connectivity listener with real-time `OfflineBanner` alert.

3. **Employee Self-Registration & Authentication Flows**:
   - **Step 1 (Register)**: Validates Employee ID against company directory with instant error feedback (`ERR_EMPLOYEE_NOT_FOUND`, `ERR_ACCOUNT_ALREADY_REGISTERED`, `ERR_EMPLOYEE_INACTIVE`).
   - **Step 2 (Simulated OTP)**: Prominently labeled **DEMO VERIFICATION MODE** callout showing simulated 6-digit OTP code with "Auto-Fill Demo Code" action; enforces 3-attempt limit and expiry handling (`ERR_INVALID_OTP`, `ERR_OTP_EXPIRED`).
   - **Step 3 (Set Password)**: Enforces minimum 8-character password with confirm password check and verification token validation.
   - **Home Profile**: Authenticated employee dashboard with verified badges, department details, and quick attendance/WFH cards.
   - **Sign In / Out**: Full login with error handling (`ERR_INVALID_CREDENTIALS`, `ERR_ACCOUNT_LOCKED`), quick-fill demo account helper, session expired detection, and clean sign out.

---

## 🌐 Connecting a Physical Phone (LAN Setup)

When running the application on a physical phone via **Expo Go**, `localhost` points to the phone itself rather than your development machine running the Express API.

### Setup Instructions:

1. **Find your computer's local Wi-Fi IP address**:
   - **Windows (PowerShell)**:
     ```powershell
     ipconfig
     # Look for IPv4 Address under Wireless LAN adapter Wi-Fi (e.g., 192.168.1.45)
     ```
   - **macOS / Linux**:
     ```bash
     ifconfig | grep "inet "
     ```

2. **Create `apps/mobile/.env`**:
   ```env
   # Replace with your computer's actual LAN IP address:
   EXPO_PUBLIC_API_URL=http://192.168.1.45:4000
   EXPO_PUBLIC_WS_URL=http://192.168.1.45:4000
   ```

3. **Ensure both devices are on the same Wi-Fi network**:
   - Make sure your computer's firewall allows incoming connections on port 4000 (Node API) and port 8081 (Metro Bundler).

4. **Start the Mobile App**:
   ```bash
   cd apps/mobile
   npx expo start
   ```
   - Scan the terminal QR code with the **Expo Go** app on Android or the iOS Camera app.

---

## 🚀 Running Locally

```bash
# Start Metro bundler (interactive menu)
npm run start --workspace=@vorldx/mobile

# Run in Web browser (mobile responsive layout)
npm run web --workspace=@vorldx/mobile

# Run TypeScript compilation check
npm run typecheck --workspace=@vorldx/mobile

# Run full end-to-end browser verification script
npx tsx apps/mobile/scripts/verify-mobile.ts
```

---

## 🔍 Verification Scope & Status

### ✅ What was Verified:
- **Type Safety**: Passed `tsc --noEmit` across all monorepo packages with 0 errors.
- **Automated End-to-End Browser Flow** (`apps/mobile/scripts/verify-mobile.ts`):
  - Emulated iPhone/Android mobile viewport (`390x844`, 2x scale, touch-enabled) via headless Chrome against a live API on port 4000 and in-memory MongoDB.
  - Welcome screen rendering and brand tokens (`browser_43_mobile_welcome.png`).
  - Employee ID validation with specific error displays for `EMP-999` (not found) and `EMP-001` (already registered) (`browser_44_mobile_register_error.png`).
  - Step 2 OTP verification screen displaying the "DEMO VERIFICATION MODE" banner with simulated OTP (`browser_45_mobile_verify_otp.png`).
  - Invalid OTP rejection (`000000`) showing `ERR_INVALID_OTP` error alert.
  - Auto-fill demo OTP code and transition to password creation (`browser_46_mobile_set_password.png`).
  - Minimum 8-character password creation and completion of registration with backend account activation.
  - Authenticated dashboard (`/home`) showing user profile ("Rohan Verma"), badges ("EMPLOYEE", "ACCOUNT VERIFIED"), and punch cards (`browser_47_mobile_home_profile.png`).
  - Safe sign-out returning to Welcome screen.
  - Sign In screen (`/login`) testing invalid password error display and demo account quick-fill (`browser_48_mobile_login.png`).
  - Successful login as "Ananya Sharma" with transition to dashboard.
  - 0 uncaught console errors.

### ⚠️ What was NOT Verified:
- **Physical Camera Hardware**: Camera scanning on a physical iOS or Android hardware device (since dynamic QR attendance punch via mobile camera will be implemented in subsequent phases using `expo-camera`).
- **Native Push Notifications**: Apple APNs / Google FCM device push notification delivery.

