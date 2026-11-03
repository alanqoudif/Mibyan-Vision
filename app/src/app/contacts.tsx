import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CircleButton } from '@/components/chrome';
import { Text } from '@/components/text';
import { Radius, Spacing, useColors } from '@/constants/theme';
import * as Earcons from '@/lib/earcons';
import { createInvite, removeContact, spokenCode, useContacts } from '@/lib/helper';
import { useI18n } from '@/lib/i18n';
import { SPEECH_RATE, useSettings } from '@/lib/settings';
import * as Voice from '@/lib/voice';

/**
 * Trusted helpers. Adding one makes a 6-digit invite that is read out and shared; the helper
 * enters it once in their own copy of the app. After that, "call mom to see with me" (or the
 * Siri shortcut) notifies them directly.
 */
export default function ContactsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const { settings } = useSettings();
  const { t, dir, speechLang } = useI18n();
  const contacts = useContacts();
  const [invite, setInvite] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const say = (text: string) => Voice.speakNow(text, { language: speechLang, rate: SPEECH_RATE[settings.speed] });

  const add = async () => {
    setError(null);
    try {
      const code = await createInvite();
      setInvite(code);
      say(t.inviteSpoken(spokenCode(code)));
      Share.share({ message: t.inviteMessage(code) }).catch(() => {});
    } catch {
      Earcons.play('error');
      setError(t.errNetwork);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: c.background, direction: dir, paddingTop: insets.top + Spacing.two }]}>
      <View style={styles.topBar}>
        <CircleButton icon="xmark" label={t.close} onPress={() => router.back()} />
        <Text variant="heading" accessibilityRole="header">
          {t.contactsTitle}
        </Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}>
        <Text tone="secondary">{t.contactsIntro}</Text>

        {contacts.length === 0 ? (
          <Text tone="secondary">{t.contactsEmpty}</Text>
        ) : (
          contacts.map((p) => (
            <View key={p.id} style={[styles.row, { backgroundColor: c.surface }]}>
              <View style={{ flex: 1 }} accessible accessibilityLabel={p.reachable ? p.name : `${p.name}. ${t.contactNoAlerts}`}>
                <Text variant="heading">{p.name}</Text>
                {!p.reachable && (
                  <Text variant="caption" tone="secondary">
                    {t.contactNoAlerts}
                  </Text>
                )}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.contactCall(p.name)}
                hitSlop={8}
                onPress={() => router.replace({ pathname: '/helper', params: { notify: String(p.id) } })}>
                <SymbolView name="video.fill" size={22} tintColor={c.text} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t.contactRemove(p.name)}
                hitSlop={8}
                onPress={() => removeContact(p.id).catch(() => setError(t.errNetwork))}>
                <SymbolView name="trash" size={20} tintColor={c.textSecondary} />
              </Pressable>
            </View>
          ))
        )}

        {invite && (
          <View
            style={[styles.invite, { backgroundColor: c.surface }]}
            accessible
            accessibilityLabel={t.inviteLabel(spokenCode(invite))}>
            <Text variant="caption" tone="secondary">
              {t.inviteTitle}
            </Text>
            <Text variant="display" center style={styles.code}>
              {invite}
            </Text>
            <Text variant="caption" tone="secondary" center>
              {t.inviteHowTo}
            </Text>
          </View>
        )}
        {!!error && <Text style={{ color: c.stopText }}>{error}</Text>}

        <Pressable
          accessibilityRole="button"
          onPress={add}
          style={({ pressed }) => [styles.pill, { backgroundColor: c.text, opacity: pressed ? 0.75 : 1 }]}>
          <SymbolView name="person.crop.circle.badge.plus" size={20} tintColor={c.background} weight="semibold" />
          <Text variant="heading" style={{ color: c.background }}>
            {invite ? t.inviteAgain : t.contactAdd}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
  },
  content: { padding: Spacing.four, gap: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four, padding: Spacing.three, minHeight: 60, borderRadius: Radius.md },
  invite: { borderRadius: Radius.lg, padding: Spacing.four, gap: Spacing.two, alignItems: 'center' },
  code: { letterSpacing: 6, fontVariant: ['tabular-nums'] },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: 60,
    borderRadius: Radius.full,
  },
});
