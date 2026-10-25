import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { BottomTabInset, OrbColors, Radius, Spacing, useColors } from '@/constants/theme';
import { FACES_ALLOWED, removeFace, useFaces } from '@/lib/faces';
import { useGlasses, type GlassesStatus } from '@/lib/glasses';
import { LANG_NAMES, useI18n } from '@/lib/i18n';
import { removeMed, useMeds } from '@/lib/meds';
import { ago, forget, forgetAll, useMemory } from '@/lib/memory';
import { useSettings, type Settings } from '@/lib/settings';

const DOT: Record<GlassesStatus, string> = {
  unsupported: '#FF9F0A',
  unregistered: '#FF9F0A',
  registering: '#FF9F0A',
  needsCamera: '#FF9F0A',
  ready: '#34C759',
};

export default function GlassesScreen() {
  const insets = useSafeAreaInsets();
  const c = useColors();
  const { settings, update } = useSettings();
  const { t, lang, dir } = useI18n();
  const router = useRouter();
  const glasses = useGlasses();
  const memory = useMemory();
  const faces = useFaces();
  const meds = useMeds();
  const status = t.glassesStatus[glasses.status];

  const speeds: { id: Settings['speed']; label: string }[] = [
    { id: 'slow', label: t.slow },
    { id: 'normal', label: t.normal },
    { id: 'fast', label: t.fast },
  ];
  const models: { id: Settings['model']; label: string; hint: string }[] = [
    { id: 'smart', label: t.modelSmart, hint: t.modelSmartHint },
    { id: 'fast', label: t.modelFast, hint: t.modelFastHint },
  ];
  const langs = (['ar', 'en'] as const).map((id) => ({ id, label: LANG_NAMES[id] }));
  const directionStyles: { id: Settings['directions']; label: string }[] = [
    { id: 'clock', label: t.directionsClock },
    { id: 'simple', label: t.directionsSimple },
  ];
  const intervals = ([3, 5, 10] as const).map((n) => ({ id: String(n) as '3' | '5' | '10', label: t.seconds(n) }));

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: c.surface, direction: dir }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + BottomTabInset + Spacing.four },
      ]}>
      <Text variant="display" accessibilityRole="header">
        {t.devices}
      </Text>

      {/* Device hero, modelled after Meta AI's Devices card */}
      <View
        style={[styles.device, { backgroundColor: c.card, shadowColor: c.shadow }]}
        accessible
        accessibilityLabel={`${t.rayban}, ${t.firstGen}. ${status.badge}. ${status.note}`}>
        <View style={styles.deviceHead}>
          <View style={{ gap: Spacing.half }}>
            <Text variant="title">Ray-Ban Meta</Text>
            <Text variant="caption" tone="secondary">
              {t.firstGen}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: c.surface }]}>
            <View style={[styles.dot, { backgroundColor: DOT[glasses.status] }]} />
            <Text variant="caption">{status.badge}</Text>
          </View>
        </View>
        <LinearGradient
          colors={[`${OrbColors[0]}18`, `${OrbColors[2]}22`, `${OrbColors[1]}18`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}>
          <SymbolView name="eyeglasses" size={120} tintColor={c.text} weight="light" />
        </LinearGradient>
        <View style={[styles.note, { backgroundColor: c.surface }]}>
          <SymbolView
            name={glasses.status === 'ready' ? 'eyeglasses' : 'iphone.rear.camera'}
            size={22}
            tintColor={c.accent}
          />
          <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
            {glasses.error ?? status.note}
          </Text>
        </View>
        {status.action && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={status.action}
            accessibilityHint={t.opensMetaAI}
            accessibilityState={{ busy: glasses.busy }}
            disabled={glasses.busy}
            onPress={glasses.connect}
            style={({ pressed }) => [
              styles.connect,
              { backgroundColor: c.accent, opacity: pressed || glasses.busy ? 0.6 : 1 },
            ]}>
            <Text variant="heading" center style={{ color: c.onAccent }}>
              {status.action}
            </Text>
          </Pressable>
        )}
      </View>

      <Section title={t.siriTitle}>
        <View style={[styles.pad, { flexDirection: 'row', alignItems: 'flex-start' }]}>
          <SymbolView name="mic.circle.fill" size={28} tintColor={c.accent} />
          <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
            {t.siriHint}
          </Text>
        </View>
      </Section>

      <Section title={t.sectionLanguage}>
        <View style={styles.pad}>
          <Segmented options={langs} value={settings.lang} onChange={(lang) => update({ lang })} />
        </View>
      </Section>

      <Section title={t.sectionVoice}>
        <View style={styles.pad}>
          <Text variant="heading">{t.speechSpeed}</Text>
          <Segmented options={speeds} value={settings.speed} onChange={(speed) => update({ speed })} />
        </View>
        <Divider />
        <ToggleRow
          icon="text.alignright"
          label={t.detailed}
          hint={t.detailedHint}
          value={settings.detail}
          onChange={(detail) => update({ detail })}
        />
        <Divider />
        <ToggleRow
          icon="arrow.triangle.2.circlepath"
          label={t.continuous}
          hint={t.continuousHint}
          value={settings.continuous}
          onChange={(continuous) => update({ continuous })}
        />
        <Divider />
        <ToggleRow
          icon="speaker.wave.2"
          label={t.sounds}
          hint={t.soundsHint}
          value={settings.sounds}
          onChange={(sounds) => update({ sounds })}
        />
        <Divider />
        <ToggleRow
          icon="viewfinder"
          label={t.framingSetting}
          hint={t.framingHint}
          value={settings.framing}
          onChange={(framing) => update({ framing })}
        />
        <Divider />
        <ToggleRow
          icon="accessibility"
          label={t.voiceOverSetting}
          hint={t.voiceOverHint}
          value={settings.voiceOver}
          onChange={(voiceOver) => update({ voiceOver })}
        />
        <Divider />
        <View style={styles.pad}>
          <Text variant="heading">{t.directions}</Text>
          <Segmented options={directionStyles} value={settings.directions} onChange={(directions) => update({ directions })} />
          <Text variant="caption" tone="secondary">
            {t.directionsHint}
          </Text>
        </View>
        <Divider />
        <ToggleRow
          icon="hand.raised"
          label={t.bargeIn}
          hint={`${t.bargeInHint}. ${t.voiceCommandsHint}`}
          value={settings.bargeIn}
          onChange={(bargeIn) => update({ bargeIn })}
        />
      </Section>

      <Section title={t.sectionMeds}>
        <View style={styles.pad}>
          <Text variant="caption" tone="secondary">
            {t.medsHint}
          </Text>
        </View>
        {meds.length === 0 ? (
          <>
            <Divider />
            <View style={styles.pad}>
              <Text tone="secondary">{t.medsEmpty}</Text>
            </View>
          </>
        ) : (
          meds.map((m) => (
            <View key={m.id}>
              <Divider />
              <View style={styles.row}>
                <View style={{ flex: 1 }} accessible accessibilityLabel={m.note ? `${m.name}: ${m.note}` : m.name}>
                  <Text variant="heading">{m.name}</Text>
                  {!!m.note && (
                    <Text variant="caption" tone="secondary">
                      {m.note}
                    </Text>
                  )}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t.medRemove(m.name)}
                  hitSlop={8}
                  onPress={() => removeMed(m.id)}>
                  <SymbolView name="trash" size={20} tintColor={c.textSecondary} />
                </Pressable>
              </View>
            </View>
          ))
        )}
      </Section>

      <Section title={t.sectionMemory}>
        <View style={styles.pad}>
          <Text variant="caption" tone="secondary">
            {t.memoryHint}
          </Text>
        </View>
        {memory.length === 0 ? (
          <>
            <Divider />
            <View style={styles.pad}>
              <Text tone="secondary">{t.memoryEmpty}</Text>
            </View>
          </>
        ) : (
          <>
            {memory.slice(0, 20).map((m) => (
              <View key={m.id}>
                <Divider />
                <View style={styles.row}>
                  <View
                    style={{ flex: 1 }}
                    accessible
                    accessibilityLabel={`${m.label}: ${m.note}. ${m.kind === 'remember' ? t.memoryRemembered : t.memorySeen} ${ago(m.at, lang)}`}>
                    <Text variant="heading">{m.label}</Text>
                    <Text variant="caption" tone="secondary">
                      {m.note} · {m.kind === 'remember' ? t.memoryRemembered : t.memorySeen} {ago(m.at, lang)}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t.memoryForget(m.label)}
                    hitSlop={8}
                    onPress={() => forget(m.id)}>
                    <SymbolView name="trash" size={20} tintColor={c.textSecondary} />
                  </Pressable>
                </View>
              </View>
            ))}
            <Divider />
            <Pressable accessibilityRole="button" onPress={forgetAll} style={styles.row}>
              <Text variant="heading" style={{ color: c.stopText }}>
                {t.memoryClear}
              </Text>
            </Pressable>
          </>
        )}
      </Section>

      {FACES_ALLOWED && (
        <Section title={t.sectionFaces}>
          <ToggleRow
            icon="person.crop.square"
            label={t.faces}
            hint={t.facesHint}
            value={settings.faces}
            onChange={(on) => update({ faces: on })}
          />
          {settings.faces &&
            (faces.length === 0 ? (
              <>
                <Divider />
                <View style={styles.pad}>
                  <Text tone="secondary">{t.facesEmpty}</Text>
                </View>
              </>
            ) : (
              faces.map((f) => (
                <View key={f.id}>
                  <Divider />
                  <View style={styles.row}>
                    <Text variant="heading" style={{ flex: 1 }}>
                      {f.name}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t.faceRemove(f.name)}
                      hitSlop={8}
                      onPress={() => removeFace(f.id)}>
                      <SymbolView name="trash" size={20} tintColor={c.textSecondary} />
                    </Pressable>
                  </View>
                </View>
              ))
            ))}
        </Section>
      )}

      <Section title={t.sectionLive}>
        <View style={styles.pad}>
          <Text variant="heading">{t.liveEvery}</Text>
          <Segmented
            options={intervals}
            value={String(settings.liveEvery) as '3' | '5' | '10'}
            onChange={(v) => update({ liveEvery: Number(v) as Settings['liveEvery'] })}
          />
          <Text variant="caption" tone="secondary">
            {t.liveHint}
          </Text>
        </View>
      </Section>

      <Section title={t.sectionAI}>
        {models.map((m, i) => (
          <View key={m.id}>
            {i > 0 && <Divider />}
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: settings.model === m.id }}
              accessibilityLabel={`${m.label}, ${m.hint}`}
              onPress={() => update({ model: m.id })}
              style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text variant="heading">{m.label}</Text>
                <Text variant="caption" tone="secondary">
                  {m.hint}
                </Text>
              </View>
              <SymbolView
                name={settings.model === m.id ? 'checkmark.circle.fill' : 'circle'}
                size={24}
                tintColor={settings.model === m.id ? c.accent : c.textTertiary}
              />
            </Pressable>
          </View>
        ))}
      </Section>

      <Section title={t.sectionGeneral}>
        <ToggleRow
          icon="iphone.radiowaves.left.and.right"
          label={t.haptics}
          value={settings.haptics}
          onChange={(haptics) => update({ haptics })}
        />
        <Divider />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.contactsTitle}
          accessibilityHint={t.contactsHint}
          onPress={() => router.push('/contacts')}
          style={styles.row}>
          <SymbolView name="person.crop.circle.badge.plus" size={22} tintColor={c.text} />
          <View style={{ flex: 1 }}>
            <Text variant="heading">{t.contactsTitle}</Text>
            <Text variant="caption" tone="secondary">
              {t.contactsHint}
            </Text>
          </View>
          <SymbolView name={dir === 'rtl' ? 'chevron.left' : 'chevron.right'} size={16} tintColor={c.textTertiary} />
        </Pressable>
        <Divider />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.helpOther}
          accessibilityHint={t.helpOtherHint}
          onPress={() => router.push('/help-view')}
          style={styles.row}>
          <SymbolView name="person.2.wave.2" size={22} tintColor={c.text} />
          <View style={{ flex: 1 }}>
            <Text variant="heading">{t.helpOther}</Text>
            <Text variant="caption" tone="secondary">
              {t.helpOtherHint}
            </Text>
          </View>
          <SymbolView name={dir === 'rtl' ? 'chevron.left' : 'chevron.right'} size={16} tintColor={c.textTertiary} />
        </Pressable>
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={{ gap: Spacing.two }}>
      <Text variant="caption" tone="secondary" accessibilityRole="header" style={{ paddingHorizontal: Spacing.one }}>
        {title}
      </Text>
      <View style={[styles.card, { backgroundColor: c.card }]}>{children}</View>
    </View>
  );
}

