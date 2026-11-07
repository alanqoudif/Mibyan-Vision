import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { SignInCard } from '@/components/sign-in-card';
import { Text } from '@/components/text';
import { Badge, Banner, Button, Card, Chip, EmptyState, Row, Screen, ScreenHeader, SectionHeader, Sheet, SkeletonList, TextField, Toggle, useToast, timeAgo } from '@/components/ui';
import { Spacing, useColors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';
import { addRecord, approveHandover, endShift, getActiveShift, isMissingTable, isOfflineError, listHandovers, listRecords, markRecordDone, saveHandoverDraft, startShift, toShiftRecord, type HandoverRow, type RecordRow } from '@/lib/sixth';
import { useS } from '@/lib/strings';
import { useAsync } from '@/lib/use-async';
import { useVisionSession } from '@/lib/vision';
import * as Voice from '@/lib/voice';
import { answerFromHandover, buildHandover, type Handover, type HandoverItem } from '@mibyan/shared/sense';

const TYPES: RecordRow['type'][] = ['observation', 'task_done', 'task_pending', 'issue'];

export default function ShiftScreen() {
  const router = useRouter();
  const s = useS();
  const c = useColors();
  const { lang } = useI18n();
  const toast = useToast();
  const session = useVisionSession();
  const [title, setTitle] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const [type, setType] = useState<RecordRow['type']>('observation');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<{ row: HandoverRow; ho: Handover } | null>(null);
  const [open, setOpen] = useState<HandoverRow | null>(null);

  const data = useAsync(async () => {
    if (!session.email) return null;
    const shift = await getActiveShift();
    const [records, handovers] = await Promise.all([shift ? listRecords({ shiftId: shift.id }) : Promise.resolve([] as RecordRow[]), listHandovers(8)]);
    return { shift, records, handovers };
  }, [session.email]);

  const err = data.error;
  const guard = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      toast(isMissingTable(m) ? s.shSchemaMissing : isOfflineError(m) ? s.offlineBanner : m, 'error');
    } finally {
      setBusy(false);
    }
  };

  const shift = data.data?.shift ?? null;
  const records = data.data?.records ?? [];

  const finish = () =>
    Alert.alert(s.shEnd, s.shDraftNote, [
      { text: s.cancel, style: 'cancel' },
      {
        text: s.shEnd,
        onPress: () =>
          void guard(async () => {
            if (!shift) return;
            const ho = buildHandover(shift.id, records.map((r) => toShiftRecord(r)));
            await endShift(shift.id);
            const row = await saveHandoverDraft(shift.id, ho);
            setDraft({ row, ho });
            data.refresh();
          }),
      },
    ]);

  return (
    <Screen header={<ScreenHeader back title={s.shTitle} />} onRefresh={data.refresh} refreshing={data.loading}>
      {!session.email ? <SignInCard message={s.shNeedBackend} /> : null}
      {err ? <Banner tone={isMissingTable(err) ? 'warning' : 'danger'} icon={isOfflineError(err) ? 'wifi.slash' : 'exclamationmark.triangle.fill'} message={isMissingTable(err) ? s.shSchemaMissing : isOfflineError(err) ? s.offlineBanner : err} /> : null}
      {session.email && data.loading && !data.data ? <SkeletonList count={2} /> : null}

      {session.email && !err && data.data ? (
        shift ? (
          <>
            <Card style={{ gap: Spacing.two }}>
              <Text variant="label" tone="tertiary">{s.shCurrent.toUpperCase()}</Text>
              <Text variant="title">{shift.title}</Text>
              <Text tone="secondary" variant="caption">{s.shSince(timeAgo(shift.started_at, lang))}</Text>
              <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                <Button style={{ flex: 1 }} compact icon="square.and.pencil" label={s.shAddNote} onPress={() => setNoteOpen(true)} />
                <Button style={{ flex: 1 }} compact variant="secondary" icon="camera.fill" label={s.shCaptureEvidence} onPress={() => router.push('/live-vision')} />
              </View>
              <Button variant="danger" label={s.shEnd} loading={busy} onPress={finish} />
            </Card>

            <SectionHeader title={s.shRecords} />
            {records.length ? records.map((r) => (
              <Card key={r.id} style={{ gap: Spacing.one }}>
                <View style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'center' }}>
                  <Badge tone={r.type === 'issue' ? 'warning' : r.type === 'task_done' ? 'success' : 'neutral'} label={s.actRecordType[r.type]} />
                  {r.consented ? <Badge tone="accent" label={s.shShare} /> : null}
                </View>
                <Text>{r.text}</Text>
                {r.type === 'task_pending' ? <Button compact variant="secondary" icon="checkmark.circle" label={s.actRecordType.task_done} onPress={() => void guard(async () => { await markRecordDone(r.id); data.refresh(); })} /> : null}
              </Card>
            )) : <Text tone="secondary">{s.shNoRecords}</Text>}
          </>
        ) : (
          <Card style={{ gap: Spacing.three }}>
            <Text variant="heading">{s.shNone}</Text>
            <Text tone="secondary">{s.shNoneBody}</Text>
            <TextField value={title} onChange={setTitle} placeholder={s.shStartPlaceholder} />
            <Button label={s.shStart} icon="play.fill" loading={busy} disabled={!title.trim()} onPress={() => void guard(async () => { await startShift(title); setTitle(''); data.refresh(); })} />
          </Card>
        )
      ) : null}

      {session.email && !err && data.data ? (
        <>
          <SectionHeader title={s.shPrevious} />
          {data.data.handovers.length ? data.data.handovers.map((h) => (
            <Row key={h.id} icon={h.status === 'approved' ? 'checkmark.seal.fill' : 'doc.text'} hue={h.status === 'approved' ? c.success : c.warning} title={s.shOpenHandover} subtitle={`${timeAgo(h.created_at, lang)} · ${h.status === 'approved' ? s.shApproved : s.shDraftNote}`} chevron onPress={() => setOpen(h)} />
          )) : <Text tone="secondary">{s.shNoPrevious}</Text>}
        </>
      ) : null}

      {!session.email ? <EmptyState icon="person.badge.clock.fill" title={s.shNone} body={s.shNoneBody} /> : null}

      <Sheet visible={noteOpen} onClose={() => setNoteOpen(false)} title={s.shAddNote}>
        <TextField value={note} onChange={setNote} placeholder={s.shNotePlaceholder} multiline />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
          {TYPES.map((t) => <Chip key={t} label={s.actRecordType[t]} selected={type === t} onPress={() => setType(t)} />)}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
          <Text style={{ flex: 1 }}>{s.shShare}</Text>
          <Toggle value={consent} onChange={setConsent} label={s.shShare} />
        </View>
        <Button label={s.save} loading={busy} disabled={!note.trim()} onPress={() => void guard(async () => {
          await addRecord({ shiftId: shift?.id, type, text: note, consented: consent, source: 'phone', flagged: type === 'issue' });
          setNote(''); setConsent(false); setNoteOpen(false); data.refresh();
        })} />
      </Sheet>

      {/* Draft after ending a shift: a human must review and approve. */}
      <Sheet visible={!!draft} onClose={() => setDraft(null)} title={s.shEndTitle}>
        {draft ? (
          <>
            <Banner tone="warning" icon="eye.fill" message={s.shDraftNote} />
            <HandoverView ho={draft.ho} />
            <Button label={s.shApprove} icon="checkmark.seal.fill" loading={busy} onPress={() => void guard(async () => { await approveHandover(draft.row.id); toast(s.shApproved, 'success'); setDraft(null); data.refresh(); })} />
          </>
        ) : null}
      </Sheet>

      {/* Incoming employee: read, listen, ask (answers only from the records). */}
      <Sheet visible={!!open} onClose={() => { Voice.stop(); setOpen(null); }} title={s.shOpenHandover}>
        {open ? <IncomingHandover row={open} /> : null}
      </Sheet>
    </Screen>
  );
}

