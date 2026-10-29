import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import {
  AlertCircle,
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock3,
  QrCode,
  RotateCcw,
  ScanLine,
  Sparkles,
  Zap,
  ZapOff,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  Screen,
  Card,
  Button,
  PageHeader,
  Input,
  Text,
  PressableScale,
} from '../../src/components';
import { colors, radii, spacing, tones, type Tone } from '../../src/theme/tokens';
import { useResponsive } from '../../src/lib/responsive';
import { attendanceApi, ApiError } from '../../src/services';

const FRAME_SIZE = 218;

function ScannerOverlay({ paused }: { paused: boolean }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (paused) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [paused, progress]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, FRAME_SIZE - 6],
  });

  return (
    <View pointerEvents="none" style={styles.scanFrame}>
      <View style={[styles.corner, styles.cornerTopLeft]} />
      <View style={[styles.corner, styles.cornerTopRight]} />
      <View style={[styles.corner, styles.cornerBottomLeft]} />
      <View style={[styles.corner, styles.cornerBottomRight]} />
      <Animated.View style={[styles.scanLine, { transform: [{ translateY }] }]} />
    </View>
  );
}

export default function ScanScreen() {
  const router = useRouter();
  const { isWide } = useResponsive();
  const [permission, requestPermission] = useCameraPermissions();

  const [torch, setTorch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  const [scanResult, setScanResult] = useState<{
    tone: Tone;
    title: string;
    message: string;
  } | null>(null);

  const isProcessingRef = useRef(false);

  const resetScanner = () => {
    isProcessingRef.current = false;
    setIsSubmitting(false);
    setScanResult(null);
    setManualToken('');
  };

  /**
   * Submits ONLY the token to the backend.
   * STRICT SECURITY REQUIREMENT: Never sends a client timestamp!
   */
  const processToken = useCallback(
    async (rawToken: string) => {
      let cleanToken = rawToken.trim();
      if (!cleanToken) return;

      if (cleanToken.startsWith('{') && cleanToken.includes('token')) {
        try {
          const parsed = JSON.parse(cleanToken);
          if (parsed.token) cleanToken = parsed.token;
        } catch {
          // Use raw token if parsing fails
        }
      }

      setIsSubmitting(true);
      setScanResult(null);

      try {
        const res = await attendanceApi.scanAttendance(cleanToken);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);

        const isOut = res.punchType === 'CHECK_OUT';
        setScanResult({
          tone: 'success',
          title: isOut ? 'Checked Out' : 'Checked In',
          message:
            res.message ||
            (isOut
              ? `Shift completed with ${res.durationMinutes}m duration.`
              : 'Attendance punch successfully registered at terminal.'),
        });
      } catch (err: unknown) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
        if (err instanceof ApiError) {
          const code = err.code || 'ERR_REQUEST_FAILED';
          if (code === 'ERR_QR_EXPIRED') {
            setScanResult({
              tone: 'warning',
              title: 'QR Code Expired',
              message: 'The rotating challenge has expired (kiosks refresh every 30s). Please aim at the current code on the display.',
            });
          } else if (code === 'ERR_ALREADY_CHECKED_IN' || code === 'ERR_PUNCH_COOLDOWN_ACTIVE') {
            setScanResult({
              tone: 'warning',
              title: 'Duplicate Punch / Cooldown',
              message: err.message || 'You have already checked in or must wait for the punch cooldown period.',
            });
          } else {
            setScanResult({
              tone: 'danger',
              title: 'Attendance Error',
              message: err.message || 'Failed to record attendance punch.',
            });
          }
        } else {
          setScanResult({
            tone: 'danger',
            title: 'Connection Error',
            message: 'Unable to connect to attendance server. Please check your connection.',
          });
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  const handleBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (isProcessingRef.current || !data || isSubmitting) return;
      isProcessingRef.current = true;
      processToken(data);
    },
    [isSubmitting, processToken]
  );

  return (
    <Screen edges={['top', 'bottom']}>
      <PageHeader
        eyebrow="Dynamic Token"
        title="Office QR Punch"
        subtitle="Aim your camera at the office lobby display kiosk to check in or out."
      />

      <View style={[styles.container, isWide && styles.containerWide]}>
        {/* Camera Viewport Frame */}
        <View style={styles.viewfinderCard}>
          {!permission ? (
            <View style={styles.permissionState}>
              <ActivityIndicator color={colors.indigoSoft} />
            </View>
          ) : !permission.granted ? (
            <View style={styles.permissionState}>
              <View style={styles.permissionIcon}>
                <Camera size={26} color={colors.indigoSoft} strokeWidth={1.8} />
              </View>
              <Text variant="subheading" align="center">
                Camera access needed
              </Text>
              <Text variant="small" color={colors.muted} align="center" style={styles.permText}>
                VorldX uses the camera strictly to read dynamic HMAC QR attendance tokens.
              </Text>
              <Button
                label={permission.canAskAgain ? 'Allow Camera' : 'Open Settings'}
                onPress={() => {
                  if (permission.canAskAgain) void requestPermission();
                  else void Linking.openSettings();
                }}
                size="sm"
                fullWidth={false}
              />
            </View>
          ) : (
            <>
              <CameraView
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                enableTorch={torch}
                facing="back"
                onBarcodeScanned={isProcessingRef.current ? undefined : handleBarcodeScanned}
                style={StyleSheet.absoluteFill}
              />
              <View pointerEvents="none" style={styles.cameraShade} />
              <ScannerOverlay paused={Boolean(scanResult || isSubmitting)} />
            </>
          )}

          {/* Top Bar Controls */}
          <View style={styles.cameraTop}>
            <View style={styles.cameraBadge}>
              <QrCode size={13} color={colors.indigoSoft} strokeWidth={2} />
              <Text variant="caption" color={colors.indigoSoft}>
                VorldX Office Kiosk
              </Text>
            </View>
            {permission?.granted ? (
              <PressableScale
                accessibilityRole="button"
                haptic="selection"
                onPress={() => setTorch((v) => !v)}
                style={styles.torchBtn}
              >
                {torch ? (
                  <ZapOff size={16} color={colors.text} />
                ) : (
                  <Zap size={16} color={colors.text} />
                )}
              </PressableScale>
            ) : null}
          </View>

          {/* Submitting Pill */}
          {isSubmitting ? (
            <View style={styles.submittingOverlay}>
              <View style={styles.submittingPill}>
                <ActivityIndicator color={colors.indigoSoft} size="small" />
                <Text variant="small" color={colors.text} weight="medium">
                  Validating dynamic token...
                </Text>
              </View>
            </View>
          ) : null}

          {/* Result Card Modal */}
          {scanResult ? (
            <View style={styles.resultOverlay}>
              <Card padding={18} tone={scanResult.tone} variant="raised">
                <View style={styles.resultHeader}>
                  <View
                    style={[
                      styles.resultIconWrap,
                      { backgroundColor: tones[scanResult.tone].bg },
                    ]}
                  >
                    {scanResult.tone === 'success' ? (
                      <CheckCircle2 size={20} color={colors.success} strokeWidth={2} />
                    ) : (
                      <AlertCircle size={20} color={colors.danger} strokeWidth={2} />
                    )}
                  </View>
                  <View style={styles.resultCopy}>
                    <Text variant="subheading">{scanResult.title}</Text>
                    <Text variant="small" color={colors.textSecondary}>
                      {scanResult.message}
                    </Text>
                  </View>
                </View>
                <View style={styles.resultActions}>
                  <Button
                    icon={<RotateCcw size={14} color={colors.text} />}
                    label="Scan again"
                    onPress={resetScanner}
                    size="sm"
                    variant="secondary"
                    style={{ flex: 1 }}
                  />
                  <Button
                    icon={<ArrowRight size={14} color={colors.white} />}
                    label="View history"
                    onPress={() => router.navigate('/(tabs)/history')}
                    size="sm"
                    style={{ flex: 1 }}
                  />
                </View>
              </Card>
            </View>
          ) : null}
        </View>

        {/* Hints Footer */}
        <View style={styles.footerHints}>
          <View style={styles.hintItem}>
            <ScanLine size={14} color={colors.muted} />
            <Text variant="small" color={colors.muted}>
              Hold steady inside the frame
            </Text>
          </View>
          <View style={styles.hintItem}>
            <Clock3 size={14} color={colors.muted} />
            <Text variant="small" color={colors.muted}>
              QR challenge rotates every 30s
            </Text>
          </View>
        </View>

        {/* Demo Token Manual Input Fallback */}
        <Card variant="soft" padding={14} style={styles.demoCard}>
          <TouchableOpacity
            onPress={() => setShowManualInput(!showManualInput)}
            style={styles.demoToggle}
          >
            <View style={styles.demoToggleLeft}>
              <Sparkles size={15} color={colors.indigoSoft} />
              <Text variant="small" color={colors.indigoSoft} weight="semibold">
                No lobby display screen? Use Instant Demo Punch
              </Text>
            </View>
          </TouchableOpacity>

          {showManualInput && (
            <View style={styles.demoInputWrap}>
              <Input
                placeholder="Paste token or payload"
                value={manualToken}
                onChangeText={setManualToken}
                leftIcon={QrCode}
              />
              <Button
                label="Submit Challenge Token"
                size="sm"
                onPress={() => processToken(manualToken)}
                loading={isSubmitting}
              />
            </View>
          )}
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: spacing.md,
  },
  containerWide: {
    maxWidth: 520,
    alignSelf: 'center',
  },
  viewfinderCard: {
    width: '100%',
    height: 380,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cameraShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 8, 14, 0.42)',
  },
  scanFrame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(89, 101, 242, 0.25)',
    position: 'relative',
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderColor: colors.indigo,
  },
  cornerTopLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 10 },
  cornerTopRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 10 },
  cornerBottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 10 },
  cornerBottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 10 },
  scanLine: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: 2,
    backgroundColor: colors.indigoSoft,
    shadowColor: colors.indigo,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 4,
  },
  cameraTop: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cameraBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(7, 8, 14, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(89, 101, 242, 0.3)',
  },
  torchBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7, 8, 14, 0.72)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  submittingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7, 8, 14, 0.65)',
  },
  submittingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(17, 20, 34, 0.95)',
    borderWidth: 1,
    borderColor: colors.borderActive,
  },
  resultOverlay: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    right: spacing.md,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  resultIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultCopy: {
    flex: 1,
    gap: 2,
  },
  resultActions: {
    flexDirection: 'row',
    gap: 10,
  },
  permissionState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  permissionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(89, 101, 242, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  permText: {
    maxWidth: 280,
    marginBottom: spacing.sm,
  },
  footerHints: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: spacing.xs,
  },
  hintItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  demoCard: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  demoToggle: {
    paddingVertical: 2,
  },
  demoToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  demoInputWrap: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
});
