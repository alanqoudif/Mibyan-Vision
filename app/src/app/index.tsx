import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AttachSheet } from '@/components/chat/attach-sheet';
import { CameraSheet } from '@/components/chat/camera-sheet';
import { Composer } from '@/components/chat/composer';
import { MessageView } from '@/components/chat/message-view';
import { Sidebar } from '@/components/chat/sidebar';
import { CircleButton } from '@/components/chrome';
import { SenseOrb } from '@/components/sense-orb';
import { Text } from '@/components/text';
import { MinTouch, Radius, Spacing, useColors } from '@/constants/theme';
import { parseTags, splitAnswer, streamAssist, visibleText, type AssistRequest, type Turn } from '@/lib/assist';
import { capabilities, capabilityFor, type Capability } from '@/lib/capabilities';
import { useChatS } from '@/lib/chat-strings';
import { appendMessage, newId, patchMessage, useChats, type ChatMessage, type ToolUse } from '@/lib/chats';
import { matchMode, matchRoute } from '@/lib/commands';
import { dial, phoneIn } from '@/lib/emergency';
import { captureFromGlasses, useGlasses } from '@/lib/glasses';
import { contactIn } from '@/lib/helper';
import { useI18n, voiceFor } from '@/lib/i18n';
import { medRefs } from '@/lib/meds';
import { memoryNotes, recordTags } from '@/lib/memory';
import type { ModeId } from '@/lib/modes';
import { READS_TEXT, readTextOffline } from '@/lib/offline';
import { preparePhoto, type Photo } from '@/lib/photo';
import { SPEECH_RATE, useSettings } from '@/lib/settings';
import * as Voice from '@/lib/voice';

const HISTORY_TURNS = 12;

/**
 * The whole app is this one conversation. Type, talk or attach a photo; when a request is
 * really a tool ("read this", "where's the qibla", "call mom") the assistant opens that tool
 * itself and leaves a note in the chat, so nobody has to learn where things live.
 */
