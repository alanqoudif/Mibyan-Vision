import { setAudioModeAsync } from 'expo-audio';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CircleButton } from '@/components/chrome';
import { Orb, type OrbState } from '@/components/orb';
import { Text } from '@/components/text';
import { Radius, Spacing, useColors } from '@/constants/theme';
import { splitAnswer, streamAssist } from '@/lib/assist';
import * as Earcons from '@/lib/earcons';
import { captureFromGlasses, stopGlasses, takeGlassesNotice } from '@/lib/glasses';
import { useI18n } from '@/lib/i18n';
import { useListen } from '@/lib/listen';
import { memoryNotes } from '@/lib/memory';
import { SPEECH_RATE, useSettings } from '@/lib/settings';
import * as Voice from '@/lib/voice';

type Pos = 'left' | 'right' | 'ahead' | 'up' | 'down' | 'none';
type Dist = 'reach' | 'near' | 'mid' | 'far';
type Phase = 'asking' | 'searching' | 'paused' | 'found';

const GUIDE_LINE = /\b(left|right|ahead|up|down|none)\b\s+\b(reach|near|mid|far)\b/i;
/** Ping interval by distance: closer = faster, like a parking sensor. */
const PING_MS: Record<Dist, number> = { reach: 220, near: 380, mid: 650, far: 1000 };
const ICON: Record<Pos, SFSymbol> = {
  left: 'arrow.left',
  right: 'arrow.right',
  up: 'arrow.up',
  down: 'arrow.down',
  ahead: 'scope',
  none: 'questionmark',
};
/** Speak the hint again after this many looks even if the direction hasn't changed. */
const REPEAT_EVERY = 4;
const LOOK_GAP_MS = 300;

/**
 * Guided find: the user says what they're looking for, then every look at the glasses camera
 * comes back as a direction and distance. Pings speed up as they get closer and turn
 * high-pitched when the thing is straight ahead; a short phrase is spoken when the direction
 * changes. Two "straight ahead, within reach" looks in a row count as found.
 */
