import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Alert, View } from 'react-native';

import { SignInCard } from '@/components/sign-in-card';
import { Text } from '@/components/text';
import { Button, Divider, Group, LargeTitle, Row, Screen, Segmented, TextField, Toggle } from '@/components/ui';
import { Spacing, useColors } from '@/constants/theme';
import { useChatS } from '@/lib/chat-strings';
import { clearChats } from '@/lib/chats';
import { useGlasses } from '@/lib/glasses';
import { forgetAll } from '@/lib/memory';
import { clearRuns } from '@/lib/runlog';
import { useSettings } from '@/lib/settings';
import { useS } from '@/lib/strings';
import { signOutVision, useVisionSession, visionClient, visionIsSeparate } from '@/lib/vision';

/** Settings, ChatGPT style: a handful of groups, everything advanced one tap deeper. */
export default function SettingsScreen() {
  const s = useS();
  const cs = useChatS();
  const c = useColors();
  const router = useRouter();
  const { settings, update } = useSettings();
  const session = useVisionSession();
  const glasses = useGlasses();
  const langValue = settings.languageMode === 'system' ? 'system' : settings.lang;

  const wipe = () =>
    Alert.alert(s.prDeleteData, s.prDeleteConfirm, [
      { text: s.cancel, style: 'cancel' },
      {
        text: s.delete,
        style: 'destructive',
        onPress: () => {
          clearRuns();
          forgetAll();
          clearChats();
        },
      },
    ]);

  return (
    <Screen>
      <LargeTitle sub={session.email ? `${s.signedInAs} ${session.email}` : undefined}>{cs.settings}</LargeTitle>

      <Group title={s.prAccount}>
        <View style={{ padding: Spacing.three, gap: Spacing.two }}>
          <Text variant="heading">{s.prName}</Text>
          <TextField value={settings.name} onChange={(name) => update({ name })} placeholder={s.prName} />
        </View>
        {session.email ? (
          <>
            <Divider />
            <Row
              icon="person.badge.key.fill"
              title={s.prAuth}
              subtitle={session.email}
              trailing={<Button compact variant="ghost" label={s.signOut} onPress={() => void (visionIsSeparate ? signOutVision() : visionClient?.auth.signOut())} />}
            />
          </>
        ) : null}
      </Group>
      {!session.email && visionClient ? <SignInCard /> : null}

      <Group title={s.prPrefs}>
        <View style={{ padding: Spacing.three, gap: Spacing.two }}>
          <Text variant="heading">{s.prLanguage}</Text>
          <Segmented
            value={langValue}
            options={[{ id: 'system', label: s.prLangSystem }, { id: 'ar', label: 'العربية' }, { id: 'en', label: 'English' }]}
            onChange={(v) => update(v === 'system' ? { languageMode: 'system' } : { languageMode: 'manual', lang: v })}
          />
        </View>
        <Divider />
        <View style={{ padding: Spacing.three, gap: Spacing.two }}>
          <Text variant="heading">{s.prAppearance}</Text>
          <Segmented
            value={settings.appearance}
            options={[{ id: 'dark', label: s.prDark }, { id: 'light', label: s.prLight }, { id: 'system', label: s.prSystem }]}
            onChange={(appearance) => update({ appearance })}
          />
        </View>
      </Group>

      <Group title={cs.assistant}>
        <View style={{ padding: Spacing.three, gap: Spacing.two }}>
          <Text variant="heading">{s.prAi}</Text>
          <Segmented value={settings.model} options={[{ id: 'smart', label: s.prModelSmart }, { id: 'fast', label: s.prModelFast }]} onChange={(model) => update({ model })} />
        </View>
        <Divider />
        <Row
          icon="speaker.wave.2.fill"
          title={s.prSpeakResults}
          trailing={<Toggle value={settings.speakResults} onChange={(speakResults) => update({ speakResults })} label={s.prSpeakResults} />}
        />
        <Divider />
        <Row icon="figure.wave" title={s.prAccessibility} subtitle={s.prAccessibilityBody} chevron onPress={() => router.push('/assistant-settings')} />
        <Divider />
        <Row icon="square.grid.2x2.fill" title={s.prTools} subtitle={s.prToolsBody} chevron onPress={() => router.push('/plugins')} />
        <Divider />
        <Row icon="brain.head.profile" title={s.prMemory} chevron onPress={() => router.push('/memory')} />
      </Group>

      <Group title={s.prDevice}>
        <Row
          icon="eyeglasses"
          hue={glasses.status === 'ready' ? c.success : undefined}
          title={s.prGlasses}
          subtitle={s.gStatus[glasses.status]}
          chevron
          onPress={() => router.push('/glasses')}
        />
        <Divider />
        <Row icon="sparkles" title={cs.senses} chevron onPress={() => router.push('/senses')} />
        <Divider />
        <Row icon="clock" title={s.tabActivity} chevron onPress={() => router.push('/activity')} />
      </Group>

      <Group title={s.prAbout}>
        <Row icon="questionmark.circle" title={s.prHelp} chevron onPress={() => router.push('/help-view')} />
        <Divider />
        <Row icon="sparkles" title={s.prOnboarding} chevron onPress={() => router.push('/onboarding')} />
        <Divider />
        <Row icon="info.circle" title={s.prAppVersion} subtitle={`${Constants.expoConfig?.version ?? '—'}`} />
      </Group>

      <Group>
        <Row icon="trash" danger title={s.prDeleteData} onPress={wipe} />
      </Group>
    </Screen>
  );
}