export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const cs = useChatS();
  const { lang, dir } = useI18n();
  const { settings } = useSettings();
  const glasses = useGlasses();
  const glassesOn = glasses.status === 'ready';
  const chats = useChats();

  const [chatId, setChatId] = useState(() => newId('c'));
  const [input, setInput] = useState('');
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);

  const chat = chats.find((x) => x.id === chatId);
  const messages = useMemo(() => chat?.messages ?? [], [chat]);
  const tools = useMemo(() => capabilities(lang, settings.enabledTools), [lang, settings.enabledTools]);

  useEffect(() => {
    if (!settings.sixthOnboarded) router.push('/onboarding');
    // First mount only; onboarding sets the flag itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      abort.current?.abort();
      Voice.stop();
    },
    [],
  );

  const toolNote = (t: ToolUse) => appendMessage(chatId, { id: newId(), role: 'assistant', text: '', tool: t });
  const openCapability = (cap: Capability, q?: string) => {
    toolNote({ id: cap.id, label: cap.label, icon: cap.icon });
    router.push(cap.href(q));
  };

  // ---------- speech ----------
  const speak = useCallback(
    (msg: ChatMessage) => {
      if (speakingId === msg.id) {
        Voice.stop();
        setSpeakingId(null);
        return;
      }
      Voice.stop();
      setSpeakingId(msg.id);
      Voice.speak(msg.text, { language: voiceFor(msg.text), rate: SPEECH_RATE[settings.speed], onDone: () => setSpeakingId((v) => (v === msg.id ? null : v)) });
    },
    [settings.speed, speakingId],
  );

  // ---------- one assistant answer ----------
  const answer = useCallback(
    async (cid: string, msgId: string, history: Turn[], text: string, image: string | undefined, mode: ModeId) => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      setStreamingId(msgId);
      Voice.stop();
      setSpeakingId(null);
      let raw = '';
      try {
        const req: AssistRequest = {
          mode,
          text: text || undefined,
          image,
          history,
          model: settings.model,
          detail: settings.detail,
          lang,
          memory: memoryNotes(lang),
          directions: settings.directions,
          meds: mode === 'meds' ? await medRefs() : undefined,
        };
        raw = await streamAssist(
          req,
          (delta) => {
            if (ctrl.signal.aborted) return;
            raw += delta;
            patchMessage(cid, msgId, { text: visibleText(splitAnswer(raw).answer) }, false);
          },
          ctrl.signal,
        );
      } catch (e) {
        if (ctrl.signal.aborted) {
          patchMessage(cid, msgId, { text: visibleText(splitAnswer(raw).answer).trim() });
          setStreamingId(null);
          return;
        }
        console.warn(e);
        // No internet: text can still be read on the phone itself.
        const offline = READS_TEXT.has(mode) && image ? await readTextOffline(image, lang) : null;
        patchMessage(cid, msgId, offline ? { text: offline, error: false } : { text: cs.errNetwork, error: true });
        setStreamingId(null);
        if (offline && settings.speakResults) Voice.speak(offline, { language: voiceFor(offline), rate: SPEECH_RATE[settings.speed] });
        return;
      }
      const body = splitAnswer(raw).answer;
      const shown = visibleText(body).trim();
      patchMessage(cid, msgId, { text: shown, error: false });
      setStreamingId(null);
      recordTags(parseTags(body), image);
      if (settings.haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (settings.speakResults && shown) {
        setSpeakingId(msgId);
        Voice.speak(shown, { language: voiceFor(shown), rate: SPEECH_RATE[settings.speed], onDone: () => setSpeakingId((v) => (v === msgId ? null : v)) });
      }
    },
    [cs.errNetwork, lang, settings],
  );

  const historyOf = (list: ChatMessage[]): Turn[] =>
    list
      .filter((m) => !m.tool && !m.error && m.text)
      .slice(-HISTORY_TURNS)
      .map((m) => ({ role: m.role, content: m.text }));

  // ---------- sending ----------
  const send = async (override?: string) => {
    const text = (override ?? input).trim();
    const img = photo;
    if ((!text && !img) || streamingId) return;
    setInput('');
    setPhoto(null);
    const cid = chatId;
    const prior = historyOf(messages);
    appendMessage(cid, { id: newId(), role: 'user', text, image: img?.uri });

    if (text) {
      // "Where's the qibla", "call mom", "watch with me": open that screen instead of answering.
      const route = matchRoute(text, (t) => contactIn(t)?.id, phoneIn);
      if (route && 'dial' in route) {
        toolNote({ id: 'call', label: text, icon: 'phone.fill' });
        dial(route.dial);
        return;
      }
      if (route) {
        const id = route.pathname === '/qibla' ? 'qibla' : route.pathname === '/live' ? 'live' : route.pathname === '/helper' ? 'helper' : 'where';
        const cap = capabilityFor(id, lang, settings.enabledTools);
        if (cap) {
          toolNote({ id: cap.id, label: cap.label, icon: cap.icon });
          router.push(route as Href);
          return;
        }
      }
      // Vision tools coach the aim and retake on their own, so without a photo they get the camera.
      const tool = matchMode(text);
      const cap = tool ? capabilityFor(tool, lang, settings.enabledTools) : undefined;
      if (cap && !img) return openCapability(cap, text);
    }

    const matched = text ? matchMode(text) : null;
    const mode: ModeId = matched && matched !== 'find' && settings.enabledTools.includes(matched) && img ? matched : img && !text ? 'describe' : 'ask';
    const msgId = newId();
    appendMessage(cid, { id: msgId, role: 'assistant', text: '' }, false);
    answer(cid, msgId, prior, text, img?.base64, mode);
  };

  const retry = async (msg: ChatMessage) => {
    const i = messages.findIndex((m) => m.id === msg.id);
    const user = [...messages.slice(0, i)].reverse().find((m) => m.role === 'user');
    if (!user || streamingId) return;
    const image = user.image ? await new File(user.image).base64().catch(() => undefined) : undefined;
    patchMessage(chatId, msg.id, { text: '', error: false }, false);
    const prior = historyOf(messages.slice(0, messages.indexOf(user)));
    answer(chatId, msg.id, prior, user.text, image, image && !user.text ? 'describe' : 'ask');
  };

  const stop = () => {
    abort.current?.abort();
    Voice.stop();
    setSpeakingId(null);
  };

  const takePhoto = async () => {
    setPlusOpen(false);
    if (glassesOn) {
      const uri = await captureFromGlasses();
      const p = uri ? await preparePhoto(uri) : undefined;
      if (p) return setPhoto(p);
    }
    setCameraOpen(true);
  };

  const startNew = () => {
    stop();
    setChatId(newId('c'));
    setInput('');
    setPhoto(null);
    setMenuOpen(false);
  };

  const navigate = (to: 'tools' | 'senses' | 'memory' | 'glasses' | 'settings') => {
    setMenuOpen(false);
    router.push(({ tools: '/tools', senses: '/senses', memory: '/memory', glasses: '/glasses', settings: '/profile' } as const)[to]);
  };

  const empty = messages.length === 0;

  return (
    <View style={[styles.root, { backgroundColor: c.background, direction: dir }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.one }]}>
        <CircleButton icon="line.3.horizontal" label={cs.menu} variant="filled" onPress={() => setMenuOpen(true)} />
        <View style={styles.titleWrap}>
          <Text variant="heading" accessibilityRole="header" numberOfLines={1}>
            {empty ? cs.title : chat?.title ?? cs.title}
          </Text>
          {glassesOn ? (
            <View style={styles.status}>
              <View style={[styles.dot, { backgroundColor: c.success }]} />
              <Text variant="label" tone="secondary">
                {cs.glassesOn}
              </Text>
            </View>
          ) : null}
        </View>
        <CircleButton icon="square.and.pencil" label={cs.newChat} variant="filled" onPress={startNew} disabled={empty} style={{ opacity: empty ? 0.4 : 1 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {empty ? (
          <View style={styles.empty}>
            <SenseOrb size={88} state={glassesOn ? 'connected' : 'idle'} />
            <Text variant="title" center accessibilityRole="header">
              {cs.emptyTitle(settings.name)}
            </Text>
            <Text tone="secondary" center>
              {cs.emptyBody}
            </Text>
          </View>
        ) : (
          <ScrollView
            ref={scroll}
            style={{ flex: 1 }}
            contentContainerStyle={styles.list}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
            {messages.map((m) => {
              const cap = m.tool ? capabilityFor(m.tool.id, lang, settings.enabledTools) : undefined;
              return (
                <MessageView
                  key={m.id}
                  msg={m}
                  streaming={m.id === streamingId}
                  speaking={m.id === speakingId}
                  onSpeak={m.role === 'assistant' && m.text ? () => speak(m) : undefined}
                  onRetry={m.error ? () => retry(m) : undefined}
                  onOpenTool={cap ? () => router.push(cap.href()) : undefined}
                />
              );
            })}
          </ScrollView>
        )}

        <View style={{ paddingHorizontal: Spacing.three, paddingBottom: insets.bottom + Spacing.two, gap: Spacing.two }}>
          {empty && !input ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.two }} keyboardShouldPersistTaps="handled">
              {cs.suggestions.map((sg) => (
                <Pressable
                  key={sg.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${sg.title}. ${sg.sub}`}
                  onPress={() => send(sg.text)}
                  style={({ pressed }) => [styles.suggestion, { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.6 : 1 }]}>
                  <Text variant="heading" numberOfLines={1}>
                    {sg.title}
                  </Text>
                  <Text variant="caption" tone="secondary" numberOfLines={1}>
                    {sg.sub}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          <Composer
            value={input}
            onChange={setInput}
            photo={photo}
            onRemovePhoto={() => setPhoto(null)}
            busy={!!streamingId}
            onSend={() => send()}
            onStop={stop}
            onPlus={() => setPlusOpen(true)}
            onVoice={() => router.push({ pathname: '/session', params: { mode: 'ask' } })}
          />
        </View>
      </KeyboardAvoidingView>

      <Sidebar
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        chats={chats}
        currentId={chat ? chatId : null}
        tools={tools}
        name={settings.name}
        glassesOn={glassesOn}
        onNewChat={startNew}
        onOpenChat={(id) => {
          stop();
          setChatId(id);
          setMenuOpen(false);
        }}
        onTool={(t) => {
          setMenuOpen(false);
          router.push(t.href());
        }}
        onNavigate={navigate}
      />
      <AttachSheet
        visible={plusOpen}
        onClose={() => setPlusOpen(false)}
        tools={tools}
        onPhoto={takePhoto}
        onTool={(t) => {
          setPlusOpen(false);
          openCapability(t);
        }}
      />
      <CameraSheet visible={cameraOpen} onClose={() => setCameraOpen(false)} onPhoto={setPhoto} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
  titleWrap: { flex: 1, alignItems: 'center', minHeight: MinTouch, justifyContent: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  dot: { width: 7, height: 7, borderRadius: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, paddingHorizontal: Spacing.five },
  list: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two, paddingBottom: Spacing.four, gap: Spacing.four },
  suggestion: { width: 200, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + 2, gap: 2 },
});
