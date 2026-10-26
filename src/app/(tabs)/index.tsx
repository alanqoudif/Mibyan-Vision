import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassesPill } from '@/components/chrome';
import { Orb } from '@/components/orb';
import { Text } from '@/components/text';
import { BottomTabInset, Radius, Spacing, useColors } from '@/constants/theme';
import { useGlasses } from '@/lib/glasses';
import { useContacts } from '@/lib/helper';
import { useI18n } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';

/**
 * Voice first: the whole screen is one button. The user says what they need ("read this",
 * "how much money is this") and the session picks the right tool from what they said.
 */
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const { t, dir } = useI18n();
  const { settings } = useSettings();
  const glasses = useGlasses();
  // With saved helpers, one tap alerts them; otherwise it falls back to a code to share.
  const hasHelpers = useContacts().some((p) => p.reachable);

  useEffect(() => {
    if (!settings.onboarded) router.push('/welcome');
    // Only on first mount; onboarding sets the flag itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const h = new Date().getHours();
  const greeting = (h < 12 ? t.helloMorning : h < 18 ? t.helloAfternoon : t.helloEvening)(settings.name);
  const talk = () => router.push({ pathname: '/session', params: { mode: 'ask' } });

  return (
    <View style={[styles.root, { backgroundColor: c.background, direction: dir }]} onMagicTap={talk}>
      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.two }]}>
        <GlassesPill connected={glasses.status === 'ready'} />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.talkButton}
        accessibilityHint={t.talkHint}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          talk();
        }}
        style={({ pressed }) => [styles.talk, { opacity: pressed ? 0.8 : 1 }]}>
        <Text variant="title" center>
          {greeting}
        </Text>
        <Orb size={220} />
        <Text variant="title" center>
          {t.talkButton}
        </Text>
        <Text tone="secondary" center>
          {t.talkExamples}
        </Text>
      </Pressable>

      <View style={[styles.actions, { paddingBottom: insets.bottom + BottomTabInset + Spacing.three }]}>
        <BigButton
          icon="dot.radiowaves.left.and.right"
          label={t.liveShort}
          hint={t.liveSubtitle}
          onPress={() => router.push('/live')}
        />
        <BigButton
          icon="person.wave.2.fill"
          label={t.helperShort}
          hint={t.helperCardSubtitle}
          onPress={() => router.push(hasHelpers ? { pathname: '/helper', params: { notify: 'all' } } : '/helper')}
        />
        <BigButton
          icon="square.grid.2x2.fill"
          label={t.toolsTitle}
          hint={t.toolsHint}
          onPress={() => router.push('/tools')}
        />
      </View>
    </View>
  );
}

function BigButton({
  icon,
  label,
  hint,
  onPress,
}: {
  icon: SFSymbol;
  label: string;
  hint: string;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      style={({ pressed }) => [styles.big, { backgroundColor: c.surface, opacity: pressed ? 0.7 : 1 }]}>
      <SymbolView name={icon} size={28} tintColor={c.text} />
      <Text variant="heading" center>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: 'row', paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
  talk: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.four, paddingHorizontal: Spacing.four },
  actions: { flexDirection: 'row', gap: Spacing.three, paddingHorizontal: Spacing.three },
  big: {
    flex: 1,
    minHeight: 96,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
  },
});