function Divider() {
  const c = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginHorizontal: Spacing.three }} />;
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
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
            onPress={() => onChange(o.id)}
            style={[
              styles.segmentItem,
              selected && [styles.segmentSelected, { backgroundColor: c.card, shadowColor: c.shadow }],
            ]}>
            <Text variant="heading" center tone={selected ? 'primary' : 'secondary'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ToggleRow({
  icon,
  label,
  hint,
  value,
  onChange,
}: {
  icon: SFSymbol;
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const c = useColors();
  return (
    <View style={styles.row}>
      <SymbolView name={icon} size={22} tintColor={c.text} />
      <View style={{ flex: 1 }}>
        <Text variant="heading">{label}</Text>
        {!!hint && (
          <Text variant="caption" tone="secondary">
            {hint}
          </Text>
        )}
      </View>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: c.accent }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: Spacing.three, gap: Spacing.four },
  device: {
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.three,
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  deviceHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    height: 32,
    borderRadius: Radius.full,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  hero: { height: 170, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  note: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.sm },
  connect: { minHeight: 52, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: Radius.md, overflow: 'hidden' },
  pad: { padding: Spacing.three, gap: Spacing.three },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    minHeight: 64,
    paddingVertical: Spacing.two,
  },
  segment: { flexDirection: 'row', padding: 3, borderRadius: Radius.sm, gap: 3 },
  segmentItem: { flex: 1, minHeight: 44, borderRadius: Radius.sm - 3, alignItems: 'center', justifyContent: 'center' },
  segmentSelected: { shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
});
