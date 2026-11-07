import { NativeTabs } from 'expo-router/native-tabs';

import { useColors } from '@/constants/theme';
import { useS } from '@/lib/strings';

export default function TabsLayout() {
  const c = useColors();
  const s = useS();
  return (
    <NativeTabs tintColor={c.accentText} backgroundColor={c.background} labelStyle={{ selected: { color: c.accentText } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{s.tabHome}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'circle.hexagongrid', selected: 'circle.hexagongrid.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="senses">
        <NativeTabs.Trigger.Label>{s.tabSenses}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'sparkles', selected: 'sparkles' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="glasses">
        <NativeTabs.Trigger.Label>{s.tabGlasses}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="eyeglasses" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="activity">
        <NativeTabs.Trigger.Label>{s.tabActivity}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'clock', selected: 'clock.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>{s.tabProfile}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
