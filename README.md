# مبيان فيجن · Mibyan Vision

**عيون ذكية للمكفوفين وضعاف البصر.** تكلّم مبيان بصوتك، وهو يشوف من كاميرا نظارة Ray‑Ban Meta (أو كاميرا الجوال) ويرد عليك بصوت واضح، بلهجة خليجية أو بالإنجليزي.

**Smart eyes for blind and low‑vision people.** Talk to Mibyan, and it looks through your Ray‑Ban Meta glasses (or the phone camera) and answers out loud, in Gulf Arabic or English.

> iOS app built with Expo and React Native. The backend runs on Supabase Edge Functions.

---

## ✨ المزايا · Features

| | العربي | English |
|---|---|---|
| 🎙️ | **زر واحد للكلام**: اسأل أي شي، وأول سؤال يختار الأداة المناسبة لحاله | **One tap and talk**: ask anything, and the first question picks the right tool |
| 👓 | **نظارة Ray‑Ban Meta**: الصور تجي من كاميرا النظارة، والجوال يقدر يكون في جيبك | **Ray‑Ban Meta glasses**: photos come from the glasses, so the phone can stay in your pocket |
| 🔴 | **الوضع المباشر**: يراقب معك ويتكلم بس لما يكون فيه شي مهم أو خطر | **Live mode**: watches with you and speaks up only when something matters |
| 📖 | قراءة النصوص والكتب والشاشات والمنيو والفواتير | Reads text, books, screens, menus and bills |
| 💵 | العملات، والمنتجات وتاريخ الانتهاء، والتأكد من الدواء | Money, products and expiry dates, and checking you have the right medicine |
| 👕 | الألوان والملابس والبقع | Colors, clothes and stains |
| 📍 | وين أنا، واتجاه القبلة | Where am I, and the Qibla direction |
| 🔎 | دوّر على أغراضك مع توجيه بالاتجاه والخطوات | Find your things, with direction and step guidance |
| 🤝 | **أحد يشوف معي**: شخص تثق فيه يشوف من نظارتك ويوجّهك برسائل تنقرا لك بصوت | **See with me**: someone you trust sees through your glasses and guides you with messages read aloud |
| 🆘 | جهات طوارئ: قول "اتصل بأمي" ويتصل | Emergency contacts: say "call mom" and it dials |
| 📴 | قراءة النص بدون إنترنت (Apple Vision على الجهاز) | Offline text reading with on‑device Apple Vision |
| 🗣️ | Siri وزر الأكشن، وVoiceOver (Magic Tap) | Siri, the Action button and VoiceOver (Magic Tap) |

---

## 🧱 Architecture

```
iPhone app (Expo / React Native)
├── src/app/                 Screens (Expo Router)
│   ├── (tabs)/              Home · Glasses · My assistant
│   ├── session.tsx          Talk / one-shot tools (read, money, meds…)
│   ├── live.tsx             Live mode
│   ├── find.tsx             Find something
│   ├── helper.tsx           "See with me" (blind user side)
│   ├── help-view.tsx        "See with me" (helper side)
│   └── qibla.tsx, contacts.tsx, history.tsx, tools.tsx, welcome.tsx
├── src/lib/                 Assistant client, voice, glasses, modes, i18n, settings
├── modules/mubayan-glasses  Native Swift module: Meta Wearables DAT camera,
│                            Siri shortcuts, on-device text recognition
└── plugins/                 Config plugins (Meta Wearables Info.plist/Pods, shortcuts)

Supabase
├── functions/mata-assist    Vision + language model via OpenRouter, streamed answers
├── functions/mata-helper    "See with me" sessions, codes, trusted helpers, push
└── migrations/              Helper sessions and contacts tables
```

**Camera source.** Every capture tries the glasses first (`src/lib/glasses.ts`). The phone camera only opens as a fallback, when the glasses aren't linked, are folded, or are out of range.

---

## 🚀 Getting started

### Requirements

- macOS with Xcode 26.4 or later, and Node.js LTS
- An iPhone on iOS 17.2 or later. The glasses SDK doesn't run in Expo Go or the simulator, so you need a **development build** on a real device.
- Ray‑Ban Meta glasses and the Meta AI app (optional; without them the app uses the phone camera)

### 1. Install

```bash
npm install
```

### 2. Environment

Create `.env.local`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

### 3. Run on a device

```bash
npx expo run:ios --device
```

or build a development client with EAS:

```bash
npx eas-cli@latest build --profile development --platform ios
```

then start the dev server:

```bash
npx expo start
```

### 4. Connect the glasses

1. Pair the glasses in the **Meta AI** app and update them to the latest firmware.
2. In Meta AI, open **Settings › App info** and tap the version number **5 times**, then turn on **Developer Mode**.
3. In Mibyan Vision, open the **Glasses** tab and tap **Link glasses**. Approve the app in Meta AI, then allow camera access.

> `MetaAppID` is `0` (Developer Mode) in `plugins/with-meta-wearables.js`. Before shipping to testers who don't have Developer Mode on, register the app in the [Wearables Developer Center](https://wearables.developer.meta.com/) and pass its real `metaAppId` and `clientToken` to the plugin.

---

## ☁️ Backend (Supabase)

```bash
supabase db push
supabase functions deploy mata-assist
supabase functions deploy mata-helper
```

| Secret | Used by | Notes |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | both functions | Provided by Supabase |
| `MATA_OPENROUTER_KEY` | `mata-assist` | Optional. It overrides the key kept in Vault as `mata_openrouter_key` |

---

## 🛠️ Development

```bash
npx tsc --noEmit    # type check
npx expo lint       # lint
npx expo-doctor     # dependency and config check
```

- `ios/` is generated (Continuous Native Generation). Change native settings in `app.json` or `plugins/`, never by hand.
- Strings for both languages live in `src/lib/i18n.tsx`.
- Tools and their prompts live in `src/lib/modes.ts`.

---

## 🔒 Privacy

- Assistant photos aren't stored. Only the question and answer text is saved, for History. Hidden memory and face tags are never stored or spoken.
- In **See with me**, only the latest frame is kept, and it's cleared when the session ends.
- Face recognition is turned off (`FACES_ALLOWED = false`). Mibyan describes people but doesn't identify them.
- Meta SDK analytics are opted out in the app's `Info.plist`.

---

<p align="center">صُنع بحب لمجتمع المكفوفين وضعاف البصر · Made with care for the blind and low‑vision community</p>
