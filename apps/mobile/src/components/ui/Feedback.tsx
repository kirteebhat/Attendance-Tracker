import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { AlertCircle, CheckCircle2, Info, RefreshCw } from 'lucide-react-native';
import { colors, radii, spacing, tones, type Tone } from '../../theme/tokens';
import { Button } from './Button';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export function Notice({
  title,
  message,
  tone = 'info',
  icon,
  actionLabel,
  onAction,
}: {
  title?: string;
  message: string;
  tone?: Tone;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const palette = tones[tone] || tones.info;
  const Fallback =
    tone === 'danger' ? AlertCircle : tone === 'success' ? CheckCircle2 : Info;

  const renderNoticeIcon = () => {
    if (!icon) return <Fallback size={17} color={palette.fg} strokeWidth={1.9} />;
    if (React.isValidElement(icon)) return icon;
    const IconComp = icon as unknown as React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
    return <IconComp size={17} color={palette.fg} strokeWidth={1.9} />;
  };

  return (
    <View
      style={[
        styles.notice,
        { backgroundColor: palette.bg, borderColor: palette.border },
      ]}
    >
      <View style={styles.noticeRow}>
        {renderNoticeIcon()}
        <View style={styles.noticeCopy}>
          {title ? (
            <Text variant="bodyMedium" color={palette.fg} weight="semibold">
              {title}
            </Text>
          ) : null}
          <Text variant="small" color={title ? colors.textSecondary : palette.fg}>
            {message}
          </Text>
        </View>
      </View>
      {actionLabel && onAction ? (
        <PressableScale
          accessibilityRole="button"
          onPress={onAction}
          style={styles.noticeAction}
        >
          <Text variant="small" color={palette.fg} weight="semibold">
            {actionLabel}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon?: ReactNode;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const renderEmptyIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    const IconComp = icon as unknown as React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
    return <IconComp size={24} color={colors.indigoSoft} strokeWidth={1.8} />;
  };

  return (
    <View style={styles.empty}>
      {icon ? <View style={styles.emptyIcon}>{renderEmptyIcon()}</View> : null}
      <Text variant="subheading" align="center">
        {title}
      </Text>
      <Text variant="small" color={colors.muted} align="center" style={styles.emptyMessage}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          size="sm"
          variant="soft"
          fullWidth={false}
          style={styles.emptyButton}
        />
      ) : null}
    </View>
  );
}

export function ErrorState({
  title = 'Could not load this screen',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.errorIcon}>
        <AlertCircle size={24} color={colors.danger} strokeWidth={1.8} />
      </View>
      <Text variant="subheading" align="center">
        {title}
      </Text>
      <Text variant="small" color={colors.muted} align="center" style={styles.emptyMessage}>
        {message}
      </Text>
      {onRetry ? (
        <Button
          label="Try again"
          onPress={onRetry}
          size="sm"
          variant="secondary"
          fullWidth={false}
          icon={<RefreshCw size={14} color={colors.text} strokeWidth={2} />}
          style={styles.emptyButton}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
    width: '100%',
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  noticeCopy: {
    flex: 1,
    gap: 2,
  },
  noticeAction: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.sm,
    width: '100%',
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  errorIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 107, 131, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyMessage: {
    maxWidth: 320,
  },
  emptyButton: {
    marginTop: spacing.md,
  },
});

