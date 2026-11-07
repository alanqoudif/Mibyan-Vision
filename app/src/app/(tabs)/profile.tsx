import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Alert, Linking, View } from 'react-native';

import { SignInCard } from '@/components/sign-in-card';
import { Text } from '@/components/text';
import { Badge, Button, Chip, Divider, Group, LargeTitle, Row, Screen, Segmented, TextField, Toggle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';
import { forgetAll } from '@/lib/memory';
import { clearRuns } from '@/lib/runlog';
import { useSettings } from '@/lib/settings';
import { useS } from '@/lib/strings';
import { signOutVision, useVisionSession, visionClient, visionIsSeparate } from '@/lib/vision';

type Exp = 'everyday' | 'accessibility' | 'work' | 'developer';

export default function ProfileTab() {
  const s = useS();
  const router = useRouter();
  const { lang } = useI18n();
  const { settings, update } = useSettings();
  const session = useVisionSession();
  const exps: [Exp, string][] = [['everyday', s.expEveryday], ['accessibility', s.expAccessibility], ['work', s.expWork], ['developer', s.expDeveloper]];
  const langValue = settings.languageMode === 'system' ? 'system' : settings.lang;

  const wipe = () =>
    Alert.alert(s.prDeleteData, s.prDeleteConfirm, [
      { text: s.cancel, style: 'cancel' },
      { text: s.delete, style: 'destructive', onPress: () => { clearRuns(); forgetAll(); } },
    ]);

  return (
    <Screen tabs>
      <LargeTitle sub={session.email ? `${s.signedInAs} ${session.email}` : undefined}>{s.prTitle}</LargeTitle>

      {/* Account */}
      <Group title={s.prAccount}>
        <View style={{ padding: Spacing.three, gap: Spacing.two }}>
          <Text variant="heading">{s.prName}</Text>
          <TextField value={settings.name} onChange={(name) => update({ name })} placeholder={s.prName} />
        </View>
        <Divider />
        <Row icon="person.badge.key.fill" title={s.prAuth} subtitle={session.email ?? s.signIn} trailing={session.email ? <Button compact variant="ghost" label={s.signOut} onPress={() => void (visionIsSeparate ? signOutVision() : visionClient?.auth.signOut())} /> : undefined} />
        <Divider />
        <Row icon="building.2.fill" title={s.prOrg} subtitle={s.prOrgNone} trailing={<Badge label={s.prUnavailable} />} />
      </Group>
      {!session.email && visionClient ? <SignInCard /> : null}
      {!visionClient ? <Badge tone="warning" label={s.prNotConfigured} /> : null}

      {/* Preferences */}
      <Group title={s.prPrefs}>
        <View style={{ padding: Spacing.three, gap: Spacing.two }}>
          <Text variant="heading">{s.prLanguage}</Text>
          <Segmented
            value={langValue}
            options={[{ id: 'system', label: s.prLangSystem }, { id: 'ar', label: 'العربية' }, { id: 'en', label: 'English' }]}
            onChange={(v) => update(v === 'system' ? { languageMode: 'system' } : { languageMode: 'manual', lang: v })}
          />
          <Text variant="caption" tone="tertiary">{lang === 'ar' ? 'RTL' : 'LTR'}</Text>
        </View>
        <Divider />
        <View style={{ padding: Spacing.three, gap: Spacing.two }}>
          <Text variant="heading">{s.prAppearance}</Text>
          <Segmented value={settings.appearance} options={[{ id: 'dark', label: s.prDark }, { id: 'light', label: s.prLight }, { id: 'system', label: s.prSystem }]} onChange={(appearance) => update({ appearance })} />
        </View>
        <Divider />
        <Row icon="figure.wave" title={s.prAccessibility} subtitle={s.prAccessibilityBody} chevron onPress={() => router.push('/assistant-settings')} />
        <Divider />
        <Row icon="bell.fill" title={s.prNotifications} subtitle={s.prNotificationsBody} chevron onPress={() => void Linking.openSettings()} />
      </Group>

      {/* Sixth Sense */}
      <Group title={s.prSixth}>
        <View style={{ padding: Spacing.three, gap: Spacing.two }}>
          <Text variant="heading">{s.prDefaultProfile}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
            {exps.map(([k, label]) => <Chip key={k} label={label} selected={settings.experience === k} onPress={() => update({ experience: k })} />)}
          </View>
        </View>
        <Divider />
        <View style={{ padding: Spacing.three, gap: Spacing.two }}>
          <Text variant="heading">{s.prAi}</Text>
          <Segmented value={settings.model} options={[{ id: 'smart', label: s.prModelSmart }, { id: 'fast', label: s.prModelFast }]} onChange={(model) => update({ model })} />
        </View>
        <Divider />
        <Row title={s.prSpeakResults} icon="speaker.wave.2.fill" trailing={<Toggle value={settings.speakResults} onChange={(speakResults) => update({ speakResults })} label={s.prSpeakResults} />} />
        <Divider />
        <Row icon="brain.head.profile" title={s.prMemory} chevron onPress={() => router.push('/memory')} />
        <Divider />
        <Row icon="checkmark.shield.fill" title={s.prPermissions} chevron onPress={() => router.push('/permissions')} />
        <Divider />
        <Row icon="square.grid.2x2.fill" title={s.prTools} subtitle={s.prToolsBody} chevron onPress={() => router.push('/tools')} />
      </Group>

      {/* Device */}
      <Group title={s.prDevice}>
        <Row icon="eyeglasses" title={s.prGlasses} chevron onPress={() => router.push('/glasses')} />
        <Divider />
        <Row icon="lock.shield" title={s.prDevicePerms} chevron onPress={() => void Linking.openSettings()} />
        <Divider />
        <Row icon="slider.horizontal.3" title={s.prConnPrefs} chevron onPress={() => router.push('/glasses-settings')} />
      </Group>

      {/* Privacy */}
      <Group title={s.prPrivacy}>
        <Row icon="video.slash.fill" title={s.prConsent} subtitle={s.prConsentBody} />
        <Divider />
        <Row icon="hourglass" title={s.prRetention} subtitle={s.prRetentionBody} />
        <Divider />
        <Row icon="square.and.arrow.up" title={s.prExport} trailing={<Badge label={s.prExportSoon} />} />
        <Divider />
        <Row icon="trash" danger title={s.prDeleteData} onPress={wipe} />
      </Group>

      {/* About */}
      <Group title={s.prAbout}>
        <Row icon="info.circle" title={s.prAppVersion} subtitle={`${Constants.expoConfig?.version ?? '—'}`} />
        <Divider />
        <Row icon="questionmark.circle" title={s.prHelp} chevron onPress={() => router.push('/help-view')} />
        <Divider />
        <Row icon="mic.fill" title={s.prVoiceSetup} chevron onPress={() => router.push('/welcome')} />
        <Divider />
        <Row icon="sparkles" title={s.prOnboarding} chevron onPress={() => router.push('/onboarding')} />
        <Divider />
        <Row icon="doc.text" title={s.prLegal} trailing={<Badge label={s.prUnavailable} />} />
      </Group>
    </Screen>
  );
}
