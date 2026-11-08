# Product

<!-- impeccable:product-schema 1 -->

## Platform

ios

The mobile app (`app/`, Expo / React Native) is iOS-first; Android builds exist but are secondary. The companion site (`web/`, Next.js) is `web`.

## Users

Blind and low-vision people in Oman and the wider Gulf. They use Mibyan Vision by voice, hands busy or phone in a pocket, while the Ray-Ban Meta glasses (or the phone camera as a fallback) look at the world for them. Most use VoiceOver; many use very large text. Arabic (Gulf dialect) is the first language; English is fully supported.

Secondary: a trusted helper (family member or friend) who joins a "See with me" session from their own phone to see through the user's glasses and guide them with messages that are read aloud. On the web, people who build or install Senses (plugins) for themselves or someone they support.

## Product Purpose

One tap and talk: ask anything and Mibyan sees, then answers out loud. It reads text, money, products, expiry dates and medicine; describes colours and clothes; says where you are and the Qibla direction; helps find things; watches in Live mode and speaks only when something matters. Success is the user getting a correct, spoken answer without needing sighted help.

## Positioning

A visual assistant built for the blind and low-vision community first, Arabic-first in Gulf dialect, that takes its eyes from Ray-Ban Meta glasses so the phone can stay in a pocket, and that grows through Senses the user or a helper can install from the web account.

## Operating Context

- Eyes-free use: VoiceOver, Magic Tap, Siri and the Action button, earcons for listening and thinking.
- Speech can collide: while the mic is open, VoiceOver announcements would be recorded as the question, so listening/thinking/live states are not announced.
- Outdoors, in pharmacies and shops, at home; glasses may be folded or out of range, so phone capture is the fallback.
- Web account (mibyan Vision Studio) syncs Senses and settings to the phone through Supabase.

## Capabilities and Constraints

- Screens: Home, Glasses, My assistant (tabs); Talk/tools session, Live mode, Find, Qibla, Contacts, History, Tools, Senses, Plugins, Pharmacy, Account, Welcome, See with me (user side and helper side).
- Glasses SDK does not run in Expo Go or the simulator; a development build on a real device is needed for the glasses path.
- Face recognition is off (`FACES_ALLOWED = false`): Mibyan describes people but does not identify them.
- Photos sent to the assistant are not stored; only question and answer text, for History.

## Brand Commitments

- Name: مبيان فيجن · Mibyan Vision. Part of the Mibyan ecosystem (ink + Atlas Blue identity).
- Voice: warm, short, plain Gulf Arabic; never clinical. "Made with care for the blind and low-vision community."
- The live-agent orb is the product's signature element.

## Evidence on Hand

- Feature list and privacy statements in `README.md`.
- No testimonials, user counts or partner names exist; do not invent them.

## Product Principles

1. Spoken first: every answer and every state must make sense without seeing the screen.
2. One action, then talk: the main thing is always one large tap (or Magic Tap) away.
3. Legibility over decoration: contrast, size and touch targets win every trade-off.
4. Privacy by default: describe, never identify; keep nothing the user did not ask to keep.
5. Arabic is the default reading direction, not a translation.

## Accessibility & Inclusion

- WCAG AA contrast minimum (4.5:1) for every readable text colour, both themes.
- Touch targets at least 56pt.
- Dynamic Type up to 2x without clipping; graphics yield space to text.
- Reduce Motion respected (orb, live dot).
- Full RTL; logical start/end, never physical left/right.
