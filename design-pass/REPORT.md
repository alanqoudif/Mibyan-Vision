# Mibyan Vision: accessibility design pass

Branch `design/vision-accessibility`, cut from `origin/main` (ce12836). UI only: no backend, API, auth, native (`ios/`, `android/`) or dependency changes.

## Skills used

- `expo-overview` (SDK 58 routing and setup rules; no packages installed)
- `mibyan-design` + `mibyan-foundation/DESIGN.md` (Vision rules: 4.5:1 tertiary text, 56pt targets, `maxFontSizeMultiplier` ≥ 2, dark accent `#6FB0F0` with dark text, Vision type scale)
- `impeccable` native audit (`reference/audit.native.md`, `craft-floor.md`). The `impeccable context` launcher ran: no PRODUCT.md, so this was handled as a narrow refinement of the existing look. `impeccable detect` only covers web, so it was not run. Hooks were left off.
- `better-typography` (Dynamic Type ceiling, tabular numerals, truncation with a way back, caption floor)

## Audit (before)

| # | Dimension | Score | Key finding |
|---|---|---|---|
| 1 | Accessibility | 2 | Tertiary text 2.2:1 (light) and 3.5:1 (dark); white on dark accent 3.3:1; text capped at 1.6×; 36pt trash/call targets; errors only written, never announced |
| 2 | Performance | 3 | Not in scope; nothing obvious |
| 3 | Theming | 3 | Tokens are used consistently; hard-coded `#FFFFFF` glyphs on the success fill (2.0:1 in dark) |
| 4 | Platform conformance | 3 | NativeTabs, SF Symbols, magic tap, VoiceOver-aware speech. Good base |
| 5 | Adaptivity | 2 | Fixed `height` on pills and chips clips large text; the 220pt orb plus a row of three tiles can't hold 2× labels |

Total 13/20 (Acceptable). Issues by severity:

- P0: none.
- P1: contrast failures (tertiary, dark accent fill, light stop on stop well, glyphs on success); Dynamic Type capped at 1.6×; small destructive targets (memory, meds, faces, emergency, contact call/remove: 20pt icon + hitSlop 8 = 36pt); mic-permission and helper network errors were silent for VoiceOver.
- P2: Reduce Motion ignored by the orb (continuous spin, breath, wobble) and the live dot; fixed-height pills, chips and badge; 44pt segmented control and chips; 52pt inputs and connect button; missing header role on the helper, help-view and find titles; find title truncated to one line.
- P3: session timer and qibla degrees without tabular numerals; physical `right` on the session live dot; header comments describing the app as "modelled on Meta AI".

Positive findings: every pressable already had a role, and every icon-only control had a label. Magic tap triggers the main action. Answers go through VoiceOver announcements when VoiceOver is on, so two voices never talk at once. Earcons cover listening and thinking. `direction: dir` is set on every screen root.

## Changes

1. **Contrast tokens** (`src/constants/theme.ts`). The light/dark ratios below were computed with the WCAG formula.
   - light `textTertiary` `#A7B0B9` → `#5E6973`: 5.6:1 on white, 5.1:1 on surface (was 2.2:1)
   - light `textSecondary` `#65717C` → `#55606A`: 6.4:1 on white, 5.2:1 on surfaceStrong (was 4.1:1 there)
   - dark `textTertiary` `#5B646D` → `#8B949E`: 6.8:1 on black (was 3.5:1)
   - dark `accent` `#3D8BFF` + white → `#6FB0F0` + `onAccent #0A1317`: 8.2:1 (was 3.3:1)
   - light `stopText` `#E4153B` → `#C2122F`: 5.0:1 on `#FFE1E6` (was 3.8:1)
   - light `success` `#1FA855` → `#1E8A47`; new `onSuccess` token (white in light, ink in dark at 9.4:1, where white on the dark green had been 2.0:1). Used by the qibla dial, the find arrow and the emergency call icon. The emergency-services cross uses `background` instead of white, so it passes in dark mode.
   - caption 14/20 → 15/22 (Vision scale in DESIGN.md)
   - Header comments now describe the Mibyan language. Colours, shapes and the orb are unchanged.
