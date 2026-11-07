import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { BottomTabInset, FontFamily, MinTouch, Radius, SmallTouch, Spacing, useColors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';
import { CATEGORY_STYLE, displayCategory, senseDesc, senseIcon, senseName } from '@/lib/sixth';
import { useS } from '@/lib/strings';
import type { SenseManifest } from '@mibyan/shared/sense';

/* ------------------------------------------------------------------ layout */

/** Page scaffold: background, RTL direction, safe area, optional pull-to-refresh and tab inset. */
export function Screen({
  children,
  tabs,
  onRefresh,
  refreshing,
  header,
  contentStyle,
  scroll = true,
}: {
  children: ReactNode;
  /** Leave room for the bottom tab bar. */
  tabs?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  header?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  scroll?: boolean;
}) {
  const c = useColors();
  const { dir } = useI18n();
  const insets = useSafeAreaInsets();
  const pad = { paddingBottom: insets.bottom + (tabs ? BottomTabInset + Spacing.four : Spacing.four) };
  return (
    <View style={{ flex: 1, backgroundColor: c.background, direction: dir }}>
      <AmbientGlow />
      <View style={{ paddingTop: insets.top + Spacing.two }}>{header}</View>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="never"
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.accentText} /> : undefined}
          contentContainerStyle={[styles.content, pad, contentStyle]}>
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, styles.content, pad, contentStyle]}>{children}</View>
      )}
    </View>
  );
}

/** A faint violet wash behind the top of every screen: depth without decoration. */
function AmbientGlow() {
  const c = useColors();
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[c.glow + '26', 'transparent']}
      style={styles.ambient}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

export function useChevron() {
  const { dir } = useI18n();
  return (dir === 'rtl' ? 'chevron.left' : 'chevron.right') as SFSymbol;
}
export function useBackIcon() {
  const { dir } = useI18n();
  return (dir === 'rtl' ? 'chevron.right' : 'chevron.left') as SFSymbol;
}

