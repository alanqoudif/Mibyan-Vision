import { useCameraPermissions, type CameraView } from 'expo-camera';
import { useKeepAwake } from 'expo-keep-awake';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, View } from 'react-native';

import { CameraPreview } from '@/components/camera-preview';
import { SenseOrb, type SenseOrbState } from '@/components/sense-orb';
import { Text } from '@/components/text';
import { Badge, Banner, Button, Card, Chip, EmptyState, IconButton, Screen, ScreenHeader, TextField, useToast } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { checkCompat } from '@/lib/compat';
import { stopGlasses, takeGlassesNotice, useCameraSource, useGlasses } from '@/lib/glasses';
import { useI18n } from '@/lib/i18n';
import { runInstalled } from '@/lib/run-sense';
import { createPhoneAdapters } from '@/lib/sense-adapters';
import { useSettings } from '@/lib/settings';
import { addRecord, currentUserId, getActiveShift, isOfflineError, senseName, useInstalledSenses } from '@/lib/sixth';
import { useS } from '@/lib/strings';
import { useVisionSession } from '@/lib/vision';
import * as Voice from '@/lib/voice';
import type { DeviceKind, RunResult } from '@mibyan/shared/sense';

type Phase = 'idle' | 'capturing' | 'analyzing' | 'done' | 'error';

/**
 * Live Vision: one capture-and-understand loop on real inputs. It labels exactly where the image
 * came from (glasses or phone), runs an installed Sense or a free question, and shows loading,
 * network, AI, permission and disconnection errors as what they are.
 */
