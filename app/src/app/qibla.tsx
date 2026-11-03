import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CircleButton } from '@/components/chrome';
import { Text } from '@/components/text';
import { Spacing, Radius, useColors } from '@/constants/theme';
import * as Earcons from '@/lib/earcons';
import { useI18n } from '@/lib/i18n';
import { currentPosition } from '@/lib/place';
import { SPEECH_RATE, useSettings } from '@/lib/settings';
import * as Voice from '@/lib/voice';

const KAABA = { latitude: 21.422487, longitude: 39.826206 };
/** Within this many degrees counts as facing the qibla. */
const ON_TARGET = 8;
/** Facing it for this long, steadily, is "found". */
const HOLD_MS = 1500;
/** Drifting this far after "found" starts the guidance again. */
const LOST = 20;

type Turn = 'ahead' | 'slightRight' | 'slightLeft' | 'right' | 'left' | 'behind';

/**
 * Qibla direction by sound, no internet needed: GPS gives the bearing to the Kaaba and the
 * compass the way the phone points. Pings speed up as the phone turns toward the qibla and turn
 * high-pitched when it's straight ahead; a short phrase is spoken when the turn changes.
 * Holding it there for a moment is "found", with a success haptic.
 */
export default function QiblaScreen() {
  useKeepAwake();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const { settings } = useSettings();
  const { t, dir, speechLang } = useI18n();

  const [bearing, setBearing] = useState<number | null>(null);
  const [delta, setDelta] = useState<number | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [found, setFound] = useState(false);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lowAccuracy, setLowAccuracy] = useState(false);

  const alive = useRef(true);
  const deltaRef = useRef<number | null>(null);
  const foundRef = useRef(false);
  const pausedRef = useRef(false);
  const lastTurn = useRef<Turn | null>(null);
  const onTargetSince = useRef(0);
  const toldCalibrate = useRef(false);

  const say = (text: string, interrupt = false) =>
    Voice.speakNow(text, { language: speechLang, rate: SPEECH_RATE[settings.speed], interrupt });

  // Where the qibla is from here.
  useEffect(() => {
    alive.current = true;
    say(t.qiblaHold);
    (async () => {
      const pos = await currentPosition();
      if (!alive.current) return;
      if (!pos) {
        setError(t.qiblaNoLocation);
        Earcons.play('error');
        say(t.qiblaNoLocation, true);
        return;
      }
      setBearing(bearingTo(pos.coords, KAABA));
      setDistanceKm(Math.round(distanceKm_(pos.coords, KAABA)));
    })();
    return () => {
      alive.current = false;
      Voice.stop();
    };
    // Runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Which way the phone points.
  useEffect(() => {
    if (bearing === null) return;
    let sub: Location.LocationSubscription | undefined;
    Location.watchHeadingAsync((h) => {
      const heading = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
      const d = wrap(bearing - heading);
      deltaRef.current = d;
      setDelta(d);
      const weak = h.accuracy <= 1;
      setLowAccuracy(weak);
      if (weak && !toldCalibrate.current) {
        toldCalibrate.current = true;
        say(t.qiblaCalibrate);
      }
    })
      .then((s) => {
        if (alive.current) sub = s;
        else s.remove();
      })
      .catch(() => setError(t.qiblaNoCompass));
    return () => sub?.remove();
    // `say` only reads settings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bearing]);

  // Sonar pings + spoken turns, faster when closer.
  useEffect(() => {
    if (bearing === null) return;
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      if (!alive.current) return;
      const d = deltaRef.current;
      let wait = 400;
      if (d !== null && !pausedRef.current) {
        const off = Math.abs(d);
        if (foundRef.current) {
          if (off > LOST) {
            foundRef.current = false;
            setFound(false);
            lastTurn.current = null;
          }
          wait = 500;
        } else {
          const ahead = off <= ON_TARGET;
          Earcons.ping(ahead);
          if (settings.haptics && ahead) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          if (ahead) {
            onTargetSince.current ||= Date.now();
            if (Date.now() - onTargetSince.current > HOLD_MS) {
              foundRef.current = true;
              setFound(true);
              Earcons.play('success');
              if (settings.haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              say(t.qiblaFound, true);
            }
          } else {
            onTargetSince.current = 0;
          }
          const turn = turnFor(d);
          if (turn !== lastTurn.current && !foundRef.current) {
            lastTurn.current = turn;
            if (turn !== 'ahead') say(t.qiblaTurn[turn], true);
          }
          // 180° off → ~1.1 s between pings, on target → 0.22 s.
          wait = ahead ? 220 : Math.round(300 + (Math.min(off, 180) / 180) * 800);
        }
      }
      timer = setTimeout(loop, wait);
    };
    timer = setTimeout(loop, 600);
    return () => clearTimeout(timer);
    // `say` only reads settings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bearing, settings.haptics]);

  const toggle = () => {
    const next = !paused;
    pausedRef.current = next;
    setPaused(next);
    if (settings.haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (next) say(t.qiblaPaused, true);
    else {
      lastTurn.current = null;
      foundRef.current = false;
      setFound(false);
    }
  };

  const close = () => {
    alive.current = false;
    Voice.stop();
    router.back();
  };

  const turn = delta === null ? null : turnFor(delta);
  const status = error
    ? error
    : delta === null
      ? t.qiblaLocating
      : found
        ? t.qiblaFound
        : paused
          ? t.qiblaPaused
          : turn === 'ahead'
            ? t.qiblaAlmost
            : t.qiblaTurn[turn!];

  return (
    <View style={[styles.root, { backgroundColor: c.background, direction: dir, paddingTop: insets.top + Spacing.two }]}>
      <View style={styles.topBar}>
        <CircleButton icon="xmark" label={t.close} onPress={close} />
        <Text variant="heading" accessibilityRole="header">
          {t.qiblaTitle}
        </Text>
        <View style={{ width: 48 }} />
      </View>

      <View style={styles.center} accessible accessibilityLiveRegion="polite" accessibilityLabel={status}>
        <View style={[styles.dial, { backgroundColor: found ? c.success : c.surface }]}>
          {/* The arrow points at the qibla relative to the top of the phone. */}
          <View style={{ transform: [{ rotate: `${delta ?? 0}deg` }] }}>
            <SymbolView name="location.north.fill" size={110} tintColor={found ? '#FFFFFF' : c.text} weight="bold" />
          </View>
        </View>
        <Text variant="title" center>
          {status}
        </Text>
        {delta !== null && !found && (
          <Text variant="heading" tone="secondary" center>
            {t.qiblaDegrees(Math.round(Math.abs(delta)), delta >= 0)}
          </Text>
        )}
        {distanceKm !== null && (
          <Text variant="caption" tone="secondary" center>
            {t.qiblaDistance(distanceKm)}
          </Text>
        )}
        {lowAccuracy && (
          <Text variant="caption" tone="secondary" center style={{ paddingHorizontal: Spacing.four }}>
            {t.qiblaCalibrate}
          </Text>
        )}
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + Spacing.three }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={paused ? t.resume : t.pause}
          disabled={bearing === null}
          onPress={toggle}
          style={({ pressed }) => [
            styles.pill,
            { backgroundColor: paused ? c.text : c.stop, opacity: bearing === null ? 0.35 : pressed ? 0.75 : 1 },
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

/** Signed degrees in (-180, 180]; positive means turn right. */
function wrap(deg: number) {
  const d = ((deg % 360) + 540) % 360 - 180;
  return d === -180 ? 180 : d;
}

function turnFor(d: number): Turn {
  const off = Math.abs(d);
  if (off <= ON_TARGET) return 'ahead';
  if (off > 135) return 'behind';
  if (off <= 30) return d > 0 ? 'slightRight' : 'slightLeft';
  return d > 0 ? 'right' : 'left';
}

const rad = (d: number) => (d * Math.PI) / 180;

/** Initial great-circle bearing from `a` to `b`, degrees from true north. */
function bearingTo(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const φ1 = rad(a.latitude);
  const φ2 = rad(b.latitude);
  const Δλ = rad(b.longitude - a.longitude);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function distanceKm_(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const h =
    Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  dial: { width: 200, height: 200, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
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