export function ScreenHeader({
  title,
  large,
  back,
  close,
  trailing,
}: {
  title?: string;
  large?: boolean;
  back?: boolean;
  close?: boolean;
  trailing?: ReactNode;
}) {
  const router = useRouter();
  const s = useS();
  const backIcon = useBackIcon();
  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>
        {(back || close) && (
          <IconButton icon={close ? 'xmark' : backIcon} label={close ? s.close : s.back} onPress={() => router.back()} />
        )}
      </View>
      {!large && title ? (
        <Text variant="heading" accessibilityRole="header" numberOfLines={1} style={{ flexShrink: 1 }}>
          {title}
        </Text>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      <View style={[styles.headerSide, { alignItems: 'flex-end' }]}>{trailing}</View>
    </View>
  );
}

export function LargeTitle({ children, sub }: { children: string; sub?: string }) {
  return (
    <View style={{ gap: Spacing.one }}>
      <Text variant="display" accessibilityRole="header">
        {children}
      </Text>
      {sub ? <Text tone="secondary">{sub}</Text> : null}
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text variant="title" accessibilityRole="header" style={{ flexShrink: 1 }}>
        {title}
      </Text>
      {action && onAction ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${action}: ${title}`} onPress={onAction} hitSlop={12} style={styles.sectionAction}>
          <Text variant="caption" tone="accent">
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ controls */

export function IconButton({
  icon,
  label,
  onPress,
  tint,
  filled = true,
  size = 44,
}: {
  icon: SFSymbol;
  label: string;
  onPress: () => void;
  tint?: string;
  filled?: boolean;
  size?: number;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: filled ? c.surface : 'transparent', opacity: pressed ? 0.6 : 1 },
      ]}>
      <SymbolView name={icon} size={size * 0.45} tintColor={tint ?? c.text} weight="semibold" />
    </Pressable>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  hint,
  compact,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: SFSymbol;
  loading?: boolean;
  disabled?: boolean;
  hint?: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const off = disabled || loading;
  const bg = { primary: c.accent, secondary: c.surfaceStrong, ghost: 'transparent', danger: c.stop }[variant];
  const fg = { primary: c.onAccent, secondary: c.text, ghost: c.accentText, danger: c.stopText }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={() => {
        Haptics.impactAsync(variant === 'primary' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, minHeight: compact ? SmallTouch : MinTouch, opacity: off ? 0.45 : pressed ? 0.75 : 1 },
        variant === 'primary' && { shadowColor: c.glow, shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: { width: 0, height: 6 } },
        style,
      ]}>
      {loading ? <ActivityIndicator color={fg} /> : icon ? <SymbolView name={icon} size={20} tintColor={fg} weight="semibold" /> : null}
      <Text variant="heading" style={{ color: fg }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Toggle({ value, onChange, label, disabled }: { value: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  const c = useColors();
  return (
    <View style={styles.toggleBox}>
      <Switch
        accessibilityLabel={label}
        accessibilityRole="switch"
        value={value}
        disabled={disabled}
        onValueChange={(v) => {
          Haptics.selectionAsync();
          onChange(v);
        }}
        trackColor={{ false: c.surfaceStrong, true: c.accent }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={c.surfaceStrong}
      />
    </View>
  );
}

export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const c = useColors();
  const { dir } = useI18n();
  return (
    <View style={[styles.search, { backgroundColor: c.surface, borderColor: c.border }]}>
      <SymbolView name="magnifyingglass" size={18} tintColor={c.textTertiary} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.textTertiary}
        accessibilityLabel={placeholder}
        returnKeyType="search"
        autoCorrect={false}
        style={{ flex: 1, minHeight: MinTouch - 8, color: c.text, fontSize: 17, fontFamily: FontFamily['400'], textAlign: dir === 'rtl' ? 'right' : 'left', writingDirection: dir }}
      />
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel="×" hitSlop={10} onPress={() => onChange('')}>
          <SymbolView name="xmark.circle.fill" size={18} tintColor={c.textTertiary} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function TextField({
  value,
  onChange,
  placeholder,
  multiline,
  secure,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  multiline?: boolean;
  secure?: boolean;
  autoFocus?: boolean;
}) {
  const c = useColors();
  const { dir } = useI18n();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={c.textTertiary}
      accessibilityLabel={placeholder}
      multiline={multiline}
      secureTextEntry={secure}
      autoFocus={autoFocus}
      style={{
        minHeight: multiline ? 96 : MinTouch,
        borderRadius: Radius.md,
        paddingHorizontal: Spacing.three,
        paddingVertical: Spacing.two,
        backgroundColor: c.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: c.border,
        color: c.text,
        fontSize: 17,
        fontFamily: FontFamily['400'],
        textAlign: dir === 'rtl' ? 'right' : 'left',
        writingDirection: dir,
        textAlignVertical: multiline ? 'top' : 'center',
      }}
    />
  );
}

export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress: () => void; icon?: SFSymbol }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected }}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: selected ? c.accent : c.surface, borderColor: selected ? c.accent : c.border, opacity: pressed ? 0.7 : 1 },
      ]}>
      {icon ? <SymbolView name={icon} size={15} tintColor={selected ? c.onAccent : c.textSecondary} /> : null}
      <Text variant="caption" style={{ color: selected ? c.onAccent : c.text }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const c = useColors();
  return (
    <View style={[styles.segment, { backgroundColor: c.surface }]} accessibilityRole="radiogroup">
      {options.map((o) => {
        const selected = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(o.id);
            }}
            style={[styles.segmentItem, selected && { backgroundColor: c.accent }]}>
            <Text variant="caption" center style={{ color: selected ? c.onAccent : c.textSecondary }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ surfaces */

export function Card({ children, style, onPress, label, hint }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; label?: string; hint?: string }) {
  const c = useColors();
  const base = [styles.card, { backgroundColor: c.card, borderColor: c.border }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [base, { opacity: pressed ? 0.75 : 1 }]}>
      {children}
    </Pressable>
  );
}

export function Group({ children, title }: { children: ReactNode; title?: string }) {
  const c = useColors();
  return (
    <View style={{ gap: Spacing.two }}>
      {title ? (
        <Text variant="label" tone="tertiary" accessibilityRole="header" style={{ paddingHorizontal: Spacing.two }}>
          {title.toUpperCase()}
        </Text>
      ) : null}
      <View style={[styles.group, { backgroundColor: c.card, borderColor: c.border }]}>{children}</View>
    </View>
  );
}

export function Divider() {
  const c = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginHorizontal: Spacing.three }} />;
}

/** A list row: leading icon badge, title/subtitle, optional trailing control or chevron. */
export function Row({
  icon,
  hue,
  title,
  subtitle,
  trailing,
  onPress,
  chevron,
  hint,
  danger,
}: {
  icon?: SFSymbol;
  hue?: string;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  hint?: string;
  danger?: boolean;
}) {
  const c = useColors();
  const chev = useChevron();
  const body = (
    <>
      {icon ? <IconBadge icon={icon} hue={hue} size={40} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="heading" tone={danger ? 'danger' : 'primary'}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="secondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {chevron ? <SymbolView name={chev} size={14} tintColor={c.textTertiary} weight="semibold" /> : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityHint={hint}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
      {body}
    </Pressable>
  );
}

export function IconBadge({ icon, hue, size = 44 }: { icon: SFSymbol; hue?: string; size?: number }) {
  const c = useColors();
  const h = hue ?? c.glow;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: h + '24', borderColor: h + '40', borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' }}>
      <SymbolView name={icon} size={size * 0.48} tintColor={h} weight="medium" />
    </View>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'accent' }) {
  const c = useColors();
  const fg = { neutral: c.textSecondary, success: c.success, warning: c.warning, danger: c.stopText, accent: c.accentText }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: fg + '1F', borderColor: fg + '40' }]}>
      <Text variant="label" style={{ color: fg }}>
        {label}
      </Text>
    </View>
  );
}

export function StatusDot({ tone }: { tone: 'success' | 'warning' | 'danger' | 'idle' }) {
  const c = useColors();
  const col = { success: c.success, warning: c.warning, danger: c.stopText, idle: c.textTertiary }[tone];
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: col }} />;
}

/* ------------------------------------------------------------------ Sense cards */

/** Full-width Sense row used in lists and the marketplace. */
export function SenseCard({
  sense,
  active,
  installed,
  compatible = true,
  onPress,
  onToggle,
  onInstall,
  busy,
}: {
  sense: SenseManifest;
  active?: boolean;
  installed?: boolean;
  compatible?: boolean;
  onPress: () => void;
  onToggle?: (v: boolean) => void;
  onInstall?: () => void;
  busy?: boolean;
}) {
  const { lang } = useI18n();
  const s = useS();
  const c = useColors();
  const cat = displayCategory(sense);
  const st = CATEGORY_STYLE[cat];
  const name = senseName(sense, lang);
  return (
    <Card
      onPress={onPress}
      label={`${name}. ${s.cat[cat]}. ${senseDesc(sense, lang)}. ${installed ? (active ? s.on : s.off) : ''}`}
      hint={s.details}
      style={{ gap: Spacing.two }}>
      <View style={styles.cardTop}>
        <IconBadge icon={senseIcon(sense)} hue={st.hue} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="heading" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="label" tone="tertiary">
            {s.cat[cat]}
          </Text>
        </View>
        {installed && onToggle ? (
          <Toggle value={!!active} onChange={onToggle} label={`${name}: ${active ? s.on : s.off}`} disabled={!compatible} />
        ) : onInstall ? (
          <Button compact label={s.install} onPress={onInstall} loading={busy} variant="secondary" hint={name} />
        ) : null}
      </View>
      <Text variant="caption" tone="secondary" numberOfLines={2}>
        {senseDesc(sense, lang)}
      </Text>
      <View style={styles.cardBadges}>
        {installed ? <Badge tone={active ? 'success' : 'neutral'} label={active ? s.on : s.off} /> : null}
        <Badge tone={compatible ? 'neutral' : 'warning'} label={compatible ? s.compatible : s.needsDevice} />
        <SymbolView name={useChevron()} size={12} tintColor={c.textTertiary} style={{ marginStart: 'auto' }} />
      </View>
    </Card>
  );
}

/** Compact horizontal tile for the Home carousel. */
export function SenseTile({ sense, active, onPress, onToggle }: { sense: SenseManifest; active: boolean; onPress: () => void; onToggle: (v: boolean) => void }) {
  const { lang } = useI18n();
  const s = useS();
  const cat = displayCategory(sense);
  const st = CATEGORY_STYLE[cat];
  const name = senseName(sense, lang);
  return (
    <Card onPress={onPress} label={`${name}. ${active ? s.on : s.off}`} hint={s.details} style={{ width: 210, gap: Spacing.two }}>
      <View style={styles.cardTop}>
        <IconBadge icon={senseIcon(sense)} hue={st.hue} />
        <View style={{ flex: 1 }} />
        <Toggle value={active} onChange={onToggle} label={`${name}: ${active ? s.on : s.off}`} />
      </View>
      <Text variant="heading" numberOfLines={1}>
        {name}
      </Text>
      <Text variant="caption" tone="secondary" numberOfLines={2}>
        {senseDesc(sense, lang)}
      </Text>
    </Card>
  );
}

/* ------------------------------------------------------------------ states */

export function EmptyState({ icon = 'tray', title, body, action }: { icon?: SFSymbol; title: string; body?: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.state} accessible accessibilityLabel={body ? `${title}. ${body}` : title}>
      <IconBadge icon={icon} size={56} />
      <Text variant="heading" center>
        {title}
      </Text>
      {body ? (
        <Text tone="secondary" center>
          {body}
        </Text>
      ) : null}
      {action ? <Button compact variant="secondary" label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const s = useS();
  return (
    <View style={styles.state} accessibilityLiveRegion="polite">
      <IconBadge icon="exclamationmark.triangle.fill" hue="#F5B544" size={56} />
      <Text variant="heading" center>
        {s.loadFailed}
      </Text>
      <Text tone="secondary" center variant="caption">
        {message}
      </Text>
      {onRetry ? <Button compact variant="secondary" label={s.retry} onPress={onRetry} /> : null}
    </View>
  );
}

export function Banner({ message, tone = 'warning', icon = 'wifi.slash' }: { message: string; tone?: 'warning' | 'danger' | 'accent'; icon?: SFSymbol }) {
  const c = useColors();
  const col = { warning: c.warning, danger: c.stopText, accent: c.accentText }[tone];
  return (
    <View accessible accessibilityRole="alert" style={[styles.banner, { backgroundColor: col + '1A', borderColor: col + '40' }]}>
      <SymbolView name={icon} size={18} tintColor={col} />
      <Text variant="caption" style={{ flex: 1 }}>
        {message}
      </Text>
    </View>
  );
}

/** Shimmering placeholder. Holds still when Reduce Motion is on. */
export function Skeleton({ height = 80, width, radius = Radius.md }: { height?: number; width?: number | `${number}%`; radius?: number }) {
  const c = useColors();
  const reduce = useReducedMotion();
  const [v] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.5, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, v]);
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ height, width: width ?? '100%', borderRadius: radius, backgroundColor: c.surface, opacity: reduce ? 0.7 : v }}
    />
  );
}

export function SkeletonList({ count = 3, height = 110 }: { count?: number; height?: number }) {
  const s = useS();
  return (
    <View style={{ gap: Spacing.two }} accessibilityLabel={s.loading} accessible>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} height={height} />
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ sheet + toast */

export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const c = useColors();
  const { dir } = useI18n();
  const s = useS();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} accessibilityViewIsModal>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={s.close} onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: '#000000AA' }]} />
        <View
          style={{
            direction: dir,
            backgroundColor: c.card,
            borderTopLeftRadius: Radius.xl,
            borderTopRightRadius: Radius.xl,
            borderColor: c.border,
            borderWidth: StyleSheet.hairlineWidth,
            padding: Spacing.four,
            paddingBottom: insets.bottom + Spacing.four,
            gap: Spacing.three,
            maxHeight: '88%',
          }}>
          <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: c.surfaceStrong }} />
          <Text variant="title" accessibilityRole="header">
            {title}
          </Text>
          <ScrollView contentContainerStyle={{ gap: Spacing.three, paddingBottom: Spacing.three }} style={{ overflow: 'visible' }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type ToastKind = 'success' | 'error' | 'info';
const ToastCtx = createContext<(msg: string, kind?: ToastKind) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind } | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback(
    (msg: string, kind: ToastKind = 'info') => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ msg, kind });
      AccessibilityInfo.announceForAccessibility(msg);
      Haptics.notificationAsync(kind === 'error' ? Haptics.NotificationFeedbackType.Error : kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      timer.current = setTimeout(() => Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setToast(null)), 3600);
    },
    [opacity],
  );
  const col = toast ? { success: c.success, error: c.stopText, info: c.accentText }[toast.kind] : c.accentText;
  const value = useMemo(() => show, [show]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View pointerEvents="none" style={[styles.toast, { top: insets.top + Spacing.two, opacity, backgroundColor: c.surfaceStrong, borderColor: col + '66' }]}>
          <SymbolView name={toast.kind === 'success' ? 'checkmark.circle.fill' : toast.kind === 'error' ? 'xmark.octagon.fill' : 'info.circle.fill'} size={20} tintColor={col} />
          <Text variant="caption" style={{ flex: 1 }}>
            {toast.msg}
          </Text>
        </Animated.View>
      ) : null}
    </ToastCtx.Provider>
  );
}

/* ------------------------------------------------------------------ timeline */

export function TimelineItem({
  icon,
  hue,
  title,
  subtitle,
  time,
  onPress,
  last,
}: {
  icon: SFSymbol;
  hue?: string;
  title: string;
  subtitle?: string;
  time: string;
  onPress?: () => void;
  last?: boolean;
}) {
  const c = useColors();
  const body = (
    <View style={styles.timeline}>
      <View style={{ alignItems: 'center' }}>
        <IconBadge icon={icon} hue={hue} size={36} />
        {!last ? <View style={{ flex: 1, width: 1, backgroundColor: c.border, marginTop: 4 }} /> : null}
      </View>
      <View style={{ flex: 1, gap: 2, paddingBottom: Spacing.three }}>
        <View style={styles.cardTop}>
          <Text variant="heading" style={{ flex: 1 }} numberOfLines={1}>
            {title}
          </Text>
          <Text variant="label" tone="tertiary">
            {time}
          </Text>
        </View>
        {subtitle ? (
          <Text variant="caption" tone="secondary" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${time}. ${subtitle ?? ''}`} onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}>
      {body}
    </Pressable>
  );
}

