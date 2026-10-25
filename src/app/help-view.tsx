import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CircleButton } from '@/components/chrome';
import { Text } from '@/components/text';
import { Radius, Spacing, useColors } from '@/constants/theme';
import { HelperEnded, joinSharing, sayToUser, viewSharing } from '@/lib/helper';
import { useI18n } from '@/lib/i18n';

const VIEW_EVERY_MS = 1000;

/**
 * The helper's side of "someone see with me": enter the code the blind user shared, watch
 * their glasses view, and send short directions that are read aloud to them.
 */
export default function HelpViewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const { t, dir } = useI18n();

  const [input, setInput] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const [frame, setFrame] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sent, setSent] = useState<string[]>([]);
  const alive = useRef(true);

  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  // Poll the latest frame while joined.
  useEffect(() => {
    if (!code) return;
    let stop = false;
    (async () => {
      while (!stop && alive.current) {
        try {
          const v = await viewSharing(code);
          if (v.ended) {
            setEnded(true);
            break;
          }
          if (v.frame) setFrame(v.frame);
        } catch {}
        await sleep(VIEW_EVERY_MS);
      }
    })();
    return () => {
      stop = true;
    };
  }, [code]);

  const join = async () => {
    const digits = input.replace(/\D/g, '');
    if (digits.length !== 8) return setError(t.helpViewBadCode);
    setError(null);
    try {
      await joinSharing(digits);
      setEnded(false);
      setCode(digits);
    } catch (e) {
      setError(e instanceof HelperEnded ? t.helpViewNotFound : t.errNetwork);
    }
  };

  const send = async (body: string) => {
    if (!code || !body.trim()) return;
    try {
      await sayToUser(code, body.trim());
      setSent((s) => [body.trim(), ...s].slice(0, 10));
      setText('');
    } catch (e) {
      if (e instanceof HelperEnded) setEnded(true);
      else setError(t.errNetwork);
    }
  };

  const inputStyle = [
    styles.input,
    { color: c.text, backgroundColor: c.surface, textAlign: dir === 'rtl' ? 'right' : 'left', writingDirection: dir },
  ] as const;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: c.background, direction: dir, paddingTop: insets.top + Spacing.two }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.topBar}>
        <CircleButton icon="xmark" label={t.close} onPress={() => router.back()} />
        <Text variant="heading">{t.helpViewTitle}</Text>
        <View style={{ width: 48 }} />
      </View>

      {!code ? (
        <View style={styles.content}>
          <Text tone="secondary">{t.helpViewIntro}</Text>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="1234 5678"
            placeholderTextColor={c.textTertiary}
            keyboardType="number-pad"
            maxLength={9}
            accessibilityLabel={t.helpViewCode}
            style={[...inputStyle, styles.codeInput]}
            onSubmitEditing={join}
          />
          {!!error && <Text style={{ color: c.stopText }}>{error}</Text>}
          <Pressable
            accessibilityRole="button"
            onPress={join}
            style={({ pressed }) => [styles.pill, { backgroundColor: c.text, opacity: pressed ? 0.75 : 1 }]}>
            <Text variant="heading" style={{ color: c.background }}>
              {t.helpViewJoin}
            </Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.frame, { backgroundColor: c.surface }]}>
            {frame ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${frame}` }}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                transition={150}
                accessibilityLabel={t.helpViewFrame}
              />
            ) : (
              <Text tone="secondary">{t.helpViewWaiting}</Text>
            )}
          </View>
          {ended && <Text style={{ color: c.stopText }}>{t.helperEnded}</Text>}
          {!!error && <Text style={{ color: c.stopText }}>{error}</Text>}

          <View style={styles.quick}>
            {t.helpViewQuick.map((q) => (
              <Pressable
                key={q}
                accessibilityRole="button"
                disabled={ended}
                onPress={() => send(q)}
                style={({ pressed }) => [styles.chip, { backgroundColor: c.surface, opacity: ended ? 0.4 : pressed ? 0.6 : 1 }]}>
                <Text variant="heading">{q}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.row}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t.helpViewSay}
              placeholderTextColor={c.textTertiary}
              accessibilityLabel={t.helpViewSay}
              editable={!ended}
              maxLength={300}
              returnKeyType="send"
              onSubmitEditing={() => send(text)}
              style={[...inputStyle, { flex: 1 }]}
            />
            <CircleButton icon="arrow.up" label={t.send} variant="solid" disabled={ended} onPress={() => send(text)} />
          </View>

          {sent.map((s, i) => (
            <Text key={i} tone="secondary">
              {s}
            </Text>
          ))}
        </ScrollView>
      )}
      <View style={{ height: insets.bottom }} />
    </KeyboardAvoidingView>
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
  },
  content: { padding: Spacing.four, gap: Spacing.three },
  input: { minHeight: 52, borderRadius: Radius.md, paddingHorizontal: Spacing.three, fontSize: 17 },
  codeInput: { fontSize: 28, letterSpacing: 4, textAlign: 'center' },
  frame: { aspectRatio: 3 / 4, borderRadius: Radius.lg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { paddingHorizontal: Spacing.three, minHeight: 44, borderRadius: Radius.full, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  pill: { height: 56, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
});
