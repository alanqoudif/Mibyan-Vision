import { useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { InstallSheet } from '@/components/install-sheet';
import { SettingsForm } from '@/components/settings-form';
import { Text } from '@/components/text';
import { Badge, Banner, Button, Divider, EmptyState, Group, IconBadge, Row, Screen, ScreenHeader, SectionHeader, timeAgo, Toggle, useToast } from '@/components/ui';
import { Spacing, useColors } from '@/constants/theme';
import { checkCompat } from '@/lib/compat';
import { useGlasses } from '@/lib/glasses';
import { useI18n } from '@/lib/i18n';
import { useRuns } from '@/lib/runlog';
import { CATEGORY_STYLE, displayCategory, getInstalledIds, saveSettings, senseDesc, senseIcon, senseName, setEnabled, uninstallSense, useCatalog, useInstalledSenses } from '@/lib/sixth';
import { useS } from '@/lib/strings';
import { useVisionSession } from '@/lib/vision';
import { requiredPermissions, type Permission, type SettingField } from '@mibyan/shared/sense';

const installedAlready = (id: string) => getInstalledIds().includes(id);

export default function SenseDetail() {
  const { id, install } = useLocalSearchParams<{ id: string; install?: string }>();
  const router = useRouter();
  const s = useS();
  const c = useColors();
  const { lang } = useI18n();
  const toast = useToast();
  const glasses = useGlasses();
  const session = useVisionSession();
  const catalog = useCatalog();
  const installed = useInstalledSenses();
  const runs = useRuns();
  const [cam, requestCam] = useCameraPermissions();
  const [sheet, setSheet] = useState(() => install === '1' && !installedAlready(id));
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);

  const item = installed.items.find((i) => i.manifest.id === id);
  const manifest = item?.manifest ?? catalog.items.find((m) => m.id === id);

  const compat = manifest ? checkCompat(manifest, { glassesReady: glasses.status === 'ready', signedIn: !!session.email, lang }) : null;
  const history = runs.filter((r) => r.senseId === id).slice(0, 5);

  if (!manifest || !compat) {
    return (
      <Screen header={<ScreenHeader back />}>
        <EmptyState icon="questionmark.circle" title={s.noSensesFound} />
      </Screen>
    );
  }

  const cat = displayCategory(manifest);
  const st = CATEGORY_STYLE[cat];
  const perms: Permission[] = item?.granted ?? [...new Set([...manifest.permissions, ...requiredPermissions(manifest.workflow)])];
  const reasons = [
    !compat.deviceOk ? s.needsDevice : '',
    ...compat.missing.map((m) => `${s.needs} ${s.capability[m] ?? m}`),
    compat.needsAccount && !session.email ? s.sdInstallNeedsAccount : '',
  ].filter(Boolean);

  const activate = async (on: boolean) => {
    if (!item) return;
    if (on) {
      if (!compat.runnable) return toast(`${s.sdBlockedTitle}: ${reasons.join(' · ')}`, 'error');
      // Validate permissions before turning it on: the camera needs OS-level approval.
      if (item.granted.includes('camera') && !cam?.granted) {
        const r = await requestCam();
        if (!r.granted) return toast(s.lvPermDenied, 'error');
      }
    }
    setBusy(true);
    try {
      await setEnabled(manifest.id, on);
      toast(on ? s.sdActivateOk : s.off, on ? 'success' : 'info');
    } catch (e) {
      toast(`${s.sdActivateFail}: ${e instanceof Error ? e.message : e}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = () =>
    Alert.alert(senseName(manifest, lang), s.sdUninstall + '?', [
      { text: s.cancel, style: 'cancel' },
      {
        text: s.sdUninstall,
        style: 'destructive',
        onPress: () => uninstallSense(manifest.id).then(() => router.back(), (e) => toast(String(e instanceof Error ? e.message : e), 'error')),
      },
    ]);

  const values = draft ?? item?.settings ?? {};

  return (
    <Screen header={<ScreenHeader back />}>
      <View style={{ flexDirection: 'row', gap: Spacing.three, alignItems: 'center' }}>
        <IconBadge icon={senseIcon(manifest)} hue={st.hue} size={72} />
        <View style={{ flex: 1, gap: Spacing.one }}>
          <Text variant="title" accessibilityRole="header">{senseName(manifest, lang)}</Text>
          <Text variant="caption" tone="secondary">{s.by} {manifest.author} · {s.version} {manifest.version}</Text>
          <View style={{ flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' }}>
            <Badge label={s.cat[cat]} />
            {item ? <Badge tone={item.enabled ? 'success' : 'neutral'} label={item.enabled ? s.on : s.off} /> : null}
            <Badge tone={compat.runnable ? 'neutral' : 'warning'} label={compat.runnable ? s.compatible : s.sdBlockedTitle} />
          </View>
        </View>
      </View>

      <Text>{senseDesc(manifest, lang)}</Text>

      {!compat.runnable && <Banner tone="warning" icon="exclamationmark.triangle.fill" message={`${s.sdMissingTitle}: ${reasons.join(' · ')}`} />}

      {/* Primary actions */}
      {!item ? (
        <Button label={s.install} icon="arrow.down.circle.fill" onPress={() => setSheet(true)} />
      ) : (
        <View style={{ gap: Spacing.two }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three }}>
            <Text variant="heading" style={{ flex: 1 }}>{item.enabled ? s.sdDeactivate : s.sdActivate}</Text>
            <Toggle value={item.enabled} onChange={(v) => void activate(v)} label={senseName(manifest, lang)} disabled={busy} />
          </View>
          {compat.runnable && item.enabled ? (
            <Button
              label={s.test}
              icon="play.fill"
              hint={s.lvRun}
              onPress={() => router.push({ pathname: '/live-vision', params: { sense: manifest.id } })}
            />
          ) : null}
        </View>
      )}

      <Group title={s.sdPermissions}>
        {perms.length ? perms.map((p, i) => (
          <View key={p}>
            {i > 0 && <Divider />}
            <Row icon={item ? 'checkmark.shield.fill' : 'lock.shield.fill'} hue={item ? c.success : undefined} title={s.perm[p]} />
          </View>
        )) : <Row title={s.emptyTitle} />}
      </Group>

      <Group title={s.sdDevices}>
        {manifest.supported_devices.map((d, i) => (
          <View key={d}>
            {i > 0 && <Divider />}
            <Row icon={d === 'meta_glasses' ? 'eyeglasses' : 'iphone'} title={s.deviceKind[d] ?? d} />
          </View>
        ))}
      </Group>

      <View style={{ gap: Spacing.two }}>
        <SectionHeader title={s.sdSettings} />
        {manifest.settings_schema.length ? (
          <>
            <SettingsForm schema={manifest.settings_schema as SettingField[]} values={values} onChange={(k, v) => setDraft({ ...values, [k]: v })} />
            {item && draft ? (
              <Button
                label={s.save}
                variant="secondary"
                onPress={() => saveSettings(manifest.id, draft).then(() => { setDraft(null); toast(s.done, 'success'); }, (e) => toast(String(e instanceof Error ? e.message : e), 'error'))}
              />
            ) : null}
          </>
        ) : (
          <Text tone="secondary">{s.sdNoSettings}</Text>
        )}
      </View>

      <Group title={s.sdWorkflow}>
        <Row icon="point.3.connected.trianglepath.dotted" title={s.sdViewWorkflow} chevron onPress={() => router.push(`/workflow/${manifest.id}`)} />
      </Group>

      <View style={{ gap: Spacing.two }}>
        <SectionHeader title={s.sdHistory} />
        {history.length ? (
          history.map((r) => (
            <Row
              key={r.id}
              icon={r.status === 'succeeded' ? 'checkmark.circle.fill' : 'exclamationmark.triangle.fill'}
              hue={r.status === 'succeeded' ? c.success : c.warning}
              title={s.actRunStatus[r.status === 'succeeded' ? 'ok' : r.status === 'failed' ? 'failed' : 'blocked']}
              subtitle={`${timeAgo(r.at, lang)} · ${r.summary.slice(0, 80)}`}
              chevron
              onPress={() => router.push({ pathname: '/activity-detail', params: { kind: 'run', id: r.id } })}
            />
          ))
        ) : (
          <Text tone="secondary">{s.sdNoHistory}</Text>
        )}
      </View>

      {item ? <Button variant="danger" label={s.sdUninstall} onPress={remove} /> : null}

      <InstallSheet senses={[manifest]} visible={sheet} onClose={() => setSheet(false)} />
    </Screen>
  );
}
