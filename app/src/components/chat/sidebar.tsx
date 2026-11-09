import * as Haptics from 'expo-haptics';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { SlideInLeft, SlideInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { MinTouch, Radius, Spacing, useColors } from '@/constants/theme';
import type { Capability } from '@/lib/capabilities';
import { useChatS } from '@/lib/chat-strings';
import { deleteChat, type Chat } from '@/lib/chats';
import { useI18n } from '@/lib/i18n';

type Props = {
  visible: boolean;
  onClose: () => void;
  chats: Chat[];
  currentId: string | null;
  tools: Capability[];
  name: string;
  glassesOn: boolean;
  onNewChat: () => void;
  onOpenChat: (id: string) => void;
  onTool: (c: Capability) => void;
  onNavigate: (to: 'tools' | 'senses' | 'memory' | 'glasses' | 'settings') => void;
};

/** The side menu: new chat, a few tools, past chats, and the account at the bottom. */
export function Sidebar({ visible, onClose, chats, currentId, tools, name, glassesOn, onNewChat, onOpenChat, onTool, onNavigate }: Props) {
  const c = useColors();
  const cs = useChatS();
  const { dir } = useI18n();
  const insets = useSafeAreaInsets();
  const initial = name.trim().charAt(0).toUpperCase();

  const confirmDelete = (chat: Chat) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(cs.deleteChat, cs.deleteChatConfirm, [
      { text: cs.cancel, style: 'cancel' },
      { text: cs.delete, style: 'destructive', onPress: () => deleteChat(chat.id) },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[StyleSheet.absoluteFill, { direction: dir }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={cs.close} onPress={onClose} style={[StyleSheet.absoluteFill, styles.scrim]} />
        <Animated.View
          entering={(dir === 'rtl' ? SlideInRight : SlideInLeft).duration(220)}
          accessibilityViewIsModal
          style={[styles.panel, { backgroundColor: c.background, borderColor: c.border, paddingTop: insets.top + Spacing.two, paddingBottom: insets.bottom + Spacing.two }]}>
          <ScrollView contentContainerStyle={styles.scroll}>
            <Item icon="square.and.pencil" label={cs.newChat} onPress={onNewChat} strong />

            <Section title={cs.tools} />
            {tools.slice(0, 4).map((t) => (
              <Item key={t.id} icon={t.icon} label={t.label} onPress={() => onTool(t)} />
            ))}
            <Item icon="sparkles" label={cs.senses} onPress={() => onNavigate('senses')} />
            <Item icon="brain.head.profile" label={cs.memory} onPress={() => onNavigate('memory')} />
            <Item icon="square.grid.2x2" label={cs.allTools} onPress={() => onNavigate('tools')} />

            <Section title={cs.chats} />
            {chats.length ? (
              chats.map((chat) => (
                <Pressable
                  key={chat.id}
                  accessibilityRole="button"
                  accessibilityLabel={chat.title}
                  accessibilityState={{ selected: chat.id === currentId }}
                  accessibilityActions={[{ name: 'delete', label: cs.deleteChat }]}
                  onAccessibilityAction={(e) => e.nativeEvent.actionName === 'delete' && confirmDelete(chat)}
                  onPress={() => onOpenChat(chat.id)}
                  onLongPress={() => confirmDelete(chat)}
                  style={({ pressed }) => [styles.chat, (pressed || chat.id === currentId) && { backgroundColor: c.surface }]}>
                  <Text numberOfLines={1} style={{ flex: 1 }}>
                    {chat.title}
                  </Text>
                </Pressable>
              ))
            ) : (
              <Text variant="caption" tone="tertiary" style={{ paddingHorizontal: Spacing.three, paddingVertical: Spacing.two }}>
                {cs.noChats}
              </Text>
            )}
          </ScrollView>

          <View style={[styles.footer, { borderColor: c.border }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${cs.settings}${name ? `. ${name}` : ''}`}
              onPress={() => onNavigate('settings')}
              style={({ pressed }) => [styles.account, { opacity: pressed ? 0.6 : 1 }]}>
              <View style={[styles.avatar, { backgroundColor: c.accent }]}>
                {initial ? (
                  <Text variant="heading" style={{ color: c.onAccent }}>
                    {initial}
                  </Text>
                ) : (
                  <SymbolView name="person.fill" size={18} tintColor={c.onAccent} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="heading" numberOfLines={1}>
                  {name || cs.settings}
                </Text>
                {name ? (
                  <Text variant="caption" tone="secondary">
                    {cs.settings}
                  </Text>
                ) : null}
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={glassesOn ? cs.glassesOn : cs.glasses}
              onPress={() => onNavigate('glasses')}
              style={({ pressed }) => [styles.glasses, { opacity: pressed ? 0.6 : 1 }]}>
              <SymbolView name="eyeglasses" size={24} tintColor={glassesOn ? c.success : c.textTertiary} />
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function Section({ title }: { title: string }) {
  return (
    <Text variant="label" tone="tertiary" accessibilityRole="header" style={styles.section}>
      {title}
    </Text>
  );
}

function Item({ icon, label, onPress, strong }: { icon: SFSymbol; label: string; onPress: () => void; strong?: boolean }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [styles.item, pressed && { backgroundColor: c.surface }]}>
      <SymbolView name={icon} size={20} tintColor={c.text} weight={strong ? 'semibold' : 'regular'} />
      <Text variant={strong ? 'heading' : 'body'} numberOfLines={1} style={{ flex: 1 }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: '#00000080' },
  panel: { position: 'absolute', top: 0, bottom: 0, start: 0, width: '84%', maxWidth: 360, borderEndWidth: StyleSheet.hairlineWidth },
  scroll: { paddingHorizontal: Spacing.two, paddingBottom: Spacing.four, gap: 2 },
  section: { paddingHorizontal: Spacing.three, paddingTop: Spacing.four, paddingBottom: Spacing.one },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: MinTouch - 4, paddingHorizontal: Spacing.three, borderRadius: Radius.sm },
  chat: { minHeight: MinTouch - 8, justifyContent: 'center', paddingHorizontal: Spacing.three, borderRadius: Radius.sm, flexDirection: 'row', alignItems: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.two, paddingTop: Spacing.two },
  account: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: MinTouch, paddingHorizontal: Spacing.two },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  glasses: { width: MinTouch, height: MinTouch, alignItems: 'center', justifyContent: 'center' },
});
