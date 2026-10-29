# VorldX UI Upgrade Brief & Governing Principles

> **Status:** Active Governing Specification  
> **Target Release:** VorldX Enterprise Suite v2.0 UI Upgrade  
> **Entity:** VorldX Industries Private Limited (CIN: `U62099UP2026PTC245598`)  
> **Classification:** Engineering & UX Upgrade Directives  

---

## 1. Overriding Governance Rules

These four rules override all other considerations throughout the upgrade lifecycle:

1. **Upgrade, Not a Rebuild:**  
   Preserve 100% of existing functionality, URL routes, API contracts, database schemas, business rules, role permissions, Socket.io events, and user workflows. Under no circumstances should working logic be removed, renamed, or restructured.
2. **Presentation-Layer Only:**  
   Restrict modifications strictly to frontend presentation files (`apps/web`, `apps/mobile`, `apps/display`). If a backend change in `apps/api` or schema change in `packages/shared` is ever strictly necessary, it must be justified in writing and approved before implementation.
3. **Real Data Only:**  
   No hardcoded metrics, mock charts, dummy percentages, simulated delay placeholders, or pretend success toasts. Every number, chart, status badge, and list item must bind directly to authentic database state through official API endpoints or real-time WebSockets.
4. **Accessibility, Reduced Motion & Performance Limits:**  
   - Respect `prefers-reduced-motion` at all times (disable transitions/rotations, switch 3D canvases to static 2D SVGs).
   - Maintain WCAG 2.1 AA accessibility standards (minimum 4.5:1 text contrast on surfaces, semantic HTML, ARIA labels, keyboard navigability, focus rings).
   - Strict performance budgets: keep Lighthouse Performance score acceptable, cap pixel ratio on WebGL to `dpr={[1, 1.5]}`, pause rendering loops when browser tabs are inactive (`document.hidden`), and lazy-load heavy modules (Three.js / Recharts).

---

## 2. Visual Identity & Brand Styling Constraints

From `docs/MASTER_BRIEF.md` Section 6:
- **Palette**:
  - **Surface & Base**: Deep Slate & Midnight Navy (`#0B132B`, `#0F172A`, `#111C38`, `#1E293B`, `#253252`) in dark mode; crisp clean Slate (`#F8FAFC`, `#FFFFFF`, `#F1F5F9`, `#E2E8F0`) in light mode.
  - **Brand Accents**: Electric Blue (`#2563EB`, `#3B82F6`), Vibrant Cyan (`#06B6D4`), and Deep Indigo (`#6366F1`).
  - **Semantic Statuses (Strictly Enforced)**:
    * `PRESENT` / `ON-TIME`: Emerald Green (`#10B981`)
    * `LATE`: Amber Gold (`#F59E0B`)
    * `ABSENT`: Crimson Rose (`#EF4444`)
    * `WFH_APPROVED` / `WFH_PENDING`: Indigo (`#6366F1`)
    * `HALF_DAY` / `INCOMPLETE`: Purple (`#8B5CF6`)
- **Visual Design Elements**:
  - Tactile buttons with explicit active/hover/focus-visible rings (`focus-visible:ring-2 focus-visible:ring-blue-500`).
  - Subtle card borders with dual light/dark contrast (`border-slate-200 dark:border-slate-800`).
  - Distinct and graceful loading skeletons, empty states, and descriptive error banners with retry handlers.

---

## 3. Strict Scope Exclusions

Per Section 5 of the Master Engineering Brief, the following remain **strictly out of scope**:
1. GPS / Geolocation-based tracking.
2. Wi-Fi SSID / Bluetooth BLE proximity beacons.
3. Facial recognition, biometric fingerprint, or hardware iris scanners.
4. Payroll calculations, salary slips, or full HRMS leave encashment workflows.
5. Multi-level hierarchical manager sign-offs.

---

## 4. Performance & Hardware Guardrails

- **Dynamic Lazy-Loading**: All heavy dependencies (`three`, `@react-three/fiber`, chart visualizers) must be code-split using dynamic `import()` and `React.lazy()` behind their respective feature flags (`threeD`, etc.).
- **Tab Inactivity Pause**: WebGL animation loops must hook into `document.visibilityState` / `visibilitychange` to set `frameloop="never"` when tabs are inactive.
- **Low-End Hardware Fallbacks**: Automatically fall back to 2D SVG vector indicators on devices with $\le 2$ CPU cores, $< 4\text{ GB}$ RAM, or WebGL context creation failure.

