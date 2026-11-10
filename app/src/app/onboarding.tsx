import { useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SenseOrb } from '@/components/sense-orb';
import { Text } from '@/components/text';
import { Badge, Banner, Button, Card, Divider, Group, IconBadge, IconButton, Row, useBackIcon, useToast } from '@/components/ui';
import { Radius, Spacing, useColors, useGraphicSize } from '@/constants/theme';
import { checkCompat } from '@/lib/compat';
import { useGlasses } from '@/lib/glasses';
import { useI18n } from '@/lib/i18n';
import { useSettings } from '@/lib/settings';
import { EXPERIENCE_SENSES, installSense, senseDesc, senseIcon, senseName, useCatalog, CATEGORY_STYLE, displayCategory } from '@/lib/sixth';
import { useS } from '@/lib/strings';
import { useVisionSession } from '@/lib/vision';
import { requiredPermissions, type Permission } from '@mibyan/shared/sense';

type Exp = 'everyday' | 'accessibility' | 'work' | 'developer';
const STEPS = 7;

export default function Onboarding() {
  const router = useRouter();
  const c = useColors();
  const s = useS();
  const { lang, dir } = useI18n();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const reduce = useReducedMotion();
  const { settings, update } = useSettings();
  const glasses = useGlasses();
  const session = useVisionSession();
  const catalog = useCatalog();
  const [cam, requestCam] = useCameraPermissions();
  const backIcon = useBackIcon();
  const orb = useGraphicSize(190);

  const [step, setStep] = useState(0);
  const [exp, setExp] = useState<Exp>(settings.experience);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);

  const recommended = useMemo(() => {
    const ids = EXPERIENCE_SENSES[exp];
    return ids.map((id) => catalog.items.find((m) => m.id === id)).filter((m): m is NonNullable<typeof m> => !!m);
  }, [exp, catalog.items]);
  const selected = picked ?? recommended.map((m) => m.id);
  const chosen = recommended.filter((m) => selected.includes(m.id));
  const perms = [...new Set(chosen.flatMap((m) => [...m.permissions, ...requiredPermissions(m.workflow)]))] as Permission[];
  const anim = (i = 0) => (reduce ? undefined : FadeInDown.delay(i * 90).duration(350));

  const expOptions: { id: Exp; icon: SFSymbol; label: string; body: string }[] = [
    { id: 'everyday', icon: 'sun.max.fill', label: s.expEveryday, body: s.expEverydayBody },
    { id: 'accessibility', icon: 'figure.wave', label: s.expAccessibility, body: s.expAccessibilityBody },
    { id: 'work', icon: 'wrench.and.screwdriver.fill', label: s.expWork, body: s.expWorkBody },
    { id: 'developer', icon: 'chevron.left.forwardslash.chevron.right', label: s.expDeveloper, body: s.expDeveloperBody },
  ];

  const finish = async () => {
    setSaving(true);
    let failed = false;
    for (const m of chosen) {
      try {
        const k = checkCompat(m, { glassesReady: glasses.status === 'ready', signedIn: !!session.email, lang });
        await installSense(m, [...new Set([...m.permissions, ...requiredPermissions(m.workflow)])], k.runnable);
      } catch {
        failed = true;
      }
    }
    update({ sixthOnboarded: true, experience: exp, profileSenses: chosen.map((m) => m.id) });
    setSaving(false);
    if (failed) toast(s.obSaveFailed, 'error');
    router.replace('/');
  };

  const next = () => setStep((x) => Math.min(STEPS - 1, x + 1));

  return (
    <View style={{ flex: 1, backgroundColor: c.background, direction: dir, paddingTop: insets.top + Spacing.two, paddingBottom: insets.bottom + Spacing.three }}>
      <View style={styles.top}>
        <View style={{ width: 48 }}>{step > 0 && <IconButton icon={backIcon} label={s.back} onPress={() => setStep((x) => x - 1)} />}</View>
        <View style={styles.dots} accessibilityLabel={`${step + 1} / ${STEPS}`} accessible>
          {Array.from({ length: STEPS }, (_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i === step ? c.accent : c.surfaceStrong, width: i === step ? 22 : 8 }]} />
          ))}
        </View>
        <View style={{ width: 48 }}>
          {step > 0 && step < STEPS - 1 && <Pressable accessibilityRole="button" accessibilityLabel={s.skip} onPress={() => setStep(STEPS - 1)} style={{ minHeight: 44, justifyContent: 'center' }}><Text variant="caption" tone="accent">{s.skip}</Text></Pressable>}
        </View>
      </View>

      <Animated.View key={step} entering={reduce ? undefined : FadeIn.duration(280)} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {step === 0 && (
          <View style={styles.center}>
            <SenseOrb size={orb} state="connected" />
            <Text variant="hero" center accessibilityRole="header">{s.obWelcomeTitle}</Text>
            <Text tone="secondary" center>{s.obWelcomeBody}</Text>
            <Text variant="label" tone="tertiary" center>{s.tagline2}</Text>
          </View>
        )}

        {step === 1 && (
          <View style={{ gap: Spacing.four }}>
            <Text variant="display" accessibilityRole="header">{s.obWhatTitle}</Text>
            <Text tone="secondary">{s.obWhatBody}</Text>
            <View style={{ gap: Spacing.two }}>
              {([['eye.fill', s.obWhatSee, '#8B5CF6'], ['dot.viewfinder', s.obWhatDetect, '#38D5F0'], ['brain.head.profile', s.obWhatRemember, '#D9C3A0'], ['bubble.left.fill', s.obWhatTell, '#34D17A']] as [SFSymbol, string, string][]).map(([icon, label, hue], i) => (
                <Animated.View key={label} entering={anim(i)}>
                  <Card style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
                    <IconBadge icon={icon} hue={hue} />
                    <Text variant="heading">{label}</Text>
                  </Card>
                </Animated.View>
              ))}
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={{ gap: Spacing.three }}>
            <Text variant="display" accessibilityRole="header">{s.obChooseTitle}</Text>
            <Text tone="secondary">{s.obChooseBody}</Text>
            {expOptions.map((o, i) => (
              <Animated.View key={o.id} entering={anim(i)}>
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: exp === o.id }}
                  accessibilityLabel={`${o.label}. ${o.body}`}
                  onPress={() => { setExp(o.id); setPicked(null); }}
                  style={[styles.choice, { backgroundColor: c.card, borderColor: exp === o.id ? c.accent : 'transparent', borderWidth: 2 }]}>
                  <IconBadge icon={o.icon} />
                  <View style={{ flex: 1 }}>
                    <Text variant="heading">{o.label}</Text>
                    <Text variant="caption" tone="secondary">{o.body}</Text>
                  </View>
                  {exp === o.id ? <SymbolView name="checkmark.circle.fill" size={24} tintColor={c.accent} /> : null}
                </Pressable>
              </Animated.View>
            ))}
          </View>
        )}

        {step === 3 && (
          <View style={{ gap: Spacing.three }}>
            <Text variant="display" accessibilityRole="header">{s.obFirstTitle}</Text>
            <Text tone="secondary">{s.obFirstBody}</Text>
            {recommended.map((m) => {
              const on = selected.includes(m.id);
              return (
                <Pressable
                  key={m.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${senseName(m, lang)}. ${senseDesc(m, lang)}`}
                  onPress={() => setPicked(on ? selected.filter((x) => x !== m.id) : [...selected, m.id])}
                  style={[styles.choice, { backgroundColor: c.card, borderColor: on ? c.accent : 'transparent', borderWidth: 2 }]}>
                  <IconBadge icon={senseIcon(m)} hue={CATEGORY_STYLE[displayCategory(m)].hue} />
                  <View style={{ flex: 1 }}>
                    <Text variant="heading">{senseName(m, lang)}</Text>
                    <Text variant="caption" tone="secondary" numberOfLines={2}>{senseDesc(m, lang)}</Text>
                  </View>
                  <SymbolView name={on ? 'checkmark.circle.fill' : 'circle'} size={24} tintColor={on ? c.accent : c.textTertiary} />
                </Pressable>
              );
            })}
            {perms.length ? <Banner tone="accent" icon="checkmark.shield.fill" message={`${s.sdInstallBody} ${perms.map((p) => s.perm[p]).join('، ')}`} /> : null}
          </View>
        )}

        {step === 4 && (
          <View style={styles.center}>
            <SenseOrb size={orb * 0.7} state={glasses.status === 'ready' ? 'connected' : glasses.status === 'registering' ? 'analyzing' : 'disconnected'} />
            <Text variant="display" center accessibilityRole="header">{s.obConnectTitle}</Text>
            <Text tone="secondary" center>{s.obConnectBody}</Text>
            <Badge tone={glasses.status === 'ready' ? 'success' : 'neutral'} label={s.gStatus[glasses.status]} />
            {glasses.status === 'unsupported' || glasses.status === 'unregistered' ? <Text tone="secondary" center variant="caption">{s.obConnectNone}</Text> : null}
            {glasses.error ? <Banner tone="danger" icon="xmark.octagon.fill" message={glasses.error} /> : null}
          </View>
        )}

        {step === 5 && (
          <View style={{ gap: Spacing.three }}>
            <Text variant="display" accessibilityRole="header">{s.obPermTitle}</Text>
            <Text tone="secondary">{s.obPermBody}</Text>
            <Group>
              <Row icon="camera.fill" title={s.obPermCamera} subtitle={s.obPermCameraBody} trailing={cam?.granted ? <Badge tone="success" label={s.obPermGranted} /> : <Button compact variant="secondary" label={s.obPermGrant} onPress={() => void requestCam()} />} />
              <Divider />
              <Row icon="mic.fill" title={s.obPermMic} subtitle={s.obPermMicBody} />
            </Group>
          </View>
        )}

        {step === 6 && (
          <View style={{ gap: Spacing.three }}>
            <View style={{ alignItems: 'center' }}><SenseOrb size={orb * 0.6} state="responding" /></View>
            <Text variant="display" center accessibilityRole="header">{s.obReadyTitle}</Text>
            <Text tone="secondary" center>{chosen.length ? s.obReadyBody : s.obReadyNone}</Text>
            {chosen.map((m) => <Row key={m.id} icon={senseIcon(m)} hue={CATEGORY_STYLE[displayCategory(m)].hue} title={senseName(m, lang)} subtitle={senseDesc(m, lang)} />)}
            {!session.email ? <Banner tone="accent" icon="iphone" message={s.localOnlyNote} /> : null}
          </View>
        )}
      </ScrollView>
      </Animated.View>

      <View style={styles.footer}>
        {step === 0 && <Button label={s.obStart} onPress={next} />}
        {step >= 1 && step <= 3 && <Button label={s.next} onPress={next} />}
        {step === 4 && (
          <>
            {glasses.status !== 'ready' && glasses.status !== 'unsupported' ? <Button label={s.obConnectButton} icon="link" loading={glasses.busy} onPress={() => void glasses.connect()} /> : null}
            <Button variant={glasses.status === 'ready' ? 'primary' : 'ghost'} label={glasses.status === 'ready' ? s.next : s.obConnectSkip} onPress={next} />
          </>
        )}
        {step === 5 && <Button label={s.next} onPress={next} />}
        {step === 6 && (
          <>
            <Button label={saving ? s.obSaving : s.obReadyGo} loading={saving} onPress={() => void finish()} />
            {exp === 'accessibility' ? <Button variant="ghost" icon="mic.fill" label={s.prVoiceSetup} onPress={() => { update({ sixthOnboarded: true, experience: exp }); router.replace('/welcome'); }} /> : null}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.three, minHeight: 48 },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { height: 8, borderRadius: 4 },
  body: { flexGrow: 1, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, justifyContent: 'center' },
  center: { alignItems: 'center', gap: Spacing.three },
  choice: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: Radius.lg, minHeight: 72 },
  footer: { paddingHorizontal: Spacing.three, gap: Spacing.two },
});
