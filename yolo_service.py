from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import cv2
import os
import numpy as np
from ultralytics import YOLO
from twilio.rest import Client

app = Flask(__name__, static_folder="Frontend", static_url_path="")
CORS(app)
load_dotenv()
# Load YOLO model
model = YOLO("yolov8n.pt")


# 🔹 Twilio Setup (PUT REAL VALUES HERE)
account_sid = os.getenv("TWILIO_ACCOUNT_SID")
auth_token = os.getenv("TWILIO_AUTH_TOKEN")
twilio_phone = os.getenv("TWILIO_PHONE")
guardian_phone = os.getenv("GUARDIAN_PHONE")

client = Client(account_sid, auth_token)


# 🔹 Home Route
@app.route("/")
def home():
    return send_from_directory("Frontend", "index.html")


# 🔹 Object Detection Route
@app.route("/detect", methods=["POST"])
def detect():
    file = request.files["image"]
    img_bytes = np.frombuffer(file.read(), np.uint8)
    img = cv2.imdecode(img_bytes, cv2.IMREAD_COLOR)

    results = model(img)[0]
    detections = []

    for box in results.boxes:
        cls_id = int(box.cls[0])
        label = model.names[cls_id]
        conf = float(box.conf[0])
        x1, y1, x2, y2 = map(int, box.xyxy[0])

        detections.append({
            "label": label,
            "confidence": round(conf, 2),
            "box": [x1, y1, x2, y2]
        })

    return jsonify({"detections": detections})


# 🔹 SOS Route
@app.route("/sos", methods=["POST"])
def sos():
    data = request.json

    latitude = data.get("latitude")
    longitude = data.get("longitude")

    if not latitude or not longitude:
        return jsonify({"error": "Location missing"}), 400

    message = f"""
🚨 EMERGENCY ALERT!
User needs help immediately.

Location:
https://maps.google.com/?q={latitude},{longitude}
"""

    try:
        client.messages.create(
            body=message,
            from_=twilio_phone,
            to=guardian_phone
        )

        return jsonify({"success": True, "message": "SOS sent successfully"})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)