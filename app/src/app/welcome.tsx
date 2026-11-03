import { useKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Orb, type OrbState } from '@/components/orb';
import { Text } from '@/components/text';
import { Radius, Spacing, useColors } from '@/constants/theme';
import { transcribe } from '@/lib/assist';
import { addEmergency, contactFromSpeech } from '@/lib/emergency';
import { useI18n } from '@/lib/i18n';
import { useListen } from '@/lib/listen';
import { SPEECH_RATE, useSettings } from '@/lib/settings';
import * as Voice from '@/lib/voice';

// Arabic letters aren't \w, so the end of a word is anything that isn't a letter.
const LATER = /^(لا|لاحقا|بعدين|مو الحين|ما ابي|ما أبي|لأ|مافي|ما فيه|no|later|skip|not now)(?![\u0621-\u064Aa-z])/i;
const NAME_PREFIX = /^(اسمي|انا|أنا|ناديني|سمني|my name is|call me|i'?m|i am)\s+/i;

/**
 * First launch, by voice: asks what to call the user and for one emergency number, then
 * explains the one gesture they need. Everything can be changed later in "My assistant".
 */
export default function WelcomeScreen() {
  useKeepAwake();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const { settings, update } = useSettings();
  const { t, lang, dir, speechLang } = useI18n();
  const { listen, cancel } = useListen();
  const [orb, setOrb] = useState<OrbState>('idle');
  const [line, setLine] = useState('');
  const alive = useRef(true);

  const say = useCallback(
    (text: string) =>
      new Promise<void>((resolve) => {
        if (!alive.current) return resolve();
        setLine(text);
        setOrb('speaking');
        const timer = setTimeout(resolve, 2500 + text.length * 90);
        Voice.speak(text, {
          language: speechLang,
          rate: SPEECH_RATE[settings.speed],
          onDone: () => {
            clearTimeout(timer);
            resolve();
          },
        });
      }),
    [settings.speed, speechLang],
  );

  /** One spoken reply as text, or null if nothing was said or it couldn't be understood. */
  const hear = useCallback(async () => {
    if (!alive.current) return null;
    setOrb('listening');
    const audio = await listen();
    if (!audio || !alive.current) return null;
    setOrb('thinking');
    try {
      return (await transcribe(audio, lang))?.trim() || null;
    } catch {
      return null;
    }
  }, [lang, listen]);

  const finish = useCallback(
    (patch: { name?: string } = {}) => {
      alive.current = false;
      cancel();
      Voice.stop();
      update({ onboarded: true, ...patch });
      router.back();
    },
    [cancel, router, update],
  );

  useEffect(() => {
    alive.current = true;
    (async () => {
      await say(t.welcomeIntro);
      const reply = await hear();
      const name =
        reply && !LATER.test(reply)
          ? reply
              .replace(/[.,!?؟،]/g, '')
              .replace(NAME_PREFIX, '')
              .split(/\s+/)
              .slice(0, 3)
              .join(' ')
          : '';
      if (name) {
        update({ name });
        await say(t.welcomeNice(name));
      }

      await say(t.welcomeEmergencyAsk);
      const said = await hear();
      const contact = said && !LATER.test(said) ? contactFromSpeech(said) : null;
      if (contact) {
        const who = contact.name || t.emergencyDefaultName;
        addEmergency(who, contact.phone);
        await say(t.welcomeSaved(who, contact.phone.split('').join(' ')));
      } else {
        await say(t.welcomeLater);
      }

      await say(t.welcomeDone);
      if (alive.current) finish(name ? { name } : {});
    })();
    return () => {
      alive.current = false;
      cancel();
      Voice.stop();
    };
    // Runs the conversation once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: c.background,
          direction: dir,
          paddingTop: insets.top + Spacing.four,
          paddingBottom: insets.bottom + Spacing.three,
        },
      ]}>
      <View style={styles.center} accessible accessibilityLiveRegion="polite" accessibilityLabel={line}>
        <Orb size={200} state={orb} />
        <Text variant="spoken" center>
          {line}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityHint={t.welcomeSkipHint}
        onPress={() => finish()}
        style={({ pressed }) => [styles.skip, { backgroundColor: c.surface, opacity: pressed ? 0.7 : 1 }]}>
        <Text variant="heading">{t.welcomeSkip}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: Spacing.four },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.five,
  },
  skip: {
    minHeight: 60,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