export default function FindScreen() {
  useKeepAwake();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const { settings } = useSettings();
  const { t, lang, dir, speechLang } = useI18n();
  const { listen, cancel } = useListen();

  const [camPerm, requestCamPerm] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const cameraReady = useRef(false);

  const [phase, setPhaseState] = useState<Phase>('asking');
  const phaseRef = useRef<Phase>('asking');
  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };
  const [target, setTarget] = useState<string | null>(q ?? null);
  const targetRef = useRef<string | null>(q ?? null);
  const [pos, setPos] = useState<Pos>('none');
  const [dist, setDist] = useState<Dist>('far');
  const [hint, setHint] = useState('');
  const [orb, setOrb] = useState<OrbState>('idle');

  const alive = useRef(true);
  const looping = useRef(false);
  const lastSaid = useRef<{ pos: Pos; looks: number }>({ pos: 'none', looks: 0 });
  const reachCount = useRef(0);

  const rate = SPEECH_RATE[settings.speed];
  const say = useCallback(
    (text: string, interrupt = true) => {
      Voice.speakNow(text, { language: speechLang, rate, interrupt });
    },
    [rate, speechLang],
  );
  const sayAndWait = useCallback(
    (text: string) =>
      new Promise<void>((resolve) => {
        Voice.speakNow(text, { language: speechLang, rate, onDone: resolve, interrupt: true });
      }),
    [rate, speechLang],
  );

  const captureFrame = useCallback(async (): Promise<string | undefined> => {
    try {
      let uri = await captureFromGlasses();
      if (!uri && cameraRef.current && cameraReady.current) {
        uri = (await cameraRef.current.takePictureAsync({ quality: 0.5, shutterSound: false })).uri;
      }
      if (!uri) return undefined;
      const ref = await ImageManipulator.manipulate(uri).resize({ width: 640 }).renderAsync();
      return (await ref.saveAsync({ base64: true, compress: 0.55, format: SaveFormat.JPEG })).base64;
    } catch (e) {
      console.warn('find capture failed', e);
      return undefined;
    }
  }, []);

  /** One look: returns false if the search should stop (found, paused, closed, failed). */
  const look = useCallback(
    async (audio?: string): Promise<boolean> => {
      const image = await captureFrame();
      if (!alive.current || phaseRef.current !== 'searching') return false;
      const notice = takeGlassesNotice();
      if (notice) await sayAndWait(t.glassesNotice[notice]);
      if (!image) {
        say(t.findNoCamera);
        return false;
      }
      setOrb('thinking');
      let raw: string;
      try {
        raw = await streamAssist(
          {
            mode: 'guide',
            image,
            audio,
            text: audio ? undefined : (targetRef.current ?? undefined),
            model: 'fast',
            lang,
            memory: audio ? memoryNotes(lang) : undefined,
          },
          () => {},
        );
      } catch (e) {
        console.warn('guide failed', e);
        Earcons.play('error');
        say(t.errNetworkSpoken);
        return false;
      }
      if (!alive.current || phaseRef.current !== 'searching') return false;
      setOrb('listening');

      const s = splitAnswer(raw);
      if (s.question && !targetRef.current) {
        targetRef.current = s.question;
        setTarget(s.question);
      }
      const lines = s.answer.split('\n').map((l) => l.trim()).filter(Boolean);
      const at = lines.findIndex((l) => GUIDE_LINE.test(l));
      const m = at === -1 ? null : lines[at].match(GUIDE_LINE);
      const nextPos = (m?.[1].toLowerCase() ?? 'none') as Pos;
      const nextDist = (m?.[2].toLowerCase() ?? 'far') as Dist;
      const phrase = lines.filter((_, i) => i !== at).join(' ');
      setPos(nextPos);
      setDist(nextDist);
      if (phrase) setHint(phrase);

      if (nextPos === 'ahead' && nextDist === 'reach') {
        reachCount.current += 1;
        if (reachCount.current >= 2) {
          setPhase('found');
          setOrb('idle');
          Earcons.play('success');
          if (settings.haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          say(phrase || t.findFound);
          return false;
        }
      } else {
        reachCount.current = 0;
      }

      const said = lastSaid.current;
      said.looks += 1;
      if (phrase && (audio || nextPos !== said.pos || said.looks >= REPEAT_EVERY)) {
        // The first answer may mention where it was last seen: let it finish.
        if (audio) await sayAndWait(phrase);
        else say(phrase);
        lastSaid.current = { pos: nextPos, looks: 0 };
        if (settings.haptics && nextPos !== said.pos) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      return true;
    },
    [captureFrame, lang, say, sayAndWait, settings.haptics, t],
  );

  const loop = useCallback(
    async (audio?: string) => {
      if (looping.current) return;
      looping.current = true;
      try {
        let first = audio;
        while (alive.current && phaseRef.current === 'searching') {
          if (!(await look(first))) break;
          first = undefined;
          await sleep(LOOK_GAP_MS);
        }
      } finally {
        looping.current = false;
        if (alive.current && phaseRef.current === 'searching') setPhase('paused');
      }
    },
    [look],
  );

  /** Asks what to look for (unless it came with the screen), then starts searching. */
  const ask = useCallback(async () => {
    Voice.stop();
    setPhase('asking');
    setPos('none');
    setHint('');
    reachCount.current = 0;
    lastSaid.current = { pos: 'none', looks: 0 };
    setOrb('idle');
    await sayAndWait(t.findWhat);
    if (!alive.current) return;
    setOrb('listening');
    const audio = await listen();
    if (!alive.current) return;
    if (!audio) {
      setOrb('idle');
      say(t.didntHear);
      return;
    }
    targetRef.current = null;
    setTarget(null);
    setPhase('searching');
    loop(audio);
  }, [listen, loop, say, sayAndWait, t]);

  useEffect(() => {
    alive.current = true;
    (async () => {
      if (!camPerm?.granted) await requestCamPerm();
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      if (targetRef.current) {
        setPhase('searching');
        say(t.findLooking(targetRef.current));
        loop();
      } else {
        ask();
      }
    })();
    return () => {
      alive.current = false;
      cancel();
      Voice.stop();
      stopGlasses();
    };
    // Runs once; later values are read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sonar: the ping rate follows the distance; nothing while it isn't in view.
  useEffect(() => {
    if (phase !== 'searching' || pos === 'none') return;
    const timer = setInterval(() => Earcons.ping(pos === 'ahead'), PING_MS[dist]);
    return () => clearInterval(timer);
  }, [phase, pos, dist]);

  const toggle = () => {
    if (settings.haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (phase === 'searching') {
      setPhase('paused');
      setOrb('idle');
      say(t.findPaused);
    } else if (targetRef.current) {
      reachCount.current = 0;
      setPhase('searching');
      say(t.findLooking(targetRef.current));
      loop();
    } else {
      ask();
    }
  };

  const close = () => {
    alive.current = false;
    Voice.stop();
    router.back();
  };

  const status =
    phase === 'asking'
      ? t.findWhat
      : phase === 'found'
        ? t.findFound
        : phase === 'paused'
          ? t.findPausedShort
          : t.findDirection[pos];

  return (
    <View style={[styles.root, { backgroundColor: c.background, direction: dir, paddingTop: insets.top + Spacing.two }]}>
      <View style={styles.topBar}>
        <CircleButton icon="xmark" label={t.close} onPress={close} />
        <Text variant="heading" numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>
          {target ? t.findLooking(target) : t.findTitle}
        </Text>
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

      <View style={styles.center} accessible accessibilityLiveRegion="polite" accessibilityLabel={`${status}. ${hint}`}>
        {phase === 'searching' ? (
          <View style={[styles.arrow, { backgroundColor: pos === 'ahead' ? c.success : c.surface }]}>
            <SymbolView name={ICON[pos]} size={96} tintColor={pos === 'ahead' ? '#FFFFFF' : c.text} weight="bold" />
          </View>
        ) : (
          <Orb size={170} state={orb} />
        )}
        <Text variant="title" center>
          {status}
        </Text>
        {phase === 'searching' && pos !== 'none' && (
          <Text variant="heading" tone="secondary" center>
            {t.findDistance[dist]}
          </Text>
        )}
        {!!hint && (
          <Text variant="spoken" center style={{ paddingHorizontal: Spacing.four }}>
            {hint}
          </Text>
        )}
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + Spacing.three }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={phase === 'searching' ? t.pause : t.findResume}
          disabled={phase === 'asking'}
          onPress={toggle}
          style={({ pressed }) => [
            styles.pill,
            {
              backgroundColor: phase === 'searching' ? c.stop : c.text,
              opacity: phase === 'asking' ? 0.35 : pressed ? 0.75 : 1,
            },
          ]}>
          <SymbolView
            name={phase === 'searching' ? 'pause.fill' : 'play.fill'}
            size={20}
            tintColor={phase === 'searching' ? c.stopText : c.background}
            weight="semibold"
          />
          <Text variant="heading" style={{ color: phase === 'searching' ? c.stopText : c.background }}>
            {phase === 'searching' ? t.pause : t.findResume}
          </Text>
        </Pressable>
        <CircleButton
          icon="mic.fill"
          label={t.findSomethingElse}
          size={60}
          variant="filled"
          disabled={phase === 'asking'}
          onPress={() => {
            setPhase('paused');
            ask();
          }}
        />
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
    gap: Spacing.three,
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  arrow: { width: 180, height: 180, borderRadius: 90, alignItems: 'center', justifyContent: 'center' },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
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
