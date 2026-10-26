import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { type CameraView, useCameraPermissions } from 'expo-camera';
import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Voice from '@/lib/voice';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CameraPreview } from '@/components/camera-preview';
import { CircleButton } from '@/components/chrome';
import { Orb, type OrbState } from '@/components/orb';
import { Text } from '@/components/text';
import { Radius, Spacing, useColors } from '@/constants/theme';
import { parseTags, splitAnswer, streamAssist, visibleText, type AssistRequest, type Turn } from '@/lib/assist';
import { matchCommand, matchMode, matchRoute } from '@/lib/commands';
import { dial, phoneIn } from '@/lib/emergency';
import * as Earcons from '@/lib/earcons';
import { FACES_ALLOWED, addFace, faceRefs } from '@/lib/faces';
import { checkFrame } from '@/lib/framing';
import { contactIn } from '@/lib/helper';
import { captureFromGlasses, stopGlasses, takeGlassesNotice } from '@/lib/glasses';
import { useI18n } from '@/lib/i18n';
import { prepareMic } from '@/lib/listen';
import { addMed, medRefs } from '@/lib/meds';
import { memoryNotes, recordTags } from '@/lib/memory';
import { getMode, modeText } from '@/lib/modes';
import { READS_TEXT, readTextOffline } from '@/lib/offline';
import { describePlace } from '@/lib/place';
import { SPEECH_RATE, useSettings } from '@/lib/settings';

type Phase = 'preparing' | 'framing' | 'listening' | 'thinking' | 'speaking' | 'idle' | 'error';

const ORB: Record<Phase, OrbState> = {
  preparing: 'idle',
  framing: 'thinking',
  listening: 'listening',
  thinking: 'thinking',
  speaking: 'speaking',
  idle: 'idle',
  error: 'idle',
};

// Voice activity detection on the recorder's meter (dBFS).
const LOUD_DB = -38;
const SILENCE_MS = 1400;
const NO_VOICE_MS = 8000;
const QUIET_NO_VOICE_MS = 5000;
const MAX_LISTEN_MS = 25000;
// Talking over the answer: louder and longer than the answer's own echo should be.
const BARGE_DB = -24;
const BARGE_MS = 350;
const SENTENCE_END = /[.!?؟\n،]/;
const FRAMING_TRIES = 3;

/**
 * Live assistant: listen (mic + VAD) → grab a camera frame → stream the answer
 * from the `mata-assist` edge function → speak it sentence by sentence.
 * Frames come from the glasses when they're connected, otherwise from the phone camera.
 */