2. **Dynamic Type up to 2×**.
   - `Text` now uses `maxFontSizeMultiplier = MaxFontScale (2)`.
   - New `useGraphicSize()` shrinks the orb, the find arrow and the qibla dial as `fontScale` grows or the screen gets shorter.
   - Home: above `fontScale` 1.3 the three tiles stack as full-width rows (icon + label) and the decorative orb steps aside.
   - Pills, chips, the glasses badge and the glasses status pill use `minHeight` + padding instead of a fixed `height`.
3. **56pt targets**.
   - New `IconAction` (56×56) replaces the 20pt icons with hitSlop in contacts, memory, meds, faces and emergency rows.
   - Segmented control, relation chips, inputs, help-view chips and the "leave" link, and the glasses connect button all reach 56pt.
4. **Reduce Motion**. With Reduce Motion on, the orb stops spinning, breathing and wobbling, and shows its state by how open the ring is. The live dot stops pulsing.
5. **Screen-reader feedback**.
   - New `useAnnounce` (`src/lib/a11y.ts`) makes iOS VoiceOver announcements; Android keeps `accessibilityLiveRegion`. Written-only errors are now announced: session mic permission and mic failure, helper network error, contacts, help-view and the emergency form.
   - The session orb button exposes the current state ("Listening…", "Thinking…") as `accessibilityValue`, plus `busy`.
   - Header role added on the helper, help-view and find titles. The find title wraps to two lines instead of truncating.
   - Deliberately **not** announced: listening, thinking, and anything in live mode. The mic is open there, VoiceOver's speech would be recorded as the user's question, and earcons already cover those states.
6. **Typography and RTL**. Tabular numerals on the session timer and the qibla degrees. The session live dot uses logical `end`.

Files: `src/constants/theme.ts`, `src/components/{text,orb,chrome,settings-rows}.tsx`, `src/lib/a11y.ts` (new), `src/app/{session,live,find,qibla,helper,help-view,contacts,welcome}.tsx`, `src/app/(tabs)/{index,assistant,glasses}.tsx`.

## Validation

- `npx tsc --noEmit`: **pass**. On a fresh clone it fails with `TS2882 Cannot find module '@/global.css'` until the generated, gitignored `expo-env.d.ts` exists, because `expo start` normally writes it. I created it locally with the standard `/// <reference types="expo/types" />`; it is not committed.
- `npx expo lint`: **pass** (no output, exit 0).
- Tests: the repo has no test script or test files.
- `npx expo export --platform web`: **pass** (bundles every route).
- `npx expo export --platform ios`: **pass** (Hermes bundle).

## Screenshots: not taken

The web export builds but does not render. Server rendering fails with `TypeError: this.validatePath is not a function` from expo-file-system's `File` in `src/lib/storage.ts`, and the client throws `ExpoNotifications.getLastNotificationResponse is not available on web`. The result is a blank page or "Internal Server Error" on every route; I tried it in headless Chrome through playwright-core. Making the app run on web would mean changing storage and notification logic, which is outside a UI pass. There is no Xcode or simulator on this Mac, so there are no before/after screenshots.

## Not verified

- Real-device layout at 200% text, especially the home stack, the session pill + mic pair, and Arabic labels in the stacked home rows.
- VoiceOver and TalkBack behaviour of the new announcements and `accessibilityValue`.
- Reduce Motion on device. `useReducedMotion` reads the setting once at startup, so changing it needs an app relaunch.
- Android Switch track colour with the new dark accent.

## Recommended next steps

1. Run on a device or EAS simulator at the largest accessibility text size, in Arabic and English, light and dark. Check home, session, find and qibla first.
2. Support iOS Increase Contrast with `DynamicColorIOS({ highContrastLight, highContrastDark })` for `textSecondary` and `border`.
3. Guard `expo-notifications` and `expo-file-system` on web (or add `.web.ts` shims) so the web export renders and visual-regression screenshots become possible.
4. Add `PRODUCT.md` (via `/impeccable init`) so later design passes have the product context.
