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
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CameraPreview } from '@/components/camera-preview';
import { CircleButton } from '@/components/chrome';
import { Orb, type OrbState } from '@/components/orb';
import { Text } from '@/components/text';
import { Radius, Spacing, useColors } from '@/constants/theme';
import { SILENT, URGENT, parseTags, splitAnswer, streamAssist, visibleText, type Turn } from '@/lib/assist';
import { matchCommand } from '@/lib/commands';
import * as Earcons from '@/lib/earcons';
import { captureFromGlasses, stopGlasses, takeGlassesNotice, useCameraSource } from '@/lib/glasses';
import { useI18n } from '@/lib/i18n';
import { prepareMic } from '@/lib/listen';
import { memoryNotes, recordTags } from '@/lib/memory';
import { SPEECH_RATE, useSettings } from '@/lib/settings';
import * as Voice from '@/lib/voice';

import { Glasses, type ObstacleReading } from '../../modules/mubayan-glasses';

type Note = { id: number; text: string; urgent: boolean; at: Date };

// Talking to live mode: louder than street noise, and a pause ends the question.
const LOUD_DB = -32;
const SILENCE_MS = 1300;
const MAX_QUESTION_MS = 12000;
/** Restart an idle recording now and then so it never grows long. */
const IDLE_RESTART_MS = 20000;
const KEEP_AWAKE = 'live';
const LIVE_ENDPOINT = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/mata-live`;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
/**
 * Obstacle sensor thresholds for near / close / very close: closeness relative to the floor
 * in front of the feet (~1.5 m), so 1 ≈ 1.5 m and higher is nearer. Tuned by walking up to a wall.
 */
const OBSTACLE_LEVELS = [1.3, 1.6, 2];
/** How Gemini's warnings start, to flag them as urgent. */
const WARNING = /^(انتبه|وقف|حاسب|careful|stop|watch out)/i;

/**
 * Live mode: grabs a frame every few seconds and only speaks when the model
 * reports something new or important (it answers <silent> otherwise).
 * Hazards come back prefixed with "!" and get a strong haptic + interrupt.
 *
 * Made for the phone in a pocket: with the glasses it keeps running with the screen locked.
 * The mic stays open the whole time (which is also what keeps iOS from suspending the app),
 * so the user can just ask a question out loud; it's answered with the current frame.
 * The screen only has to stay on when the phone camera is the one looking.
 */
export default function LiveScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const { settings } = useSettings();
  const { t, lang, dir, speechLang } = useI18n();

  const [camPerm, requestCamPerm] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const cameraReady = useRef(false);

  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const recState = useAudioRecorderState(recorder, 120);

  const [paused, setPaused] = useState(false);
  const [orb, setOrb] = useState<OrbState>('idle');
  const [notes, setNotes] = useState<Note[]>([]);
  const fromGlasses = useCameraSource().glasses;
  const [failed, setFailed] = useState(false);
  // Gemini Live: a natural voice about a second after something comes into view. The
  // frame-by-frame pipeline is the fallback (Expo Go, no key on the server, connection lost).
  const [legacy, setLegacy] = useState(!Glasses);
  // Gemini Live is connected and can say alerts.
  const liveReady = useRef(false);
  const [obstacle, setObstacle] = useState<ObstacleReading | null>(null);

  // Parking-sensor warnings from the glasses video, on the phone: beeps within a frame or two.
  useEffect(() => {
    if (!Glasses) return;
    const sub = Glasses.addListener('onObstacle', (r) => {
      setObstacle(r);
      if (__DEV__) console.log('obstacle', r.level, r.side, r.label, r.values.map((v) => v.toFixed(2)).join(' '));
    });
    Glasses.obstacleStart(OBSTACLE_LEVELS, lang);
    return () => {
      sub.remove();
      Glasses?.obstacleStop();
    };
  }, [lang]);

  const alive = useRef(true);
  const pausedRef = useRef(false);
  // Looks in flight. Two overlap so a new frame goes out before the last answer is back;
  // an answer older than one already handled is dropped.
  const inFlight = useRef(0);
  const lookSeq = useRef(0);
  const lastLook = useRef(0);
  const speaking = useRef(false);
  const asking = useRef(false);
  const micOpen = useRef(false);
  const vad = useRef({ start: 0, lastLoud: 0, heard: false });
  const context = useRef<Turn[]>([]);
  const nextId = useRef(1);
  const failedRef = useRef(false);
  const toldNoCamera = useRef(false);

  // ---------- frames ----------
  const captureFrame = useCallback(async (): Promise<string | undefined> => {
    try {
      let uri = await captureFromGlasses('frame');
      // The phone camera only works on screen, so it needs the screen kept on.
      if (uri) deactivateKeepAwake(KEEP_AWAKE).catch(() => {});
      else activateKeepAwakeAsync(KEEP_AWAKE).catch(() => {});
      if (!uri && AppState.currentState === 'active' && cameraRef.current && cameraReady.current) {
        uri = (await cameraRef.current.takePictureAsync({ quality: 0.5, shutterSound: false })).uri;
      }
      if (!uri) return undefined;
      toldNoCamera.current = false;
      // Small and light: upload time counts toward every warning.
      const ref = await ImageManipulator.manipulate(uri).resize({ width: 512 }).renderAsync();
      return (await ref.saveAsync({ base64: true, compress: 0.5, format: SaveFormat.JPEG })).base64;
    } catch (e) {
      console.warn('live capture failed', e);
      return undefined;
    }
  }, []);

  // ---------- mic ----------
  /** (Re)starts the always-on recording, so a question never includes old audio. */
  const openMic = useCallback(async () => {
    if (!alive.current) return;
    try {
      if (recorder.isRecording) await recorder.stop().catch(() => {});
      await prepareMic(recorder, { shouldPlayInBackground: true, allowsBackgroundRecording: true });
      recorder.record();
      vad.current = { start: Date.now(), lastLoud: 0, heard: false };
      micOpen.current = true;
    } catch (e) {
      micOpen.current = false;
      console.warn('live mic failed', e);
    }
  }, [recorder]);

  const say = useCallback(
    (text: string, interrupt = false) => {
      // Realtime mode: Gemini says it in its own voice; its events drive `speaking`.
      if (!legacy && liveReady.current) {
        Glasses?.liveSay(text);
        return;
      }
      speaking.current = true;
      setOrb('speaking');
      const done = () => {
        speaking.current = false;
        if (!alive.current) return;
        setOrb(pausedRef.current ? 'idle' : 'listening');
        // Drop what the mic heard of our own voice.
        if (!asking.current && legacy) openMic();
      };
      Voice.speakNow(text, { language: speechLang, rate: SPEECH_RATE[settings.speed], onDone: done, interrupt });
    },
    [legacy, openMic, settings.speed, speechLang],
  );

  // ---------- one look ----------
  const tick = useCallback(async () => {
    if (!alive.current || pausedRef.current || inFlight.current >= 2 || speaking.current || asking.current) return;
    inFlight.current++;
    const look = ++lookSeq.current;
    setOrb('thinking');
    try {
      const image = await captureFrame();
      const notice = takeGlassesNotice();
      if (notice && alive.current) say(t.glassesNotice[notice], true);
      if (!image && AppState.currentState !== 'active' && !toldNoCamera.current) {
        // Locked phone and no glasses: nothing can look, so say so once instead of going quiet.
        toldNoCamera.current = true;
        say(t.liveNeedsGlasses, true);
      }
      if (!image || !alive.current || pausedRef.current) return;
      const raw = await streamAssist(
        {
          mode: 'live',
          image,
          history: context.current.slice(-6),
          model: settings.model,
          detail: false,
          lang,
          directions: settings.directions,
        },
        () => {},
      );
      setFailed(false);
      failedRef.current = false;
      if (look < lastLook.current) return;
      lastLook.current = look;
      const text = raw.trim();
      if (!alive.current || pausedRef.current || asking.current || !text || text.includes(SILENT)) return;

      const urgent = text.startsWith(URGENT);
      const clean = text.replace(/^!\s*/, '');
      context.current.push({ role: 'assistant', content: clean });
      // In realtime mode the note comes from Gemini's transcript of what it actually said.
      if (legacy) setNotes((n) => [{ id: nextId.current++, text: clean, urgent, at: new Date() }, ...n].slice(0, 30));
      if (settings.haptics) {
        if (urgent) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      say(clean, urgent);
    } catch (e) {
      console.warn('live tick failed', e);
      if (!failedRef.current) Earcons.play('error');
      failedRef.current = true;
      setFailed(true);
    } finally {
      inFlight.current--;
      if (alive.current && !speaking.current && !inFlight.current) setOrb(pausedRef.current ? 'idle' : 'listening');
    }
  }, [captureFrame, lang, legacy, say, settings.directions, settings.haptics, settings.model, t]);

  // ---------- a spoken question ----------
  const ask = useCallback(async () => {
    if (asking.current || !alive.current) return;
    asking.current = true;
    micOpen.current = false;
    Earcons.play('send');
    if (settings.haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setOrb('thinking');
    Earcons.startThinking();
    try {
      await recorder.stop().catch(() => {});
      const uri = recorder.uri;
      if (!uri) return;
      // The glasses take one photo at a time; let a look in progress finish.
      for (let i = 0; i < 50 && inFlight.current; i++) await sleep(100);
      const [audio, image] = await Promise.all([new File(uri).base64(), captureFrame()]);
      let raw = '';
      let stopped = false;
      raw = await streamAssist(
        {
          mode: 'ask',
          audio,
          image,
          history: context.current.slice(-8),
          model: settings.model,
          detail: false,
          lang,
          memory: memoryNotes(lang),
          directions: settings.directions,
        },
        (delta) => {
          raw += delta;
          const s = splitAnswer(raw);
          if (!stopped && s.question && !s.pending && matchCommand(s.question) === 'stop') stopped = true;
        },
      );
      Earcons.stopThinking();
      if (!alive.current || stopped) {
        Voice.stop();
        return;
      }
      const s = splitAnswer(raw);
      const answer = visibleText(s.answer).trim();
      recordTags(parseTags(s.answer), image);
      if (!answer) return;
      context.current.push({ role: 'user', content: s.question ?? '' }, { role: 'assistant', content: answer });
      setNotes((n) => [{ id: nextId.current++, text: answer, urgent: false, at: new Date() }, ...n].slice(0, 30));
      say(answer, true);
    } catch (e) {
      console.warn('live question failed', e);
      Earcons.play('error');
      say(t.errNetworkSpoken, true);
    } finally {
      Earcons.stopThinking();
      asking.current = false;
      if (alive.current && !speaking.current) {
        setOrb(pausedRef.current ? 'idle' : 'listening');
        openMic();
      }
    }
  }, [captureFrame, lang, openMic, recorder, say, settings.directions, settings.haptics, settings.model, t]);

  // Voice activity on the always-on mic: speech then a pause is a question.
  useEffect(() => {
    if (!micOpen.current || asking.current || speaking.current) return;
    const now = Date.now();
    const v = vad.current;
    if ((recState.metering ?? -160) > LOUD_DB) {
      if (!v.heard) Earcons.play('listen');
      v.heard = true;
      v.lastLoud = now;
    }
    if (v.heard && (now - v.lastLoud > SILENCE_MS || now - v.start > MAX_QUESTION_MS)) ask();
    else if (!v.heard && now - v.start > IDLE_RESTART_MS) openMic();
  }, [recState.metering, recState.durationMillis, ask, openMic]);

  // ---------- realtime (Gemini Live) ----------
  useEffect(() => {
    if (legacy || !Glasses) return;
    alive.current = true;
    let heard = false;
    if (!camPerm?.granted) requestCamPerm();
    activateKeepAwakeAsync(KEEP_AWAKE).catch(() => {});
    const sub = Glasses.addListener('onLiveEvent', (e) => {
      if (!alive.current) return;
      if (__DEV__ && e.type !== 'speaking') console.log('gemini live', JSON.stringify(e));
      if (e.type === 'state') {
        liveReady.current = e.state === 'live';
        if (e.state === 'live') {
          heard = true;
          setFailed(false);
          setOrb('listening');
        } else if (e.state !== 'stopped') setOrb('thinking');
      } else if (e.type === 'speaking') {
        speaking.current = e.speaking;
        setOrb(e.speaking ? 'speaking' : 'listening');
      } else if (e.type === 'model') {
        const urgent = WARNING.test(e.text);
        setNotes((n) => [{ id: nextId.current++, text: e.text, urgent, at: new Date() }, ...n].slice(0, 30));
        if (settings.haptics) {
          if (urgent) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      } else if (e.type === 'error') {
        console.warn('realtime live failed', e.message);
        // Never connected: use the frame-by-frame mode instead. Dropped later: say so.
        if (!heard) setLegacy(true);
        else setFailed(true);
      }
    });
    Glasses.liveStart(LIVE_ENDPOINT, ANON, lang, settings.directions).catch((e) => {
      console.warn('realtime live unavailable, using frames', e);
      if (alive.current) setLegacy(true);
    });

    // Phone-camera frames for when the glasses aren't sending video.
    const frames = setInterval(async () => {
      if (pausedRef.current || AppState.currentState !== 'active' || !cameraRef.current || !cameraReady.current) return;
      try {
        const pic = await cameraRef.current.takePictureAsync({ quality: 0.5, shutterSound: false });
        const ref = await ImageManipulator.manipulate(pic.uri).resize({ width: 512 }).renderAsync();
        const out = await ref.saveAsync({ base64: true, compress: 0.5, format: SaveFormat.JPEG });
        if (out.base64) Glasses?.liveSendFrame(out.base64);
      } catch {}
    }, 1000);

    return () => {
      liveReady.current = false;
      sub.remove();
      clearInterval(frames);
      Glasses?.liveStop();
      deactivateKeepAwake(KEEP_AWAKE).catch(() => {});
      stopGlasses();
    };
    // Starts once per mode; settings are read at start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legacy]);

  // ---------- lifecycle (frame-by-frame mode) ----------
  useEffect(() => {
    if (!legacy) return;
    alive.current = true;
    (async () => {
      if (!camPerm?.granted) await requestCamPerm();
      const mic = await requestRecordingPermissionsAsync();
      if (mic.granted) await openMic();
      else await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true });
      say(t.liveStarted);
    })();
    return () => {
      alive.current = false;
      micOpen.current = false;
      Voice.stop();
      Earcons.stopThinking();
      recorder.stop().catch(() => {});
      setAudioModeAsync({ allowsRecording: false, shouldPlayInBackground: false, allowsBackgroundRecording: false }).catch(() => {});
      deactivateKeepAwake(KEEP_AWAKE).catch(() => {});
      stopGlasses();
    };
    // Runs once per mode; later values are read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legacy]);

  // A new look every interval without waiting for the last answer; `tick` skips a beat
  // while two are already in flight.
  // Runs in both modes: in realtime mode it's what spots hazards, and Gemini says them.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const loop = () => {
      tick();
      if (!stopped) timer = setTimeout(loop, settings.liveEvery * 1000);
    };
    timer = setTimeout(loop, 1200);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [tick, settings.liveEvery]);

  const togglePause = () => {
    const next = !paused;
    pausedRef.current = next;
    setPaused(next);
    if (settings.haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!legacy) {
      Glasses?.livePause(next);
      setOrb(next ? 'idle' : 'listening');
      return;
    }
    if (next) {
      setOrb('idle');
      say(t.liveStopped, true);
    } else {
      setOrb('listening');
      tick();
    }
  };

  const close = () => {
    alive.current = false;
    Voice.stop();
    router.back();
  };

  const latest = notes[0];

  return (
    <View
      style={[styles.root, { backgroundColor: c.background, direction: dir, paddingTop: insets.top + Spacing.two }]}>
      <View style={styles.topBar}>
        <CircleButton icon="xmark" label={t.close} onPress={close} />
        <LiveChip paused={paused} label={paused ? t.livePaused : t.liveTitle} />
        <View style={{ width: 48 }} />
      </View>

      {/* camera */}
      <View style={[styles.preview, { backgroundColor: c.surface }]}>
        <CameraPreview
          cameraRef={cameraRef}
          readyRef={cameraReady}
          granted={!!camPerm?.granted}
          iconSize={40}
          iconColor={c.textTertiary}
        />
        <View style={styles.previewOverlay} pointerEvents="none">
          <View style={styles.sourceChip}>
            <SymbolView name={fromGlasses ? 'eyeglasses' : 'iphone.rear.camera'} size={14} tintColor="#FFFFFF" />
            <Text variant="caption" style={{ color: '#FFFFFF' }}>
              {t.liveSource(fromGlasses)}
            </Text>
          </View>
          {fromGlasses && !!obstacle?.level && (
            <View style={[styles.sourceChip, { backgroundColor: obstacle.level === 3 ? '#FF3B30' : '#FF9F0A' }]}>
              <SymbolView name="sensor.fill" size={14} tintColor="#FFFFFF" />
              <Text variant="caption" style={{ color: '#FFFFFF' }}>
                {t.obstacle(obstacle.level, obstacle.side, obstacle.label)}
              </Text>
            </View>
          )}
          <View style={styles.orbCorner}>
            <Orb size={46} state={paused ? 'idle' : orb} />
          </View>
        </View>
      </View>

      {/* narration */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.feed}>
        {latest ? (
          <View style={styles.latest} accessibilityLiveRegion="polite">
            {latest.urgent && (
              <View style={[styles.urgent, { backgroundColor: c.stop }]}>
                <SymbolView name="exclamationmark.triangle.fill" size={16} tintColor={c.stopText} />
              </View>
            )}
            <Text variant="spoken" style={{ fontWeight: '700', flex: 1 }}>
              {latest.text}
            </Text>
          </View>
        ) : (
          <Text variant="body" tone="secondary">
            {failed ? t.errNetwork : paused ? t.livePaused : t.liveEmpty}
            {'\n\n'}
            {t.livePocketHint}
          </Text>
        )}
        {notes.slice(1).map((n) => (
          <View key={n.id} style={styles.older}>
            <Text variant="caption" tone="tertiary">
              {n.at.toLocaleTimeString(lang === 'ar' ? 'ar' : 'en', { hour: 'numeric', minute: '2-digit' })}
            </Text>
            <Text variant="body" tone="secondary" style={{ flex: 1 }}>
              {n.text}
            </Text>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.controls, { paddingBottom: insets.bottom + Spacing.three }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={paused ? t.resume : t.pause}
          onPress={togglePause}
          style={({ pressed }) => [
            styles.pill,
            { backgroundColor: paused ? c.text : c.stop, opacity: pressed ? 0.75 : 1 },
          ]}>
          <SymbolView
            name={paused ? 'play.fill' : 'pause.fill'}
            size={20}
            tintColor={paused ? c.background : c.stopText}
            weight="semibold"
          />
          <Text variant="heading" style={{ color: paused ? c.background : c.stopText }}>
            {paused ? t.resume : t.pause}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function LiveChip({ paused, label }: { paused: boolean; label: string }) {
  const c = useColors();
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = paused ? 1 : withRepeat(withTiming(0.25, { duration: 800 }), -1, true);
  }, [paused, pulse]);
  const dot = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <View style={[styles.chip, { backgroundColor: paused ? c.surface : 'rgba(255,59,48,0.12)' }]}>
      <Animated.View style={[styles.dot, { backgroundColor: paused ? c.textTertiary : '#FF3B30' }, dot]} />
      <Text variant="caption">{label}</Text>
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
    paddingBottom: Spacing.three,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 36,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.full,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  preview: {
    height: '42%',
    marginHorizontal: Spacing.three,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'space-between', padding: Spacing.three },
  sourceChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    paddingHorizontal: Spacing.two + 2,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  orbCorner: { alignSelf: 'flex-end', marginBottom: -Spacing.three, marginEnd: -Spacing.three },
  feed: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.four, gap: Spacing.three },
  latest: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  urgent: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  older: { flexDirection: 'row', gap: Spacing.three, alignItems: 'baseline' },
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
