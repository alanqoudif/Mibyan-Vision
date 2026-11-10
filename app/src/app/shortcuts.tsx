import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { View } from 'react-native';

import { IconAction } from '@/components/chrome';
import { Text } from '@/components/text';
import { Button, Divider, Group, LargeTitle, Row, Screen, TextField } from '@/components/ui';
import { Spacing, useColors } from '@/constants/theme';
import { capabilities, resolveShortcuts } from '@/lib/capabilities';
import { useChatS } from '@/lib/chat-strings';
import { newId } from '@/lib/chats';
import { useI18n } from '@/lib/i18n';
import { DEFAULT_SHORTCUTS, useSettings, type Shortcut } from '@/lib/settings';

/** The buttons on the chat's start screen: the user's own, in their order. */
export default function ShortcutsScreen() {
  const cs = useChatS();
  const c = useColors();
  const { lang } = useI18n();
  const { settings, update } = useSettings();
  const [label, setLabel] = useState('');
  const [text, setText] = useState('');

  const list = Array.isArray(settings.shortcuts) ? settings.shortcuts : [];
  const shown = resolveShortcuts(list, lang, settings.enabledTools);
  const used = new Set(list.filter((s) => s.kind === 'tool').map((s) => s.tool));
  const addable = capabilities(lang, settings.enabledTools).filter((cap) => !used.has(cap.id));

  const save = (next: Shortcut[]) => {
    Haptics.selectionAsync();
    update({ shortcuts: next });
  };
  const move = (id: string, by: -1 | 1) => {
    const i = list.findIndex((s) => s.id === id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
  };
  const addPrompt = () => {
    if (!text.trim()) return;
    save([...list, { id: newId('sc'), kind: 'prompt', label: label.trim(), text: text.trim() }]);
    setLabel('');
    setText('');
  };

  return (
    <Screen>
      <LargeTitle sub={cs.editShortcutsHint}>{cs.shortcuts}</LargeTitle>

      <Group>
        {shown.length ? (
          shown.map((r, i) => (
            <View key={r.shortcut.id}>
              {i > 0 ? <Divider /> : null}
              <Row
                icon={r.icon}
                hue={c.accent}
                title={r.label}
                subtitle={r.shortcut.kind === 'prompt' && r.shortcut.label ? r.shortcut.text : undefined}
                trailing={
                  <View style={{ flexDirection: 'row' }}>
                    {i > 0 ? <IconAction icon="chevron.up" label={`${cs.moveUp}: ${r.label}`} color={c.textSecondary} size={18} onPress={() => move(r.shortcut.id, -1)} /> : null}
                    {i < shown.length - 1 ? (
                      <IconAction icon="chevron.down" label={`${cs.moveDown}: ${r.label}`} color={c.textSecondary} size={18} onPress={() => move(r.shortcut.id, 1)} />
                    ) : null}
                    <IconAction icon="minus.circle.fill" label={`${cs.remove}: ${r.label}`} color={c.stopText} onPress={() => save(list.filter((s) => s.id !== r.shortcut.id))} />
                  </View>
                }
              />
            </View>
          ))
        ) : (
          <Text tone="secondary" style={{ padding: Spacing.three }}>
            {cs.noShortcuts}
          </Text>
        )}
      </Group>

      <Group title={cs.customShortcut}>
        <View style={{ padding: Spacing.three, gap: Spacing.two }}>
          <TextField value={text} onChange={setText} placeholder={cs.customText} />
          <TextField value={label} onChange={setLabel} placeholder={cs.customLabel} />
          <Button label={cs.add} icon="plus" disabled={!text.trim()} onPress={addPrompt} />
        </View>
      </Group>

      {addable.length ? (
        <Group title={cs.addTool}>
          {addable.map((cap, i) => (
            <View key={cap.id}>
              {i > 0 ? <Divider /> : null}
              <Row
                icon={cap.icon}
                title={cap.label}
                subtitle={cap.hint}
                hint={cs.add}
                trailing={<IconAction icon="plus.circle.fill" label={`${cs.add}: ${cap.label}`} color={c.accentText} onPress={() => save([...list, { id: newId('sc'), kind: 'tool', tool: cap.id, label: '' }])} />}
              />
            </View>
          ))}
        </Group>
      ) : null}

      <Button variant="ghost" label={cs.resetShortcuts} onPress={() => save(DEFAULT_SHORTCUTS)} />
    </Screen>
  );
}
