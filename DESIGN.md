---
name: Mibyan Vision
description: A spoken visual assistant for blind and low-vision people; the Mibyan language at its most legible.
colors:
  background: "#FFFFFF"
  surface: "#F1F4F7"
  surface-strong: "#E4E8EE"
  card: "#FFFFFF"
  border: "#E4E8EE"
  field: "#F1F4F7"
  ink: "#0A1317"
  text-secondary: "#55606A"
  text-tertiary: "#5E6973"
  vision-blue: "#0064E0"
  on-accent: "#FFFFFF"
  stop-well: "#FFE1E6"
  stop-text: "#C2122F"
  success: "#1E8A47"
  on-success: "#FFFFFF"
  dark-background: "#000000"
  dark-surface: "#16191D"
  dark-surface-strong: "#23272D"
  dark-card: "#101215"
  dark-field: "#23272D"
  dark-ink: "#F5F7F9"
  dark-text-secondary: "#9AA4AE"
  dark-text-tertiary: "#8B949E"
  dark-vision-blue: "#6FB0F0"
  dark-on-accent: "#0A1317"
  dark-stop-well: "#3A1219"
  dark-stop-text: "#FF6B81"
  dark-success: "#34D17A"
  dark-on-success: "#0A1317"
typography:
  display:
    fontFamily: "System (SF Pro / SF Arabic)"
    fontSize: "32pt"
    fontWeight: 700
    lineHeight: "42pt"
  title:
    fontFamily: "System (SF Pro / SF Arabic)"
    fontSize: "24pt"
    fontWeight: 700
    lineHeight: "32pt"
  heading:
    fontFamily: "System (SF Pro / SF Arabic)"
    fontSize: "18pt"
    fontWeight: 600
    lineHeight: "26pt"
  body:
    fontFamily: "System (SF Pro / SF Arabic)"
    fontSize: "17pt"
    fontWeight: 400
    lineHeight: "26pt"
  spoken:
    fontFamily: "System (SF Pro / SF Arabic)"
    fontSize: "22pt"
    fontWeight: 400
    lineHeight: "34pt"
  caption:
    fontFamily: "System (SF Pro / SF Arabic)"
    fontSize: "15pt"
    fontWeight: 500
    lineHeight: "22pt"
rounded:
  sm: "12pt"
  md: "18pt"
  lg: "26pt"
  full: "999pt"
spacing:
  one: "4pt"
  two: "8pt"
  three: "16pt"
  four: "24pt"
  five: "32pt"
  six: "64pt"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.background}"
    rounded: "{rounded.full}"
    height: "60pt"
  button-hero:
    backgroundColor: "{colors.vision-blue}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.full}"
    height: "60pt"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    height: "56pt"
  button-destructive:
    backgroundColor: "{colors.stop-well}"
    textColor: "{colors.stop-text}"
    rounded: "{rounded.full}"
    height: "56pt"
  input:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: "56pt"
  grouped-card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.md}"
  home-tile:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    height: "78pt"
---

# Design System: Mibyan Vision

Source of truth for values: `app/src/constants/theme.ts`. This file records the system the app ships; when the two disagree, the code wins and this file is stale.

## Overview

**Creative North Star: "The Spoken Room."** The screen is the quiet half of a conversation. Mibyan is the Mibyan language (white paper, ink type, soft grey wells) pushed to its most legible: huge, singular, one thing per screen, and every state also said out loud. The orb is the only expressive element; everything else is calm, large and predictable, because many users never see it and the rest see it at 200% text.

Inherits the Mibyan ecosystem (ink + Atlas Blue): ink acts, blue lives. Primary buttons are ink pills. Vision Blue fills a button only for the one hero action that hands off to the outside world (linking the glasses), plus switch tracks, links and live state.

Anti-references: dashboards, card grids, decorative gradients outside the orb, small type, grey-on-grey text, anything that only makes sense if you can see it.

## Colors

- **Ink** (`#0A1317` / dark `#F5F7F9`) carries all text and icons.
- **Vision Blue** (`#0064E0` / dark `#6FB0F0`) means "Mibyan is doing something, or this goes somewhere": links, switch tracks, the glasses-link hero button. In dark mode the fill is lighter and text on it is ink (`onAccent`), never white.
- **Field** (`#F1F4F7` / dark `#23272D`): text inputs and unselected chips sitting on a card. In dark, `surface` is too close to `card` to read as a well.
- **Wells** (`surface`, `surfaceStrong`) group content without borders.
- **Stop** (`stop` well + `stopText`) is the only red: stop, end, delete, errors.
- **Success** green only for "ready / pointing the right way" states, with `onSuccess` for glyphs on it.
- **Camera alerts** (`CameraAlert` in theme): danger `#C2122F` + white, warning `#FF9F0A` + ink, scrim 60% black. They sit on video, so they don't switch with the theme.
- Never hard-code a hex in a screen. Every readable text colour meets 4.5:1 on background and surface in both modes.

## Typography

System font only (SF Pro / SF Arabic), so Dynamic Type and the Arabic system face work. Six roles: display 32/42, title 24/32, heading 18/26, body 17/26, spoken 22/34 (answers read on screen), caption 15/22 (the floor; nothing smaller). Always through the `Text` component, which sets `maxFontSizeMultiplier = 2`, writing direction and logical alignment. Tabular numerals for timers, degrees and counts.

## Layout

- One focal point per screen: a title or one primary action.
- Screen gutter 16pt; groups 16pt apart; label to control 8pt.
- Modal screens share one header, `ScreenHeader`: close `CircleButton` at the start, the title as the screen's header in the middle, an optional trailing CircleButton (or an equal spacer) at the end.
- Settings-shaped screens (My assistant, plugins, pharmacy, Senses) use the iOS grouped style: `surface` page, `Section` cards in `card`, `Divider` between rows. Never one card per row.
- At `fontScale > 1.3` horizontal button rows stack; big graphics shrink through `useGraphicSize`.
- RTL first: `direction: dir` on every screen root, logical start/end only.

## Elevation & Depth

Flat. Tonal wells do the grouping. The only shadow is the soft one under floating `CircleButton`s and the glasses pill (offset 4, blur 14, 8%).

## Shapes

Pill (`full`) for every button and chip. `md` (18) for grouped cards and list rows, `lg` (26) for the home tiles. Inputs `sm` (12).

## Components

- **CircleButton**: 48pt round header button + hitSlop (56pt target), floating/filled/solid.
- **IconAction**: 56pt inline icon action in list rows.
- **Section / ToggleRow / Segmented**: grouped settings building blocks (`components/settings-rows.tsx`).
- **PillButton** (`components/chrome.tsx`): the one button. 60pt pill, heading type, optional SF Symbol. `primary` ink fill, `secondary` surface fill, `destructive` stop well. Handles disabled/busy state and haptics.
- **Field**: text input with a visible caption label above (placeholders vanish while typing), 56pt, `field` fill, logical alignment.
- **ScreenHeader**: the modal header described in Layout.
- **Hero button** (glasses link only): Vision Blue fill, `onAccent` text.
- **Orb**: the live-agent signature; respects Reduce Motion.

## Do's and Don'ts

- Do give every pressable a role and a label; announce errors with `useAnnounce`.
- Do keep every target at 56pt or more.
- Don't put white text on the accent; use `onAccent`.
- Don't build a button or input by hand; use `PillButton` and `Field`.
- Don't use `Text` tone `accent` for errors; use `danger`.
- Don't use font sizes below caption, or raw `fontSize` on `Text`.
- Don't nest cards or put borders inside wells.
- Don't animate without a Reduce Motion fallback.
