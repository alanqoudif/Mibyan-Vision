import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { SenseOrb, type SenseOrbState } from '@/components/sense-orb';
import { Text } from '@/components/text';
import { Badge, Card, EmptyState, Screen, SectionHeader, SenseCard, SenseTile, SkeletonList, StatusDot, TimelineItem, timeAgo, useToast } from '@/components/ui';
import { MinTouch, Radius, Spacing, useColors, useGraphicSize } from '@/constants/theme';
import { useGlasses } from '@/lib/glasses';
import { useI18n } from '@/lib/i18n';
import { useRuns } from '@/lib/runlog';
import { useSettings } from '@/lib/settings';
import { EXPERIENCE_SENSES, setEnabled, senseName, useCatalog, useInstalledSenses } from '@/lib/sixth';
import { useS } from '@/lib/strings';
import { useVisionSession } from '@/lib/vision';

type Action = { id: string; icon: SFSymbol; label: string; needs?: string; go: () => void };

export default function HomeScreen() {
  const router = useRouter();
  const c = useColors();
  const s = useS();
  const { lang } = useI18n();
  const toast = useToast();
  const { settings } = useSettings();
  const glasses = useGlasses();
  const session = useVisionSession();
  const installed = useInstalledSenses();
  const catalog = useCatalog();
  const runs = useRuns();
  const orbSize = useGraphicSize(170);
  const connected = glasses.status === 'ready';

  useEffect(() => {
    if (!settings.sixthOnboarded) router.push('/onboarding');
    // Only on first mount; onboarding sets the flag itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const h = new Date().getHours();
  const name = settings.name || '';
  const greeting = (h < 12 ? s.helloMorning : h < 18 ? s.helloAfternoon : s.helloEvening)(name);
  const initial = (name || session.email || '').trim().charAt(0).toUpperCase();

  const active = installed.items.filter((i) => i.enabled);
  const installedIds = useMemo(() => new Set(installed.items.map((i) => i.manifest.id)), [installed.items]);
  const suggestions = useMemo(() => {
    const preferred = EXPERIENCE_SENSES[settings.experience];
    return catalog.items
      .filter((m) => !installedIds.has(m.id))
      .sort((a, b) => Number(preferred.includes(b.id)) - Number(preferred.includes(a.id)))
      .slice(0, 2);
  }, [catalog.items, installedIds, settings.experience]);

  const senseAction = (id: string, fallbackName: string) => () => {
    const found = installed.items.find((i) => i.manifest.id === id);
    if (!found) return toast(s.needSenseInstalled.replace('{x}', fallbackName), 'info');
    if (!found.enabled) return toast(`${senseName(found.manifest, lang)}: ${s.off}`, 'info');
    router.push({ pathname: '/live-vision', params: { sense: id } });
  };
  const has = (id: string) => installed.items.some((i) => i.manifest.id === id && i.enabled);

  const actions: Action[] = [
    { id: 'ask', icon: 'waveform', label: s.askVision, go: () => router.push({ pathname: '/session', params: { mode: 'ask' } }) },
    { id: 'read', icon: 'text.viewfinder', label: s.readAnything, needs: has('read-anything') ? undefined : 'read-anything', go: senseAction('read-anything', 'Read Anything') },
    { id: 'inspect', icon: 'wrench.and.screwdriver.fill', label: s.inspectEquipment, needs: has('equipment-inspection') ? undefined : 'equipment-inspection', go: senseAction('equipment-inspection', 'Equipment Inspection') },
    { id: 'memory', icon: 'brain.head.profile', label: s.saveMemory, go: () => router.push('/memory') },
    { id: 'shift', icon: 'person.badge.clock.fill', label: s.startShift, go: () => router.push('/shift') },
    { id: 'explore', icon: 'sparkles', label: s.exploreSenses, go: () => router.push('/marketplace') },
  ];

  const orbState: SenseOrbState = connected ? 'connected' : 'idle';
  const statusTone = connected ? 'success' : 'warning';
  const statusText = connected ? s.glassesConnected : glasses.status === 'unsupported' ? s.phoneMode : s.glassesNotConnected;

  return (
    <Screen
      tabs
      onRefresh={() => { installed.refresh(); catalog.refresh(); glasses.refresh(); }}
      refreshing={installed.loading}>
      {/* Top: greeting, avatar, status */}
      <View style={styles.top}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="display" accessibilityRole="header" numberOfLines={2}>
            {greeting}
          </Text>
          <View style={styles.rowGap}>
            <StatusDot tone={statusTone} />
            <Text variant="caption" tone="secondary">
              {statusText}
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={s.tabProfile}
          onPress={() => router.push('/profile')}
          style={[styles.avatar, { backgroundColor: c.accent }]}>
          {initial ? (
            <Text variant="heading" style={{ color: c.onAccent }}>
              {initial}
            </Text>
          ) : (
            <SymbolView name="person.fill" size={22} tintColor={c.onAccent} />
          )}
        </Pressable>
      </View>

      <View style={styles.rowGap}>
        <Badge tone="accent" label={`${s.profileLabel}: ${expLabel(settings.experience, s)}`} />
      </View>

      {/* Sense Orb: opens the assistant */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={s.orbLabel}
        accessibilityHint={s.orbHint}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          router.push({ pathname: '/session', params: { mode: 'ask' } });
        }}
        style={styles.orbWrap}>
        <SenseOrb size={orbSize} state={orbState} />
        <Text variant="caption" tone="secondary" center style={{ marginTop: -Spacing.three }}>
          {s.orbHint}
        </Text>
      </Pressable>

      {/* Glasses hero: only what is verified */}
      <Card
        onPress={() => router.push('/glasses')}
        label={`${s.gDevice}. ${s.gStatus[glasses.status]}`}
        style={{ gap: Spacing.two }}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="heading">{s.gDevice}</Text>
            <Text variant="caption" tone={connected ? 'success' : 'secondary'}>
              {s.gStatus[glasses.status]}
            </Text>
          </View>
          <SymbolView name="eyeglasses" size={34} tintColor={connected ? c.success : c.textTertiary} />
        </View>
        <Text variant="caption" tone="secondary">
          {connected ? `${s.gSource}: ${s.gSourceGlasses}. ${s.gBatteryUnknown}.` : s.gStatusNote[glasses.status]}
        </Text>
      </Card>

      {/* Active Senses */}
      <View style={{ gap: Spacing.two }}>
        <SectionHeader title={s.activeSenses} action={s.seeAll} onAction={() => router.push('/senses')} />
        {!installed.ready ? (
          <SkeletonList count={1} height={120} />
        ) : active.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.two }}>
            {active.map((i) => (
              <SenseTile
                key={i.manifest.id}
                sense={i.manifest}
                active
                onPress={() => router.push(`/sense/${i.manifest.id}`)}
                onToggle={(v) => setEnabled(i.manifest.id, v).catch((e) => toast(String(e instanceof Error ? e.message : e), 'error'))}
              />
            ))}
          </ScrollView>
        ) : (
          <EmptyState icon="sparkles" title={s.noActiveSenses} body={s.noActiveSensesBody} action={{ label: s.exploreSenses, onPress: () => router.push('/marketplace') }} />
        )}
      </View>

      {/* Quick actions: unavailable ones explain themselves instead of failing */}
      <View style={{ gap: Spacing.two }}>
        <SectionHeader title={s.quickActions} />
        <View style={styles.grid}>
          {actions.map((a) => {
            const blocked = !!a.needs;
            return (
              <Pressable
                key={a.id}
                accessibilityRole="button"
                accessibilityLabel={a.label}
                accessibilityHint={blocked ? s.needSenseInstalled.replace('{x}', a.needs ?? '') : undefined}
                accessibilityState={{ disabled: blocked }}
                onPress={() => {
                  Haptics.selectionAsync();
                  a.go();
                }}
                style={({ pressed }) => [styles.action, { backgroundColor: c.card, borderColor: c.border, opacity: blocked ? 0.55 : pressed ? 0.7 : 1 }]}>
                <SymbolView name={a.icon} size={26} tintColor={blocked ? c.textTertiary : c.accentText} />
                <Text variant="caption" center numberOfLines={2}>
                  {a.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Recent verified activity: runs that actually happened on this phone */}
      <View style={{ gap: Spacing.two }}>
        <SectionHeader title={s.recentActivity} action={s.seeAll} onAction={() => router.push('/activity')} />
        {runs.length ? (
          <View>
            {runs.slice(0, 3).map((r, i, arr) => (
              <TimelineItem
                key={r.id}
                icon={r.status === 'succeeded' ? 'checkmark.circle.fill' : 'exclamationmark.triangle.fill'}
                hue={r.status === 'succeeded' ? c.success : c.warning}
                title={r.name}
                subtitle={r.summary}
                time={timeAgo(r.at, lang)}
                last={i === arr.length - 1}
                onPress={() => router.push({ pathname: '/activity-detail', params: { kind: 'run', id: r.id } })}
              />
            ))}
          </View>
        ) : (
          <Text tone="secondary">{s.noActivity}</Text>
        )}
      </View>

      {suggestions.length > 0 && (
        <View style={{ gap: Spacing.two }}>
          <SectionHeader title={s.suggested} />
          {suggestions.map((m) => (
            <SenseCard key={m.id} sense={m} onPress={() => router.push(`/sense/${m.id}`)} onInstall={() => router.push(`/sense/${m.id}?install=1`)} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function expLabel(e: 'everyday' | 'accessibility' | 'work' | 'developer', s: ReturnType<typeof useS>) {
  return { everyday: s.expEveryday, accessibility: s.expAccessibility, work: s.expWork, developer: s.expDeveloper }[e];
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  orbWrap: { alignItems: 'center', justifyContent: 'center', minHeight: MinTouch },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  action: {
    width: '31.5%',
    flexGrow: 1,
    minHeight: 92,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
  },
});
