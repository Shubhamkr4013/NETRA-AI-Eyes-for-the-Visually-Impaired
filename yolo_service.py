from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
# from google import genai
import cv2
import os
import numpy as np
from ultralytics import YOLO
from twilio.rest import Client
# import requests
from huggingface_hub import InferenceClient
import threading
import time
import pyttsx3




def reminder_task(seconds, message):
    time.sleep(seconds)
    print("Reminder:", message)


app = Flask(__name__, static_folder="Frontend", static_url_path="")
CORS(app)
load_dotenv()


# Load YOLO model
model = YOLO("yolov8n.pt")


#  Twilio Setup (PUT REAL VALUES HERE)
account_sid = os.getenv("TWILIO_ACCOUNT_SID")
auth_token = os.getenv("TWILIO_AUTH_TOKEN")
twilio_phone = os.getenv("TWILIO_PHONE")
guardian_phone = os.getenv("GUARDIAN_PHONE")

client = Client(account_sid, auth_token)

#  Gemini Setup
# client_ai = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


# Home Route
@app.route("/")
def home():
    return send_from_directory("Frontend", "index.html")


#  Object Detection Route
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



# AI Client
hf_client = InferenceClient(
    model="mistralai/Mistral-7B-Instruct-v0.2",
    token=os.getenv("HF_TOKEN")
)

@app.route("/ask-ai", methods=["POST"])
def ask_ai():

    data = request.json
    question = data.get("question")

    if not question:
        return jsonify({"answer": "Question nahi mila"})

    try:

        response = hf_client.text_generation(
            f"Answer in Hindi: {question}",
            max_new_tokens=120
        )

        return jsonify({"answer": response})

    except Exception as e:

        print("AI ERROR:", e)
        return jsonify({"answer": "AI response nahi mila"})
    
    
    # Reminder Route
engine = pyttsx3.init()
def reminder_task(seconds, message):

    time.sleep(seconds)

    print("Reminder:", message)

    
@app.route("/set-reminder", methods=["POST"])
def set_reminder():

    data = request.json
    minutes = data.get("minutes")

    seconds = int(minutes) * 60

    threading.Thread(target=reminder_task, args=(seconds, "Reminder time ho gaya")).start()

    return jsonify({"status": "Reminder set"})
    

    
#  SOS Route
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