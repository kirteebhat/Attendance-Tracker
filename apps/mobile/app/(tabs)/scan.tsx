import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { Card, Button, StatusBadge, Icon } from "../../src/components";
import { colors, spacing, typography, radii } from "../../src/theme";
import { attendanceApi, ScanAttendanceResult, ApiError } from "../../src/services";

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();

  const [torch, setTorch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);

  // Result view state
  const [scanResult, setScanResult] = useState<ScanAttendanceResult | null>(null);
  const [scanError, setScanError] = useState<{
    code: string;
    message: string;
    title: string;
    type: "expired" | "invalid" | "duplicate" | "checked_out" | "unauthorized" | "network";
  } | null>(null);

  // Debounce flag to ensure a scan triggers only once
  const isProcessingRef = useRef(false);

  const resetScanner = () => {
    isProcessingRef.current = false;
    setIsSubmitting(false);
    setScanResult(null);
    setScanError(null);
    setManualToken("");
  };

  /**
   * Submits ONLY the token to the backend.
   * STRICT SECURITY REQUIREMENT: Never sends a client timestamp!
   */
  const processToken = useCallback(async (rawToken: string) => {
    let cleanToken = rawToken.trim();
    if (!cleanToken) return;

    // Support extracting token if display app rendered JSON string
    if (cleanToken.startsWith("{") && cleanToken.includes("token")) {
      try {
        const parsed = JSON.parse(cleanToken);
        if (parsed.token) cleanToken = parsed.token;
      } catch {
        // Use raw token if parsing fails
      }
    }

    setIsSubmitting(true);
    setScanResult(null);
    setScanError(null);

    try {
      const res = await attendanceApi.scanAttendance(cleanToken);
      setScanResult(res);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        const code = err.code || "ERR_REQUEST_FAILED";

        if (code === "ERR_QR_EXPIRED") {
          setScanError({
            code,
            title: "QR Code Expired",
            message:
              "The rotating challenge code has expired (kiosks refresh every 30s). Please aim at the current code on the display.",
            type: "expired",
          });
        } else if (code === "ERR_INVALID_QR_TOKEN" || code === "ERR_INVALID_QR_SIGNATURE") {
          setScanError({
            code,
            title: "Invalid QR Code",
            message:
              "The scanned QR code is not a valid cryptographic VorldX attendance token.",
            type: "invalid",
          });
        } else if (code === "ERR_ALREADY_CHECKED_IN" || code === "ERR_PUNCH_COOLDOWN_ACTIVE") {
          setScanError({
            code,
            title: "Duplicate Punch / Cooldown Active",
            message:
              err.message ||
              "You have already checked in for this shift or must wait for the punch cooldown period.",
            type: "duplicate",
          });
        } else if (
          code === "ERR_ALREADY_CHECKED_OUT" ||
          code === "ERR_ATTENDANCE_WINDOW_CLOSED" ||
          code === "ERR_NO_ACTIVE_CHECKIN"
        ) {
          setScanError({
            code,
            title: "Already Checked Out",
            message:
              err.message ||
              "Daily attendance is already completed or no active check-in session was found.",
            type: "checked_out",
          });
        } else if (
          code === "ERR_TERMINAL_UNAUTHORIZED" ||
          code === "ERR_TERMINAL_DISABLED" ||
          code === "ERR_TERMINAL_REVOKED" ||
          code === "ERR_DISPLAY_NOT_FOUND"
        ) {
          setScanError({
            code,
            title: "Unauthorized Display Kiosk",
            message:
              "This display terminal has been revoked or disabled by HR. Attendance cannot be recorded here.",
            type: "unauthorized",
          });
        } else {
          setScanError({
            code,
            title: "Punch Rejected",
            message: err.message || "Failed to record attendance.",
            type: "invalid",
          });
        }
      } else {
        // Network or connection failure
        setScanError({
          code: "ERR_NETWORK_FAILURE",
          title: "Network Connection Failed",
          message:
            "Unable to communicate with the VorldX attendance server. Please check your network connection.",
          type: "network",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const handleBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (isProcessingRef.current || isSubmitting || scanResult || scanError) {
        return;
      }
      isProcessingRef.current = true;
      processToken(data);
    },
    [isSubmitting, scanResult, scanError, processToken]
  );

  const handleManualSubmit = () => {
    if (!manualToken.trim()) return;
    isProcessingRef.current = true;
    processToken(manualToken.trim());
  };

  // =========================================================================
  // RESULT VIEW 1: SUCCESS RESULT SCREEN (Server authoritative timestamp)
  // =========================================================================
  if (scanResult) {
    const isCheckIn = scanResult.punchType === "CHECK_IN";
    const record = scanResult.record;
    const serverTimestamp = isCheckIn ? record?.checkInTime : record?.checkOutTime;

    const formattedServerTime = serverTimestamp
      ? new Date(serverTimestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      : "Recorded";

    return (
      <View style={styles.resultContainer} testID="scan-result-success">
        <Card variant="elevated" style={styles.resultCard}>
          <View style={[styles.resultIconCircle, { backgroundColor: colors.status.presentBg }]}>
            <Icon name="checkmark-circle" size={48} color={colors.status.present} />
          </View>

          <Text style={styles.resultTitle}>
            {isCheckIn ? "Check-In Recorded!" : "Check-Out Recorded!"}
          </Text>

          <Text style={styles.resultSubtitle}>{scanResult.message}</Text>

          {/* Server Timestamp Box */}
          <View style={styles.serverTimeBox}>
            <Icon name="time" size={16} color={colors.accent.cyan} />
            <Text style={styles.serverTimeText}>Server Time: {formattedServerTime}</Text>
          </View>

          {/* Details Row */}
          <View style={styles.resultDetailsGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Status</Text>
              <StatusBadge status={scanResult.status as any} label={scanResult.status} />
            </View>

            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Punctuality</Text>
              <Text
                style={[
                  styles.detailValue,
                  { color: scanResult.isLate ? colors.status.late : colors.status.present },
                ]}
              >
                {scanResult.isLate ? `Late (+${scanResult.lateMinutes}m)` : "On-Time"}
              </Text>
            </View>

            {!isCheckIn && (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Duration</Text>
                <Text style={styles.detailValue}>
                  {Math.floor(scanResult.durationMinutes / 60)}h {scanResult.durationMinutes % 60}m
                </Text>
              </View>
            )}
          </View>

          <Button
            title="Scan Again"
            onPress={resetScanner}
            variant="outline"
            size="lg"
            testID="scan-success-again-btn"
            style={styles.actionBtn}
          />

          <Button
            title="Done / View Dashboard"
            onPress={() => router.push("/(tabs)/home")}
            variant="primary"
            size="lg"
            testID="scan-success-done-btn"
            style={[styles.actionBtn, { marginTop: spacing.sm }]}
          />
        </Card>
      </View>
    );
  }

  // =========================================================================
  // RESULT VIEW 2: ERROR RESULT SCREENS
  // =========================================================================
  if (scanError) {
    let iconName = "alert-circle";
    let iconColor: string = colors.status.absent;
    let iconBg: string = colors.status.absentBg;

    if (scanError.type === "expired") {
      iconName = "time";
      iconColor = colors.status.late;
      iconBg = colors.status.lateBg;
    } else if (scanError.type === "duplicate" || scanError.type === "checked_out") {
      iconName = "information-circle";
      iconColor = colors.accent.indigo;
      iconBg = colors.accent.indigoMuted;
    } else if (scanError.type === "unauthorized") {
      iconName = "shield";
      iconColor = colors.text.danger;
      iconBg = colors.status.absentBg;
    } else if (scanError.type === "network") {
      iconName = "cloud-offline";
      iconColor = colors.text.muted;
      iconBg = "rgba(148, 163, 184, 0.1)";
    }

    return (
      <View style={styles.resultContainer} testID="scan-result-error">
        <Card variant="elevated" style={styles.resultCard}>
          <View style={[styles.resultIconCircle, { backgroundColor: iconBg }]}>
            <Icon name={iconName} size={48} color={iconColor} />
          </View>

          <StatusBadge status="ABSENT" label={scanError.code} style={{ marginBottom: spacing.sm }} />

          <Text style={styles.resultTitle}>{scanError.title}</Text>
          <Text style={styles.resultSubtitle}>{scanError.message}</Text>

          <Button
            title="Scan Again"
            onPress={resetScanner}
            variant="primary"
            size="lg"
            testID="scan-error-retry-btn"
            style={styles.actionBtn}
          />

          <Button
            title="Return to Home"
            onPress={() => router.push("/(tabs)/home")}
            variant="ghost"
            size="md"
            testID="scan-error-home-btn"
            style={{ marginTop: spacing.xs }}
          />
        </Card>
      </View>
    );
  }

  // =========================================================================
  // PERMISSION STATES: Denied / Permanently Blocked
  // =========================================================================
  if (permission && !permission.granted) {
    const isPermanentlyBlocked = !permission.canAskAgain;

    return (
      <View style={styles.permissionContainer} testID="scan-permission-denied-view">
        <Card variant="surface" style={styles.permissionCard}>
          <View style={[styles.resultIconCircle, { backgroundColor: colors.status.lateBg }]}>
            <Icon name="camera-outline" size={44} color={colors.status.late} />
          </View>

          <Text style={styles.permissionTitle}>
            {isPermanentlyBlocked ? "Camera Permission Blocked" : "Camera Access Required"}
          </Text>

          <Text style={styles.permissionText}>
            {isPermanentlyBlocked
              ? "Camera access was permanently disabled in your device permissions. To scan attendance QR codes, please enable the camera in device settings."
              : "VorldX requires camera permission to scan the rotating attendance QR codes on lobby display kiosks."}
          </Text>

          {isPermanentlyBlocked ? (
            <Button
              title="Open Device Settings"
              onPress={() => Linking.openSettings()}
              variant="primary"
              size="lg"
              testID="scan-open-settings-btn"
              style={styles.actionBtn}
            />
          ) : (
            <Button
              title="Grant Camera Permission"
              onPress={requestPermission}
              variant="primary"
              size="lg"
              testID="scan-grant-permission-btn"
              style={styles.actionBtn}
            />
          )}

          {/* Manual Entry Fallback Toggle */}
          <TouchableOpacity
            onPress={() => setShowManualInput(!showManualInput)}
            style={styles.toggleManualBtn}
            testID="scan-toggle-manual-entry-btn"
          >
            <Text style={styles.toggleManualText}>
              {showManualInput ? "Hide Manual Entry" : "Use Manual Token Entry (Demo / Testing)"}
            </Text>
          </TouchableOpacity>

          {showManualInput && (
            <View style={styles.manualEntryBox}>
              <TextInput
                placeholder="Paste rotating QR token here"
                placeholderTextColor={colors.text.muted}
                value={manualToken}
                onChangeText={setManualToken}
                style={styles.manualInput}
                testID="scan-manual-token-input"
              />
              <Button
                title="Submit Punch"
                onPress={handleManualSubmit}
                isLoading={isSubmitting}
                size="md"
                testID="scan-submit-manual-token-btn"
              />
            </View>
          )}
        </Card>
      </View>
    );
  }

  // =========================================================================
  // ACTIVE SCANNER VIEW with Guidance Frame
  // =========================================================================
  return (
    <View style={styles.scannerContainer}>
      {/* Native Camera View or Web Fallback */}
      {Platform.OS !== "web" ? (
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={handleBarcodeScanned}
        />
      ) : (
        <View style={styles.webCameraPlaceholder}>
          <Icon name="camera-outline" size={64} color={colors.accent.cyan} />
          <Text style={styles.webCameraText}>Camera View Active (Mobile Web / Native Emulator)</Text>
        </View>
      )}

      {/* Dark Translucent Mask with Cutout Scan Frame */}
      <View style={styles.overlay}>
        <View style={styles.overlayTop} />

        <View style={styles.overlayCenterRow}>
          <View style={styles.overlaySide} />

          {/* Central Scan Target Box */}
          <View style={styles.scanTargetBox} testID="scan-target-frame">
            {/* Corner Bracket Guides */}
            <View style={[styles.cornerBracket, styles.topLeftBracket]} />
            <View style={[styles.cornerBracket, styles.topRightBracket]} />
            <View style={[styles.cornerBracket, styles.bottomLeftBracket]} />
            <View style={[styles.cornerBracket, styles.bottomRightBracket]} />
          </View>

          <View style={styles.overlaySide} />
        </View>

        <View style={styles.overlayBottom}>
          <Text style={styles.guidanceText}>
            Align the 30-second rotating QR code from the office display within the frame
          </Text>

          {/* Controls Bar */}
          <View style={styles.controlsRow}>
            {Platform.OS !== "web" && (
              <TouchableOpacity
                onPress={() => setTorch(!torch)}
                style={[styles.controlBtn, torch && styles.controlBtnActive]}
                testID="scan-toggle-torch-btn"
              >
                <Icon
                  name={torch ? "flashlight" : "flashlight-outline"}
                  size={20}
                  color={torch ? colors.accent.cyan : "#FFFFFF"}
                />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => setShowManualInput(!showManualInput)}
              style={styles.manualEntryPill}
              testID="scan-toggle-manual-entry-btn"
            >
              <Icon name="key-outline" size={16} color={colors.accent.cyan} />
              <Text style={styles.manualEntryPillText}>
                {showManualInput ? "Hide Code Entry" : "Manual Token"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Manual Input Drawer (for Web, Testing & Simulators) */}
          {showManualInput && (
            <Card variant="surface" style={styles.manualDrawer}>
              <Text style={styles.manualDrawerTitle}>Test or Manual QR Token Punch</Text>
              <TextInput
                placeholder="Enter or paste token from office display"
                placeholderTextColor={colors.text.muted}
                value={manualToken}
                onChangeText={setManualToken}
                style={styles.manualInput}
                testID="scan-manual-token-input"
              />
              <Button
                title="Submit Attendance Punch"
                onPress={handleManualSubmit}
                isLoading={isSubmitting}
                size="md"
                testID="scan-submit-manual-token-btn"
                style={{ marginTop: spacing.sm }}
              />
            </Card>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scannerContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  webCameraPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0B1120",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  webCameraText: {
    ...typography.sm,
    color: colors.text.secondary,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  overlayCenterRow: {
    flexDirection: "row",
    height: 260,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  scanTargetBox: {
    width: 260,
    height: 260,
    position: "relative",
    backgroundColor: "transparent",
  },
  cornerBracket: {
    position: "absolute",
    width: 32,
    height: 32,
    borderColor: colors.accent.cyan,
  },
  topLeftBracket: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: radii.md,
  },
  topRightBracket: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: radii.md,
  },
  bottomLeftBracket: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: radii.md,
  },
  bottomRightBracket: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: radii.md,
  },
  overlayBottom: {
    flex: 1.5,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  guidanceText: {
    ...typography.sm,
    color: "#FFFFFF",
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  controlBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  controlBtnActive: {
    backgroundColor: "rgba(6, 182, 212, 0.25)",
  },
  manualEntryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: "rgba(6, 182, 212, 0.15)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.accent.cyan,
  },
  manualEntryPillText: {
    ...typography.xs,
    fontWeight: "700",
    color: colors.accent.cyan,
  },
  manualDrawer: {
    marginTop: spacing.md,
    width: "100%",
    padding: spacing.md,
  },
  manualDrawerTitle: {
    ...typography.xs,
    fontWeight: "700",
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  manualInput: {
    backgroundColor: colors.background.base,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 13,
  },
  resultContainer: {
    flex: 1,
    backgroundColor: colors.background.base,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  resultCard: {
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    padding: spacing.xl,
  },
  resultIconCircle: {
    width: 80,
    height: 80,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  resultTitle: {
    ...typography.xl,
    fontWeight: "800",
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  resultSubtitle: {
    ...typography.sm,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  serverTimeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: "rgba(6, 182, 212, 0.1)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
    marginBottom: spacing.lg,
  },
  serverTimeText: {
    ...typography.xs,
    fontWeight: "700",
    color: colors.accent.cyan,
  },
  resultDetailsGrid: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: colors.background.base,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  detailItem: {
    alignItems: "center",
    gap: 4,
  },
  detailLabel: {
    ...typography.xs,
    color: colors.text.muted,
  },
  detailValue: {
    ...typography.sm,
    fontWeight: "800",
    color: colors.text.primary,
  },
  actionBtn: {
    width: "100%",
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: colors.background.base,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  permissionCard: {
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
    padding: spacing.xl,
  },
  permissionTitle: {
    ...typography.lg,
    fontWeight: "800",
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  permissionText: {
    ...typography.sm,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  toggleManualBtn: {
    marginTop: spacing.md,
    padding: spacing.xs,
  },
  toggleManualText: {
    ...typography.xs,
    color: colors.accent.cyan,
    textAlign: "center",
  },
  manualEntryBox: {
    width: "100%",
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
});
