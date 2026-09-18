
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
from twilio.rest import Client
from huggingface_hub import InferenceClient

import cv2
import os
import numpy as np
from ultralytics import YOLO
import threading
import time


# =========================================================
# ENVIRONMENT
# =========================================================

load_dotenv()


# =========================================================
# FLASK APP
# =========================================================

app = Flask(
    __name__,
    static_folder="Frontend",
    static_url_path=""
)

# Maximum uploaded image size: 10 MB
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024

# Allow frontend / Android APK to communicate with backend
CORS(app)


# =========================================================
# YOLO MODEL
# =========================================================

print("Loading YOLO model...")

model = YOLO("yolov8n.pt")

print("YOLO model loaded successfully.")


# =========================================================
# TWILIO CONFIGURATION
# =========================================================

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_PHONE = os.getenv("TWILIO_PHONE")
GUARDIAN_PHONE = os.getenv("GUARDIAN_PHONE")

twilio_client = None

if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    try:
        twilio_client = Client(
            TWILIO_ACCOUNT_SID,
            TWILIO_AUTH_TOKEN
        )
        print("Twilio initialized successfully.")
    except Exception as e:
        print("Twilio initialization failed:", e)
else:
    print("WARNING: Twilio credentials are missing.")


# =========================================================
# HUGGING FACE AI
# =========================================================

HF_TOKEN = os.getenv("HF_TOKEN")

hf_client = None

if HF_TOKEN:
    try:
        hf_client = InferenceClient(
            model="mistralai/Mistral-7B-Instruct-v0.2",
            token=HF_TOKEN
        )

        print("Hugging Face AI initialized successfully.")

    except Exception as e:
        print("Hugging Face initialization failed:", e)

else:
    print("WARNING: HF_TOKEN is missing.")


# =========================================================
# HOME
# =========================================================

@app.route("/")
def home():

    return send_from_directory(
        "Frontend",
        "index.html"
    )


# =========================================================
# HEALTH CHECK
# =========================================================

@app.route("/health", methods=["GET"])
def health():

    return jsonify({
        "status": "ok",
        "service": "NETRA Backend",
        "yolo": True,
        "ai": hf_client is not None,
        "twilio": twilio_client is not None
    })


# =========================================================
# OBJECT DETECTION
# =========================================================

@app.route("/detect", methods=["POST"])
def detect():

    try:

        # Check image exists
        if "image" not in request.files:

            return jsonify({
                "error": "Image file missing"
            }), 400


        file = request.files["image"]


        if file.filename == "":

            return jsonify({
                "error": "Empty image file"
            }), 400


        # Read image
        image_bytes = file.read()

        if not image_bytes:

            return jsonify({
                "error": "Image data empty"
            }), 400


        # Convert bytes to numpy array
        img_array = np.frombuffer(
            image_bytes,
            np.uint8
        )


        # Decode image
        img = cv2.imdecode(
            img_array,
            cv2.IMREAD_COLOR
        )


        if img is None:

            return jsonify({
                "error": "Invalid image"
            }), 400


        # YOLO inference
        results = model(img)[0]


        detections = []


        # Process detections
        for box in results.boxes:

            cls_id = int(box.cls[0])

            label = model.names[cls_id]

            confidence = float(box.conf[0])


            x1, y1, x2, y2 = map(
                int,
                box.xyxy[0]
            )


            detections.append({

                "label": label,

                "confidence": round(
                    confidence,
                    2
                ),

                "box": [
                    x1,
                    y1,
                    x2,
                    y2
                ]

            })


        return jsonify({

            "success": True,

            "detections": detections

        })


    except Exception as e:

        print("DETECTION ERROR:", e)

        return jsonify({

            "success": False,

            "error": "Object detection failed"

        }), 500


# =========================================================
# AI QUESTION
# =========================================================

@app.route("/ask-ai", methods=["POST"])
def ask_ai():

    try:

        # Check JSON
        data = request.get_json(
            silent=True
        )


        if not data:

            return jsonify({
                "answer": "Request data nahi mila."
            }), 400


        question = data.get("question")


        if not question:

            return jsonify({
                "answer": "Question nahi mila."
            }), 400


        # Check AI availability
        if hf_client is None:

            return jsonify({

                "answer":
                "AI service abhi configured nahi hai."

            }), 503


        # AI prompt
        prompt = (
            "Answer the following question in simple Hindi. "
            "Keep the answer useful and concise.\n\n"
            f"Question: {question}"
        )


        response = hf_client.text_generation(

            prompt,

            max_new_tokens=120

        )


        return jsonify({

            "success": True,

            "answer": response

        })


    except Exception as e:

        print("AI ERROR:", e)

        return jsonify({

            "success": False,

            "answer":
            "AI response nahi mila."

        }), 500


