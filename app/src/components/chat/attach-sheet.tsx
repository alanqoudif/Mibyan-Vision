import { View } from 'react-native';

import { Divider, Group, Row, Sheet } from '@/components/ui';
import { useColors } from '@/constants/theme';
import type { Capability } from '@/lib/capabilities';
import { useChatS } from '@/lib/chat-strings';

/** The "+" menu: attach a photo, or jump straight into one tool. */
export function AttachSheet({
  visible,
  onClose,
  tools,
  onPhoto,
  onTool,
}: {
  visible: boolean;
  onClose: () => void;
  tools: Capability[];
  onPhoto: () => void;
  onTool: (c: Capability) => void;
}) {
  const c = useColors();
  const cs = useChatS();
  return (
    <Sheet visible={visible} onClose={onClose} title={cs.attach}>
      <Group>
        <Row icon="camera.fill" hue={c.accent} title={cs.takePhoto} subtitle={cs.takePhotoHint} onPress={onPhoto} />
      </Group>
      <Group title={cs.tools}>
        {tools.map((t, i) => (
          <View key={t.id}>
            {i > 0 ? <Divider /> : null}
            <Row icon={t.icon} title={t.label} subtitle={t.hint} onPress={() => onTool(t)} />
          </View>
        ))}
      </Group>
    </Sheet>
  );
}
