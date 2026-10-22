# VorldX Attendance System — Visual Evidence & Screenshot Gallery

This directory contains the visual verification artifacts captured during automated browser and mobile end-to-end testing of the VorldX Attendance System.

---

## 1. HR & Admin Web Portal (`apps/web`)

### Authentication & Responsive Viewports
| Filename | Description | Viewport |
| :--- | :--- | :--- |
| [`browser_01_login_375px.png`](./browser_01_login_375px.png) | Login screen rendered on mobile viewport | 375 × 667 |
| [`browser_02_wrong_password.png`](./browser_02_wrong_password.png) | Invalid password error feedback & rate limit prevention | 375 × 667 |
| [`browser_03_dashboard_1280px.png`](./browser_03_dashboard_1280px.png) | HR Executive Dashboard with live stat cards, attendance bar charts, and socket feed | 1280 × 800 |
| [`browser_04_dashboard_768px.png`](./browser_04_dashboard_768px.png) | HR Executive Dashboard rendered on tablet viewport | 768 × 1024 |
| [`browser_05_dashboard_375px.png`](./browser_05_dashboard_375px.png) | HR Executive Dashboard rendered on mobile viewport | 375 × 667 |
| [`browser_06_mobile_drawer_375px.png`](./browser_06_mobile_drawer_375px.png) | Mobile navigation drawer open with navigation links | 375 × 667 |
| [`browser_07_session_expired.png`](./browser_07_session_expired.png) | Session expiration notification with seamless re-authentication | 1280 × 800 |

### Employee Directory Management
| Filename | Description | Viewport |
| :--- | :--- | :--- |
| [`browser_08_employees_list.png`](./browser_08_employees_list.png) | Paginated employee directory with search, filters, and status badges | 1280 × 800 |
| [`browser_09_duplicate_employee_error.png`](./browser_09_duplicate_employee_error.png) | Add employee drawer showing duplicate Employee ID error validation | 1280 × 800 |
| [`browser_10_employee_created.png`](./browser_10_employee_created.png) | Directory updated immediately after adding a new employee (`EMP-999`) | 1280 × 800 |
| [`browser_11_employee_edited.png`](./browser_11_employee_edited.png) | Employee profile updated drawer with role change and confirmation toast | 1280 × 800 |
| [`browser_12_employee_deactivated.png`](./browser_12_employee_deactivated.png) | Employee deactivation confirmation modal and updated inactive badge | 1280 × 800 |
| [`browser_13_employees_filtered.png`](./browser_13_employees_filtered.png) | Filtered employee table matching active status and Engineering department | 1280 × 800 |
| [`browser_14_profile_snapshot.png`](./browser_14_profile_snapshot.png) | Employee detail drawer displaying personal info and attendance snapshot | 1280 × 800 |

### Daily Attendance & Correction Workflows
| Filename | Description | Viewport |
| :--- | :--- | :--- |
| [`browser_15_attendance_ledger.png`](./browser_15_attendance_ledger.png) | Daily attendance ledger with date picker, check-in/out timestamps, and status badges | 1280 × 800 |
| [`browser_16_attendance_corrected.png`](./browser_16_attendance_corrected.png) | Attendance correction modal requiring reason with original vs corrected values | 1280 × 800 |
| [`browser_17_correction_history.png`](./browser_17_correction_history.png) | Correction history audit drawer displaying before/after diffs and HR comments | 1280 × 800 |
| [`browser_18_audit_trail_confirmed.png`](./browser_18_audit_trail_confirmed.png) | System audit log confirming immutable entry for attendance modification | 1280 × 800 |

### Policy & Holiday Configuration
| Filename | Description | Viewport |
| :--- | :--- | :--- |
| [`browser_19_policy_initial.png`](./browser_19_policy_initial.png) | Company policy configuration page: shift timing, grace period, WFH quotas | 1280 × 800 |
| [`browser_20_policy_confirm_modal.png`](./browser_20_policy_confirm_modal.png) | Policy change confirmation modal summarizing exact setting modifications | 1280 × 800 |
| [`browser_21_policy_updated.png`](./browser_21_policy_updated.png) | Updated policy dashboard showing version history badge (`v2`) | 1280 × 800 |

### Work-From-Home (WFH) Management
| Filename | Description | Viewport |
| :--- | :--- | :--- |
| [`browser_22_wfh_requests_list.png`](./browser_22_wfh_requests_list.png) | WFH requests queue with pending, approved, and rejected filters | 1280 × 800 |
| [`browser_23_wfh_approve_modal.png`](./browser_23_wfh_approve_modal.png) | HR approval modal with manager notes input and employee eligibility summary | 1280 × 800 |
| [`browser_24_wfh_approved.png`](./browser_24_wfh_approved.png) | WFH request row showing approved status badge and disabled action buttons | 1280 × 800 |

### QR Display Kiosk Administration
| Filename | Description | Viewport |
| :--- | :--- | :--- |
| [`browser_25_displays_list.png`](./browser_25_displays_list.png) | Displays management table showing terminal IDs, pairing status, and last seen | 1280 × 800 |
| [`browser_26_display_pairing_code.png`](./browser_26_display_pairing_code.png) | 6-character terminal pairing code modal shown once upon registration | 1280 × 800 |
| [`browser_27_display_revoke_modal.png`](./browser_27_display_revoke_modal.png) | Terminal revocation warning modal | 1280 × 800 |
| [`browser_28_display_revoked.png`](./browser_28_display_revoked.png) | Terminal revoked status badge in management ledger | 1280 × 800 |

