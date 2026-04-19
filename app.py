"""
Wrist Fracture AI – Detection + Classification web app.

Two-stage pipeline:
  1. YOLO11x (binary fracture detection)    – best.pt  (train8)
  2. EfficientNet-B5 (3-class classifier)   – retrained_efficientnet_b5.pt
     classes: 0=occult, 1=simple, 2=comminuted
"""
from __future__ import annotations

import base64
import io
import logging
import os
import time

import numpy as np
import torch
import torch.nn as nn
from flask import Flask, jsonify, render_template, request
from PIL import Image
from torchvision import transforms

from efficientnet_pytorch import EfficientNet
from ultralytics import YOLO


# --------------------------------------------------------------------------- #
# Config                                                                      #
# --------------------------------------------------------------------------- #
# Model paths are configurable via environment variables so the repo does not
# embed filesystem paths. Place weights anywhere and point to them with:
#   YOLO_WEIGHTS=/path/to/yolo.pt EFFNET_WEIGHTS=/path/to/effnet.pt python app.py
YOLO_WEIGHTS = os.environ.get("YOLO_WEIGHTS", "./models/yolo_best.pt")
EFFNET_WEIGHTS = os.environ.get(
    "EFFNET_WEIGHTS", "./models/retrained_efficientnet_b5.pt"
)

CLASS_NAMES = {0: "occult", 1: "simple", 2: "comminuted"}
CLASS_COLORS = {0: "#F5B700", 1: "#FF6B35", 2: "#D62828"}  # yellow / orange / red

PORT = int(os.environ.get("PORT", 5050))
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(message)s")
log = logging.getLogger("wrist-fx")


# --------------------------------------------------------------------------- #
# Model loading                                                               #
# --------------------------------------------------------------------------- #
log.info("Loading YOLO detector...")
yolo_model = YOLO(YOLO_WEIGHTS)
yolo_model.to(DEVICE)

log.info("Loading EfficientNet-B5 classifier...")
eff_model = EfficientNet.from_name("efficientnet-b5", num_classes=3)
eff_model._fc = nn.Linear(eff_model._fc.in_features, 3)
_state = torch.load(EFFNET_WEIGHTS, map_location=DEVICE)
eff_model.load_state_dict(_state)
eff_model.to(DEVICE).eval()

eff_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

log.info(f"Models loaded on {DEVICE}.")


# --------------------------------------------------------------------------- #
# Inference                                                                   #
# --------------------------------------------------------------------------- #
def run_pipeline(image: Image.Image) -> dict:
    """Run YOLO detection + per-ROI EfficientNet classification."""
    t0 = time.time()
    image = image.convert("RGB")
    img_w, img_h = image.size

    arr = np.array(image)  # HxWx3 RGB
    yolo_out = yolo_model.predict(
        source=arr,
        conf=0.05,
        iou=0.30,
        imgsz=1280,
        verbose=False,
    )
    boxes = yolo_out[0].boxes

    detections = []
    if boxes is not None and len(boxes) > 0:
        for b in boxes:
            xyxy = b.xyxy.cpu().numpy()[0].tolist()
            det_conf = float(b.conf.cpu().numpy()[0])
            x1, y1, x2, y2 = [max(0, int(round(v))) for v in xyxy]
            x2 = min(img_w, x2)
            y2 = min(img_h, y2)
            if x2 <= x1 or y2 <= y1:
                continue
            roi = image.crop((x1, y1, x2, y2))
            tensor = eff_transform(roi).unsqueeze(0).to(DEVICE)
            with torch.no_grad():
                logits = eff_model(tensor)
                probs = torch.softmax(logits, dim=1).cpu().numpy()[0].tolist()
            pred_class = int(np.argmax(probs))
            detections.append({
                "bbox": [x1, y1, x2, y2],
                "det_conf": det_conf,
                "class_id": pred_class,
                "class_name": CLASS_NAMES[pred_class],
                "class_color": CLASS_COLORS[pred_class],
                "probs": {
                    CLASS_NAMES[i]: float(probs[i]) for i in range(3)
                },
                "class_conf": float(probs[pred_class]),
            })

    dt = time.time() - t0
    return {
        "image_width": img_w,
        "image_height": img_h,
        "detections": detections,
        "n_detections": len(detections),
        "elapsed_ms": int(dt * 1000),
        "device": str(DEVICE),
    }


# --------------------------------------------------------------------------- #
# Flask app                                                                   #
# --------------------------------------------------------------------------- #
app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 32 * 1024 * 1024  # 32 MB
app.config["TEMPLATES_AUTO_RELOAD"] = True
app.jinja_env.auto_reload = True


@app.route("/")
def index():
    return render_template("index.html", class_names=CLASS_NAMES,
                           class_colors=CLASS_COLORS)


@app.route("/predict", methods=["POST"])
def predict():
    try:
        image = _read_image_from_request()
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    try:
        result = run_pipeline(image)
    except Exception as e:
        log.exception("Inference error")
        return jsonify({"error": f"Inference failed: {e}"}), 500
    return jsonify(result)


def _read_image_from_request() -> Image.Image:
    """Accept file upload (multipart) OR base64 JSON body."""
    if request.files.get("image"):
        f = request.files["image"]
        if not f.filename:
            raise ValueError("Empty filename")
        return Image.open(f.stream)

    if request.is_json:
        data = request.get_json(silent=True) or {}
        b64 = data.get("image_base64") or data.get("image")
        if not b64:
            raise ValueError("Missing 'image_base64' in JSON body")
        if "," in b64:  # strip data URL prefix
            b64 = b64.split(",", 1)[1]
        raw = base64.b64decode(b64)
        return Image.open(io.BytesIO(raw))

    raw = request.get_data()
    if raw:
        return Image.open(io.BytesIO(raw))

    raise ValueError("No image provided. Use multipart 'image' field or JSON 'image_base64'.")


# --------------------------------------------------------------------------- #
# Main                                                                        #
# --------------------------------------------------------------------------- #
if __name__ == "__main__":
    print(f"Server running on http://0.0.0.0:{PORT}")
    app.run(host="0.0.0.0", port=PORT, debug=False, use_reloader=False)