# =========================================================
# REMINDER
# =========================================================

def reminder_task(seconds, message):

    try:

        time.sleep(seconds)

        print(
            "Reminder:",
            message
        )

    except Exception as e:

        print(
            "REMINDER ERROR:",
            e
        )


@app.route("/set-reminder", methods=["POST"])
def set_reminder():

    try:

        data = request.get_json(
            silent=True
        )


        if not data:

            return jsonify({
                "error": "Request data nahi mila"
            }), 400


        minutes = data.get("minutes")


        if minutes is None:

            return jsonify({
                "error": "Minutes missing"
            }), 400


        minutes = float(minutes)


        if minutes <= 0:

            return jsonify({
                "error":
                "Minutes must be greater than 0"
            }), 400


        seconds = int(
            minutes * 60
        )


        threading.Thread(

            target=reminder_task,

            args=(
                seconds,
                "Reminder time ho gaya"
            ),

            daemon=True

        ).start()


        return jsonify({

            "success": True,

            "status":
            "Reminder set",

            "minutes":
            minutes

        })


    except Exception as e:

        print(
            "REMINDER ERROR:",
            e
        )

        return jsonify({

            "success": False,

            "error":
            "Reminder set nahi hua"

        }), 500


# =========================================================
# SOS
# =========================================================

@app.route("/sos", methods=["POST"])
def sos():

    try:

        data = request.get_json(
            silent=True
        )


        if not data:

            return jsonify({
                "error": "Request data nahi mila"
            }), 400


        latitude = data.get("latitude")

        longitude = data.get("longitude")


        # Check location properly
        if latitude is None or longitude is None:

            return jsonify({

                "error":
                "Location missing"

            }), 400


        # Convert to string
        latitude = str(latitude)

        longitude = str(longitude)


        # Google Maps location
        maps_link = (
            f"https://maps.google.com/"
            f"?q={latitude},{longitude}"
        )


        message = (
            "🚨 EMERGENCY ALERT!\n\n"
            "User needs help immediately.\n\n"
            "Location:\n"
            f"{maps_link}"
        )


        # Check Twilio
        if twilio_client is None:

            return jsonify({

                "success": False,

                "error":
                "Twilio is not configured"

            }), 503


        if not TWILIO_PHONE or not GUARDIAN_PHONE:

            return jsonify({

                "success": False,

                "error":
                "Twilio phone configuration missing"

            }), 503


        # =================================================
        # SMS
        # =================================================

        twilio_client.messages.create(

            body=message,

            from_=TWILIO_PHONE,

            to=GUARDIAN_PHONE

        )


        # =================================================
        # WHATSAPP
        # =================================================

        try:

            twilio_client.messages.create(

                body=message,

                from_="whatsapp:+14155238886",

                to=f"whatsapp:{GUARDIAN_PHONE}"

            )

        except Exception as whatsapp_error:

            print(
                "WhatsApp ERROR:",
                whatsapp_error
            )


        # =================================================
        # PHONE CALL
        # =================================================

        try:

            twilio_client.calls.create(

                twiml=(
                    "<Response>"
                    "<Say>"
                    "Emergency alert. "
                    "The user needs help immediately."
                    "</Say>"
                    "</Response>"
                ),

                from_=TWILIO_PHONE,

                to=GUARDIAN_PHONE

            )

        except Exception as call_error:

            print(
                "CALL ERROR:",
                call_error
            )


        return jsonify({

            "success": True,

            "message":
            "SOS sent successfully"

        })


    except Exception as e:

        print(
            "SOS ERROR:",
            e
        )

        return jsonify({

            "success": False,

            "error":
            "SOS service failed"

        }), 500


# =========================================================
# FILE TOO LARGE
# =========================================================

@app.errorhandler(413)
def request_entity_too_large(error):

    return jsonify({

        "error":
        "Image too large. Maximum size is 10 MB."

    }), 413


# =========================================================
# START SERVER
# =========================================================

if __name__ == "__main__":

    port = int(
        os.getenv(
            "PORT",
            5000
        )
    )


    print(
        f"NETRA backend running on port {port}"
    )


    app.run(

        host="0.0.0.0",

        port=port

    )
