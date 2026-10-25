import { setAudioModeAsync } from 'expo-audio';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CircleButton } from '@/components/chrome';
import { Text } from '@/components/text';
import { Radius, Spacing, useColors } from '@/constants/theme';
import * as Earcons from '@/lib/earcons';
import { captureFromGlasses, stopGlasses, takeGlassesNotice } from '@/lib/glasses';
import { HelperEnded, formatCode, sendFrame, spokenCode, startSharing, stopSharing } from '@/lib/helper';
import { useI18n } from '@/lib/i18n';
import { SPEECH_RATE, useSettings } from '@/lib/settings';
import * as Voice from '@/lib/voice';

const FRAME_GAP_MS = 1200;

type Msg = { id: number; body: string };

/**
 * "Someone see with me": shares the glasses view with a trusted person, who watches the frames
 * and sends short directions that are read aloud. With `notify` ("all" or a contact id, from
 * Siri or "call mom"), saved helpers get a notification that opens the view; otherwise, or if
 * none could be reached, the code is read out and shared.
 * Voice goes over a normal phone call; this screen only carries the picture and the messages.
 */
export default function HelperScreen() {
  useKeepAwake();
  const { notify } = useLocalSearchParams<{ notify?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const { settings } = useSettings();
  const { t, dir, speechLang } = useI18n();

  const [camPerm, requestCamPerm] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const cameraReady = useRef(false);

  const [code, setCode] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [failed, setFailed] = useState(false);

  const alive = useRef(true);
  const codeRef = useRef<string | null>(null);
  const lastId = useRef(0);
  const joinedRef = useRef(false);

  const say = useCallback(
    (text: string) => Voice.speakNow(text, { language: speechLang, rate: SPEECH_RATE[settings.speed] }),
    [settings.speed, speechLang],
  );

  const captureFrame = useCallback(async (): Promise<string | undefined> => {
    try {
      let uri = await captureFromGlasses();
      if (!uri && cameraRef.current && cameraReady.current) {
        uri = (await cameraRef.current.takePictureAsync({ quality: 0.5, shutterSound: false })).uri;
      }
      if (!uri) return undefined;
      const ref = await ImageManipulator.manipulate(uri).resize({ width: 720 }).renderAsync();
      return (await ref.saveAsync({ base64: true, compress: 0.55, format: SaveFormat.JPEG })).base64;
    } catch (e) {
      console.warn('helper capture failed', e);
      return undefined;
    }
  }, []);

  const share = useCallback(
    (c: string) => Share.share({ message: t.helperShareMessage(formatCode(c)) }).catch(() => {}),
    [t],
  );

  useEffect(() => {
    alive.current = true;
    (async () => {
      if (!camPerm?.granted) await requestCamPerm();
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      let newCode: string;
      let notified: string[];
      try {
        ({ code: newCode, notified } = await startSharing(
          notify === 'all' ? 'all' : notify && Number.isInteger(Number(notify)) ? Number(notify) : undefined,
        ));
      } catch {
        setFailed(true);
        Earcons.play('error');
        say(t.errNetworkSpoken);
        return;
      }
      if (!alive.current) return stopSharing(newCode);
      codeRef.current = newCode;
      setCode(newCode);
      if (notified.length) {
        say(t.helperNotified(notified));
      } else {
        if (notify) say(t.helperNobodyReached);
        say(t.helperCodeSpoken(spokenCode(newCode)));
        share(newCode);
      }

      // Upload a frame, read any new messages, repeat.
      while (alive.current) {
        const image = await captureFrame();
        const notice = takeGlassesNotice();
        if (notice) say(t.glassesNotice[notice]);
        try {
          const res = await sendFrame(newCode, image, lastId.current);
          if (!alive.current) break;
          setFailed(false);
          if (res.joined && !joinedRef.current) {
            joinedRef.current = true;
            setJoined(true);
            Earcons.play('up');
            say(t.helperJoined);
          }
          for (const m of res.messages) {
            lastId.current = Math.max(lastId.current, m.id);
            if (settings.haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            say(m.body);
          }
          if (res.messages.length) setMessages((list) => [...res.messages.slice().reverse(), ...list].slice(0, 30));
        } catch (e) {
          if (e instanceof HelperEnded) {
            say(t.helperEnded);
            break;
          }
          setFailed(true);
        }
        await sleep(FRAME_GAP_MS);
      }
    })();
    return () => {
      alive.current = false;
      Voice.stop();
      if (codeRef.current) stopSharing(codeRef.current);
      stopGlasses();
    };
    // Runs once; later values are read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    alive.current = false;
    Voice.stop();
    router.back();
  };

  return (
    <View style={[styles.root, { backgroundColor: c.background, direction: dir, paddingTop: insets.top + Spacing.two }]}>
      <View style={styles.topBar}>
        <CircleButton icon="xmark" label={t.helperEnd} onPress={close} />
        <Text variant="heading">{t.helperTitle}</Text>
        <View style={[styles.cam, { backgroundColor: c.surface }]} accessible accessibilityLabel={t.cameraOn}>
          {camPerm?.granted ? (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              animateShutter={false}
              onCameraReady={() => {
                cameraReady.current = true;
              }}
            />
          ) : (
            <SymbolView name="video.slash" size={20} tintColor={c.textSecondary} />
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View
          style={[styles.codeCard, { backgroundColor: c.surface }]}
          accessible
          accessibilityLabel={code ? t.helperCodeLabel(spokenCode(code)) : t.preparing}>
          <Text variant="caption" tone="secondary">
            {t.helperCodeTitle}
          </Text>
          <Text variant="display" center style={styles.code}>
            {code ? formatCode(code) : '…'}
          </Text>
          <Text variant="caption" tone="secondary" center>
            {joined ? t.helperJoined : t.helperWaiting}
          </Text>
        </View>

        <Text tone="secondary">{t.helperHowTo}</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityHint={t.contactsHint}
          onPress={() => router.push('/contacts')}
          style={({ pressed }) => [styles.link, { backgroundColor: c.surface, opacity: pressed ? 0.6 : 1 }]}>
          <SymbolView name="person.crop.circle.badge.plus" size={22} tintColor={c.text} />
          <Text variant="heading" style={{ flex: 1 }}>
            {t.contactsTitle}
          </Text>
        </Pressable>

        {failed && (
          <Text variant="body" style={{ color: c.stopText }}>
            {t.errNetwork}
          </Text>
        )}

        {messages.map((m) => (
          <View key={m.id} style={[styles.bubble, { backgroundColor: c.surface }]}>
            <Text variant="spoken">{m.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.controls, { paddingBottom: insets.bottom + Spacing.three }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.helperShareAgain}
          disabled={!code}
          onPress={() => code && share(code)}
          style={({ pressed }) => [styles.pill, { backgroundColor: c.text, opacity: !code ? 0.35 : pressed ? 0.75 : 1 }]}>
          <SymbolView name="square.and.arrow.up" size={20} tintColor={c.background} weight="semibold" />
          <Text variant="heading" style={{ color: c.background }}>
            {t.helperShareAgain}
          </Text>
        </Pressable>
      </View>
    </View>
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
  cam: {
    width: 56,
    height: 72,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: Spacing.four, gap: Spacing.three },
  codeCard: { borderRadius: Radius.lg, padding: Spacing.four, gap: Spacing.two, alignItems: 'center' },
  code: { letterSpacing: 4, fontVariant: ['tabular-nums'] },
  bubble: { padding: Spacing.three, borderRadius: Radius.md },
  link: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, minHeight: 56, borderRadius: Radius.md },
  controls: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minWidth: 200,
    height: 60,
    paddingHorizontal: Spacing.five,
    borderRadius: Radius.full,
  },
});