export function timeAgo(at: number | string, lang: 'ar' | 'en'): string {
  const t = typeof at === 'string' ? Date.parse(at) : at;
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  const h = Math.round(mins / 60);
  const d = Math.round(h / 24);
  if (lang === 'en') return mins < 1 ? 'now' : mins < 60 ? `${mins} min` : h < 24 ? `${h} h` : `${d} d`;
  return mins < 1 ? 'الآن' : mins < 60 ? `${mins} د` : h < 24 ? `${h} س` : `${d} ي`;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.three, gap: Spacing.four, paddingTop: Spacing.two },
  ambient: { position: 'absolute', top: 0, left: 0, right: 0, height: 320 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.three, minHeight: 48, gap: Spacing.two },
  headerSide: { minWidth: 48, justifyContent: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  sectionAction: { minHeight: SmallTouch, justifyContent: 'center' },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two, borderRadius: Radius.full, paddingHorizontal: Spacing.four },
  toggleBox: { minHeight: SmallTouch, minWidth: 56, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, borderRadius: Radius.full, borderWidth: StyleSheet.hairlineWidth, minHeight: MinTouch },
  chip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, minHeight: SmallTouch, paddingHorizontal: Spacing.three, borderRadius: Radius.full, borderWidth: StyleSheet.hairlineWidth },
  segment: { flexDirection: 'row', borderRadius: Radius.full, padding: 3 },
  segmentItem: { flex: 1, minHeight: SmallTouch, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.two },
  card: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.three },
  group: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three - 2, paddingHorizontal: Spacing.three, minHeight: MinTouch },
  badge: { alignSelf: 'flex-start', paddingHorizontal: Spacing.two, paddingVertical: 2, borderRadius: Radius.full, borderWidth: StyleSheet.hairlineWidth },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  cardBadges: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  state: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.five, paddingHorizontal: Spacing.three },
  banner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth },
  toast: { position: 'absolute', left: Spacing.three, right: Spacing.three, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.lg, borderWidth: 1 },
  timeline: { flexDirection: 'row', gap: Spacing.three },
});
