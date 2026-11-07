import { useRouter } from 'expo-router';

import { EmptyState, Row, Screen, ScreenHeader, Group, Divider, Badge, SkeletonList } from '@/components/ui';
import { View } from 'react-native';
import { useI18n } from '@/lib/i18n';
import { senseName, useInstalledSenses } from '@/lib/sixth';
import { useS } from '@/lib/strings';

export default function WorkflowsScreen() {
  const router = useRouter();
  const s = useS();
  const { lang } = useI18n();
  const installed = useInstalledSenses();
  return (
    <Screen header={<ScreenHeader back title={s.wfList} />} onRefresh={installed.refresh} refreshing={installed.loading}>
      {!installed.ready ? <SkeletonList count={3} height={72} /> : installed.items.length ? (
        <Group>
          {installed.items.map((i, n) => (
            <View key={i.manifest.id}>
              {n > 0 && <Divider />}
              <Row
                icon="point.3.connected.trianglepath.dotted"
                title={senseName(i.manifest, lang)}
                subtitle={`${i.manifest.workflow.nodes.length} ${s.wfSteps}`}
                trailing={<Badge tone={i.enabled ? 'success' : 'neutral'} label={i.enabled ? s.wfActive : s.wfDisabled} />}
                chevron
                onPress={() => router.push(`/workflow/${i.manifest.id}`)}
              />
            </View>
          ))}
        </Group>
      ) : (
        <EmptyState icon="point.3.connected.trianglepath.dotted" title={s.wfNone} />
      )}
    </Screen>
  );
}
