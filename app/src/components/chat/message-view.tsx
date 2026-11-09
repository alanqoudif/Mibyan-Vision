import { Image } from 'expo-image';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { Radius, SmallTouch, Spacing, useColors } from '@/constants/theme';
import { useChatS } from '@/lib/chat-strings';
import type { ChatMessage } from '@/lib/chats';

type Props = {
  msg: ChatMessage;
  streaming?: boolean;
  speaking?: boolean;
  onSpeak?: () => void;
  onRetry?: () => void;
  onOpenTool?: () => void;
};

/** One turn, ChatGPT style: the user's words in a bubble, the assistant's as plain text. */
export function MessageView({ msg, streaming, speaking, onSpeak, onRetry, onOpenTool }: Props) {
  const c = useColors();
  const cs = useChatS();

  if (msg.role === 'user') {
    return (
      <View style={styles.userWrap} accessible accessibilityLabel={`${cs.you}: ${msg.text}${msg.image ? `. ${cs.photo}` : ''}`}>
        {msg.image ? <Image source={{ uri: msg.image }} style={styles.thumb} contentFit="cover" accessibilityIgnoresInvertColors /> : null}
        {msg.text ? (
          <View style={[styles.bubble, { backgroundColor: c.surfaceStrong }]}>
            <Text selectable>{msg.text}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  if (msg.tool) {
    return (
      <View style={[styles.tool, { borderColor: c.border, backgroundColor: c.surface }]}>
        <SymbolView name={msg.tool.icon as SFSymbol} size={20} tintColor={c.accentText} />
        <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
          {cs.usedTool(msg.tool.label)}
        </Text>
        {onOpenTool ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`${cs.openAgain}: ${msg.tool.label}`} onPress={onOpenTool} hitSlop={8} style={styles.toolBtn}>
            <Text variant="label" tone="accent">
              {cs.openAgain}
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const empty = !msg.text && streaming;
  return (
    <View style={styles.assistant}>
      {empty ? (
        <View style={styles.thinking} accessible accessibilityLabel={cs.thinking} accessibilityLiveRegion="polite">
          <ActivityIndicator color={c.textSecondary} />
          <Text tone="secondary">{cs.thinking}</Text>
        </View>
      ) : (
        <Text variant="body" selectable tone={msg.error ? 'danger' : 'primary'} style={styles.answer}>
          {msg.text}
        </Text>
      )}
      {!streaming && (onSpeak || onRetry) ? (
        <View style={styles.actions}>
          {onSpeak && !msg.error ? (
            <Action icon={speaking ? 'stop.fill' : 'speaker.wave.2'} label={speaking ? cs.stopSpeaking : cs.speak} onPress={onSpeak} />
          ) : null}
          {onRetry ? <Action icon="arrow.clockwise" label={cs.retry} onPress={onRetry} /> : null}
        </View>
      ) : null}
    </View>
  );
}

function Action({ icon, label, onPress }: { icon: SFSymbol; label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.action, { opacity: pressed ? 0.5 : 1 }]}>
      <SymbolView name={icon} size={18} tintColor={c.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  userWrap: { alignSelf: 'flex-end', alignItems: 'flex-end', maxWidth: '85%', gap: Spacing.two },
  bubble: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + 2, borderRadius: Radius.lg },
  thumb: { width: 160, height: 200, borderRadius: Radius.md },
  assistant: { alignSelf: 'stretch', gap: Spacing.one },
  answer: { lineHeight: 30 },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: SmallTouch },
  actions: { flexDirection: 'row', gap: Spacing.one, marginStart: -Spacing.two },
  action: { width: SmallTouch, height: SmallTouch, alignItems: 'center', justifyContent: 'center' },
  tool: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  toolBtn: { minHeight: SmallTouch, justifyContent: 'center', paddingHorizontal: Spacing.one },
});
