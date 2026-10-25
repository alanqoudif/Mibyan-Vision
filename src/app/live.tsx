import { setAudioModeAsync } from 'expo-audio';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CircleButton } from '@/components/chrome';
import { Orb, type OrbState } from '@/components/orb';
import { Text } from '@/components/text';
import { Radius, Spacing, useColors } from '@/constants/theme';
import { SILENT, URGENT, streamAssist, type Turn } from '@/lib/assist';
import * as Earcons from '@/lib/earcons';
import { captureFromGlasses, stopGlasses, takeGlassesNotice } from '@/lib/glasses';
import { useI18n } from '@/lib/i18n';
import { SPEECH_RATE, useSettings } from '@/lib/settings';

type Note = { id: number; text: string; urgent: boolean; at: Date };

/**
 * Live mode: grabs a frame every few seconds and only speaks when the model
 * reports something new or important (it answers <silent> otherwise).
 * Hazards come back prefixed with "!" and get a strong haptic + interrupt.
 */
export default function LiveScreen() {
  useKeepAwake();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const { settings } = useSettings();
  const { t, lang, dir, speechLang } = useI18n();

  const [camPerm, requestCamPerm] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const cameraReady = useRef(false);

  const [paused, setPaused] = useState(false);
  const [orb, setOrb] = useState<OrbState>('idle');
  const [notes, setNotes] = useState<Note[]>([]);
  const [fromGlasses, setFromGlasses] = useState(false);
  const [failed, setFailed] = useState(false);

  const alive = useRef(true);
  const pausedRef = useRef(false);
  const busy = useRef(false);
  const speaking = useRef(false);
  const context = useRef<Turn[]>([]);
  const nextId = useRef(1);
  const failedRef = useRef(false);

  // ---------- frames ----------
  const captureFrame = useCallback(async (): Promise<string | undefined> => {
    try {
      let uri = await captureFromGlasses();
      setFromGlasses(!!uri);
      if (!uri && cameraRef.current && cameraReady.current) {
        uri = (await cameraRef.current.takePictureAsync({ quality: 0.5, shutterSound: false })).uri;
      }
      if (!uri) return undefined;
      const ref = await ImageManipulator.manipulate(uri).resize({ width: 640 }).renderAsync();
      return (await ref.saveAsync({ base64: true, compress: 0.55, format: SaveFormat.JPEG })).base64;
    } catch (e) {
      console.warn('live capture failed', e);
      return undefined;
    }
  }, []);

  const say = useCallback(
    (text: string, interrupt = false) => {
      if (interrupt) Speech.stop();
      speaking.current = true;
      setOrb('speaking');
      const done = () => {
        speaking.current = false;
        if (alive.current) setOrb(pausedRef.current ? 'idle' : 'listening');
      };
      Speech.speak(text, { language: speechLang, rate: SPEECH_RATE[settings.speed], onDone: done, onStopped: done, onError: done });
    },
    [settings.speed, speechLang],
  );

  // ---------- one look ----------
  const tick = useCallback(async () => {
    if (!alive.current || pausedRef.current || busy.current || speaking.current) return;
    busy.current = true;
    setOrb('thinking');
    try {
      const image = await captureFrame();
      const notice = takeGlassesNotice();
      if (notice && alive.current) say(t.glassesNotice[notice], true);
      if (!image || !alive.current || pausedRef.current) return;
      const raw = await streamAssist(
        { mode: 'live', image, history: context.current.slice(-6), model: settings.model, detail: false, lang },
        () => {},
      );
      setFailed(false);
      failedRef.current = false;
      const text = raw.trim();
      if (!alive.current || pausedRef.current || !text || text.includes(SILENT)) return;

      const urgent = text.startsWith(URGENT);
      const clean = text.replace(/^!\s*/, '');
      context.current.push({ role: 'assistant', content: clean });
      setNotes((n) => [{ id: nextId.current++, text: clean, urgent, at: new Date() }, ...n].slice(0, 30));
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
      busy.current = false;
      if (alive.current && !speaking.current) setOrb(pausedRef.current ? 'idle' : 'listening');
    }
  }, [captureFrame, lang, say, settings.haptics, settings.model, t]);

  // ---------- lifecycle ----------
  useEffect(() => {
    alive.current = true;
    (async () => {
      if (!camPerm?.granted) await requestCamPerm();
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      say(t.liveStarted);
    })();
    return () => {
      alive.current = false;
      Speech.stop();
      stopGlasses();
    };
    // Runs once; later values are read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A setTimeout chain, not setInterval: the glasses only serve one photo request at a time,
  // so each look must finish before the next is scheduled.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const loop = async () => {
      await tick();
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
    if (next) {
      Speech.stop();
      setOrb('idle');
      say(t.liveStopped);
    } else {
      setOrb('listening');
      tick();
    }
  };

  const close = () => {
    alive.current = false;
    Speech.stop();
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
          <SymbolView name="video.slash" size={40} tintColor={c.textTertiary} />
        )}
        <View style={styles.previewOverlay} pointerEvents="none">
          <View style={styles.sourceChip}>
            <SymbolView name={fromGlasses ? 'eyeglasses' : 'iphone.rear.camera'} size={14} tintColor="#FFFFFF" />
            <Text variant="caption" style={{ color: '#FFFFFF' }}>
              {t.liveSource(fromGlasses)}
            </Text>
          </View>
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