### Reports & Audit Logging
| Filename | Description | Viewport |
| :--- | :--- | :--- |
| [`browser_29_reports_summary.png`](./browser_29_reports_summary.png) | Executive attendance report summary with date range picker | 1280 × 800 |
| [`browser_30_reports_employee_wise.png`](./browser_30_reports_employee_wise.png) | Employee-wise attendance metrics table with hours worked and CSV export | 1280 × 800 |
| [`browser_31_reports_department_wise.png`](./browser_31_reports_department_wise.png) | Departmental attendance aggregation table | 1280 × 800 |
| [`browser_32_reports_late.png`](./browser_32_reports_late.png) | Late arrival frequency report with grace period violation breakdown | 1280 × 800 |
| [`browser_33_reports_wfh.png`](./browser_33_reports_wfh.png) | WFH utilization summary and department quota tracker | 1280 × 800 |
| [`browser_34_audit_diff_modal.png`](./browser_34_audit_diff_modal.png) | Audit log page with actor, action, and entity type filters | 1280 × 800 |
| [`browser_35_audit_json_diff.png`](./browser_35_audit_json_diff.png) | Deep JSON before/after field diff modal for high-compliance auditing | 1280 × 800 |

---

## 2. Office QR Display Kiosk (`apps/display`)

| Filename | Description | Viewport |
| :--- | :--- | :--- |
| [`browser_36_display_pairing_screen_1080p.png`](./browser_36_display_pairing_screen_1080p.png) | Display initial pairing screen prompting for pairing code | 1920 × 1080 |
| [`browser_37_display_main_screen_1080p.png`](./browser_37_display_main_screen_1080p.png) | Active kiosk screen: VorldX branding, high-contrast dynamic QR, radial 30s countdown ring | 1920 × 1080 |
| [`browser_38_display_rotated_token_1080p.png`](./browser_38_display_rotated_token_1080p.png) | Display seamlessly rotated to next dynamic cryptographic challenge token | 1920 × 1080 |
| [`browser_39_display_disabled_screen_1080p.png`](./browser_39_display_disabled_screen_1080p.png) | Kiosk display when disabled remotely: QR immediately blanked | 1920 × 1080 |
| [`browser_40_display_main_screen_tablet.png`](./browser_40_display_main_screen_tablet.png) | Active display screen rendered on tablet viewport | 800 × 1280 |
| [`browser_41_display_revoked_tablet.png`](./browser_41_display_revoked_tablet.png) | Display revoked screen on tablet: immediately deauthorizes and wipes credential | 800 × 1280 |
| [`browser_42_display_returned_to_pairing.png`](./browser_42_display_returned_to_pairing.png) | Display returning to pairing code entry screen after revocation | 1920 × 1080 |

---

## 3. Employee Mobile App (`apps/mobile`)

| Filename | Description | Viewport |
| :--- | :--- | :--- |
| [`browser_43_mobile_welcome.png`](./browser_43_mobile_welcome.png) | Employee mobile welcome & onboarding screen | 390 × 844 |
| [`browser_44_mobile_register_error.png`](./browser_44_mobile_register_error.png) | Registration error: unknown or unregistered Employee ID validation | 390 × 844 |
| [`browser_45_mobile_verify_otp.png`](./browser_45_mobile_verify_otp.png) | 6-digit OTP verification screen labeled with Demo OTP callout | 390 × 844 |
| [`browser_46_mobile_set_password.png`](./browser_46_mobile_set_password.png) | Initial password setup with 8-character and symbol validation | 390 × 844 |
| [`browser_47_mobile_home_profile.png`](./browser_47_mobile_home_profile.png) | Initial profile setup confirmation and welcome prompt | 390 × 844 |
| [`browser_48_mobile_login.png`](./browser_48_mobile_login.png) | Employee login screen with secure token persistence | 390 × 844 |
| [`browser_49_mobile_tabs_home.png`](./browser_49_mobile_tabs_home.png) | Mobile Home Tab: today's punch state, shift hours, live check-in time, quick actions | 390 × 844 |
| [`browser_50_mobile_scan_view.png`](./browser_50_mobile_scan_view.png) | Scan Tab: high-contrast camera viewfinder, scan target frame, guidance banner | 390 × 844 |
| [`browser_51_mobile_scan_success.png`](./browser_51_mobile_scan_success.png) | Scan Success: verified server check-in confirmation with authoritative server timestamp | 390 × 844 |
| [`browser_52_mobile_scan_expired.png`](./browser_52_mobile_scan_expired.png) | Scan Error: expired/rotated QR token rejection screen | 390 × 844 |
| [`browser_53_mobile_history_tab.png`](./browser_53_mobile_history_tab.png) | History Tab: monthly attendance log, status badges (Present, Late, WFH), hours | 390 × 844 |
| [`browser_54_mobile_wfh_tab.png`](./browser_54_mobile_wfh_tab.png) | WFH Tab: quota tracker, date selector, reason input, pending request list | 390 × 844 |
| [`browser_55_mobile_profile_tab.png`](./browser_55_mobile_profile_tab.png) | Profile Tab: employee credentials, designated department, shift timings, sign out | 390 × 844 |
| [`browser_56_wfh_dual_view_before.png`](./browser_56_wfh_dual_view_before.png) | Real-time dual test: Mobile WFH request submitted and pending HR review | Dual-client |
| [`browser_57_wfh_dual_view_after.png`](./browser_57_wfh_dual_view_after.png) | Real-time dual test: HR approved request on Web; Mobile instant socket update to Approved | Dual-client |
| [`browser_58_hr_web_wfh_approved.png`](./browser_58_hr_web_wfh_approved.png) | Web portal view of the approved WFH request | 1280 × 800 |
| [`browser_59_mobile_profile_shift_details.png`](./browser_59_mobile_profile_shift_details.png) | Mobile app profile expanded view displaying company policy and shift rules | 390 × 844 |

