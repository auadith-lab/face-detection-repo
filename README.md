# FaceCount AI · Mobile Phone Face Detection & Counter App

An ultra-responsive, mobile-first web app that uses your phone camera to detect and count how many human faces are visible on your screen in real time.

Powered by Google MediaPipe Face Detection running directly on your phone's GPU (WebGL/WebAssembly) with **zero server lag** and **100% privacy** (video never leaves your device).

---

## ✨ Features

- 👤 **Real-Time Live Face Counter**: Displays a prominent, glowing HUD counter: `👥 3 FACES IN VIEW` that updates smoothly at 30–60 FPS.
- 🔄 **Front & Back Camera Switch**: Flip instantly between selfie camera and rear camera with one tap.
- 🔦 **Flashlight / Torch Support**: Toggle phone flashlight when using the rear camera in low light.
- 🗣️ **Voice & Audio Announcements**:
  - Web Audio tone chime whenever face counts change.
  - Text-to-speech engine speaks out: *"One face detected"*, *"Two faces detected"*.
- 📸 **Snapshot Capture & Watermarking**: Freeze current video, stamp face count + timestamp, and download or share via native phone share sheet (`navigator.share`).
- 🎚️ **Dual Detection Modes**:
  - **Selfie Mode (Short-Range ≤ 2m)**: Optimized for phone selfies and video calls.
  - **Group / Crowd Mode (Full-Range ≤ 5m)**: Optimized for group photos, classrooms, and rooms.
- 🎯 **Facial Landmarks & Tech Overlays**: Cyberpunk corner brackets, confidence badges (`Face #1 · 97%`), and 6 keypoint dots (eyes, nose tip, mouth, ears).
- 🖼️ **Test Without Camera**: Upload any photo from your gallery or choose 1-click sample photos to test multi-face counting instantly.
- 📱 **Progressive Web App (PWA)**: Tap **"Add to Home Screen"** on iPhone (Safari) or Android (Chrome) to install it like a native mobile app.
- 🤖 **Native Android APK Package**: Comes pre-compiled with a signed Android package (`FaceCountAI.apk`) ready for direct sideloading and installation on any Android smartphone.

---

## 🚀 Quick Start (Computer / Desktop Test)

1. Open your terminal in this directory:
   ```bash
   cd C:\Users\Administrator\.gemini\antigravity\scratch\face-detect-phone-app
   ```
2. Start the local server:
   ```bash
   node server.js
   ```
3. Open in your browser:
   ```
   http://localhost:3000
   ```
4. Click **Start Camera** and grant camera permissions to test.

---

## 📱 How to Open on Your Actual Smartphone

Modern mobile browsers (iOS Safari and Android Chrome) require **HTTPS or localhost** to allow camera access. Choose any of these 3 easy methods:

### Method 1: Instant Free HTTPS Tunnel (Recommended for Phone)
Run this command in a terminal while `node server.js` is running:
```bash
npx localtunnel --port 3000
```
or with Cloudflare:
```bash
npx untun tunnel --port 3000
```
This gives you a secure `https://xxxx.loca.lt` link. Open it on your phone or scan its QR code to test camera access immediately on any smartphone.

### Method 2: Local Wi-Fi + QR Code
1. Make sure your phone and computer are on the same Wi-Fi.
2. Visit `http://localhost:3000/qr` on your computer.
3. Scan the displayed QR code with your phone camera!
*(Tip: On Android Chrome, if camera is blocked over plain HTTP on LAN, visit `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, enter `http://<your-ip>:3000`, and tap Enable).*

### Method 3: 1-Click Free Cloud Deployment
You can drop this folder directly into [Vercel](https://vercel.com), [Netlify](https://www.netlify.com), or GitHub Pages. It has zero backend dependencies, so it works out of the box with instant free HTTPS worldwide!

---

## 📱 Installing the Native Android APK (.apk)

The Android package is compiled, signed, and ready:
- File path: `FaceCountAI.apk`
- Download URL: `http://localhost:3000/download-apk`

### How to Install on your Android Phone:
1. Transfer `FaceCountAI.apk` to your Android phone (via USB, Bluetooth, Google Drive, WhatsApp, or download it via `http://<your-ip>:3000/download-apk`).
2. Tap the `FaceCountAI.apk` file on your phone.
3. If prompted with *"For your security, your phone is not allowed to install unknown apps from this source"*, tap **Settings** and enable **"Allow from this source"**.
4. Tap **Install** and open **FaceCount AI**!

---

## 🛠️ Project Structure

```
face-detect-phone-app/
├── index.html        # Main mobile UI and camera viewport
├── styles.css        # Responsive glassmorphic mobile stylesheet
├── app.js            # MediaPipe detection loop, HUD counter, sound & camera flip
├── server.js         # Zero-dependency local Node.js server with QR code page
├── manifest.json     # PWA manifest for Add-to-Home-Screen
├── sw.js             # Service worker for offline caching
└── package.json      # NPM scripts and configuration
```

---

## 🔒 Privacy Guarantee
All face detection and image processing is executed entirely within your browser's local sandbox using WebAssembly and WebGL. **No photos, video streams, or biometric data are ever uploaded, recorded, or sent to any server.**
