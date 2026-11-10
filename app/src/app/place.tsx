import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CircleButton } from '@/components/chrome';
import { PlaceMap } from '@/components/place-map';
import { Text } from '@/components/text';
import { Button } from '@/components/ui';
import { MinTouch, Radius, Spacing, useColors } from '@/constants/theme';
import { appendMessage, getChat, newId } from '@/lib/chats';
import type { PlaceKind } from '@/lib/commands';
import { useI18n } from '@/lib/i18n';
import { KINDS, directionText, distanceText, findNearby, nearbySpeech, walkText, type Coords, type NearbyPlace } from '@/lib/nearby';
import { currentPosition, describePlace } from '@/lib/place';
import { SPEECH_RATE, useSettings } from '@/lib/settings';
import * as Voice from '@/lib/voice';

type Phase = 'locating' | 'searching' | 'done' | 'noLocation' | 'error';

const COPY = {
  ar: {
    whereTitle: 'موقعك',
    nearTitle: (k: string) => `أقرب ${k}`,
    locating: 'أحدد موقعك…',
    searching: 'أدوّر حولك…',
    noLocation: 'ما قدرت أحدد موقعك. اسمح للتطبيق بالموقع وحاول مرة ثانية.',
    error: 'ما قدرت أوصل لخدمة الأماكن. تأكد من الإنترنت وحاول مرة ثانية.',
    you: (p: string) => `أنت الحين في: ${p}.`,
    unknownPlace: 'حددت موقعك على الخريطة، بس ما عرفت اسم الشارع.',
    repeat: 'أعد',
    directions: 'الاتجاهات',
    directionsTo: (n: string) => `اتجاهات المشي إلى ${n}`,
    lookAround: 'صف لي اللي حولي',
    openSettings: 'افتح الإعدادات',
    retry: 'حاول مرة ثانية',
    close: 'إغلاق',
  },
  en: {
    whereTitle: 'Your location',
    nearTitle: (k: string) => `Nearest ${k}`,
    locating: 'Finding your location…',
    searching: 'Looking around you…',
    noLocation: 'I couldn’t get your location. Allow location access and try again.',
    error: 'I couldn’t reach the places service. Check your connection and try again.',
    you: (p: string) => `You’re at: ${p}.`,
    unknownPlace: 'I found you on the map, but not the street name.',
    repeat: 'Repeat',
    directions: 'Directions',
    directionsTo: (n: string) => `Walking directions to ${n}`,
    lookAround: 'Describe around me',
    openSettings: 'Open Settings',
    retry: 'Try again',
    close: 'Close',
  },
};

async function heading(): Promise<number | null> {
  try {
    const h = await Promise.race([Location.getHeadingAsync(), new Promise<null>((r) => setTimeout(() => r(null), 1500))]);
    if (!h) return null;
    const v = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
    return v >= 0 ? v : null;
  } catch {
    return null;
  }
}

/**
 * "Where am I" and "the nearest …": finds the user, looks around, shows it on a map and says
 * the answer aloud, then leaves the answer in the chat it came from.
 */
