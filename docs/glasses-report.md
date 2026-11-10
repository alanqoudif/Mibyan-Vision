# Mibyan Vision: Ray-Ban Meta Glasses Report

This report covers the Glasses page (`app/src/app/glasses.tsx`), the Device settings page (`app/src/app/glasses-settings.tsx`), and the native iOS module behind them (`app/modules/mubayan-glasses`).

## Overview

Mibyan Vision pairs with **Ray-Ban Meta (1st generation)** smart glasses through the **Meta Wearables Device Access Toolkit**. Once paired, the assistant sees through the glasses camera, not the phone. If the glasses can't be reached, the app switches to the phone camera without interrupting the user. The integration is iOS-only and needs a development or production build. In Expo Go and on web, the app uses only the phone camera.

## Key features

### 1. Guided pairing through Meta AI
- One button takes the user through each setup step in order: **Pair glasses**, then **Allow camera**, then **Update glasses app** if the toolkit app on the glasses is out of date.
- Approval happens inside the Meta AI app. Mibyan re-checks automatically when the user comes back.
- The status is always shown, with a short note: *Not supported in this build*, *Not paired*, *Pairing*, *Needs camera permission*, *Needs update*, or *Connected*.

### 2. Glasses camera as the assistant's eyes
- **Photo capture:** full-quality JPEGs from the glasses camera.
- **Fast frame grab:** the latest video frame, available instantly at video resolution. Live mode uses this.
- The camera stream stays open between captures, so follow-up questions don't wait for the connection again.
- The video arrives as HEVC at medium quality and 15 fps, and is decoded on the phone. A live preview of what the glasses see is shown in the app.

### 3. Automatic fallback to the phone camera
- If the glasses stop responding, the app plays a short sound and tells the user that photos now come from the phone. A different sound plays when the glasses are back.
- After a failure, the phone camera is used for 20 seconds before the glasses are tried again. If the glasses only paused the camera, the retry comes after 3 seconds. This avoids a delay on every photo.
- If the user paused the camera with the glasses touchpad, the app tells them to tap the touchpad to resume.

### 4. Realtime Live mode (Gemini Live)
- Streams the microphone and one camera frame per second to Gemini Live, and plays Gemini's spoken answers as they arrive.
- When the glasses are connected over Bluetooth, both the microphone and the voice go through them. Echo cancellation keeps the assistant from hearing its own voice.
- If the user starts talking, the assistant stops speaking right away.
- Sessions reconnect and resume on their own, because Google closes each connection after about 10 minutes.
- The analysis interval is adjustable in Device settings (every 1, 3 or 5 seconds). A shorter interval gives faster alerts but uses more battery and credit.

### 5. Obstacle sensor (works like a car's parking sensor)
- Estimates depth from the glasses video on the phone itself, using Apple's Depth Anything V2 Core ML model (about 30 ms per frame on the Neural Engine). It needs no network connection.
- Warns with beeps that speed up as something gets closer, plus a haptic and a short spoken direction (for example, "chair ahead, go left").
- There are three closeness levels (near, close and very close) for the left, center and right of the view.
- Handles real-world cases: it names stairs and escalators, doesn't beep when the user walks through a doorway or corridor, and ignores single odd frames.

### 6. On-device text reading
- Reads text on the phone with Apple Vision when the online assistant can't be reached.

### 7. Honest capability reporting
- A capability is marked **Verified** only after it has actually worked in this session. The capabilities are camera, photo capture, live video, audio input and audio output.
- Battery level is shown as unavailable, because the Meta toolkit doesn't report it.

### 8. Senses, permissions and diagnostics
- Lists the installed Senses (plugins) that run on the glasses, each linking to its own page.
- Shows camera permission status, with shortcuts to grant it or open system settings.
- A diagnostics section shows whether the Meta Wearables SDK is present and lets the user re-check the connection.
- Built-in troubleshooting tips: check Bluetooth, check the glasses in Meta AI, and tap the touchpad to resume the camera.

### 9. Siri and Shortcuts
- Siri, Shortcuts and the Action button can open app screens directly (for example, Live mode).

## Limitations
- iOS only. It doesn't work in Expo Go or on web.
- Battery level isn't available from the Meta toolkit.
- Audio uses the phone's normal Bluetooth connection, not a dedicated glasses API.
- Live video and audio capabilities show as *Not verified* until they've been used.