export default function LiveVisionScreen() {
  useKeepAwake();
  const router = useRouter();
  const s = useS();
  const { lang } = useI18n();
  const toast = useToast();
  const { settings } = useSettings();
  const glasses = useGlasses();
  const source = useCameraSource();
  const session = useVisionSession();
  const installed = useInstalledSenses();
  const { sense: senseParam } = useLocalSearchParams<{ sense?: string }>();
  const [cam, requestCam] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const readyRef = useRef(false);

  const enabled = installed.items.filter((i) => i.enabled);
  const [selected, setSelected] = useState<string | null>(senseParam ?? null);
  const current = enabled.find((i) => i.manifest.id === selected) ?? null;
  const [question, setQuestion] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [usedSource, setUsedSource] = useState<DeviceKind | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [flagged, setFlagged] = useState(false);
  const [notice, setNotice] = useState('');

  const phoneCapture = async () => {
    if (!readyRef.current || !cameraRef.current) return undefined;
    return (await cameraRef.current.takePictureAsync({ quality: 0.5, shutterSound: false })).uri;
  };

  const compat = current ? checkCompat(current.manifest, { glassesReady: glasses.status === 'ready', signedIn: !!session.email, lang }) : null;

  const fail = (e: unknown) => {
    const m = e instanceof Error ? e.message : String(e);
    setError(isOfflineError(m) ? s.lvNetwork : `${s.lvAiFail}: ${m}`);
    setPhase('error');
    AccessibilityInfo.announceForAccessibility(s.lvAiFail);
  };
  const afterCapture = () => {
    const n = takeGlassesNotice();
    setNotice(n === 'lost' || n === 'paused' ? s.lvGlassesLost : '');
  };
  const ensureCamera = async () => {
    if (cam?.granted) return true;
    const r = await requestCam();
    return r.granted;
  };

  const runSense = async () => {
    if (!current) return;
    if (!compat?.runnable) return toast(s.sdNotRunnable, 'error');
    if (!(await ensureCamera()) && !source.glasses) { setError(s.lvPermDenied); setPhase('error'); return; }
    setPhase('analyzing');
    setError('');
    setAnswer('');
    try {
      const out = await runInstalled(current, { lang, phoneCapture, speakResult: settings.speakResults });
      afterCapture();
      setResult(out.result);
      setUsedSource(out.source ?? null);
      setFlagged(out.flagged);
      const failed = out.result.steps.find((x) => x.status === 'failed' || x.status === 'blocked');
      if (failed) {
        setError(failed.error ?? s.lvAiFail);
        setPhase('error');
      } else {
        setAnswer(out.text ?? '');
        setPhase('done');
        AccessibilityInfo.announceForAccessibility(out.text ?? s.done);
      }
    } catch (e) {
      fail(e);
    }
  };

  const ask = async () => {
    if (!question.trim()) return;
    if (!(await ensureCamera()) && !source.glasses) { setError(s.lvPermDenied); setPhase('error'); return; }
    setResult(null);
    setError('');
    setAnswer('');
    setPhase('capturing');
    try {
      const a = createPhoneAdapters({ lang, phoneCapture, onSource: setUsedSource });
      const shot = await a.capture!();
      afterCapture();
      setUsedSource(shot.source);
      setPhase('analyzing');
      const r = await a.describe!(shot.imageRef, question.trim());
      setAnswer(r.text);
      setPhase('done');
      AccessibilityInfo.announceForAccessibility(r.text);
      if (settings.speakResults) Voice.speak(r.text);
    } catch (e) {
      fail(e);
    }
  };

  const capture = async () => {
    if (!(await ensureCamera()) && !source.glasses) { setError(s.lvPermDenied); setPhase('error'); return; }
    setPhase('capturing');
    setError('');
    try {
      const a = createPhoneAdapters({ lang, phoneCapture, onSource: setUsedSource });
      const shot = await a.capture!();
      afterCapture();
      setUsedSource(shot.source);
      setPhase('analyzing');
      const r = await a.describe!(shot.imageRef, undefined);
      setAnswer(r.text);
      setResult(null);
      setPhase('done');
    } catch (e) {
      fail(e);
    }
  };

  const save = async () => {
    if (!answer) return;
    try {
      if (!(await currentUserId())) return toast(s.shNeedBackend, 'info');
      const shift = await getActiveShift().catch(() => null);
      await addRecord({
        shiftId: shift?.id,
        senseId: current?.manifest.id,
        type: flagged ? 'issue' : 'observation',
        text: answer,
        flagged,
        consented: true, // the person tapped "save" for this exact text
        source: usedSource === 'meta_glasses' ? 'device' : 'phone',
      });
      toast(s.lvSaved, 'success');
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      toast(/does not exist|schema cache/i.test(m) ? s.shSchemaMissing : m, 'error');
    }
  };

  const orb: SenseOrbState = phase === 'capturing' || phase === 'analyzing' ? 'analyzing' : phase === 'done' ? 'responding' : phase === 'error' ? 'error' : glasses.status === 'ready' ? 'connected' : 'idle';
  const srcLabel = (usedSource ?? (source.glasses ? 'meta_glasses' : 'phone_camera')) === 'meta_glasses' ? s.lvSourceGlasses : s.lvSourcePhone;
  const busy = phase === 'capturing' || phase === 'analyzing';
  const camDenied = cam && !cam.granted && !source.glasses;

  return (
    <Screen
      header={
        <ScreenHeader
          close
          title={s.lvTitle}
          trailing={<IconButton icon="stop.fill" label={s.lvStop} tint="#FF7A90" onPress={() => { Voice.stop(); stopGlasses(); router.back(); }} />}
        />
      }>
      {/* Source is always labelled; phone output is never presented as glasses footage. */}
      <View style={[styles.preview, { backgroundColor: '#000' }]} accessibilityLabel={s.lvSourceLine(srcLabel)}>
        {camDenied ? (
          <EmptyState icon="camera.fill" title={s.lvPermDenied} action={{ label: s.lvAllowCamera, onPress: () => void requestCam() }} />
        ) : (
          <CameraPreview cameraRef={cameraRef} readyRef={readyRef} granted={!!cam?.granted} iconSize={44} iconColor="#8F8EA6" />
        )}
        <View style={styles.sourceTag}>
          <Badge tone={srcLabel === s.lvSourceGlasses ? 'success' : 'accent'} label={s.lvSourceLine(srcLabel)} />
        </View>
      </View>

      <View style={styles.statusRow} accessibilityLiveRegion="polite" accessible>
        <SenseOrb size={52} state={orb} />
        <Text variant="heading" style={{ flex: 1 }}>
          {phase === 'capturing' ? s.lvCapturing : phase === 'analyzing' ? s.lvAnalyzing : phase === 'done' ? s.lvResponse : phase === 'error' ? s.lvAiFail : s.lvIdle}
        </Text>
      </View>

      {notice ? <Banner message={notice} icon="eyeglasses" /> : null}

      <View style={{ gap: Spacing.two }}>
        <Text variant="label" tone="tertiary">{s.lvActiveSense.toUpperCase()}</Text>
        {enabled.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.two }}>
            {enabled.map((i) => (
              <Chip key={i.manifest.id} label={senseName(i.manifest, lang)} selected={selected === i.manifest.id} onPress={() => setSelected(i.manifest.id)} />
            ))}
          </ScrollView>
        ) : (
          <Text tone="secondary">{s.noActiveSensesBody}</Text>
        )}
        {current && compat && !compat.runnable ? <Banner tone="warning" icon="exclamationmark.triangle.fill" message={s.sdNotRunnable} /> : null}
        <Button label={current ? `${s.lvRun}: ${senseName(current.manifest, lang)}` : s.lvNoSense} icon="play.fill" loading={busy} disabled={!current || !compat?.runnable} onPress={() => void runSense()} />
      </View>

      <View style={{ gap: Spacing.two }}>
        <TextField value={question} onChange={setQuestion} placeholder={s.lvAskPlaceholder} />
        <View style={styles.pair}>
          <Button style={{ flex: 1 }} variant="secondary" icon="questionmark.bubble.fill" label={s.lvAsk} disabled={busy || !question.trim()} onPress={() => void ask()} />
          <Button style={{ flex: 1 }} variant="secondary" icon="camera.fill" label={s.lvCapture} disabled={busy} onPress={() => void capture()} />
        </View>
      </View>

      {error ? <Banner tone="danger" icon="xmark.octagon.fill" message={error} /> : null}

      {answer ? (
        <Card style={{ gap: Spacing.two }}>
          <View style={styles.statusRow}>
            <Text variant="label" tone="tertiary" style={{ flex: 1 }}>{s.lvResponse.toUpperCase()}</Text>
            {flagged ? <Badge tone="warning" label={s.lvFlagged} /> : null}
          </View>
          <Text variant="spoken" selectable>{answer}</Text>
          <View style={styles.pair}>
            <Button style={{ flex: 1 }} compact variant="secondary" icon="speaker.wave.2.fill" label={s.lvSpeak} onPress={() => Voice.speak(answer)} />
            <Button style={{ flex: 1 }} compact variant="secondary" icon="square.and.arrow.down" label={s.lvSaveObs} onPress={() => void save()} />
          </View>
        </Card>
      ) : null}

      {result ? (
        <Card style={{ gap: Spacing.one }}>
          <Text variant="label" tone="tertiary">{s.lvSteps.toUpperCase()}</Text>
          {result.steps.map((st) => (
            <Text key={st.nodeId + st.startedAt} variant="caption" tone={st.status === 'failed' || st.status === 'blocked' ? 'danger' : 'secondary'}>
              {s.stepStatus[st.status] ?? st.status} · {s.nodeKind[st.kind] ?? st.kind}{st.error ? ` — ${st.error}` : ''}
            </Text>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: { height: 260, borderRadius: Radius.xl, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  sourceTag: { position: 'absolute', top: Spacing.two, start: Spacing.two },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  pair: { flexDirection: 'row', gap: Spacing.two },
});
