import { useCameraPermissions } from 'expo-camera';
import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Linking, View } from 'react-native';

import { SenseOrb, type SenseOrbState } from '@/components/sense-orb';
import { Text } from '@/components/text';
import { Badge, Banner, Button, Card, Divider, Group, LargeTitle, Row, Screen, StatusDot } from '@/components/ui';
import { Spacing, useColors } from '@/constants/theme';
import { useCameraSource, useGlasses } from '@/lib/glasses';
import { useI18n } from '@/lib/i18n';
import { senseName, useInstalledSenses } from '@/lib/sixth';
import { useS } from '@/lib/strings';

import { Glasses } from '../../../modules/mubayan-glasses';

export default function GlassesTab() {
  const s = useS();
  const c = useColors();
  const router = useRouter();
  const { lang } = useI18n();
  const glasses = useGlasses();
  const source = useCameraSource();
  const installed = useInstalledSenses();
  const [cam, requestCam] = useCameraPermissions();
  // Tabs stay mounted; re-check when coming back to this one.
  useFocusEffect(glasses.refresh);

  const st = glasses.status;
  const ready = st === 'ready';
  const orb: SenseOrbState = ready ? 'connected' : st === 'registering' ? 'analyzing' : glasses.error ? 'error' : 'disconnected';
  const action =
    st === 'unregistered' ? { label: s.gConnect, icon: 'link' as const }
    : st === 'needsCamera' ? { label: s.gAllowCamera, icon: 'camera.fill' as const }
    : st === 'needsUpdate' ? { label: s.gUpdate, icon: 'arrow.down.circle.fill' as const }
    : null;

  const cap = (verified: boolean) => (st === 'unsupported' ? s.gCapNotSupported : verified ? s.gCapVerified : s.gCapNotVerified);
  const capTone = (verified: boolean) => (verified ? 'success' : st === 'unsupported' ? 'danger' : 'neutral');
  const onDevice = installed.items.filter((i) => i.enabled && i.manifest.supported_devices.includes('meta_glasses'));

  return (
    <Screen tabs onRefresh={glasses.refresh}>
      <LargeTitle>{s.glassesTitle}</LargeTitle>

      <Card style={{ alignItems: 'center', gap: Spacing.two }}>
        <SenseOrb size={140} state={orb} />
        <View style={{ marginTop: -Spacing.four, alignItems: 'center', gap: Spacing.one }}>
          <Text variant="title" center>{s.gDevice}</Text>
          <View style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'center' }}>
            <StatusDot tone={ready ? 'success' : st === 'unsupported' ? 'idle' : 'warning'} />
            <Text variant="heading" tone={ready ? 'success' : 'secondary'}>{s.gStatus[st]}</Text>
          </View>
          <Text tone="secondary" center variant="caption">{s.gStatusNote[st]}</Text>
        </View>
        {action ? <Button label={action.label} icon={action.icon} loading={glasses.busy} onPress={() => void glasses.connect()} style={{ alignSelf: 'stretch' }} /> : null}
        {st === 'registering' ? <Button variant="secondary" label={s.gCheckAgain} onPress={glasses.refresh} style={{ alignSelf: 'stretch' }} /> : null}
        {glasses.error ? <Banner tone="danger" icon="xmark.octagon.fill" message={glasses.error} /> : null}
      </Card>

      <Group title={s.gSessionActive}>
        <Row icon="video.fill" hue={source.glasses ? c.success : undefined} title={source.glasses ? s.gSessionActive : s.gSessionNone} subtitle={`${s.gSource}: ${source.glasses ? s.gSourceGlasses : s.gSourcePhone}`} />
        <Divider />
        <Row icon="battery.50percent" title={s.gBattery} subtitle={s.gBatteryUnknown} />
      </Group>

      {/* Only what has been verified is marked available. */}
      <Group title={s.gCapabilities}>
        <Row icon="camera.fill" title={s.gCapCamera} trailing={<Badge tone={capTone(ready)} label={cap(ready)} />} />
        <Divider />
        <Row icon="photo.fill" title={s.gCapPhoto} subtitle={source.frame ? undefined : undefined} trailing={<Badge tone={capTone(!!source.frame)} label={cap(!!source.frame)} />} />
        <Divider />
        <Row icon="dot.radiowaves.left.and.right" title={s.gCapLive} trailing={<Badge tone="neutral" label={st === 'unsupported' ? s.gCapNotSupported : s.gCapNotVerified} />} />
        <Divider />
        <Row icon="mic.fill" title={s.gCapAudioIn} subtitle={s.gCapAudioNote} trailing={<Badge label={s.gCapNotVerified} />} />
        <Divider />
        <Row icon="speaker.wave.2.fill" title={s.gCapAudioOut} trailing={<Badge label={s.gCapNotVerified} />} />
      </Group>

      <Group title={s.gActiveSenses}>
        {onDevice.length ? onDevice.map((i, n) => (
          <View key={i.manifest.id}>
            {n > 0 && <Divider />}
            <Row icon="sparkles" title={senseName(i.manifest, lang)} chevron onPress={() => router.push(`/sense/${i.manifest.id}`)} />
          </View>
        )) : <Row title={s.noActiveSenses} />}
      </Group>

      <Group title={s.gPermissions}>
        <Row
          icon="camera"
          title={s.perm.camera}
          subtitle={cam?.granted ? s.obPermGranted : s.lvPermDenied}
          trailing={cam?.granted ? <Badge tone="success" label={s.on} /> : <Button compact label={s.obPermGrant} variant="secondary" onPress={() => (cam?.canAskAgain === false ? void Linking.openSettings() : void requestCam())} />}
        />
        <Divider />
        <Row icon="gearshape.fill" title={s.gOpenSettings} chevron onPress={() => void Linking.openSettings()} />
        <Divider />
        <Row icon="slider.horizontal.3" title={s.gSettings} subtitle={s.gSettingsBody} chevron onPress={() => router.push('/glasses-settings')} />
      </Group>

      <Group title={s.gDiagnostics}>
        <Row title="Meta Wearables SDK" subtitle={Glasses ? 'OK' : s.gCapNotSupported} icon="cpu" />
        <Divider />
        <Row title={s.gStatus[st]} subtitle={st} icon="stethoscope" trailing={<SymbolView name="arrow.clockwise" size={16} tintColor={c.accentText} />} onPress={glasses.refresh} />
      </Group>

      <Group title={s.gTroubleshoot}>
        {s.gTips.map((tip, i) => (
          <View key={i}>
            {i > 0 && <Divider />}
            <Row icon="lightbulb" title={tip} />
          </View>
        ))}
      </Group>
    </Screen>
  );
}
