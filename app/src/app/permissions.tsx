import { View } from 'react-native';

import { Text } from '@/components/text';
import { Divider, EmptyState, Group, Row, Screen, ScreenHeader } from '@/components/ui';
import { useColors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';
import { senseName, useInstalledSenses } from '@/lib/sixth';
import { useS } from '@/lib/strings';
import { PERMISSIONS } from '@mibyan/shared/sense';

/** Every permission currently granted to an installed Sense, and which Senses hold it. */
export default function PermissionsScreen() {
  const s = useS();
  const c = useColors();
  const { lang } = useI18n();
  const installed = useInstalledSenses();
  const rows = PERMISSIONS.map((p) => ({ p, by: installed.items.filter((i) => i.granted.includes(p)) })).filter((r) => r.by.length);
  return (
    <Screen header={<ScreenHeader back title={s.prPermissions} />}>
      <Text tone="secondary">{s.sdInstallBody}</Text>
      {rows.length ? (
        <Group>
          {rows.map((r, n) => (
            <View key={r.p}>
              {n > 0 && <Divider />}
              <Row icon="checkmark.shield.fill" hue={c.success} title={s.perm[r.p]} subtitle={r.by.map((i) => senseName(i.manifest, lang)).join(' · ')} />
            </View>
          ))}
        </Group>
      ) : (
        <EmptyState icon="checkmark.shield" title={s.noInstalled} />
      )}
    </Screen>
  );
}