function summaryText(ho: Handover, s: ReturnType<typeof useS>) {
  const part = (t: string, items: HandoverItem[]) => `${t}: ${items.length ? items.map((i) => i.text).join('. ') : s.shNothing}.`;
  return [part(s.shCompleted, ho.completed), part(s.shPending, ho.pending), part(s.shConcerns, ho.concerns)].join(' ');
}

function Section({ title, items }: { title: string; items: HandoverItem[] }) {
  const s = useS();
  return (
    <View style={{ gap: Spacing.one }}>
      <Text variant="heading">{title}</Text>
      {items.length ? items.map((i, n) => (
        <Text key={n} tone="secondary">• {i.text}{i.equipmentId ? ` (${i.equipmentId})` : ''}  <Text variant="label" tone="tertiary">{i.sourceIds.length} {s.shSources}</Text></Text>
      )) : <Text tone="tertiary">{s.shNothing}</Text>}
    </View>
  );
}

function HandoverView({ ho }: { ho: Handover }) {
  const s = useS();
  return (
    <View style={{ gap: Spacing.three }}>
      <Section title={s.shCompleted} items={ho.completed} />
      <Section title={s.shPending} items={ho.pending} />
      <Section title={s.shConcerns} items={ho.concerns} />
      {ho.excluded > 0 ? <Text variant="caption" tone="tertiary">{s.shExcluded(ho.excluded)}</Text> : null}
    </View>
  );
}

function IncomingHandover({ row }: { row: HandoverRow }) {
  const s = useS();
  const ho = row.content as unknown as Handover;
  const [q, setQ] = useState('');
  const [ans, setAns] = useState<{ answer: string; grounded: boolean } | null>(null);
  if (!ho || !Array.isArray(ho.completed)) return <Text tone="secondary">{s.shNothing}</Text>;
  return (
    <>
      <Badge tone={row.status === 'approved' ? 'success' : 'warning'} label={row.status === 'approved' ? s.shApproved : s.shDraftNote} />
      <HandoverView ho={ho} />
      <Button variant="secondary" icon="speaker.wave.2.fill" label={s.shListen} onPress={() => Voice.speak(summaryText(ho, s))} />
      <Text variant="heading">{s.shAsk}</Text>
      <TextField value={q} onChange={setQ} placeholder={s.shAskPlaceholder} />
      <Button compact label={s.search} disabled={!q.trim()} onPress={() => setAns(answerFromHandover(ho, q))} />
      {ans ? <Banner tone={ans.grounded ? 'accent' : 'warning'} icon={ans.grounded ? 'checkmark.seal.fill' : 'questionmark.circle'} message={`${ans.grounded ? s.shGrounded : s.shNotGrounded}: ${ans.answer}`} /> : null}
    </>
  );
}
