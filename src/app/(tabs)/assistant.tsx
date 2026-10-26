import { useRouter } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Divider, Section, Segmented, ToggleRow, rows } from '@/components/settings-rows';
import { Text } from '@/components/text';
import { BottomTabInset, Radius, Spacing, useColors } from '@/constants/theme';
import * as Earcons from '@/lib/earcons';
import { EMERGENCY_SERVICES, addEmergency, cleanPhone, dial, removeEmergency, useEmergency } from '@/lib/emergency';
import { FACES_ALLOWED, removeFace, useFaces } from '@/lib/faces';
import { LANG_NAMES, useI18n } from '@/lib/i18n';
import { removeMed, useMeds } from '@/lib/meds';
import { ago, forget, forgetAll, useMemory } from '@/lib/memory';
import { useSettings, type Settings } from '@/lib/settings';

/** Everything personal about the assistant: who to call, how it talks, what it remembers. */
export default function AssistantScreen() {
  const insets = useSafeAreaInsets();
  const c = useColors();
  const { settings, update } = useSettings();
  const { t, lang, dir } = useI18n();
  const router = useRouter();
  const memory = useMemory();
  const faces = useFaces();
  const meds = useMeds();
  const [advanced, setAdvanced] = useState(false);

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

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: c.surface, direction: dir }]}
      onMagicTap={() => router.push({ pathname: '/session', params: { mode: 'ask' } })}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + BottomTabInset + Spacing.four },
      ]}>
      <Text variant="display" accessibilityRole="header">
        {t.assistantTitle}
      </Text>

      <EmergencySection />

      <Section title={t.sectionVoiceLang}>
        <View style={rows.pad}>
          <Text variant="heading">{t.sectionLanguage}</Text>
          <Segmented options={langs} value={settings.lang} onChange={(lang) => update({ lang })} />
        </View>
        <Divider />
        <View style={rows.pad}>
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
      </Section>

      <Section title={t.sectionGeneral}>
        <LinkRow
          icon="person.crop.circle.badge.plus"
          label={t.contactsTitle}
          hint={t.contactsHint}
          onPress={() => router.push('/contacts')}
        />
        <Divider />
        <LinkRow
          icon="clock.arrow.circlepath"
          label={t.historyTitle}
          hint={t.historySubtitle}
          onPress={() => router.push('/history')}
        />
      </Section>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: advanced }}
        onPress={() => setAdvanced((v) => !v)}
        style={({ pressed }) => [styles.more, { backgroundColor: c.card, opacity: pressed ? 0.7 : 1 }]}>
        <Text variant="heading">{advanced ? t.lessSettings : t.moreSettings}</Text>
        <SymbolView name={advanced ? 'chevron.up' : 'chevron.down'} size={16} tintColor={c.text} weight="semibold" />
      </Pressable>

      {advanced && (
        <>
          <Section title={t.siriTitle}>
            <View style={[rows.pad, { flexDirection: 'row', alignItems: 'flex-start' }]}>
              <SymbolView name="mic.circle.fill" size={28} tintColor={c.accent} />
              <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
                {t.siriHint}
              </Text>
            </View>
          </Section>

          <Section title={t.sectionVoice}>
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
            <View style={rows.pad}>
              <Text variant="heading">{t.directions}</Text>
              <Segmented
                options={directionStyles}
                value={settings.directions}
                onChange={(directions) => update({ directions })}
              />
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
            <Divider />
            <ToggleRow
              icon="iphone.radiowaves.left.and.right"
              label={t.haptics}
              value={settings.haptics}
              onChange={(haptics) => update({ haptics })}
            />
          </Section>

          <Section title={t.sectionMeds}>
            <View style={rows.pad}>
              <Text variant="caption" tone="secondary">
                {t.medsHint}
              </Text>
            </View>
            {meds.length === 0 ? (
              <>
                <Divider />
                <View style={rows.pad}>
                  <Text tone="secondary">{t.medsEmpty}</Text>
                </View>
              </>
            ) : (
              meds.map((m) => (
                <View key={m.id}>
                  <Divider />
                  <View style={rows.row}>
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
            <View style={rows.pad}>
              <Text variant="caption" tone="secondary">
                {t.memoryHint}
              </Text>
            </View>
            {memory.length === 0 ? (
              <>
                <Divider />
                <View style={rows.pad}>
                  <Text tone="secondary">{t.memoryEmpty}</Text>
                </View>
              </>
            ) : (
              <>
                {memory.slice(0, 20).map((m) => (
                  <View key={m.id}>
                    <Divider />
                    <View style={rows.row}>
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
                <Pressable accessibilityRole="button" onPress={forgetAll} style={rows.row}>
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
                    <View style={rows.pad}>
                      <Text tone="secondary">{t.facesEmpty}</Text>
                    </View>
                  </>
                ) : (
                  faces.map((f) => (
                    <View key={f.id}>
                      <Divider />
                      <View style={rows.row}>
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

          <Section title={t.sectionAI}>
            {models.map((m, i) => (
              <View key={m.id}>
                {i > 0 && <Divider />}
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: settings.model === m.id }}
                  accessibilityLabel={`${m.label}, ${m.hint}`}
                  onPress={() => update({ model: m.id })}
                  style={rows.row}>
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

          <Section title={t.sectionOther}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.helpOther}
              accessibilityHint={t.helpOtherHint}
              onPress={() => router.push('/help-view')}
              style={rows.row}>
              <SymbolView name="person.2.wave.2" size={22} tintColor={c.text} />
              <View style={{ flex: 1 }}>
                <Text variant="heading">{t.helpOther}</Text>
                <Text variant="caption" tone="secondary">
                  {t.helpOtherHint}
                </Text>
              </View>
              <SymbolView
                name={dir === 'rtl' ? 'chevron.left' : 'chevron.right'}
                size={16}
                tintColor={c.textTertiary}
              />
            </Pressable>
            <Divider />
            <LinkRow
              icon="mic.badge.plus"
              label={t.redoSetup}
              hint={t.redoSetupHint}
              onPress={() => router.push('/welcome')}
            />
          </Section>
        </>
      )}
    </ScrollView>
  );
}

function LinkRow({ icon, label, hint, onPress }: { icon: SFSymbol; label: string; hint: string; onPress: () => void }) {
  const c = useColors();
  const { dir } = useI18n();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      style={rows.row}>
      <SymbolView name={icon} size={22} tintColor={c.text} />
      <View style={{ flex: 1 }}>
        <Text variant="heading">{label}</Text>
        <Text variant="caption" tone="secondary">
          {hint}
        </Text>
      </View>
      <SymbolView name={dir === 'rtl' ? 'chevron.left' : 'chevron.right'} size={16} tintColor={c.textTertiary} />
    </Pressable>
  );
}

function EmergencySection() {
  const c = useColors();
  const { t, dir } = useI18n();
  const contacts = useEmergency();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState(false);
  const align = { textAlign: dir === 'rtl' ? 'right' : 'left', writingDirection: dir } as const;

  const save = () => {
    const number = cleanPhone(phone);
    if (!name.trim() || !number) {
      Earcons.play('error');
      setError(true);
      return;
    }
    addEmergency(name, number);
    setName('');
    setPhone('');
    setError(false);
    setAdding(false);
  };

  return (
    <Section title={t.sectionEmergency}>
      <View style={rows.pad}>
        <Text variant="caption" tone="secondary">
          {t.emergencyHint}
        </Text>
      </View>
      {contacts.map((e) => (
        <View key={e.id}>
          <Divider />
          <View style={rows.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.emergencyCall(e.name)}
              accessibilityHint={e.phone}
              onPress={() => dial(e.phone)}
              style={styles.callArea}>
              <View style={[styles.callIcon, { backgroundColor: c.success }]}>
                <SymbolView name="phone.fill" size={20} tintColor="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="heading">{e.name}</Text>
                <Text
                  variant="caption"
                  tone="secondary"
                  style={{ writingDirection: 'ltr', textAlign: align.textAlign }}>
                  {e.phone}
                </Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.emergencyRemove(e.name)}
              hitSlop={8}
              onPress={() => removeEmergency(e.id)}>
              <SymbolView name="trash" size={20} tintColor={c.textSecondary} />
            </Pressable>
          </View>
        </View>
      ))}
      <Divider />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.emergencyCall(t.emergencyServices)}
        accessibilityHint={EMERGENCY_SERVICES}
        onPress={() => dial(EMERGENCY_SERVICES)}
        style={rows.row}>
        <View style={[styles.callIcon, { backgroundColor: c.stopText }]}>
          <SymbolView name="cross.case.fill" size={20} tintColor="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="heading">{t.emergencyServices}</Text>
          <Text variant="caption" tone="secondary">
            {EMERGENCY_SERVICES}
          </Text>
        </View>
      </Pressable>
      <Divider />
      {adding ? (
        <View style={rows.pad}>
          <View style={styles.chips}>
            {t.emergencyRelations.map((r) => (
              <Pressable
                key={r}
                accessibilityRole="button"
                accessibilityState={{ selected: name === r }}
                onPress={() => setName(r)}
                style={[styles.chip, { backgroundColor: name === r ? c.text : c.surface }]}>
                <Text variant="caption" style={{ color: name === r ? c.background : c.text }}>
                  {r}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t.emergencyName}
            placeholderTextColor={c.textTertiary}
            accessibilityLabel={t.emergencyName}
            returnKeyType="next"
            style={[styles.input, align, { color: c.text, backgroundColor: c.surface }]}
          />
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder={t.emergencyPhone}
            placeholderTextColor={c.textTertiary}
            accessibilityLabel={t.emergencyPhone}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            onSubmitEditing={save}
            style={[styles.input, align, { color: c.text, backgroundColor: c.surface }]}
          />
          {error && <Text style={{ color: c.stopText }}>{t.emergencyInvalid}</Text>}
          <Pressable
            accessibilityRole="button"
            onPress={save}
            style={({ pressed }) => [styles.pill, { backgroundColor: c.text, opacity: pressed ? 0.75 : 1 }]}>
            <Text variant="heading" style={{ color: c.background }}>
              {t.emergencyAdd}
            </Text>
          </Pressable>
        </View>
      ) : (
        <Pressable accessibilityRole="button" onPress={() => setAdding(true)} style={rows.row}>
          <SymbolView name="plus.circle.fill" size={24} tintColor={c.accent} />
          <Text variant="heading" style={{ flex: 1, color: c.accent }}>
            {t.emergencyNew}
          </Text>
        </Pressable>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: Spacing.three, gap: Spacing.four },
  callArea: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  callIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { minHeight: 44, paddingHorizontal: Spacing.three, borderRadius: Radius.full, justifyContent: 'center' },
  input: { minHeight: 52, borderRadius: Radius.sm, paddingHorizontal: Spacing.three, fontSize: 17 },
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minHeight: 56,
    borderRadius: Radius.md,
  },
  pill: { height: 56, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
});
