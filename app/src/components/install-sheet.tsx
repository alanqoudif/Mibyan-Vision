import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { SettingsForm } from '@/components/settings-form';
import { Text } from '@/components/text';
import { Badge, Banner, Button, Divider, Group, IconBadge, Row, Sheet } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { checkCompat } from '@/lib/compat';
import { useGlasses } from '@/lib/glasses';
import { useI18n } from '@/lib/i18n';
import { CATEGORY_STYLE, displayCategory, installSense, saveSettings, senseDesc, senseIcon, senseName } from '@/lib/sixth';
import { useS } from '@/lib/strings';
import { useVisionSession } from '@/lib/vision';
import { requiredPermissions, type Permission, type SenseManifest, type SettingField } from '@mibyan/shared/sense';

type Phase = 'review' | 'permissions' | 'configure' | 'installing' | 'done' | 'error';

/**
 * Install flow for one Sense or a pack: review → permissions → configure → install → persist → activate.
 * The result screen only says "installed" after the write actually succeeded.
 */
export function InstallSheet(props: { senses: SenseManifest[]; visible: boolean; onClose: () => void; onInstalled?: () => void }) {
  // The flow mounts fresh each time, so it always starts at the review step.
  return props.visible ? <InstallFlow {...props} /> : null;
}

function InstallFlow({ senses, visible, onClose, onInstalled }: { senses: SenseManifest[]; visible: boolean; onClose: () => void; onInstalled?: () => void }) {
  const s = useS();
  const { lang } = useI18n();
  const glasses = useGlasses();
  const session = useVisionSession();
  const [phase, setPhase] = useState<Phase>('review');
  const [error, setError] = useState('');
  const [synced, setSynced] = useState(false);
  const [settings, setSettings] = useState<Record<string, Record<string, unknown>>>({});
  const [activated, setActivated] = useState(0);

  const perms = useMemo(() => {
    const set = new Set<Permission>();
    for (const m of senses) {
      // The workflow can only use what it declares; the manifest and the nodes agree (validated at publish).
      for (const p of m.permissions) set.add(p);
      for (const p of requiredPermissions(m.workflow)) set.add(p);
    }
    return [...set];
  }, [senses]);
  const fields = senses.flatMap((m) => m.settings_schema.map((f) => ({ m, f })));
  const compat = senses.map((m) => ({ m, k: checkCompat(m, { glassesReady: glasses.status === 'ready', signedIn: !!session.email, lang }) }));
  const title = senses.length === 1 ? senseName(senses[0], lang) : s.installPack;

  const install = async () => {
    setPhase('installing');
    try {
      let sy = false;
      let on = 0;
      for (const { m, k } of compat) {
        // Only grant what this Sense itself declares.
        const granted = [...new Set([...m.permissions, ...requiredPermissions(m.workflow)])];
        const r = await installSense(m, granted, k.runnable);
        sy = r.synced;
        if (k.runnable) on++;
        if (settings[m.id] && Object.keys(settings[m.id]).length) await saveSettings(m.id, settings[m.id]);
      }
      setSynced(sy);
      setActivated(on);
      setPhase('done');
      onInstalled?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('error');
    }
  };

  const blockers = compat.filter(({ k }) => !k.runnable);
  const stepIndex = { review: 1, permissions: 2, configure: 3, installing: 4, done: 4, error: 4 }[phase];
  const total = fields.length ? 4 : 3;

  return (
    <Sheet visible={visible} onClose={onClose} title={phase === 'permissions' ? s.sdInstallTitle : title}>
      {phase !== 'done' && phase !== 'error' && (
        <Text variant="label" tone="tertiary">
          {s.sdStep(Math.min(stepIndex, total), total)}
        </Text>
      )}

      {phase === 'review' && (
        <>
          {senses.map((m) => (
            <View key={m.id} style={{ flexDirection: 'row', gap: Spacing.three, alignItems: 'center' }}>
              <IconBadge icon={senseIcon(m)} hue={CATEGORY_STYLE[displayCategory(m)].hue} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="heading">{senseName(m, lang)}</Text>
                <Text variant="caption" tone="secondary">
                  {senseDesc(m, lang)}
                </Text>
                <Text variant="label" tone="tertiary">
                  {s.version} {m.version} · {s.by} {m.author}
                </Text>
              </View>
            </View>
          ))}
          {blockers.map(({ m, k }) => (
            <Banner
              key={m.id}
              tone="warning"
              icon="exclamationmark.triangle.fill"
              message={`${senseName(m, lang)}: ${[
                !k.deviceOk ? s.needsDevice : '',
                k.missing.length ? `${s.needs} ${k.missing.map((x) => s.capability[x] ?? x).join(', ')}` : '',
                k.needsAccount && !session.email ? s.sdInstallNeedsAccount : '',
              ].filter(Boolean).join(' · ')}`}
            />
          ))}
          <Button label={s.next} onPress={() => setPhase('permissions')} />
        </>
      )}

      {phase === 'permissions' && (
        <>
          <Text tone="secondary">{s.sdInstallBody}</Text>
          <Group>
            {perms.map((p, i) => (
              <View key={p}>
                {i > 0 && <Divider />}
                <Row icon="lock.shield.fill" title={s.perm[p]} />
              </View>
            ))}
            {perms.length === 0 && <Row title={s.emptyTitle} />}
          </Group>
          <Button label={fields.length ? s.next : s.sdConfirmInstall} onPress={() => (fields.length ? setPhase('configure') : void install())} />
        </>
      )}

      {phase === 'configure' && (
        <>
          {senses.map((m) =>
            m.settings_schema.length ? (
              <View key={m.id} style={{ gap: Spacing.two }}>
                <Text variant="heading">{senseName(m, lang)}</Text>
                <SettingsForm
                  schema={m.settings_schema as SettingField[]}
                  values={settings[m.id] ?? {}}
                  onChange={(k, v) => setSettings((x) => ({ ...x, [m.id]: { ...(x[m.id] ?? {}), [k]: v } }))}
                />
              </View>
            ) : null,
          )}
          <Button label={s.sdConfirmInstall} onPress={() => void install()} />
        </>
      )}

      {phase === 'installing' && <Button label={s.sdInstalling} loading onPress={() => {}} />}

      {phase === 'done' && (
        <>
          <Badge tone="success" label={synced ? s.sdInstallOk : s.installed} />
          {!synced && <Banner tone="accent" icon="iphone" message={s.localOnlyNote} />}
          <Text tone="secondary">
            {activated === senses.length ? s.sdActivateOk : `${s.sdActivateOk}: ${activated}/${senses.length}. ${s.sdNotRunnable}`}
          </Text>
          <Button label={s.done} onPress={onClose} />
        </>
      )}

      {phase === 'error' && (
        <>
          <Banner tone="danger" icon="xmark.octagon.fill" message={`${s.sdInstallFail}: ${error}`} />
          <Button label={s.retry} onPress={() => void install()} />
          <Button label={s.cancel} variant="ghost" onPress={onClose} />
        </>
      )}
    </Sheet>
  );
}
