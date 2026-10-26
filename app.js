/**
 * FaceCount AI · Real-Time Phone Face Detector
 * Powered by Google MediaPipe Face Detection + Native WebRTC Camera
 */

(function () {
  'use strict';

  // --- DOM Elements ---
  const video = document.getElementById('webcam');
  const canvas = document.getElementById('overlayCanvas');
  const ctx = canvas.getContext('2d');
  const counterCard = document.getElementById('counterCard');
  const faceCountNum = document.getElementById('faceCountNum');
  const faceCountLabel = document.getElementById('faceCountLabel');
  const fpsDisplay = document.getElementById('fpsDisplay');
  const statusIndicator = document.getElementById('statusIndicator');
  const scanLaser = document.getElementById('scanLaser');
  const cameraPlaceholder = document.getElementById('cameraPlaceholder');
  const hudToast = document.getElementById('hudToast');
  const facesTagsBar = document.getElementById('facesTagsBar');

  // Controls
  const btnStartCamera = document.getElementById('btnStartCamera');
  const btnUploadPhoto = document.getElementById('btnUploadPhoto');
  const photoInput = document.getElementById('photoInput');
  const btnFlipCamera = document.getElementById('btnFlipCamera');
  const btnSnapshot = document.getElementById('btnSnapshot');
  const btnTorch = document.getElementById('btnTorch');
  const btnToggleRange = document.getElementById('btnToggleRange');
  const rangeModeLabel = document.getElementById('rangeModeLabel');
  const btnPauseCamera = document.getElementById('btnPauseCamera');
  const pauseBtnIcon = document.getElementById('pauseBtnIcon');
  const pauseBtnLabel = document.getElementById('pauseBtnLabel');
  const btnVoiceToggle = document.getElementById('btnVoiceToggle');
  const btnSettings = document.getElementById('btnSettings');

  // Settings Modal
  const settingsModal = document.getElementById('settingsModal');
  const btnCloseSettings = document.getElementById('btnCloseSettings');
  const btnSaveSettings = document.getElementById('btnSaveSettings');
  const segShort = document.getElementById('segShort');
  const segFull = document.getElementById('segFull');
  const confidenceSlider = document.getElementById('confidenceSlider');
  const confidenceVal = document.getElementById('confidenceVal');
  const checkVoiceAnnounce = document.getElementById('checkVoiceAnnounce');
  const checkAudioChime = document.getElementById('checkAudioChime');
  const checkLandmarks = document.getElementById('checkLandmarks');
  const checkMirror = document.getElementById('checkMirror');
  const checkTechBox = document.getElementById('checkTechBox');
  const btnSample1 = document.getElementById('btnSample1');
  const btnSample2 = document.getElementById('btnSample2');
  const btnSample3 = document.getElementById('btnSample3');

  // Snapshot Modal
  const snapshotModal = document.getElementById('snapshotModal');
  const btnCloseSnapshot = document.getElementById('btnCloseSnapshot');
  const btnRetakeSnapshot = document.getElementById('btnRetakeSnapshot');
  const btnShareSnapshot = document.getElementById('btnShareSnapshot');
  const btnDownloadSnapshot = document.getElementById('btnDownloadSnapshot');
  const snapshotImg = document.getElementById('snapshotImg');
  const snapshotBadge = document.getElementById('snapshotBadge');

  // --- State Variables ---
  let currentStream = null;
  let videoTrack = null;
  let facingMode = 'user'; // 'user' (front) or 'environment' (back)
  let torchActive = false;
  let isPaused = false;
  let faceDetection = null;
  let isModelReady = false;
  let isProcessingFrame = false;

  // Source Tracking
  let isStaticImageMode = false;
  let staticImageElement = null;
  let activeSourceWidth = 640;
  let activeSourceHeight = 480;

  // Settings
  let modelRange = 'short'; // 'short' (selfie <= 2m) or 'full' (group <= 5m)
  let minConfidence = 0.50;
  let voiceEnabled = true;
  let chimeEnabled = true;
  let showLandmarks = true;
  let mirrorFront = true;
  let drawTechCorners = true;

  // Counters & Smoothing
  let lastFaceCount = -1;
  let countStabilityTimer = null;
  let lastSpokenCount = -1;
  let lastSpeechTimestamp = 0;

  // FPS calculation
  let lastFrameTime = performance.now();
  let frameCount = 0;
  let lastFpsUpdateTime = performance.now();
  let currentFps = 0;

  // Web Audio Context for Tone Chimes
  let audioCtx = null;

  // --------------------------------------------------------------------------
  // Audio Feedback (Chimes & Speech)
  // --------------------------------------------------------------------------
  function initAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
  }

  function playFaceTone(count) {
    if (!chimeEnabled) return;
    try {
      initAudioContext();
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      const baseFreq = 440;
      const targetFreq = count > 0 ? baseFreq + (count * 65) : 320;

      osc.type = count > 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(targetFreq, audioCtx.currentTime);

      gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, audioCtx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.22);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch (e) {
      console.warn('Audio tone error:', e);
    }
  }

  function announceCountSpeech(count) {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;
    const now = performance.now();
    if (now - lastSpeechTimestamp < 1500) return;
    if (count === lastSpokenCount) return;

    window.speechSynthesis.cancel();
    let text = '';
    if (count === 0) {
      text = 'No faces detected';
    } else if (count === 1) {
      text = 'One face detected';
    } else {
      text = `${count} faces detected`;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.1;
    utterance.volume = 0.9;
    window.speechSynthesis.speak(utterance);

    lastSpokenCount = count;
    lastSpeechTimestamp = now;
  }

  // --------------------------------------------------------------------------
  // Toast Helper
  // --------------------------------------------------------------------------
  let toastTimer = null;
  function showToast(message, durationMs = 2400) {
    hudToast.textContent = message;
    hudToast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      hudToast.classList.remove('visible');
    }, durationMs);
  }

  // --------------------------------------------------------------------------
  // MediaPipe FaceDetection Initialization
  // --------------------------------------------------------------------------
  async function initFaceDetector() {
    if (isModelReady && faceDetection) return;

    statusIndicator.className = 'status-pulse idle';
    showToast('Initializing Face Detection AI...');

    try {
      // 1. Try loading from local mediapipe/ directory first
      faceDetection = new FaceDetection({
        locateFile: (file) => {
          return `mediapipe/${file}`;
        }
      });

      faceDetection.setOptions({
        model: modelRange,
        minDetectionConfidence: minConfidence
      });

      faceDetection.onResults(onDetectionResults);
      await faceDetection.initialize();

      isModelReady = true;
      statusIndicator.className = 'status-pulse';
      statusIndicator.title = 'AI Engine Active';
      showToast('AI Ready · Point camera at face', 2200);
      console.log('MediaPipe FaceDetection initialized successfully (local).');
    } catch (err) {
      console.warn('Local mediapipe init failed, trying CDN fallback:', err);
      try {
        // 2. Fallback to CDN
        faceDetection = new FaceDetection({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`
        });

        faceDetection.setOptions({
          model: modelRange,
          minDetectionConfidence: minConfidence
        });

        faceDetection.onResults(onDetectionResults);
        await faceDetection.initialize();

        isModelReady = true;
        statusIndicator.className = 'status-pulse';
        showToast('AI Ready (CDN) · Point camera at face', 2200);
        console.log('MediaPipe FaceDetection initialized successfully (CDN).');
      } catch (err2) {
        console.error('All Face Detector initializations failed:', err2);
        statusIndicator.className = 'status-pulse error';
        showToast('Error loading Face Models. Check internet.');
      }
    }
  }

  // --------------------------------------------------------------------------
  // Camera Management
  // --------------------------------------------------------------------------
  async function startCamera() {
    try {
      initAudioContext();
      isStaticImageMode = false;
      staticImageElement = null;
      statusIndicator.className = 'status-pulse idle';
      showToast('Accessing phone camera...');

      if (currentStream) {
        currentStream.getTracks().forEach(t => t.stop());
        currentStream = null;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API (getUserMedia) not supported in this environment.');
      }

      const constraints = {
        audio: false,
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      currentStream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = currentStream;
      videoTrack = currentStream.getVideoTracks()[0];

      await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          activeSourceWidth = video.videoWidth || 640;
          activeSourceHeight = video.videoHeight || 480;
          resolve();
        };
      });

      await video.play();

      checkTorchSupport();
      updateMirroring();

      cameraPlaceholder.style.opacity = '0';
      setTimeout(() => {
        cameraPlaceholder.style.display = 'none';
      }, 300);

      scanLaser.classList.add('active');
      statusIndicator.className = 'status-pulse';
      showToast(facingMode === 'user' ? 'Front camera active' : 'Rear camera active');

      // Initialize AI model if not ready
      if (!isModelReady) {
        await initFaceDetector();
      }

      requestAnimationFrame(detectionLoop);
    } catch (err) {
      console.error('Camera access failed:', err);
      statusIndicator.className = 'status-pulse error';
      let errorMsg = 'Could not access camera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = 'Camera permission denied. Allow camera in phone settings.';
      } else if (err.name === 'NotFoundError') {
        errorMsg = 'No camera found on this device.';
      }
      showToast(errorMsg, 4000);
      alert(errorMsg + '\n\nTip: You can also tap "Test Photo" or choose a Sample Image from Settings (⚙️) to test face detection immediately!');
    }
  }

  function updateMirroring() {
    if (!isStaticImageMode && facingMode === 'user' && mirrorFront) {
      video.classList.remove('unmirrored');
    } else {
      video.classList.add('unmirrored');
    }
  }

  function checkTorchSupport() {
    if (!videoTrack) {
      btnTorch.disabled = true;
      return;
    }
    const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
    if (capabilities.torch) {
      btnTorch.disabled = false;
      btnTorch.title = 'Flashlight / Torch';
    } else {
      btnTorch.disabled = true;
      btnTorch.title = 'Torch not supported on this camera';
    }
  }

  async function toggleTorch() {
    if (!videoTrack || btnTorch.disabled) return;
    try {
      torchActive = !torchActive;
      await videoTrack.applyConstraints({
        advanced: [{ torch: torchActive }]
      });
      btnTorch.classList.toggle('active', torchActive);
      showToast(torchActive ? 'Torch On 🔦' : 'Torch Off');
    } catch (e) {
      console.warn('Could not toggle torch:', e);
      showToast('Torch unavailable');
    }
  }

  async function flipCamera() {
    facingMode = (facingMode === 'user') ? 'environment' : 'user';
    torchActive = false;
    btnTorch.classList.remove('active');
    await startCamera();
  }

  function togglePause() {
    isPaused = !isPaused;
    if (isPaused) {
      video.pause();
      pauseBtnIcon.textContent = '▶️';
      pauseBtnLabel.textContent = 'Resume';
      scanLaser.classList.remove('active');
      showToast('Detection Paused');
    } else {
      video.play();
      pauseBtnIcon.textContent = '⏸️';
      pauseBtnLabel.textContent = 'Pause';
      scanLaser.classList.add('active');
      showToast('Detection Resumed');
      requestAnimationFrame(detectionLoop);
    }
  }

  // --------------------------------------------------------------------------
  // Detection Frame Processing Loop
  // --------------------------------------------------------------------------
  async function detectionLoop() {
    if (isPaused || isStaticImageMode || !currentStream || video.paused || video.ended) {
      return;
    }

    if (faceDetection && isModelReady && !isProcessingFrame) {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        isProcessingFrame = true;
        try {
          activeSourceWidth = video.videoWidth;
          activeSourceHeight = video.videoHeight;
          await faceDetection.send({ image: video });
        } catch (e) {
          console.warn('Frame processing error:', e);
        } finally {
          isProcessingFrame = false;
        }
      }
    }

    calcFps();
    requestAnimationFrame(detectionLoop);
  }

  function calcFps() {
    const now = performance.now();
    frameCount++;
    if (now - lastFpsUpdateTime >= 500) {
      currentFps = Math.round((frameCount * 1000) / (now - lastFpsUpdateTime));
      const delta = (now - lastFrameTime).toFixed(0);
      fpsDisplay.textContent = `${currentFps} FPS · ${delta} ms`;
      frameCount = 0;
      lastFpsUpdateTime = now;
    }
    lastFrameTime = now;
  }

  // --------------------------------------------------------------------------
  // Results Rendering & HUD Update
  // --------------------------------------------------------------------------
  function onDetectionResults(results) {
    const srcW = activeSourceWidth || 640;
    const srcH = activeSourceHeight || 480;

    const width = canvas.clientWidth || canvas.width || 360;
    const height = canvas.clientHeight || canvas.height || 640;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.clearRect(0, 0, width, height);

    // Calculate aspect-fill scale factors
    const videoRatio = srcW / srcH;
    const canvasRatio = width / height;

    let renderW, renderH, offsetX, offsetY;
    if (canvasRatio > videoRatio) {
      renderW = width;
      renderH = width / videoRatio;
      offsetX = 0;
      offsetY = (height - renderH) / 2;
    } else {
      renderH = height;
      renderW = height * videoRatio;
      offsetX = (width - renderW) / 2;
      offsetY = 0;
    }

    // In static photo mode, draw the photo onto the canvas backdrop
    if (isStaticImageMode && staticImageElement) {
      ctx.drawImage(staticImageElement, offsetX, offsetY, renderW, renderH);
    }

    const detections = results.detections || [];
    const count = detections.length;
    const isMirrored = (!isStaticImageMode && facingMode === 'user' && mirrorFront);

    // Render Bounding Boxes
    detections.forEach((det, idx) => {
      let boxX = 0, boxY = 0, boxWidth = 0, boxHeight = 0;

      // Extract box coordinates accurately across MediaPipe versions
      if (det.boundingBox) {
        // MediaPipe JS Solution: { xCenter, yCenter, width, height }
        const bw = det.boundingBox.width * renderW;
        const bh = det.boundingBox.height * renderH;
        const bx = (det.boundingBox.xCenter - det.boundingBox.width / 2) * renderW + offsetX;
        const by = (det.boundingBox.yCenter - det.boundingBox.height / 2) * renderH + offsetY;
        boxX = bx;
        boxY = by;
        boxWidth = bw;
        boxHeight = bh;
      } else if (det.locationData && det.locationData.relativeBoundingBox) {
        const rbb = det.locationData.relativeBoundingBox;
        boxWidth = rbb.width * renderW;
        boxHeight = rbb.height * renderH;
        const minX = rbb.xMin !== undefined ? rbb.xMin : (rbb.xCenter - rbb.width / 2);
        const minY = rbb.yMin !== undefined ? rbb.yMin : (rbb.yCenter - rbb.height / 2);
        boxX = minX * renderW + offsetX;
        boxY = minY * renderH + offsetY;
      }

      // Safe confidence score
      let score = Math.round(minConfidence * 100);
      if (det.V && det.V.length > 0) {
        const first = det.V[0];
        const s = first.ga !== undefined ? first.ga : (first.score !== undefined ? first.score : null);
        if (typeof s === 'number') score = Math.round(s * 100);
      } else if (det.score && det.score.length > 0) {
        score = Math.round(det.score[0] * 100);
      }

      // Handle horizontal mirroring for selfie camera
      if (isMirrored) {
        boxX = width - (boxX + boxWidth);
      }

      drawFaceBox(boxX, boxY, boxWidth, boxHeight, idx + 1, score);

      // Facial landmarks
      const keypoints = det.landmarks || (det.locationData && det.locationData.relativeKeypoints) || [];
      if (showLandmarks && keypoints.length > 0) {
        drawLandmarks(keypoints, renderW, renderH, offsetX, offsetY, width, isMirrored);
      }
    });

    // Update Counter HUD
    updateCounterHUD(count, detections);
  }

  function drawFaceBox(x, y, w, h, index, score) {
    ctx.save();

    const primaryColor = '#10b981'; // Electric emerald
    const cyanColor = '#06b6d4';    // Neon cyan
    const glowColor = 'rgba(16, 185, 129, 0.45)';

    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2.5;

    if (drawTechCorners) {
      const cornerLen = Math.min(w, h) * 0.22;
      ctx.strokeStyle = primaryColor;

      // Top-Left
      ctx.beginPath();
      ctx.moveTo(x, y + cornerLen);
      ctx.lineTo(x, y);
      ctx.lineTo(x + cornerLen, y);
      ctx.stroke();

      // Top-Right
      ctx.beginPath();
      ctx.moveTo(x + w - cornerLen, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + cornerLen);
      ctx.stroke();

      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(x + w, y + h - cornerLen);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x + w - cornerLen, y + h);
      ctx.stroke();

      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(x + cornerLen, y + h);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x, y + h - cornerLen);
      ctx.stroke();

      ctx.fillStyle = 'rgba(6, 182, 212, 0.08)';
      ctx.fillRect(x, y, w, h);
    } else {
      ctx.strokeStyle = primaryColor;
      ctx.strokeRect(x, y, w, h);
    }

    // Top Tag Badge (Face #N · XX%)
    const tagText = `Face #${index} · ${score}%`;
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const tagW = ctx.measureText(tagText).width + 16;
    const tagH = 22;
    const tagY = y > 28 ? y - 26 : y + 6;

    ctx.fillStyle = 'rgba(7, 9, 14, 0.88)';
    ctx.strokeStyle = cyanColor;
    ctx.lineWidth = 1;
    roundRect(ctx, x, tagY, tagW, tagH, 6, true, true);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(tagText, x + 8, tagY + 15);

    ctx.restore();
  }

  function drawLandmarks(keypoints, renderW, renderH, offsetX, offsetY, canvasWidth, isMirrored) {
    ctx.save();
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#38bdf8';

    keypoints.forEach((kp) => {
      let kx = offsetX + kp.x * renderW;
      const ky = offsetY + kp.y * renderH;
      if (isMirrored) {
        kx = canvasWidth - kx;
      }
      ctx.beginPath();
      ctx.arc(kx, ky, 3.5, 0, 2 * Math.PI);
      ctx.fill();
    });
    ctx.restore();
  }

  function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  // --------------------------------------------------------------------------
  // Update Live Counter State
  // --------------------------------------------------------------------------
  function updateCounterHUD(count, detections) {
    faceCountNum.textContent = count;

    if (count === 0) {
      faceCountLabel.textContent = 'NO FACES DETECTED';
      counterCard.classList.remove('detected');
    } else if (count === 1) {
      faceCountLabel.textContent = '1 FACE IN VIEW';
      counterCard.classList.add('detected');
    } else {
      faceCountLabel.textContent = `${count} FACES IN VIEW`;
      counterCard.classList.add('detected');
    }

    if (count !== lastFaceCount) {
      counterCard.classList.add('bump');
      setTimeout(() => counterCard.classList.remove('bump'), 220);

      playFaceTone(count);

      clearTimeout(countStabilityTimer);
      countStabilityTimer = setTimeout(() => {
        announceCountSpeech(count);
      }, 500);

      lastFaceCount = count;
    }

    updateTagsBar(detections);
  }

  function updateTagsBar(detections) {
    facesTagsBar.innerHTML = '';
    detections.forEach((det, i) => {
      let score = Math.round(minConfidence * 100);
      if (det.V && det.V.length > 0) {
        const s = det.V[0].ga || det.V[0].score;
        if (typeof s === 'number') score = Math.round(s * 100);
      } else if (det.score && det.score.length > 0) {
        score = Math.round(det.score[0] * 100);
      }
      const pill = document.createElement('div');
      pill.className = 'face-pill';
      pill.innerHTML = `<span class="face-pill-dot"></span> Face #${i + 1} (${score}%)`;
      facesTagsBar.appendChild(pill);
    });
  }

  // --------------------------------------------------------------------------
  // Snapshot Capture Feature
  // --------------------------------------------------------------------------
  function takeSnapshot() {
    const srcW = activeSourceWidth || 640;
    const srcH = activeSourceHeight || 480;

    const mergeCanvas = document.createElement('canvas');
    mergeCanvas.width = srcW;
    mergeCanvas.height = srcH;
    const mCtx = mergeCanvas.getContext('2d');

    if (isStaticImageMode && staticImageElement) {
      mCtx.drawImage(staticImageElement, 0, 0, mergeCanvas.width, mergeCanvas.height);
    } else if (video.videoWidth > 0) {
      mCtx.save();
      if (facingMode === 'user' && mirrorFront) {
        mCtx.translate(mergeCanvas.width, 0);
        mCtx.scale(-1, 1);
      }
      mCtx.drawImage(video, 0, 0, mergeCanvas.width, mergeCanvas.height);
      mCtx.restore();
    }

    mCtx.drawImage(canvas, 0, 0, mergeCanvas.width, mergeCanvas.height);

    const count = lastFaceCount >= 0 ? lastFaceCount : 0;
    const stampText = `FaceCount AI · ${count} Face(s) Detected · ${new Date().toLocaleTimeString()}`;
    mCtx.fillStyle = 'rgba(7, 9, 14, 0.75)';
    mCtx.fillRect(16, mergeCanvas.height - 48, mCtx.measureText(stampText).width + 36, 36);
    mCtx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    mCtx.fillStyle = '#10b981';
    mCtx.fillText(stampText, 32, mergeCanvas.height - 24);

    const dataUrl = mergeCanvas.toDataURL('image/jpeg', 0.92);
    snapshotImg.src = dataUrl;
    btnDownloadSnapshot.href = dataUrl;
    snapshotBadge.textContent = `${count} ${count === 1 ? 'Face' : 'Faces'} Captured`;

    snapshotModal.classList.add('open');
    showToast('Snapshot captured 📸');
  }

  // --------------------------------------------------------------------------
  // Photo Upload & Static Test Images
  // --------------------------------------------------------------------------
  btnUploadPhoto.addEventListener('click', () => photoInput.click());
  photoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      loadStaticImage(URL.createObjectURL(file));
    }
  });

  async function loadStaticImage(url) {
    showToast('Analyzing photo...');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      isStaticImageMode = true;
      staticImageElement = img;
      activeSourceWidth = img.width;
      activeSourceHeight = img.height;

      cameraPlaceholder.style.opacity = '0';
      setTimeout(() => { cameraPlaceholder.style.display = 'none'; }, 200);

      if (currentStream) {
        currentStream.getTracks().forEach(t => t.stop());
        currentStream = null;
      }
      video.pause();

      if (!isModelReady) {
        await initFaceDetector();
      }

      const offCanvas = document.createElement('canvas');
      offCanvas.width = img.width;
      offCanvas.height = img.height;
      const offCtx = offCanvas.getContext('2d');
      offCtx.drawImage(img, 0, 0);

      try {
        await faceDetection.send({ image: offCanvas });
        showToast('Photo analyzed successfully!');
      } catch (err) {
        console.error('Photo detection error:', err);
        showToast('Detection error on photo');
      }
    };
    img.onerror = () => {
      showToast('Could not load image');
    };
    img.src = url;
  }

  // Real Photographic Samples for Testing
  btnSample1.addEventListener('click', () => {
    closeSettings();
    loadStaticImage('samples/sample1.jpg');
  });
  btnSample2.addEventListener('click', () => {
    closeSettings();
    loadStaticImage('samples/sample2.jpg');
  });
  btnSample3.addEventListener('click', () => {
    closeSettings();
    loadStaticImage('samples/sample3.jpg');
  });

  // --------------------------------------------------------------------------
  // Settings & Toggles
  // --------------------------------------------------------------------------
  function openSettings() {
    settingsModal.classList.add('open');
  }

  function closeSettings() {
    settingsModal.classList.remove('open');
  }

  btnSettings.addEventListener('click', openSettings);
  btnCloseSettings.addEventListener('click', closeSettings);
  btnSaveSettings.addEventListener('click', closeSettings);

  segShort.addEventListener('click', () => setRangeMode('short'));
  segFull.addEventListener('click', () => setRangeMode('full'));
  btnToggleRange.addEventListener('click', () => {
    setRangeMode(modelRange === 'short' ? 'full' : 'short');
  });

  function setRangeMode(mode) {
    modelRange = mode;
    segShort.classList.toggle('active', mode === 'short');
    segFull.classList.toggle('active', mode === 'full');
    rangeModeLabel.textContent = mode === 'short' ? 'Selfie' : 'Group';
    if (faceDetection) {
      faceDetection.setOptions({ model: modelRange, minDetectionConfidence: minConfidence });
    }
    showToast(`Range: ${mode === 'short' ? 'Selfie Mode (≤2m)' : 'Group/Crowd Mode (≤5m)'}`);
  }

  confidenceSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    confidenceVal.textContent = `${val}%`;
    minConfidence = val / 100;
    if (faceDetection) {
      faceDetection.setOptions({ model: modelRange, minDetectionConfidence: minConfidence });
    }
  });

  checkVoiceAnnounce.addEventListener('change', (e) => {
    voiceEnabled = e.target.checked;
    btnVoiceToggle.classList.toggle('active', voiceEnabled);
  });
  btnVoiceToggle.addEventListener('click', () => {
    voiceEnabled = !voiceEnabled;
    checkVoiceAnnounce.checked = voiceEnabled;
    btnVoiceToggle.classList.toggle('active', voiceEnabled);
    showToast(voiceEnabled ? 'Voice Announcements On' : 'Voice Announcements Muted');
  });

  checkAudioChime.addEventListener('change', (e) => chimeEnabled = e.target.checked);
  checkLandmarks.addEventListener('change', (e) => showLandmarks = e.target.checked);
  checkMirror.addEventListener('change', (e) => {
    mirrorFront = e.target.checked;
    updateMirroring();
  });
  checkTechBox.addEventListener('change', (e) => drawTechCorners = e.target.checked);

  btnCloseSnapshot.addEventListener('click', () => snapshotModal.classList.remove('open'));
  btnRetakeSnapshot.addEventListener('click', () => snapshotModal.classList.remove('open'));
  btnShareSnapshot.addEventListener('click', async () => {
    if (navigator.share) {
      try {
        const response = await fetch(snapshotImg.src);
        const blob = await response.blob();
        const file = new File([blob], 'face-count.jpg', { type: 'image/jpeg' });
        await navigator.share({
          title: 'FaceCount AI Snapshot',
          text: `Detected ${lastFaceCount} face(s) in this shot!`,
          files: [file]
        });
      } catch (err) {
        console.warn('Share canceled/failed:', err);
      }
    } else {
      showToast('Sharing not supported on this browser. Click Download instead.');
    }
  });

  // Main Action Buttons
  btnStartCamera.addEventListener('click', startCamera);
  btnFlipCamera.addEventListener('click', flipCamera);
  btnTorch.addEventListener('click', toggleTorch);
  btnSnapshot.addEventListener('click', takeSnapshot);
  btnPauseCamera.addEventListener('click', togglePause);

  // Initialize detector immediately
  initFaceDetector();

  // Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(err => {
        console.log('SW registration skipped:', err);
      });
    });
  }

})();
