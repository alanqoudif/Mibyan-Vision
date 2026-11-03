import { NativeTabs } from 'expo-router/native-tabs';

import { useColors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';

export default function TabsLayout() {
  const c = useColors();
  const { t } = useI18n();
  return (
    <NativeTabs tintColor={c.text} labelStyle={{ selected: { color: c.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t.tabHome}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'circle.circle', selected: 'circle.circle.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="assistant">
        <NativeTabs.Trigger.Label>{t.tabAssistant}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="glasses">
        <NativeTabs.Trigger.Label>{t.tabGlasses}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="eyeglasses" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
