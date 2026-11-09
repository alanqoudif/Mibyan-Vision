import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Button, Chip, Divider, Group, LargeTitle, Row, Screen, Segmented, TextField, Toggle } from '@/components/ui';
import { Accents, Spacing, useColors } from '@/constants/theme';
import { useChatS } from '@/lib/chat-strings';
import { useI18n } from '@/lib/i18n';
import { SPEECH_RATE, useSettings, type Accent, type Settings } from '@/lib/settings';
import * as Voice from '@/lib/voice';

const ACCENTS = Object.keys(Accents) as Accent[];

/** Personalization: what the assistant knows, how it answers, how it looks and sounds. */
export default function PersonalizeScreen() {
  const cs = useChatS();
  const c = useColors();
  const { speechLang } = useI18n();
  const { settings, update } = useSettings();

  const style = settings.responseStyle;
  const hasPreset = (p: string) => style.split(/[،,]\s*/).map((x) => x.trim()).includes(p);
  const togglePreset = (p: string) => {
    const parts = style.split(/[،,]\s*/).map((x) => x.trim()).filter(Boolean);
    const next = hasPreset(p) ? parts.filter((x) => x !== p) : [...parts, p];
    update({ responseStyle: next.join('، ') });
  };

  const tryVoice = (speed: Settings['speed'] = settings.speed) => {
    Voice.stop();
    Voice.speak(cs.testVoiceLine, { language: speechLang, rate: SPEECH_RATE[speed] });
  };

  return (
    <Screen>
      <LargeTitle sub={cs.instructionsNote}>{cs.personalize}</LargeTitle>

      <Group>
        <View style={styles.block}>
          <Text variant="heading">{cs.aboutMe}</Text>
          <TextField multiline value={settings.aboutMe} onChange={(aboutMe) => update({ aboutMe })} placeholder={cs.aboutMePlaceholder} />
        </View>
        <Divider />
        <View style={styles.block}>
          <Text variant="heading">{cs.responseStyle}</Text>
          <View style={styles.wrap}>
            {cs.stylePresets.map((p) => (
              <Chip key={p} label={p} selected={hasPreset(p)} onPress={() => togglePreset(p)} />
            ))}
          </View>
          <TextField multiline value={style} onChange={(responseStyle) => update({ responseStyle })} placeholder={cs.responsePlaceholder} />
        </View>
      </Group>

      <Group title={cs.accent}>
        <View style={[styles.block, styles.swatches]} accessibilityRole="radiogroup">
          {ACCENTS.map((a) => {
            const on = settings.accent === a;
            return (
              <Pressable
                key={a}
                accessibilityRole="radio"
                accessibilityLabel={cs.accentNames[a]}
                accessibilityState={{ selected: on }}
                onPress={() => {
                  Haptics.selectionAsync();
                  update({ accent: a });
                }}
                style={styles.swatchHit}>
                <View style={[styles.swatchRing, { borderColor: on ? c.text : 'transparent' }]}>
                  <View style={[styles.swatch, { backgroundColor: Accents[a].swatch }]}>
                    {on ? <SymbolView name="checkmark" size={18} tintColor="#FFFFFF" weight="bold" /> : null}
                  </View>
                </View>
                <Text variant="label" tone={on ? 'primary' : 'secondary'} center>
                  {cs.accentNames[a]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Group>

      <Group title={cs.voice}>
        <View style={styles.block}>
          <Text variant="heading">{cs.speed}</Text>
          <Segmented
            value={settings.speed}
            options={(['slow', 'normal', 'fast'] as const).map((id) => ({ id, label: cs.speedNames[id] }))}
            onChange={(speed) => {
              update({ speed });
              tryVoice(speed);
            }}
          />
        </View>
        <Divider />
        <Row
          icon="speaker.wave.2.fill"
          hue={c.accent}
          title={cs.autoSpeak}
          trailing={<Toggle value={settings.speakResults} onChange={(speakResults) => update({ speakResults })} label={cs.autoSpeak} />}
        />
        <View style={[styles.block, { paddingTop: 0 }]}>
          <Button variant="secondary" icon="play.fill" label={cs.testVoice} onPress={() => tryVoice()} />
        </View>
      </Group>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { padding: Spacing.three, gap: Spacing.two },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  swatches: { flexDirection: 'row', justifyContent: 'space-between' },
  swatchHit: { alignItems: 'center', gap: Spacing.one, minWidth: 56 },
  swatchRing: { padding: 3, borderRadius: 28, borderWidth: 2 },
  swatch: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
