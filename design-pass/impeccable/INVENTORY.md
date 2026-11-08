# Impeccable pass: screen inventory

Skill: `impeccable` v4.8.1 (native iOS audit, craft floor). Context: `PRODUCT.md` and `DESIGN.md` at the repo root (new in this pass).
Every screen was rendered at 390×844 in Arabic (RTL) and English, light and dark, through the Expo web design preview (see "How screenshots are made").

Status: **done** = audited, fixed and re-checked · **audited** = audited and re-checked, no change needed · **skipped** = with reason.

## Mobile app (`app/src/app`)

| Screen | Route | Group / PR | Status | What changed |
|---|---|---|---|---|
| Account & sync | `/account` | A | done | Was Arabic-only with hard-coded colours. Now uses the English strings too, shared header, ink primary pill, the system Sign in with Apple button (HIG), the signed-in email shown in a well, and errors that are announced. |
| Manage tools & plugins | `/plugins` | A | done | One card per toggle replaced by iOS grouped lists (`Section` + `ToggleRow` + dividers). White text on the dark-mode accent (3.3:1) is gone; buttons went from 42pt to 56–60pt pills; the 12pt category chips are now 56pt radio chips; inputs have visible labels; the account link is a labelled header button; errors use the danger tone and are announced. |
| Pharmacy catalog | `/pharmacy` | A | done | The Shelf/Row fields overflowed the card. Now labelled 56pt fields in grouped sections. The "remove" text links are 56pt trash actions with full labels. Hard-coded `#b63449`/`#a23a4c`/`#fff` removed. Shelf and row numbers use tabular figures. Added an empty state and announced errors. |
| Senses | `/senses` | A | done | Shared header, labelled fields with autofill hints, ink pill buttons with busy state, errors in the danger tone (they were in the accent blue), 56pt sign-out and enable links, grouped page background so cards read in light mode. |
| Tools | `/tools` | A | done | The icon tiles were white on white in light mode; now on the surface well. Shared header. |
| Home | `/` (tab) | B | audited | Fine after the previous accessibility pass. The overlap of the tab bar and glasses pill is web-preview only (NativeTabs draws a web pill). |
| Talk / tools session | `/session` | B | audited | No change needed. |
| Live mode | `/live` | B | done | Obstacle alert was white on orange (2.2:1) and white on red (3.5:1). Now `CameraAlert` tokens: ink on orange (9.6:1), white on deep red (6.0:1); camera-label scrim 45% → 60%. Live chip is the screen's header for VoiceOver. |
| Find something | `/find` | B | done | The resume button now reports its disabled state to VoiceOver while Mibyan is asking. |
| Qibla | `/qibla` | B | audited | No change needed. |
| Welcome (voice onboarding) | `/welcome` | B | audited | No change needed. |
| My assistant | `/assistant` (tab) | C | done | Emergency-number inputs and relation chips use the new `field` token, so they read as wells on dark cards (surface on card was too close). |
| Glasses | `/glasses` (tab) | C | audited | No change needed; the status dot always has a word next to it. |
| People who see with me | `/contacts` | C | audited | No change needed. |
| History | `/history` | C | audited | No change needed. |
| See with me (user side) | `/helper` | C | audited | No change needed. |
| Help someone see (helper side) | `/help-view` | C | audited | No change needed. |

## Vision website (`web/src/app`)

| Page | Route | Group / PR | Status |
|---|---|---|---|
| Landing | `/` | D | pending (next PR) |
| Plugins workspace | `/plugins` | D | pending (next PR) |
| Pharmacy catalog | `/pharmacy` | D | pending (next PR) |
| Studio overview | `/studio` | D | pending (next PR) |
| Studio marketplace | `/studio/marketplace` | D | pending (next PR) |
| Studio composer | `/studio/composer` | D | pending (next PR) |
| Studio my Senses | `/studio/senses` | D | pending (next PR) |
| Studio handover | `/studio/handover` | D | pending (next PR) |
| Auth callback | `/auth/callback` | D | skipped: route handler, no UI |

## How screenshots are made

```bash
cd app
VISION_DESIGN_PREVIEW=1 npx expo start --web --port 8091
# in another shell, with playwright-core installed somewhere:
node design-pass/impeccable/tools/shoot.mjs <outDir> [route,...] --langs=ar,en --themes=light,dark
```

`VISION_DESIGN_PREVIEW=1` swaps `expo-file-system`, `expo-notifications` and `expo-keep-awake` for in-memory stubs on web only and turns off server rendering (`app/metro.config.js`, `app/app.config.js`, `app/design-preview/`). Unset, both config files are no-ops, so native builds are untouched. URL params seed state: `?lang=ar|en`, `?welcome=1`.

### Limits of these screenshots

- They come from a browser, not the iOS Simulator (this Mac has no Xcode). SF Symbols do not draw on web, so icons are missing, and the native tab bar shows as a floating pill at the top. Shadows under floating buttons don't render either.
- Dynamic Type at 200% can't be emulated on web; large-text behaviour was checked in code only.
- Screens that need a signed-in account (Senses list, plugin editing, pharmacy items) were captured signed out.