export default function PlaceScreen() {
  const { kind: kindParam, cid } = useLocalSearchParams<{ kind?: string; q?: string; cid?: string }>();
  const kind = (kindParam && kindParam in KINDS ? kindParam : 'where') as PlaceKind | 'where';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const { lang, dir, speechLang } = useI18n();
  const { settings } = useSettings();
  const t = COPY[lang];
  const info = kind === 'where' ? null : KINDS[kind];

  const [phase, setPhase] = useState<Phase>('locating');
  const [center, setCenter] = useState<Coords | null>(null);
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [head, setHead] = useState<number | null>(null);
  const [answer, setAnswer] = useState('');
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  const alive = useRef(true);

  const say = (text: string) => {
    Voice.stop();
    Voice.speak(text, { language: speechLang, rate: SPEECH_RATE[settings.speed] });
  };

  useEffect(() => {
    alive.current = true;
    const ctrl = new AbortController();
    (async () => {
      setPhase('locating');
      Voice.speak(t.locating, { language: speechLang, rate: SPEECH_RATE[settings.speed] });
      const [pos, h] = await Promise.all([currentPosition(), heading()]);
      if (!alive.current) return;
      if (!pos) {
        setPhase('noLocation');
        say(t.noLocation);
        return;
      }
      const here = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setCenter(here);
      setHead(h);
      let text: string;
      try {
        if (kind === 'where') {
          const p = await describePlace(lang);
          text = p ? t.you(p) : t.unknownPlace;
        } else {
          setPhase('searching');
          const found = await findNearby(kind, here, lang, ctrl.signal);
          if (!alive.current) return;
          setPlaces(found);
          text = nearbySpeech(kind, found, h, lang, settings.directions === 'clock');
        }
      } catch (e) {
        if (!alive.current || ctrl.signal.aborted) return;
        console.warn(e);
        setPhase('error');
        say(t.error);
        return;
      }
      if (!alive.current) return;
      setAnswer(text);
      setPhase('done');
      if (settings.haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      say(text);
      // Leave the answer in the conversation that asked, so it's there after closing.
      if (cid && getChat(cid)) appendMessage(cid, { id: newId(), role: 'assistant', text });
    })();
    return () => {
      alive.current = false;
      ctrl.abort();
      Voice.stop();
    };
    // One search per open (and per retry); settings are read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const directionsTo = (p: NearbyPlace) => {
    const { latitude, longitude } = p.coords;
    const name = encodeURIComponent(p.name || (info ? info[lang].one : ''));
    Linking.openURL(
      Platform.OS === 'ios'
        ? `http://maps.apple.com/?daddr=${latitude},${longitude}&q=${name}&dirflg=w`
        : `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=walking`,
    );
  };

  const pick = (p: NearbyPlace) => {
    Haptics.selectionAsync();
    setSelected(p.id);
    const walk = walkText(p.meters, lang);
    say([p.name || info?.[lang].one, distanceText(p.meters, lang), walk, directionText(p.bearing, head, lang, settings.directions === 'clock')].filter(Boolean).join('، '));
  };

  const busy = phase === 'locating' || phase === 'searching';
  const status = phase === 'locating' ? t.locating : phase === 'searching' ? t.searching : phase === 'noLocation' ? t.noLocation : phase === 'error' ? t.error : answer;
  const title = info ? t.nearTitle(info[lang].one) : t.whereTitle;
  const first = places.find((p) => p.id === selected) ?? places[0];

  return (
    <View style={[styles.root, { backgroundColor: c.background, direction: dir }]}>
      <View style={[styles.map, { backgroundColor: c.surface }]}>
        {center ? <PlaceMap center={center} places={places} icon={info?.icon} selectedId={selected} /> : null}
        <View style={[styles.top, { paddingTop: insets.top + Spacing.two }]}>
          <CircleButton icon="xmark" label={t.close} onPress={() => router.back()} />
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + Spacing.four }]}>
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
        <View style={styles.answerRow} accessibilityLiveRegion="polite">
          {busy ? <ActivityIndicator color={c.textSecondary} /> : null}
          <Text variant="spoken" tone={phase === 'error' || phase === 'noLocation' ? 'danger' : busy ? 'secondary' : 'primary'} selectable style={{ flex: 1 }}>
            {status}
          </Text>
        </View>

        {phase === 'done' ? (
          <View style={styles.actions}>
            <Button compact variant="secondary" icon="speaker.wave.2.fill" label={t.repeat} onPress={() => say(answer)} />
            {first ? <Button compact icon="figure.walk" label={t.directions} hint={t.directionsTo(first.name || info?.[lang].one || '')} onPress={() => directionsTo(first)} /> : null}
            {kind === 'where' && settings.enabledTools.includes('where') ? (
              <Button compact variant="secondary" icon="eye.fill" label={t.lookAround} onPress={() => router.replace({ pathname: '/session', params: { mode: 'where' } })} />
            ) : null}
          </View>
        ) : null}
        {phase === 'noLocation' ? <Button label={t.openSettings} onPress={() => Linking.openSettings()} /> : null}
        {phase === 'error' || phase === 'noLocation' ? <Button variant="secondary" label={t.retry} onPress={() => setAttempt((n) => n + 1)} /> : null}

        {places.length ? (
          <View style={[styles.list, { borderColor: c.border, backgroundColor: c.card }]}>
            {places.map((p, i) => {
              const on = p.id === (selected ?? places[0].id);
              const name = p.name || info?.[lang].one || '';
              const meta = [distanceText(p.meters, lang), walkText(p.meters, lang), directionText(p.bearing, head, lang, settings.directions === 'clock')].filter(Boolean).join(' · ');
              return (
                <View key={p.id} style={[styles.item, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.border }]}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${name}. ${meta}`}
                    accessibilityState={{ selected: on }}
                    onPress={() => pick(p)}
                    style={({ pressed }) => [styles.itemMain, { opacity: pressed ? 0.6 : 1 }]}>
                    <View style={[styles.rank, { backgroundColor: on ? c.accent : c.surfaceStrong }]}>
                      <Text variant="label" style={{ color: on ? c.onAccent : c.textSecondary }}>
                        {i + 1}
                      </Text>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="heading" numberOfLines={1}>
                        {name}
                      </Text>
                      <Text variant="caption" tone="secondary" numberOfLines={2}>
                        {meta}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={t.directionsTo(name)} onPress={() => directionsTo(p)} style={styles.go}>
                    <SymbolView name="arrow.triangle.turn.up.right.circle.fill" size={30} tintColor={c.accentText} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  map: { height: '42%', overflow: 'hidden', borderBottomLeftRadius: Radius.lg, borderBottomRightRadius: Radius.lg },
  top: { position: 'absolute', top: 0, start: 0, end: 0, paddingHorizontal: Spacing.three, flexDirection: 'row' },
  body: { padding: Spacing.four, gap: Spacing.three },
  answerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  list: { borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center' },
  itemMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: MinTouch + 8, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  rank: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  go: { width: MinTouch, height: MinTouch, alignItems: 'center', justifyContent: 'center' },
});
