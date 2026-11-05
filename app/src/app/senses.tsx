import { useCameraPermissions, type CameraView } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CameraPreview } from '@/components/camera-preview';
import { CircleButton } from '@/components/chrome';
import { Text } from '@/components/text';
import { MinTouch, Radius, Spacing, useColors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';
import { confirmWithUser, createPhoneAdapters } from '@/lib/sense-adapters';
import { BUILTIN_SENSES, missingCapabilities, runWorkflow, type RunResult, type SenseManifest } from '@mibyan/shared/sense';

const L = {
  ar: {
    title: 'الحواس', intro: 'كل حاسة قدرة إضافية تعمل بأذونات تحددها أنت.', run: 'تشغيل', running: 'جارٍ التشغيل…',
    perms: 'الأذونات', unavailable: 'غير متاح بعد', needs: 'يحتاج', confirm: 'تشغيل الحاسة', allow: 'ستستخدم هذه الحاسة:',
    ok: 'تم', failed: 'فشل', blocked: 'متوقف', skipped: 'تخطّي', result: 'النتيجة', steps: 'الخطوات', cam: 'كاميرا',
    permission: { camera: 'الكاميرا', microphone: 'الميكروفون', speech_out: 'النطق بالصوت', location: 'الموقع', notifications: 'الإشعارات', store_read: 'قراءة السجلات', store_write: 'حفظ السجلات', memory_read: 'قراءة الذاكرة', memory_write: 'الكتابة في الذاكرة', tasks_write: 'إنشاء مهام', team_message: 'مراسلة الفريق', network: 'الشبكة' } as Record<string, string>,
  },
  en: {
    title: 'Senses', intro: 'Each Sense is an extra capability that runs only with the permissions you allow.', run: 'Run', running: 'Running…',
    perms: 'Permissions', unavailable: 'Not available yet', needs: 'Needs', confirm: 'Run Sense', allow: 'This Sense will use:',
    ok: 'Done', failed: 'Failed', blocked: 'Blocked', skipped: 'Skipped', result: 'Result', steps: 'Steps', cam: 'Camera',
    permission: { camera: 'Camera', microphone: 'Microphone', speech_out: 'Spoken output', location: 'Location', notifications: 'Notifications', store_read: 'Read records', store_write: 'Save records', memory_read: 'Read memory', memory_write: 'Write memory', tasks_write: 'Create tasks', team_message: 'Message team', network: 'Network' } as Record<string, string>,
  },
};

export default function SensesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const { lang, dir, t } = useI18n();
  const s = L[lang];
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const readyRef = useRef(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, RunResult>>({});

  // Same capability set as the runtime adapters; used only to tell which Senses can run.
  const available = useMemo(() => createPhoneAdapters({ lang }), [lang]);

  const run = async (sense: SenseManifest) => {
    const list = sense.permissions.map((p) => s.permission[p] ?? p).join('، ');
    const ok = await confirmWithUser(`${s.confirm}: ${lang === 'ar' ? sense.name_ar : sense.name_en}`, `${s.allow} ${list}`);
    if (!ok) return;
    if (sense.permissions.includes('camera') && !camPerm?.granted) await requestCamPerm();
    setBusy(sense.id);
    const adapters = createPhoneAdapters({
      lang,
      phoneCapture: async () => {
        if (!readyRef.current || !cameraRef.current) return undefined;
        return (await cameraRef.current.takePictureAsync({ quality: 0.5, shutterSound: false })).uri;
      },
    });
    try {
      const result = await runWorkflow(sense, {
        granted: sense.permissions,
        adapters,
        approve: (_id, kind) => confirmWithUser(kind, kind),
      });
      setResults((r) => ({ ...r, [sense.id]: result }));
      const failed = result.steps.find((x) => x.status === 'failed');
      AccessibilityInfo.announceForAccessibility(failed ? `${s.failed}: ${failed.error}` : s.ok);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setResults((r) => ({ ...r, [sense.id]: { status: 'failed', steps: [{ nodeId: '-', kind: 'trigger.manual', status: 'failed', startedAt: Date.now(), ms: 0, error: message }], outputs: {}, aiCalls: 0 } }));
      AccessibilityInfo.announceForAccessibility(`${s.failed}: ${message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: c.background, direction: dir, paddingTop: insets.top + Spacing.two }]}>
      <View style={styles.topBar}>
        <CircleButton icon="xmark" label={t.close} onPress={() => router.back()} />
        <Text variant="heading" accessibilityRole="header">{s.title}</Text>
        <View style={{ width: 48 }} />
      </View>
      <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + Spacing.four }]}>
        <Text tone="secondary">{s.intro}</Text>
        <View style={[styles.preview, { backgroundColor: c.card }]} accessibilityLabel={s.cam}>
          <CameraPreview cameraRef={cameraRef} readyRef={readyRef} granted={!!camPerm?.granted} iconSize={36} iconColor={c.textSecondary} />
        </View>
        {BUILTIN_SENSES.map((sense) => {
          const missing = missingCapabilities(sense.workflow, available);
          const result = results[sense.id];
          const name = lang === 'ar' ? sense.name_ar : sense.name_en;
          return (
            <View key={sense.id} style={[styles.card, { backgroundColor: c.card }]}>
              <Text variant="heading" accessibilityRole="header">{name}</Text>
              <Text tone="secondary">{lang === 'ar' ? sense.description_ar : sense.description_en}</Text>
              <Text variant="caption" tone="tertiary">{s.perms}: {sense.permissions.map((p) => s.permission[p] ?? p).join('، ')}</Text>
              {missing.length > 0 ? (
                <Text variant="caption" tone="tertiary" accessibilityLabel={`${s.unavailable}. ${s.needs} ${missing.join(', ')}`}>
                  {s.unavailable} · {s.needs}: {missing.join(', ')}
                </Text>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${s.run} ${name}`}
                  accessibilityState={{ disabled: busy !== null, busy: busy === sense.id }}
                  disabled={busy !== null}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); void run(sense); }}
                  style={({ pressed }) => [styles.button, { backgroundColor: c.text, opacity: pressed || busy !== null ? 0.6 : 1 }]}>
                  <Text variant="heading" style={{ color: c.background }} center>{busy === sense.id ? s.running : s.run}</Text>
                </Pressable>
              )}
              {result && (
                <View accessibilityLiveRegion="polite" style={styles.steps}>
                  <Text variant="caption" tone="secondary">{s.steps}</Text>
                  {result.steps.map((st) => (
                    <Text key={st.nodeId + st.startedAt} variant="caption" tone={st.status === 'failed' ? 'accent' : 'secondary'}>
                      {s[st.status]} · {st.nodeId}{st.error ? ` — ${st.error}` : ''}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
  list: { padding: Spacing.three, gap: Spacing.three },
  preview: { height: 160, borderRadius: Radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  card: { padding: Spacing.three, borderRadius: Radius.md, gap: Spacing.two },
  button: { minHeight: MinTouch, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.three },
  steps: { gap: Spacing.half, marginTop: Spacing.one },
});
