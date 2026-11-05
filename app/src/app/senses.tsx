import { useCameraPermissions, type CameraView } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CameraPreview } from '@/components/camera-preview';
import { CircleButton } from '@/components/chrome';
import { Text } from '@/components/text';
import { MinTouch, Radius, Spacing, useColors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';
import { confirmWithUser, createPhoneAdapters } from '@/lib/sense-adapters';
import { setInstalledEnabled, signInWithPassword, signOutVision, useInstalled, useVisionSession, visionClient, visionIsSeparate, type InstalledSense } from '@/lib/vision';
import { BUILTIN_SENSES, missingCapabilities, runWorkflow, type Permission, type RunResult } from '@mibyan/shared/sense';

const L = {
  ar: {
    title: 'الحواس', introAccount: 'الحواس المثبّتة في حسابك على الويب. التغييرات تظهر هنا عند التحديث.', introLocal: 'حواس مدمجة. لم يُضبط حساب للمزامنة بعد.',
    run: 'تشغيل', running: 'جارٍ التشغيل…', perms: 'الأذونات الممنوحة', unavailable: 'غير متاح بعد', needs: 'يحتاج', confirm: 'تشغيل الحاسة', allow: 'ستستخدم هذه الحاسة:',
    ok: 'تم', failed: 'فشل', blocked: 'متوقف', skipped: 'تخطّي', steps: 'الخطوات', cam: 'كاميرا', refresh: 'تحديث', enable: 'تفعيل', disable: 'تعطيل', active: 'مفعّلة', off: 'معطّلة',
    email: 'البريد', password: 'كلمة المرور', signIn: 'دخول', mibyanSignIn: 'سجّل الدخول بحساب مبيان', signOut: 'خروج', empty: 'لا توجد حواس مثبّتة. ثبّت من Vision Studio على الويب.', signedIn: 'مسجّل باسم', signInTitle: 'سجّل الدخول لعرض حواسك',
    permission: { camera: 'الكاميرا', microphone: 'الميكروفون', speech_out: 'النطق بالصوت', location: 'الموقع', notifications: 'الإشعارات', store_read: 'قراءة السجلات', store_write: 'حفظ السجلات', memory_read: 'قراءة الذاكرة', memory_write: 'الكتابة في الذاكرة', tasks_write: 'إنشاء مهام', team_message: 'مراسلة الفريق', network: 'الشبكة' } as Record<string, string>,
  },
  en: {
    title: 'Senses', introAccount: 'Senses installed on your account on the web. Changes appear here on refresh.', introLocal: 'Built-in Senses. No account backend is configured for sync yet.',
    run: 'Run', running: 'Running…', perms: 'Granted permissions', unavailable: 'Not available yet', needs: 'Needs', confirm: 'Run Sense', allow: 'This Sense will use:',
    ok: 'Done', failed: 'Failed', blocked: 'Blocked', skipped: 'Skipped', steps: 'Steps', cam: 'Camera', refresh: 'Refresh', enable: 'Enable', disable: 'Disable', active: 'Active', off: 'Disabled',
    email: 'Email', password: 'Password', signIn: 'Sign in', mibyanSignIn: 'Sign in with your Mibyan account', signOut: 'Sign out', empty: 'No Senses installed. Install from Vision Studio on the web.', signedIn: 'Signed in as', signInTitle: 'Sign in to see your Senses',
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
  const session = useVisionSession();
  const hasBackend = !!visionClient;
  const signedIn = !!session.email;
  const installed = useInstalled(signedIn);
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Same capability set as the runtime adapters; used only to tell which Senses can run.
  const available = useMemo(() => createPhoneAdapters({ lang }), [lang]);

  const items: InstalledSense[] = hasBackend
    ? installed.items
    : BUILTIN_SENSES.map((m) => ({ manifest: m, enabled: true, granted: m.permissions, settings: {}, version: m.version }));

  const run = async (item: InstalledSense) => {
    const sense = item.manifest;
    const name = lang === 'ar' ? sense.name_ar : sense.name_en;
    const list = item.granted.map((p) => s.permission[p] ?? p).join('، ');
    const ok = await confirmWithUser(`${s.confirm}: ${name}`, `${s.allow} ${list}`);
    if (!ok) return;
    if (item.granted.includes('camera') && !camPerm?.granted) await requestCamPerm();
    setBusy(sense.id);
    const adapters = createPhoneAdapters({
      lang,
      phoneCapture: async () => {
        if (!readyRef.current || !cameraRef.current) return undefined;
        return (await cameraRef.current.takePictureAsync({ quality: 0.5, shutterSound: false })).uri;
      },
    });
    try {
      // `granted` is what the person consented to when installing, not what the manifest asks for.
      const result = await runWorkflow(sense, {
        granted: item.granted as Permission[],
        adapters,
        settings: item.settings,
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

  const toggle = async (item: InstalledSense) => {
    try {
      await setInstalledEnabled(item.manifest.id, !item.enabled);
      installed.refresh();
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : String(e));
    }
  };

  const doSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPassword(formEmail.trim(), formPassword);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : String(e));
    }
  };

  const inputStyle = [styles.input, { backgroundColor: c.surface, color: c.text, textAlign: dir === 'rtl' ? ('right' as const) : ('left' as const) }];

  return (
    <View style={[styles.root, { backgroundColor: c.background, direction: dir, paddingTop: insets.top + Spacing.two }]}>
      <View style={styles.topBar}>
        <CircleButton icon="xmark" label={t.close} onPress={() => router.back()} />
        <Text variant="heading" accessibilityRole="header">{s.title}</Text>
        {hasBackend && signedIn ? <CircleButton icon="arrow.clockwise" label={s.refresh} onPress={installed.refresh} /> : <View style={{ width: 48 }} />}
      </View>
      <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + Spacing.four }]} keyboardShouldPersistTaps="handled">
        <Text tone="secondary">{hasBackend ? s.introAccount : s.introLocal}</Text>

        {hasBackend && !session.ready ? null : hasBackend && !signedIn ? (
          <View style={[styles.card, { backgroundColor: c.card }]}>
            <Text variant="heading" accessibilityRole="header">{s.signInTitle}</Text>
            {visionIsSeparate ? (
              <>
                <TextInput style={inputStyle} placeholder={s.email} placeholderTextColor={c.textTertiary} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" value={formEmail} onChangeText={setFormEmail} accessibilityLabel={s.email} />
                <TextInput style={inputStyle} placeholder={s.password} placeholderTextColor={c.textTertiary} secureTextEntry textContentType="password" value={formPassword} onChangeText={setFormPassword} accessibilityLabel={s.password} />
                {authError && <Text variant="caption" tone="accent" accessibilityLiveRegion="polite">{authError}</Text>}
                <Pressable accessibilityRole="button" accessibilityLabel={s.signIn} onPress={() => void doSignIn()} style={[styles.button, { backgroundColor: c.text }]}>
                  <Text variant="heading" style={{ color: c.background }} center>{s.signIn}</Text>
                </Pressable>
              </>
            ) : (
              <Pressable accessibilityRole="button" accessibilityLabel={s.mibyanSignIn} onPress={() => router.push('/account')} style={[styles.button, { backgroundColor: c.text }]}>
                <Text variant="heading" style={{ color: c.background }} center>{s.mibyanSignIn}</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <>
            {hasBackend && (
              <View style={styles.rowBetween}>
                <Text variant="caption" tone="tertiary">{s.signedIn} {session.email}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={s.signOut} onPress={() => void signOutVision()} hitSlop={12}><Text variant="caption" tone="accent">{s.signOut}</Text></Pressable>
              </View>
            )}
            {authError && <Text variant="caption" tone="accent">{authError}</Text>}
            {installed.error && <Text variant="caption" tone="accent" accessibilityLiveRegion="polite">{installed.error}</Text>}
            <View style={[styles.preview, { backgroundColor: c.card }]} accessibilityLabel={s.cam}>
              <CameraPreview cameraRef={cameraRef} readyRef={readyRef} granted={!!camPerm?.granted} iconSize={36} iconColor={c.textSecondary} />
            </View>
            {hasBackend && !installed.loading && !installed.error && items.length === 0 && <Text tone="secondary">{s.empty}</Text>}
            {items.map((item) => {
              const sense = item.manifest;
              const missing = missingCapabilities(sense.workflow, available);
              const result = results[sense.id];
              const name = lang === 'ar' ? sense.name_ar : sense.name_en;
              return (
                <View key={sense.id} style={[styles.card, { backgroundColor: c.card }]}>
                  <View style={styles.rowBetween}>
                    <Text variant="heading" accessibilityRole="header" style={{ flex: 1 }}>{name}</Text>
                    {hasBackend && <Text variant="caption" tone={item.enabled ? 'accent' : 'tertiary'}>{item.enabled ? s.active : s.off}</Text>}
                  </View>
                  <Text tone="secondary">{lang === 'ar' ? sense.description_ar : sense.description_en}</Text>
                  <Text variant="caption" tone="tertiary">{s.perms}: {item.granted.map((p) => s.permission[p] ?? p).join('، ') || '-'}</Text>
                  {missing.length > 0 ? (
                    <Text variant="caption" tone="tertiary" accessibilityLabel={`${s.unavailable}. ${s.needs} ${missing.join(', ')}`}>{s.unavailable} · {s.needs}: {missing.join(', ')}</Text>
                  ) : item.enabled ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${s.run} ${name}`}
                      accessibilityState={{ disabled: busy !== null, busy: busy === sense.id }}
                      disabled={busy !== null}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); void run(item); }}
                      style={({ pressed }) => [styles.button, { backgroundColor: c.text, opacity: pressed || busy !== null ? 0.6 : 1 }]}>
                      <Text variant="heading" style={{ color: c.background }} center>{busy === sense.id ? s.running : s.run}</Text>
                    </Pressable>
                  ) : null}
                  {hasBackend && (
                    <Pressable accessibilityRole="button" accessibilityLabel={`${item.enabled ? s.disable : s.enable} ${name}`} onPress={() => void toggle(item)} style={styles.link} hitSlop={8}>
                      <Text variant="caption" tone="accent">{item.enabled ? s.disable : s.enable}</Text>
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
          </>
        )}
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
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  input: { minHeight: MinTouch, borderRadius: Radius.sm, paddingHorizontal: Spacing.three, fontSize: 17 },
  button: { minHeight: MinTouch, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.three },
  link: { minHeight: 44, justifyContent: 'center' },
  steps: { gap: Spacing.half, marginTop: Spacing.one },
});