export default function SessionScreen() {
  const { mode: modeParam, q } = useLocalSearchParams<{ mode?: string; q?: string }>();
  const mode = getMode(modeParam);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const { settings } = useSettings();
  const { t, lang, dir, speechLang } = useI18n();
  const prompt = modeText(mode, lang).prompt;
  const conversational = mode.id === 'ask' || !!mode.followUp;
  const STATUS: Record<Phase, string> = {
    preparing: t.preparing,
    framing: t.framing,
    listening: t.listening,
    thinking: t.thinking,
    speaking: '',
    idle: conversational ? t.tapToTalk : '',
    error: '',
  };

  const [camPerm, requestCamPerm] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const cameraReady = useRef(false);

  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const recState = useAudioRecorderState(recorder, 100);

  const [phase, setPhaseState] = useState<Phase>('preparing');
  const phaseRef = useRef<Phase>('preparing');
  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
    if (p === 'thinking') Earcons.startThinking();
    else Earcons.stopThinking();
  };

  const [question, setQuestion] = useState<string | null>(q ?? null);
  const [answer, setAnswer] = useState('');
  const [spokenUpTo, setSpokenUpTo] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const alive = useRef(true);
  const gen = useRef(0); // bumps on every new turn so stale speech callbacks are ignored
  const abort = useRef<AbortController | null>(null);
  const turns = useRef<Turn[]>([]);
  const spoken = useRef(0); // chars of the answer already queued for speech
  const outstanding = useRef(0); // utterances queued but not finished
  const streamDone = useRef(false);
  const vad = useRef({ start: 0, lastLoud: 0, heard: false, loudSince: 0 });
  /** The mic is open during the answer, waiting for the user to talk over it. */
  const barging = useRef(false);
  /** This listen was opened automatically: if nobody talks, go idle without complaining. */
  const quietListen = useRef(false);
  /** "briefly" / "in detail" said during this session overrides the setting. */
  const detailOverride = useRef<boolean | null>(null);
  const lastImage = useRef<string | undefined>(undefined);
  const listenRef = useRef<(quiet?: boolean) => void>(() => {});

  const haptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
    if (settings.haptics) Haptics.impactAsync(style);
  };

  /** Speaks and resolves when done, or after a timeout in case speech gets cancelled. */
  const sayAndWait = useCallback(
    (text: string) =>
      new Promise<void>((resolve) => {
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

  // ---------- camera ----------
  // Glasses first; the phone camera covers Expo Go and glasses that aren't connected.
  const phonePhoto = useCallback(async (): Promise<string | undefined> => {
    for (let i = 0; i < 30 && !cameraReady.current; i++) await sleep(100);
    if (!cameraRef.current || !cameraReady.current) return undefined;
    const pic = await cameraRef.current.takePictureAsync({ quality: 0.6, shutterSound: false });
    return pic.uri;
  }, []);

  const captureFrame = useCallback(async (): Promise<string | undefined> => {
    try {
      const uri = (await captureFromGlasses()) ?? (await phonePhoto());
      if (!uri) return undefined;
      const ref = await ImageManipulator.manipulate(uri).resize({ width: 768 }).renderAsync();
      const out = await ref.saveAsync({ base64: true, compress: 0.6, format: SaveFormat.JPEG });
      return out.base64;
    } catch (e) {
      console.warn('capture failed', e);
      return undefined;
    }
  }, [phonePhoto]);

  /**
   * The photo for a one-shot mode. For text, money, labels and screens, a quick check first
   * tells the user how to aim ("turn a little right", "bring it closer") and retakes,
   * a few times at most, before the real request.
   */
  const framedCapture = useCallback(async (): Promise<string | undefined> => {
    let image = await captureFrame();
    if (image && settings.framing && mode.framing) {
      for (let i = 0; i < FRAMING_TRIES && alive.current; i++) {
        setPhase('framing');
        const tip = await checkFrame(mode.id, image, lang);
        if (!tip || !alive.current) break;
        const notice = takeGlassesNotice();
        if (notice) await sayAndWait(t.glassesNotice[notice]);
        await sayAndWait(tip);
        await sleep(700);
        image = (await captureFrame()) ?? image;
      }
    }
    if (image) Earcons.play('capture');
    return image;
  }, [captureFrame, lang, mode.framing, mode.id, sayAndWait, settings.framing, t]);

  // ---------- talking over the answer ----------
  const stopBarge = useCallback(async () => {
    if (!barging.current) return;
    barging.current = false;
    try {
      await recorder.stop();
    } catch {}
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
  }, [recorder]);

  /** Opens the mic before the answer plays, so the user can cut it off by talking. */
  const startBarge = useCallback(async () => {
    if (!settings.bargeIn || barging.current) return;
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) return;
      await prepareMic(recorder);
      recorder.record();
      vad.current = { start: Date.now(), lastLoud: 0, heard: false, loudSince: 0 };
      barging.current = true;
    } catch (e) {
      console.warn('barge-in mic failed', e);
    }
  }, [recorder, settings.bargeIn]);

  // ---------- speech out ----------
  const onAnswerFinished = useCallback(async () => {
    if (!alive.current) return;
    await stopBarge();
    setPhase('idle');
    if (settings.continuous && conversational) {
      // In one-shot modes, listening for a follow-up is a bonus: stay quiet if none comes.
      setTimeout(() => alive.current && listenRef.current(mode.id !== 'ask'), 450);
    }
  }, [conversational, mode.id, settings.continuous, stopBarge]);

  const speakChunk = useCallback(
    (chunk: string, start: number) => {
      const myGen = gen.current;
      outstanding.current += 1;
      if (phaseRef.current !== 'speaking') setPhase('speaking');
      const finish = () => {
        if (myGen !== gen.current) return;
        setSpokenUpTo((v) => Math.max(v, start + chunk.length));
        outstanding.current -= 1;
        if (outstanding.current <= 0 && streamDone.current) onAnswerFinished();
      };
      Voice.speak(chunk, { language: speechLang, rate: SPEECH_RATE[settings.speed], onDone: finish });
    },
    [onAnswerFinished, settings.speed, speechLang],
  );

  /** Queue whole sentences for speech as soon as they've streamed in. */
  const feedSpeech = useCallback(
    (full: string, final: boolean) => {
      const rest = full.slice(spoken.current);
      if (!rest) return;
      let cut = -1;
      for (let i = rest.length - 1; i >= 0; i--) {
        if (SENTENCE_END.test(rest[i])) {
          cut = i + 1;
          break;
        }
      }
      if (final) cut = rest.length;
      if (cut <= 0 || (!final && cut < 12)) return;
      const chunk = rest.slice(0, cut);
      const start = spoken.current;
      spoken.current += cut;
      if (chunk.trim()) speakChunk(chunk, start);
    },
    [speakChunk],
  );

  /** Drops the current answer: no more speech, no more streaming. */
  const silence = useCallback(() => {
    gen.current += 1;
    Voice.stop();
    abort.current?.abort();
  }, []);

  // ---------- one assistant turn ----------
  const run = useCallback(
    async (req: Pick<AssistRequest, 'image' | 'audio' | 'text'>) => {
      silence();
      const ctrl = new AbortController();
      abort.current = ctrl;
      spoken.current = 0;
      outstanding.current = 0;
      streamDone.current = false;
      lastImage.current = req.image;
      setAnswer('');
      setSpokenUpTo(0);
      setError(null);
      if (req.text) setQuestion(req.text);
      setPhase('thinking');
      startBarge();

      const notice = takeGlassesNotice();
      if (notice) Voice.speak(t.glassesNotice[notice], { language: speechLang, rate: SPEECH_RATE[settings.speed] });

      const facesOn = FACES_ALLOWED && settings.faces && mode.id === 'people';
      const [meds, place] = await Promise.all([
        mode.id === 'meds' ? medRefs() : undefined,
        mode.id === 'where' ? describePlace(lang) : undefined,
      ]);
      if (ctrl.signal.aborted) return;
      let raw = '';
      let commandSeen = false;
      try {
        raw = await streamAssist(
          {
            ...req,
            mode: mode.id,
            history: turns.current,
            model: settings.model,
            detail: detailOverride.current ?? settings.detail,
            lang,
            memory: memoryNotes(lang),
            faces: facesOn ? await faceRefs() : undefined,
            faces_enabled: facesOn,
            meds,
            place,
            directions: settings.directions,
          },
          (delta) => {
            if (ctrl.signal.aborted) return;
            raw += delta;
            const s = splitAnswer(raw);
            if (s.question) setQuestion(s.question);
            if (s.question && !s.pending && !commandSeen) {
              commandSeen = true;
              const cmd = matchCommand(s.question);
              if (cmd === 'stop') {
                silence();
                stopBarge();
                setAnswer('');
                setPhase('idle');
                return;
              }
              if (cmd) detailOverride.current = cmd === 'detail';
              // "Where's the qibla?", "call mom to see with me": open that screen instead.
              const route = matchRoute(s.question, (text) => contactIn(text)?.id, phoneIn);
              if (route && 'dial' in route) {
                silence();
                stopBarge();
                setAnswer('');
                setPhase('idle');
                dial(route.dial);
                return;
              }
              if (route && !(route.pathname === '/session' && mode.id === 'where')) {
                silence();
                stopBarge();
                alive.current = false;
                router.replace(route);
                return;
              }
              // The opening question of a plain chat picks the tool ("how much money is this").
              const tool = mode.id === 'ask' && turns.current.length === 0 ? matchMode(s.question) : null;
              if (tool) {
                silence();
                stopBarge();
                alive.current = false;
                router.replace(
                  tool === 'find'
                    ? { pathname: '/find', params: { q: s.question } }
                    : { pathname: '/session', params: { mode: tool, q: s.question } },
                );
                return;
              }
            }
            const shown = visibleText(s.answer);
            setAnswer(shown);
            if (!s.pending) feedSpeech(shown, false);
          },
          ctrl.signal,
        );
      } catch (e) {
        if (!alive.current || ctrl.signal.aborted) return;
        console.warn(e);
        stopBarge();
        // No internet: text can still be read on the phone itself.
        const offline = READS_TEXT.has(mode.id) && req.image ? await readTextOffline(req.image, lang) : null;
        if (!alive.current) return;
        if (offline) {
          const spokenText = `${t.offlineReading} ${offline}`;
          setAnswer(spokenText);
          setPhase('speaking');
          spoken.current = 0;
          streamDone.current = true;
          feedSpeech(spokenText, true);
          return;
        }
        setError(t.errNetwork);
        setPhase('error');
        Earcons.play('error');
        Voice.speak(t.errNetworkSpoken, { language: speechLang });
        return;
      }
      if (ctrl.signal.aborted) return;

      const s = splitAnswer(raw);
      const shown = visibleText(s.answer).trim();
      setAnswer(shown);
      streamDone.current = true;
      feedSpeech(shown, true);
      if (settings.haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const tags = parseTags(s.answer);
      recordTags(tags, req.image);
      if (facesOn && req.image) tags.faces.forEach((name) => addFace(name, req.image!));
      if (req.image) tags.meds.forEach((m) => addMed(m.name, m.note, req.image!));

      turns.current.push(
        { role: 'user', content: s.question ?? req.text ?? prompt },
        { role: 'assistant', content: shown },
      );
      if (outstanding.current === 0) onAnswerFinished();
    },
    [feedSpeech, mode.id, prompt, onAnswerFinished, settings, lang, t, speechLang, silence, startBarge, stopBarge, router],
  );

  // ---------- microphone ----------
  const startListening = useCallback(
    async (quiet = false) => {
      if (!alive.current) return;
      silence();
      barging.current = false;
      quietListen.current = quiet;
      try {
        const perm = await requestRecordingPermissionsAsync();
        if (!perm.granted) {
          setError(t.errMicPerm);
          setPhase('error');
          return;
        }
        if (recorder.isRecording) await recorder.stop().catch(() => {});
        await prepareMic(recorder);
        recorder.record();
        vad.current = { start: Date.now(), lastLoud: Date.now(), heard: false, loudSince: 0 };
        setQuestion(null);
        setAnswer('');
        setSpokenUpTo(0);
        setError(null);
        setPhase('listening');
        Earcons.play('listen');
        if (settings.haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {
        console.warn('record failed', e);
        setError(t.errMic);
        setPhase('error');
        Earcons.play('error');
      }
    },
    [recorder, settings.haptics, t, silence],
  );
  useEffect(() => {
    listenRef.current = startListening;
  }, [startListening]);

  const finishListening = useCallback(async () => {
    if (phaseRef.current !== 'listening') return;
    setPhase('thinking');
    try {
      await recorder.stop();
    } catch {}
    // Leave record mode so speech plays through the loud speaker, not the earpiece.
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    if (!alive.current) return;

    if (!vad.current.heard || !recorder.uri) {
      setPhase('idle');
      if (!quietListen.current) {
        Voice.speak(t.didntHear, { language: speechLang, rate: SPEECH_RATE[settings.speed] });
      }
      return;
    }
    Earcons.play('send');
    if (settings.haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const [audio, image] = await Promise.all([new File(recorder.uri).base64(), captureFrame()]);
    run({ audio, image });
  }, [captureFrame, recorder, run, settings.haptics, settings.speed, speechLang, t]);

  // Voice activity detection: stop after a pause once we've heard speech; while the answer
  // plays with barge-in on, sustained speech cuts it off and opens a fresh question.
  useEffect(() => {
    const now = Date.now();
    const v = vad.current;
    const level = recState.metering ?? -160;

    if (barging.current && phaseRef.current === 'speaking') {
      if (level > BARGE_DB) {
        v.loudSince ||= now;
        if (now - v.loudSince > BARGE_MS) {
          haptic(Haptics.ImpactFeedbackStyle.Medium);
          // A fresh recording, so the question doesn't include the answer's own voice.
          // "Stop" on its own is handled right here: nothing more is heard, so it goes quiet.
          listenRef.current(true);
        }
      } else {
        v.loudSince = 0;
      }
      return;
    }

    if (phaseRef.current !== 'listening') return;
    if (level > LOUD_DB) {
      v.heard = true;
      v.lastLoud = now;
    }
    const noVoice = quietListen.current ? QUIET_NO_VOICE_MS : NO_VOICE_MS;
    if (
      (v.heard && now - v.lastLoud > SILENCE_MS) ||
      (!v.heard && now - v.start > noVoice) ||
      now - v.start > MAX_LISTEN_MS
    ) {
      finishListening();
    }
    // `haptic` only reads settings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recState.metering, recState.durationMillis, finishListening]);

  // ---------- lifecycle ----------
  useEffect(() => {
    alive.current = true;
    (async () => {
      if (!camPerm?.granted) await requestCamPerm();
      await setAudioModeAsync({ playsInSilentMode: true });
      if (q) run({ text: q, image: mode.id === 'ask' ? await captureFrame() : await framedCapture() });
      else if (mode.id === 'ask') startListening();
      else run({ image: await framedCapture() });
    })();
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      alive.current = false;
      clearInterval(t);
      gen.current += 1;
      abort.current?.abort();
      Voice.stop();
      Earcons.stopThinking();
      recorder.stop().catch(() => {});
      setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      stopGlasses();
    };
    // Runs once per session; the callbacks read the latest values through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- interactions ----------
  const busy = phase === 'thinking' || phase === 'preparing' || phase === 'framing';

  const retake = () => {
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    if (busy) return;
    framedCapture().then((image) => run({ image }));
  };

  const onOrbPress = () => {
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    const p = phaseRef.current;
    if (p === 'listening') return finishListening();
    if (busy) return;
    if (conversational || p === 'speaking') return startListening();
    retake();
  };

  const stopTalking = () => {
    silence();
    stopBarge();
    setSpokenUpTo(answer.length);
    setPhase('idle');
  };

  const close = () => {
    alive.current = false;
    Voice.stop();
    router.back();
  };

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <View
      style={[styles.root, { backgroundColor: c.background, direction: dir, paddingTop: insets.top + Spacing.two }]}
      // VoiceOver's two-finger double tap: talk, or cut the answer off and talk.
      onMagicTap={onOrbPress}>
      <View style={styles.topBar}>
        <CircleButton icon="xmark" label={t.close} onPress={close} />
        <Text variant="caption" tone="secondary" accessibilityLabel={t.duration(elapsed)}>
          {mm}:{ss}
        </Text>
        <View style={[styles.cam, { backgroundColor: c.surface }]} accessible accessibilityLabel={t.cameraOn}>
          <CameraPreview
            cameraRef={cameraRef}
            readyRef={cameraReady}
            granted={!!camPerm?.granted}
            iconSize={20}
            iconColor={c.textSecondary}
          />
          <View style={styles.liveDot} />
        </View>
      </View>

      <Pressable
        onPress={onOrbPress}
        accessibilityRole="button"
        accessibilityLabel={
          phase === 'listening'
            ? t.doneTalking
            : phase === 'speaking'
              ? t.interrupt
              : conversational
                ? t.tapToTalk
                : t.retake
        }
        style={styles.orbWrap}>
        <Orb size={answer ? 110 : 170} state={ORB[phase]} />
        {!!STATUS[phase] && (
          <Text variant="heading" tone="secondary" center accessibilityLiveRegion="polite">
            {STATUS[phase]}
          </Text>
        )}
      </Pressable>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.transcript}>
        {!!question && (
          <View style={[styles.bubble, { backgroundColor: c.surface }]}>
            <Text variant="body">{question}</Text>
          </View>
        )}
        {!!answer && (
          <Text variant="spoken" selectable>
            <Text variant="spoken" style={{ fontWeight: '700' }}>
              {answer.slice(0, spokenUpTo)}
            </Text>
            <Text variant="spoken" tone="tertiary">
              {answer.slice(spokenUpTo)}
            </Text>
          </Text>
        )}
        {!!error && (
          <Text variant="body" style={{ color: c.stopText }}>
            {error}
          </Text>
        )}
      </ScrollView>

      <View style={[styles.controls, { paddingBottom: insets.bottom + Spacing.three }]}>
        {phase === 'speaking' ? (
          <Pill icon="pause.fill" label={t.stop} bg={c.stop} fg={c.stopText} onPress={stopTalking} />
        ) : phase === 'listening' ? (
          <Pill icon="arrow.up" label={t.sendNow} bg={c.text} fg={c.background} onPress={finishListening} />
        ) : mode.id === 'ask' ? (
          <Pill icon="mic.fill" label={t.talk} bg={c.text} fg={c.background} disabled={busy} onPress={onOrbPress} />
        ) : (
          <View style={styles.pair}>
            <Pill icon="camera.fill" label={t.retake} bg={c.text} fg={c.background} disabled={busy} onPress={retake} />
            {mode.followUp && (
              <CircleButton
                icon="mic.fill"
                label={t.askAboutIt}
                size={60}
                variant="filled"
                disabled={busy}
                onPress={() => startListening()}
              />
            )}
          </View>
        )}
      </View>
    </View>
  );
}

function Pill({
  icon,
  label,
  bg,
  fg,
  onPress,
  disabled,
}: {
  icon: SFSymbol;
  label: string;
  bg: string;
  fg: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.pill, { backgroundColor: bg, opacity: disabled ? 0.35 : pressed ? 0.75 : 1 }]}>
      <SymbolView name={icon} size={20} tintColor={fg} weight="semibold" />
      <Text variant="heading" style={{ color: fg }}>
        {label}
      </Text>
    </Pressable>
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
  liveDot: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30' },
  orbWrap: { alignItems: 'center', paddingTop: Spacing.two, gap: Spacing.one },
  transcript: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.four, gap: Spacing.three },
  bubble: {
    alignSelf: 'flex-start',
    maxWidth: '85%',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderRadius: Radius.lg,
  },
  controls: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, alignItems: 'center' },
  pair: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
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
