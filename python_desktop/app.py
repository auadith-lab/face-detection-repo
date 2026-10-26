"""FaceDetect AI - Python Desktop Face Counter App
Educational MVP using OpenCV Haar Cascades and Streamlit for desktop webcams.
"""

import threading
import time
from io import BytesIO

import cv2
import numpy as np
import streamlit as st
from PIL import Image, ImageOps

try:
    import av
    from streamlit_webrtc import VideoProcessorBase, WebRtcMode, webrtc_streamer
    WEBRTC_AVAILABLE = True
except ImportError:
    WEBRTC_AVAILABLE = False

APP_NAME = "FaceDetect AI (Desktop)"
PAGES = ["Home", "Live Webcam Face Counter", "Image File Detection"]
MAX_UPLOAD_MB = 15
BOX_COLOR_BGR = (0, 255, 0)

st.set_page_config(page_title=APP_NAME, page_icon="👤", layout="wide")

st.markdown(
    """
    <style>
    [data-testid="stSidebar"] { background-color: #0b1f4b; }
    [data-testid="stSidebar"] * { color: #ffffff !important; }
    h1, h2, h3 { color: #0b1f4b; }
    [data-testid="stMetric"] {
        background-color: #0b1f4b; padding: 14px 16px; border-radius: 10px;
    }
    [data-testid="stMetric"] * { color: #ffffff !important; }
    .hero {
        background: linear-gradient(135deg, #0b1f4b, #1d4ed8); color: #ffffff;
        padding: 24px 28px; border-radius: 14px; margin-bottom: 18px;
    }
    .hero h1 { color: #ffffff; margin: 0 0 6px 0; }
    .hero p { margin: 0; font-size: 1.05rem; }
    .counter-highlight {
        font-size: 2.2rem; font-weight: 800; color: #10b981;
    }
    </style>
    """,
    unsafe_allow_html=True,
)


@st.cache_resource(show_spinner=False)
def get_cascade() -> cv2.CascadeClassifier:
    path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    cascade = cv2.CascadeClassifier(path)
    if cascade.empty():
        raise RuntimeError(f"Could not load Haar cascade from: {path}")
    return cascade


def detect_faces(bgr, cascade, sensitivity, min_size, max_width=None):
    height, width = bgr.shape[:2]
    scale = 1.0
    work = bgr
    if max_width and width > max_width:
        scale = max_width / float(width)
        work = cv2.resize(bgr, (max_width, int(round(height * scale))), interpolation=cv2.INTER_AREA)

    gray = cv2.cvtColor(work, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)

    min_neighbors = int(12 - sensitivity)
    side = max(20, int(round(min_size * scale)))
    faces = cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=min_neighbors,
        minSize=(side, side),
    )
    boxes = []
    for (x, y, w, h) in faces:
        boxes.append((int(x / scale), int(y / scale), int(w / scale), int(h / scale)))
    return boxes


def draw_boxes(bgr, boxes):
    thickness = max(2, bgr.shape[1] // 300)
    for i, (x, y, w, h) in enumerate(boxes, start=1):
        cv2.rectangle(bgr, (x, y), (x + w, y + h), BOX_COLOR_BGR, thickness)
        label = f"Face #{i}"
        cv2.putText(bgr, label, (x, max(20, y - 10)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
    return bgr


with st.sidebar:
    st.markdown(f"## 👤 {APP_NAME}")
    nav = st.radio("Navigation", PAGES, key="nav_radio")
    st.divider()
    st.markdown("### Detection Settings")
    sensitivity = st.slider("Sensitivity", 1, 10, 6, help="Higher = detects more faces")
    min_face_size = st.slider("Min face size (px)", 20, 300, 40, 5)
    st.caption("🔒 All processing runs locally.")

cascade = get_cascade()

if nav == "Home":
    st.markdown(
        f"""
        <div class="hero">
            <h1>{APP_NAME}</h1>
            <p>Real-time face counter for desktop webcams and images using OpenCV.</p>
        </div>
        """,
        unsafe_allow_html=True,
    )
    st.info("💡 To detect faces using your PHONE camera, run the mobile app in the parent directory (`node server.js`).")

elif nav == "Live Webcam Face Counter":
    st.header("Live Webcam Face Counter")
    if not WEBRTC_AVAILABLE:
        st.error("Please install webrtc dependencies: `pip install streamlit-webrtc av`")
    else:
        class FaceProcessor(VideoProcessorBase):
            def __init__(self):
                self._cascade = get_cascade()
                self._lock = threading.Lock()
                self.count = 0

            def recv(self, frame):
                img = frame.to_ndarray(format="bgr24")
                boxes = detect_faces(img, self._cascade, sensitivity, min_face_size, max_width=640)
                draw_boxes(img, boxes)
                with self._lock:
                    self.count = len(boxes)
                return av.VideoFrame.from_ndarray(img, format="bgr24")

        ctx = webrtc_streamer(
            key="face-counter-live",
            mode=WebRtcMode.SENDRECV,
            video_processor_factory=FaceProcessor,
            media_stream_constraints={"video": {"width": {"ideal": 640}}, "audio": False},
            rtc_configuration={"iceServers": []},
            async_processing=True,
        )

        counter_ph = st.empty()
        if ctx.state.playing and ctx.video_processor:
            counter_ph.metric("Faces Detected", ctx.video_processor.count)

else:
    st.header("Image File Detection")
    file = st.file_uploader("Upload an image", type=["jpg", "jpeg", "png"])
    if file:
        img = Image.open(BytesIO(file.getvalue()))
        img = ImageOps.exif_transpose(img).convert("RGB")
        bgr = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        boxes = detect_faces(bgr, cascade, sensitivity, min_face_size)
        draw_boxes(bgr, boxes)
        st.metric("Faces Detected", len(boxes))
        st.image(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
