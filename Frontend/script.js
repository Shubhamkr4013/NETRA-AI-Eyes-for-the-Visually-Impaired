// ============================================================
// NETRA - AI Vision Assistant
// Android / WebView Compatible JavaScript
// ============================================================


// ============================================================
// API CONFIGURATION
// ============================================================

// Website ko laptop par Flask ke saath test karne ke liye
const LOCAL_API_URL = "http://10.144.164.68:5000";

// APK banne ke baad yahan apna deployed Flask HTTPS URL डालना.
// Example:
// const PRODUCTION_API_URL = "https://netra-api.onrender.com";
const PRODUCTION_API_URL =
  "https://netra-backend-4iq1.onrender.com";

const isLocalHost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

const API_BASE_URL = isLocalHost
  ? LOCAL_API_URL
  : PRODUCTION_API_URL;


// ============================================================
// DOM ELEMENTS
// ============================================================

const startBtn =
  document.getElementById("startBtn");

const video =
  document.getElementById("video");

const canvas =
  document.getElementById("canvas");

const output =
  document.getElementById("output");

const snapshotBtn =
  document.getElementById("snapshotBtn");

const voiceBtn =
  document.getElementById("voiceBtn");

const manualDetectBtn =
  document.getElementById("manualDetectBtn");

const startAutoDetectBtn =
  document.getElementById("startAutoDetectBtn");

const stopAutoDetectBtn =
  document.getElementById("stopAutoDetectBtn");

const sosBtn =
  document.getElementById("sosBtn");

const floatingVoice =
  document.getElementById("floatingVoice");


// ============================================================
// APP STATE
// ============================================================

let autoDetectInterval = null;

let isDetecting = false;

let currentFacingMode =
  "environment";

let currentStream = null;

let roomMemory = {};

let recognition = null;

let isListening = false;

let reminderInterval = null;

let alertPlayed = false;


// ============================================================
// COMMON FUNCTIONS
// ============================================================

function setOutput(message) {

  if (output) {
    output.innerText = message;
  }

}


// ============================================================
// TEXT TO SPEECH
// ============================================================

function speak(text) {

  if (!text) return;

  if (!("speechSynthesis" in window)) {

    console.warn(
      "Speech synthesis not supported."
    );

    return;
  }

  try {

    speechSynthesis.cancel();

    const utterance =
      new SpeechSynthesisUtterance(
        String(text)
      );

    utterance.lang = "hi-IN";

    utterance.rate = 0.95;

    utterance.pitch = 1;

    speechSynthesis.speak(
      utterance
    );

  } catch (error) {

    console.error(
      "Speech error:",
      error
    );

  }

}


// ============================================================
// STOP SPEAKING
// ============================================================

function stopSpeaking() {

  if ("speechSynthesis" in window) {

    speechSynthesis.cancel();

  }

}


// ============================================================
// API CHECK
// ============================================================

function isApiConfigured() {

  return (
    API_BASE_URL &&
    !API_BASE_URL.includes(
      "YOUR-NETRA-BACKEND-URL"
    )
  );

}


// ============================================================
// ANDROID / WEBVIEW PERMISSIONS
// ============================================================

async function requestCameraPermission() {

  try {

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {

      setOutput(
        "Camera API supported nahi hai."
      );

      return false;
    }

    const testStream =
      await navigator.mediaDevices
        .getUserMedia({
          video: true,
          audio: false
        });

    testStream
      .getTracks()
      .forEach(track =>
        track.stop()
      );

    return true;

  } catch (error) {

    console.error(
      "Camera permission error:",
      error
    );

    if (
      error.name ===
      "NotAllowedError"
    ) {

      setOutput(
        "Camera permission allow karein."
      );

    } else if (
      error.name ===
      "NotFoundError"
    ) {

      setOutput(
        "Camera device nahi mila."
      );

    } else if (
      error.name ===
      "SecurityError"
    ) {

      setOutput(
        "Camera access WebView me blocked hai."
      );

    } else {

      setOutput(
        "Camera start nahi ho pa raha."
      );

    }

    return false;
  }

}


// ============================================================
// MICROPHONE PERMISSION
// ============================================================

async function requestMicrophonePermission() {

  try {

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {

      setOutput(
        "Microphone API supported nahi hai."
      );

      return false;
    }

    const testStream =
      await navigator.mediaDevices
        .getUserMedia({
          audio: true,
          video: false
        });

    testStream
      .getTracks()
      .forEach(track =>
        track.stop()
      );

    return true;

  } catch (error) {

    console.error(
      "Microphone permission error:",
      error
    );

    if (
      error.name ===
      "NotAllowedError"
    ) {

      setOutput(
        "Microphone permission allow karein."
      );

    } else if (
      error.name ===
      "SecurityError"
    ) {

      setOutput(
        "Microphone access WebView me blocked hai."
      );

    } else {

      setOutput(
        "Microphone access nahi mil raha."
      );

    }

    return false;
  }

}


// ============================================================
// CAMERA
// ============================================================

async function switchCamera(mode) {

  try {

    const permissionGranted =
      await requestCameraPermission();

    if (!permissionGranted) {

      return;
    }


    // Stop previous camera

    if (currentStream) {

      currentStream
        .getTracks()
        .forEach(track =>
          track.stop()
        );

      currentStream = null;
    }


    currentFacingMode =
      mode;


    // Start new camera

    const stream =
      await navigator.mediaDevices
        .getUserMedia({

          video: {

            width: {
              ideal: 640
            },

            height: {
              ideal: 480
            },

            facingMode: {
              ideal:
                currentFacingMode
            }

          },

          audio: false

        });


    currentStream =
      stream;


    if (video) {

      video.srcObject =
        stream;

      video.setAttribute(
        "playsinline",
        "true"
      );

      video.setAttribute(
        "autoplay",
        "true"
      );

      try {

        await video.play();

      } catch (error) {

        console.warn(
          "Video play warning:",
          error
        );

      }

    }


    updateCameraButton();


    console.log(
      "Camera switched:",
      currentFacingMode
    );


  } catch (error) {

    console.error(
      "Camera switch error:",
      error
    );


    if (
      error?.name ===
      "NotAllowedError"
    ) {

      setOutput(
        "Camera permission allow karein."
      );

    } else if (
      error?.name ===
      "NotFoundError"
    ) {

      setOutput(
        "Camera device nahi mila."
      );

    } else if (
      error?.name ===
      "NotReadableError"
    ) {

      setOutput(
        "Camera kisi aur app me use ho raha hai."
      );

    } else {

      setOutput(
        "Camera start nahi ho pa raha."
      );

    }


    console.error(
      "Camera error details:",
      error?.name,
      error?.message
    );

  }

}


// ============================================================
// CAMERA BUTTON TEXT
// ============================================================

function updateCameraButton() {

  if (!startBtn) return;


  if (
    currentFacingMode ===
    "environment"
  ) {

    startBtn.innerText =
      "📷 Switch to Front Camera";

  } else {

    startBtn.innerText =
      "📷 Switch to Back Camera";

  }

}


// ============================================================
// START / SWITCH CAMERA
// ============================================================

if (startBtn) {

  startBtn.addEventListener(
    "click",
    async event => {

      event.preventDefault();

      const nextMode =
        currentFacingMode ===
        "environment"
          ? "user"
          : "environment";

      await switchCamera(
        nextMode
      );

    }
  );

}


// ============================================================
// DETECTION
// ============================================================

async function runDetectionOnce() {

  // Already detecting

  if (isDetecting) {

    return;
  }


  // Camera check

  if (!video || !canvas) {

    setOutput(
      "Camera available nahi hai."
    );

    return;
  }


  if (
    video.readyState < 2 ||
    !video.videoWidth ||
    !video.videoHeight
  ) {

    setOutput(
      "Camera ready nahi hai."
    );

    return;
  }


  // Backend check

  if (!isApiConfigured()) {

    setOutput(
      "Backend URL configure karein."
    );

    console.error(
      "PRODUCTION_API_URL ko apne deployed backend URL se replace karein."
    );

    return;
  }


  isDetecting = true;


  setOutput(
    "Detecting..."
  );


  try {

    const ctx =
      canvas.getContext("2d");


    if (!ctx) {

      throw new Error(
        "Canvas context unavailable."
      );

    }


    // Canvas size

    canvas.width =
      video.videoWidth;

    canvas.height =
      video.videoHeight;


    // Camera frame capture

    ctx.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );


    // Convert frame to JPEG

    const blob =
      await new Promise(
        (resolve, reject) => {

          canvas.toBlob(

            result => {

              if (result) {

                resolve(result);

              } else {

                reject(
                  new Error(
                    "Image create nahi hui."
                  )
                );

              }

            },

            "image/jpeg",

            0.85

          );

        }
      );


    // Form data

    const formData =
      new FormData();


    formData.append(
      "image",
      blob,
      "frame.jpg"
    );


    // Flask API

    const response =
      await fetch(
        `${API_BASE_URL}/detect`,
        {
          method: "POST",
          body: formData
        }
      );


    if (!response.ok) {

      throw new Error(
        `Detection server error: ${response.status}`
      );

    }


    const data =
      await response.json();


    if (
      !data ||
      !Array.isArray(
        data.detections
      )
    ) {

      throw new Error(
        "Invalid detection response."
      );

    }


    // Narrate result

    narrateDetection(
      data
    );


  } catch (error) {

    console.error(
      "Detection error:",
      error
    );

    setOutput(
      "Detection failed. Backend check karein."
    );

  } finally {

    isDetecting = false;

  }

}


// ============================================================
// DISTANCE ESTIMATION
// ============================================================

function estimateDistance(
  width,
  frameWidth,
  objectHeight
) {

  if (
    !frameWidth ||
    width <= 0
  ) {

    return 3.0;

  }


  const relativeSize =
    width / frameWidth;


  // Approximate distance
  // This is NOT true depth measurement.

  if (
    relativeSize > 0.4
  ) {

    return 0.5;

  }


  if (
    relativeSize > 0.3
  ) {

    return 1.0;

  }


  if (
    relativeSize > 0.2
  ) {

    return 1.5;

  }


  if (
    relativeSize > 0.1
  ) {

    return 2.0;

  }


  return 3.0;

}


// ============================================================
// HINDI OBJECT LABEL
// ============================================================

function getHindiLabel(
  label
) {

  const labels = {

    "person":
      "vyakti",

    "car":
      "gaadi",

    "bottle":
      "botal",

    "chair":
      "kursi",

    "cell phone":
      "mobile phone",

    "dog":
      "kutta",

    "cat":
      "billi",

    "handbag":
      "bag",

    "backpack":
      "bag",

    "bus":
      "bus",

    "truck":
      "truck",

    "bicycle":
      "cycle",

    "motorcycle":
      "bike",

    "traffic light":
      "traffic light",

    "bench":
      "bench",

    "cup":
      "cup",

    "laptop":
      "laptop",

    "book":
      "kitab",

    "table":
      "table"

  };


  return (
    labels[label] ||
    label
  );

}


// ============================================================
// DETECTION NARRATION
// ============================================================

function narrateDetection(
  data
) {

  const frameWidth =
    video?.videoWidth ||
    640;


  // No object

  if (
    !data ||
    !Array.isArray(
      data.detections
    ) ||
    data.detections.length === 0
  ) {

    const message =
      "Kuch bhi nahi mila.";

    setOutput(
      message
    );

    speak(
      message
    );

    roomMemory = {};

    return;
  }


  const objectCounts = {};

  const objectDescriptions = [];


  data.detections.forEach(
    detection => {

      const label =
        detection.label ||
        "object";


      const hindiLabel =
        getHindiLabel(
          label
        );


      // Count

      if (
        !objectCounts[
          hindiLabel
        ]
      ) {

        objectCounts[
          hindiLabel
        ] = 0;

      }


      objectCounts[
        hindiLabel
      ]++;


      // Bounding box

      const box =
        Array.isArray(
          detection.box
        )
          ? detection.box
          : [
              0,
              0,
              0,
              0
            ];


      const [
        x1,
        y1,
        x2,
        y2
      ] = box;


      const centerX =
        (x1 + x2) / 2;


      const width =
        Math.max(
          0,
          x2 - x1
        );


      const height =
        Math.max(
          0,
          y2 - y1
        );


      // Direction

      let direction =
        "aage";


      if (
        centerX <
        frameWidth * 0.33
      ) {

        direction =
          "left mein";

      } else if (
        centerX >
        frameWidth * 0.66
      ) {

        direction =
          "right mein";

      }


      // Distance

      const distance =
        estimateDistance(
          width,
          frameWidth,
          height
        );


      objectDescriptions.push(
        `ek ${hindiLabel} ${direction} ${distance} meter dur hai`
      );

    }
  );


  // Store memory

  roomMemory = {
    ...objectCounts
  };


  // Count sentence

  const countParts =
    Object.entries(
      objectCounts
    ).map(
      ([label, count]) =>
        `${count} ${label}`
    );


  const countSentence =
    countParts.join(
      ", "
    );


  // Description

  const descriptionSentence =
    objectDescriptions.join(
      ", "
    );


  // Final Hindi sentence

  const hindiSentence =
    `Aapke saamne ${countSentence} hai, ${descriptionSentence}.`;


  setOutput(
    hindiSentence
  );


  speak(
    hindiSentence
  );

}


// ============================================================
// AUTO DETECTION
// ============================================================

function startAutoDetect() {

  if (autoDetectInterval) {

    console.log(
      "Auto detect already running."
    );

    return;
  }


  console.log(
    "Starting auto detect."
  );


  // Immediate detection

  runDetectionOnce();


  // Every 10 seconds

  autoDetectInterval =
    setInterval(
      runDetectionOnce,
      10000
    );


  setOutput(
    "Auto detection chalu hai."
  );

}


// ============================================================
// STOP AUTO DETECT
// ============================================================

function stopAutoDetect() {

  if (!autoDetectInterval) {

    console.log(
      "Auto detect not running."
    );

    return;
  }


  clearInterval(
    autoDetectInterval
  );


  autoDetectInterval =
    null;


  console.log(
    "Auto detect stopped."
  );


  setOutput(
    "Auto detection band ho gaya."
  );

}


// ============================================================
// SNAPSHOT
// ============================================================

function takeSnapshot() {

  if (!video || !canvas) {

    setOutput(
      "Camera available nahi hai."
    );

    return;
  }


  if (
    video.readyState < 2 ||
    !video.videoWidth ||
    !video.videoHeight
  ) {

    alert(
      "Video not ready for snapshot."
    );

    return;
  }


  const ctx =
    canvas.getContext(
      "2d"
    );


  if (!ctx) return;


  canvas.width =
    video.videoWidth;

  canvas.height =
    video.videoHeight;


  ctx.drawImage(
    video,
    0,
    0,
    canvas.width,
    canvas.height
  );


  canvas.toBlob(

    blob => {

      if (!blob) {

        setOutput(
          "Snapshot create nahi hua."
        );

        return;
      }


      const url =
        URL.createObjectURL(
          blob
        );


      const link =
        document.createElement(
          "a"
        );


      link.href =
        url;


      link.download =
        `netra-snapshot-${Date.now()}.jpg`;


      document.body.appendChild(
        link
      );


      link.click();


      link.remove();


      setTimeout(
        () => {

          URL.revokeObjectURL(
            url
          );

        },
        1000
      );


      setOutput(
        "Snapshot save ho gaya."
      );

    },

    "image/jpeg",

    0.92

  );

}


// ============================================================
// VOICE RECOGNITION
// ============================================================

async function startVoiceRecognition() {

  // First request microphone

  const micPermission =
    await requestMicrophonePermission();


  if (!micPermission) {

    return;
  }


  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;


  if (!SpeechRecognition) {

    console.warn(
      "SpeechRecognition API is unavailable in this WebView."
    );


    setOutput(
      "Is Android WebView me voice recognition available nahi hai."
    );


    speak(
      "Voice recognition is device par available nahi hai."
    );


    return;
  }


  recognition =
    new SpeechRecognition();


  recognition.lang =
    "hi-IN";


  recognition.interimResults =
    false;


  recognition.maxAlternatives =
    1;


  recognition.continuous =
    true;


  // ---------------- START ----------------

  recognition.onstart =
    () => {

      isListening =
        true;


      if (voiceBtn) {

        voiceBtn.innerText =
          "🛑 Stop Voice Command";

      }


      console.log(
        "Voice recognition started."
      );


      setOutput(
        "Sun raha hoon..."
      );

    };


  // ---------------- RESULT ----------------

  recognition.onresult =
    event => {

      const lastResult =
        event.results[
          event.results.length - 1
        ];


      if (
        !lastResult ||
        !lastResult[0]
      ) {

        return;
      }


      const transcript =
        lastResult[0]
          .transcript
          .toLowerCase()
          .trim()
          .replace(
            /[.,!?]/g,
            ""
          );


      console.log(
        "Voice input:",
        transcript
      );


      setOutput(
        `Aapne kaha: "${transcript}"`
      );


      handleVoiceCommand(
        transcript
      );

    };


  // ---------------- ERROR ----------------

  recognition.onerror =
    event => {

      console.error(
        "Voice command error:",
        event.error
      );


      if (
        event.error ===
        "not-allowed"
      ) {

        setOutput(
          "Microphone permission ya speech service access nahi mila."
        );


      } else if (
        event.error ===
        "service-not-allowed"
      ) {

        setOutput(
          "Android speech recognition service available nahi hai."
        );


      } else if (
        event.error ===
        "network"
      ) {

        setOutput(
          "Speech recognition ke liye internet check karein."
        );


      } else if (
        event.error ===
        "no-speech"
      ) {

        setOutput(
          "Kuch suna nahi. Dobara boliye."
        );


      } else if (
        event.error !==
        "aborted"
      ) {

        setOutput(
          "Voice command failed: " +
          event.error
        );

      }

    };


  // ---------------- END ----------------

  recognition.onend =
    () => {

      console.log(
        "Voice recognition ended."
      );


      if (isListening) {

        setTimeout(
          () => {

            try {

              recognition?.start();

            } catch (error) {

              console.warn(
                "Voice restart warning:",
                error
              );

            }

          },
          300
        );

      }

    };


  // ---------------- START ----------------

  try {

    recognition.start();

  } catch (error) {

    console.error(
      "Voice start error:",
      error
    );

  }

}


// ============================================================
// STOP VOICE RECOGNITION
// ============================================================

function stopVoiceRecognition() {

  isListening =
    false;


  if (recognition) {

    try {

      recognition.stop();

    } catch (error) {

      console.warn(
        "Voice stop warning:",
        error
      );

    }

  }


  if (voiceBtn) {

    voiceBtn.innerText =
      "🎤 Start Voice Command";

  }


  console.log(
    "Voice recognition stopped."
  );

}


// ============================================================
// VOICE COMMAND HANDLER
// ============================================================

function handleVoiceCommand(
  transcript
) {

  if (!transcript) return;


  // ========================================================
  // AI
  // ========================================================

  if (

    transcript.includes(
      "what is"
    ) ||

    transcript.includes(
      "वॉट इज़"
    ) ||

    transcript.includes(
      "explain"
    ) ||

    transcript.includes(
      "एक्सप्लेन"
    ) ||

    transcript.includes(
      "tell me"
    ) ||

    transcript.includes(
      "batao"
    ) ||

    transcript.includes(
      "samjhao"
    ) ||

    transcript.includes(
      "kya hota hai"
    ) ||

    transcript.includes(
      "ka matlab kya hai"
    ) ||

    transcript.includes(
      "क्या है"
    ) ||

    transcript.includes(
      "समझाओ"
    ) ||

    transcript.includes(
      "बताओ"
    ) ||

    transcript.includes(
      "क्या होता है"
    )

  ) {

    askAI(
      transcript
    );

    return;
  }


  // ========================================================
  // BACK CAMERA
  // ========================================================

  if (

    transcript.includes(
      "back camera"
    ) ||

    transcript.includes(
      "बै कैमरा"
    ) ||

    transcript.includes(
      "पीछे का कैमरा"
    ) ||

    transcript.includes(
      "back camera open"
    ) ||

    transcript.includes(
      "back camera kholo"
    ) ||

    transcript.includes(
      "rear camera"
    )

  ) {

    switchCamera(
      "environment"
    );

    return;
  }


  // ========================================================
  // FRONT CAMERA
  // ========================================================

  if (

    transcript.includes(
      "front camera"
    ) ||

    transcript.includes(
      "selfie camera"
    ) ||

    transcript.includes(
      "आगे का कैमरा"
    ) ||

    transcript.includes(
      "फ्रंट कैमरा"
    ) ||

    transcript.includes(
      "front camera open"
    ) ||

    transcript.includes(
      "front camera kholo"
    )

  ) {

    switchCamera(
      "user"
    );

    return;
  }


  // ========================================================
  // SNAPSHOT
  // ========================================================

  if (

    transcript.includes(
      "tasveer lo"
    ) ||

    transcript.includes(
      "tasvir lo"
    ) ||

    transcript.includes(
      "तस्वीर लो"
    ) ||

    transcript.includes(
      "capture"
    ) ||

    transcript.includes(
      "snapshot"
    ) ||

    transcript.includes(
      "तस्वीर"
    )

  ) {

    takeSnapshot();

    return;
  }


  // ========================================================
  // SOS
  // ========================================================

  if (

    transcript.includes(
      "madad chahiye"
    ) ||

    transcript.includes(
      "madad karo"
    ) ||

    transcript.includes(
      "help me"
    ) ||

    transcript ===
      "help" ||

    transcript.includes(
      "मदद करो"
    ) ||

    transcript.includes(
      "मदद चाहिए"
    )

  ) {

    triggerSOS();

    return;
  }


  // ========================================================
  // REMINDER
  // ========================================================

  if (

    transcript.includes(
      "reminder"
    ) ||

    transcript.includes(
      "रिमाइंडर"
    ) ||

    transcript.includes(
      "yaad dilana"
    ) ||

    transcript.includes(
      "याद दिलाना"
    )

  ) {

    handleReminderVoiceCommand(
      transcript
    );

    return;
  }


  // ========================================================
  // MEMORY
  // ========================================================

  if (

    transcript.includes(
      "yaha kya tha"
    ) ||

    transcript.includes(
      "pehle kya tha"
    ) ||

    transcript.includes(
      "pehle kya dekha"
    ) ||

    transcript.includes(
      "यहाँ क्या था"
    ) ||

    transcript.includes(
      "पहले क्या देखा"
    ) ||

    transcript.includes(
      "पहले क्या था"
    )

  ) {

    recallMemory();

    return;
  }


  // ========================================================
  // DETECT
  // ========================================================

  if (

    transcript.includes(
      "detect"
    ) ||

    transcript.includes(
      "aage kya hai"
    ) ||

    transcript.includes(
      "डिटेक्ट"
    ) ||

    transcript.includes(
      "आगे क्या है"
    )

  ) {

    runDetectionOnce();

    return;
  }


  // ========================================================
  // STOP AUTO DETECT
  // ========================================================

  if (

    transcript.includes(
      "band karo"
    ) ||

    transcript.includes(
      "stop auto"
    ) ||

    transcript.includes(
      "स्टॉप"
    ) ||

    transcript.includes(
      "बंद करो"
    )

  ) {

    stopAutoDetect();

    return;
  }


  // ========================================================
  // START AUTO DETECT
  // ========================================================

  if (

    transcript.includes(
      "chalu karo"
    ) ||

    transcript.includes(
      "start auto"
    ) ||

    transcript.includes(
      "चालू करो"
    ) ||

    transcript.includes(
      "स्टार्ट"
    ) ||

    transcript.includes(
      "auto detect"
    )

  ) {

    startAutoDetect();

    return;
  }

}


// ============================================================
// REMINDER VOICE COMMAND
// ============================================================

function handleReminderVoiceCommand(
  transcript
) {

  const numberMatch =
    transcript.match(
      /\d+/
    );


  if (!numberMatch) {

    setOutput(
      "Reminder ke liye number aur minute/second boliye."
    );


    speak(
      "Reminder ke liye number aur minute ya second boliye."
    );


    return;
  }


  const number =
    parseInt(
      numberMatch[0],
      10
    );


  if (
    isNaN(number) ||
    number <= 0
  ) {

    setOutput(
      "Valid reminder time boliye."
    );

    return;
  }


  let seconds;


  // Seconds

  if (

    transcript.includes(
      "second"
    ) ||

    transcript.includes(
      "seconds"
    ) ||

    transcript.includes(
      "sec"
    ) ||

    transcript.includes(
      "सेकंड"
    )

  ) {

    seconds =
      number;

  }


  // Minutes

  else if (

    transcript.includes(
      "minute"
    ) ||

    transcript.includes(
      "minutes"
    ) ||

    transcript.includes(
      "मिनट"
    )

  ) {

    seconds =
      number * 60;

  }


  // Default

  else {

    seconds =
      number;

  }


  speak(
    "Reminder set ho gaya."
  );


  startReminderTimer(
    seconds
  );

}


// ============================================================
// VOICE BUTTON
// ============================================================

if (voiceBtn) {

  voiceBtn.addEventListener(
    "click",
    event => {

      event.preventDefault();


      if (isListening) {

        stopVoiceRecognition();

      } else {

        startVoiceRecognition();

      }

    }
  );

}


// ============================================================
// BUTTON EVENTS
// ============================================================


// Snapshot

if (snapshotBtn) {

  snapshotBtn.addEventListener(
    "click",
    event => {

      event.preventDefault();

      takeSnapshot();

    }
  );

}


// Manual detection

if (manualDetectBtn) {

  manualDetectBtn.addEventListener(
    "click",
    event => {

      event.preventDefault();

      runDetectionOnce();

    }
  );

}


// Start auto detect

if (startAutoDetectBtn) {

  startAutoDetectBtn.addEventListener(
    "click",
    event => {

      event.preventDefault();

      startAutoDetect();

    }
  );

}


// Stop auto detect

if (stopAutoDetectBtn) {

  stopAutoDetectBtn.addEventListener(
    "click",
    event => {

      event.preventDefault();

      stopAutoDetect();

    }
  );

}


// Floating voice button

if (floatingVoice) {

  floatingVoice.addEventListener(
    "click",
    event => {

      event.preventDefault();


      if (voiceBtn) {

        voiceBtn.click();

      }

    }
  );

}


// ============================================================
// THEME
// ============================================================

document.addEventListener(
  "DOMContentLoaded",
  () => {

    const themeToggle =
      document.getElementById(
        "themeToggle"
      );


    if (!themeToggle) return;


    themeToggle.addEventListener(
      "click",
      () => {

        document.body.classList.toggle(
          "light-mode"
        );


        if (
          document.body.classList.contains(
            "light-mode"
          )
        ) {

          themeToggle.innerText =
            "🌞 Dark Mode";

        } else {

          themeToggle.innerText =
            "🌙 Light Mode";

        }

      }
    );

  }
);


// ============================================================
// SOS
// ============================================================

function showSOS() {

  const overlay =
    document.getElementById(
      "sosOverlay"
    );


  if (overlay) {

    overlay.style.display =
      "flex";

  }


  const siren =
    document.getElementById(
      "sirenSound"
    );


  if (siren) {

    try {

      siren.currentTime =
        0;


      const playPromise =
        siren.play();


      if (
        playPromise?.catch
      ) {

        playPromise.catch(
          error => {

            console.warn(
              "Siren warning:",
              error
            );

          }
        );

      }


    } catch (error) {

      console.warn(
        "Siren error:",
        error
      );

    }

  }


  // Vibration

  if (
    navigator.vibrate
  ) {

    navigator.vibrate([

      300,
      200,

      300,
      200,

      600,
      300,

      600

    ]);

  }

}


// ============================================================
// HIDE SOS
// ============================================================

function hideSOS() {

  const overlay =
    document.getElementById(
      "sosOverlay"
    );


  if (overlay) {

    overlay.style.display =
      "none";

  }


  const siren =
    document.getElementById(
      "sirenSound"
    );


  if (siren) {

    try {

      siren.pause();

      siren.currentTime =
        0;

    } catch (error) {

      console.warn(
        "Siren stop warning:",
        error
      );

    }

  }


  if (
    navigator.vibrate
  ) {

    navigator.vibrate(0);

  }

}


// ============================================================
// TRIGGER SOS
// ============================================================

async function triggerSOS() {

  showSOS();


  speak(
    "Madad ke liye sandesh bheja ja raha hai."
  );


  // Location check

  if (!navigator.geolocation) {

    speak(
      "Location support nahi hai."
    );

    return;
  }


  // Backend check

  if (!isApiConfigured()) {

    setOutput(
      "SOS backend URL configure karein."
    );


    console.error(
      "PRODUCTION_API_URL configure karein."
    );

    return;
  }


  navigator.geolocation.getCurrentPosition(

    async position => {

      const latitude =
        position.coords.latitude;


      const longitude =
        position.coords.longitude;


      try {

        const response =
          await fetch(
            `${API_BASE_URL}/sos`,
            {

              method:
                "POST",

              headers: {

                "Content-Type":
                  "application/json"

              },

              body:
                JSON.stringify({

                  latitude,
                  longitude

                })

            }
          );


        if (!response.ok) {

          throw new Error(
            `SOS server error: ${response.status}`
          );

        }


        const data =
          await response.json();


        if (data.success) {

          console.log(
            "SOS sent successfully."
          );


          setOutput(
            "SOS message successfully bhej diya gaya."
          );


          speak(
            "SOS message successfully bhej diya gaya."
          );


          setTimeout(
            () => {

              hideSOS();

            },
            6000
          );


        } else {

          console.error(
            data.error
          );


          setOutput(
            "SOS send nahi hua."
          );


          speak(
            "SOS send nahi hua."
          );

        }


      } catch (error) {

        console.error(
          "SOS error:",
          error
        );


        setOutput(
          "SOS server se connection nahi hua."
        );


        speak(
          "SOS server se connection nahi hua."
        );

      }

    },


    error => {

      console.error(
        "Location error:",
        error
      );


      setOutput(
        "Location permission allow karein."
      );


      speak(
        "Location permission allow karein."
      );

    },


    {

      enableHighAccuracy:
        true,

      timeout:
        15000,

      maximumAge:
        10000

    }

  );

}


// ============================================================
// SOS BUTTON
// ============================================================

if (sosBtn) {

  sosBtn.addEventListener(
    "click",
    event => {

      event.preventDefault();

      triggerSOS();

    }
  );

}


// ============================================================
// MEMORY
// ============================================================

function recallMemory() {

  if (

    !roomMemory ||

    Object.keys(
      roomMemory
    ).length === 0

  ) {

    const message =
      "Abhi tak koi vastu detect nahi hui.";


    setOutput(
      message
    );


    speak(
      message
    );


    return;
  }


  const memoryParts =
    Object.entries(
      roomMemory
    ).map(

      ([label, count]) =>
        `${count} ${label}`

    );


  const sentence =
    `Yaha pehle ${memoryParts.join(", ")} detect hui thi.`;


  setOutput(
    sentence
  );


  speak(
    sentence
  );

}


// ============================================================
// REMINDER TIMER
// ============================================================

function startReminderTimer(
  seconds
) {

  const container =
    document.getElementById(
      "reminderContainer"
    );


  const timer =
    document.getElementById(
      "timerCount"
    );


  const alertSound =
    document.getElementById(
      "alertSound"
    );


  const reminderSound =
    document.getElementById(
      "reminderSound"
    );


  if (
    !container ||
    !timer
  ) {

    console.error(
      "Reminder UI elements not found."
    );

    return;
  }


  // Stop previous timer

  if (reminderInterval) {

    clearInterval(
      reminderInterval
    );


    reminderInterval =
      null;

  }


  seconds =
    Math.max(
      1,
      Math.floor(
        Number(seconds) || 1
      )
    );


  container.style.display =
    "block";


  timer.innerText =
    seconds;


  alertPlayed =
    false;


  reminderInterval =
    setInterval(
      () => {

        seconds--;


        timer.innerText =
          Math.max(
            seconds,
            0
          );


        // ---------------- LAST 5 SECONDS ----------------

        if (
          seconds <= 5 &&
          seconds > 0
        ) {

          container.classList.add(
            "reminder-danger"
          );


          if (
            !alertPlayed &&
            alertSound
          ) {

            try {

              alertSound.currentTime =
                0;


              const playPromise =
                alertSound.play();


              if (
                playPromise?.catch
              ) {

                playPromise.catch(
                  error => {

                    console.warn(
                      "Alert sound warning:",
                      error
                    );

                  }
                );

              }


              alertPlayed =
                true;


            } catch (error) {

              console.warn(
                "Alert sound error:",
                error
              );

            }

          }

        }


        // ---------------- FINISHED ----------------

        if (
          seconds <= 0
        ) {

          clearInterval(
            reminderInterval
          );


          reminderInterval =
            null;


          container.style.display =
            "none";


          container.classList.remove(
            "reminder-danger"
          );


          alertPlayed =
            false;


          // Stop alert

          if (alertSound) {

            try {

              alertSound.pause();

              alertSound.currentTime =
                0;

            } catch (error) {

              console.warn(
                "Alert stop warning:",
                error
              );

            }

          }


          // Final reminder sound

          if (reminderSound) {

            try {

              const playPromise =
                reminderSound.play();


              if (
                playPromise?.catch
              ) {

                playPromise.catch(
                  error => {

                    console.warn(
                      "Reminder sound warning:",
                      error
                    );

                  }
                );

              }

            } catch (error) {

              console.warn(
                "Reminder sound error:",
                error
              );

            }

          }


          speak(
            "Reminder time ho gaya."
          );

        }

      },

      1000

    );

}


// ============================================================
// AI
// ============================================================

async function askAI(
  question
) {

  if (!question) return;


  if (!isApiConfigured()) {

    setOutput(
      "AI backend URL configure karein."
    );


    console.error(
      "PRODUCTION_API_URL configure karein."
    );

    return;
  }


  try {

    setOutput(
      "Soch raha hoon..."
    );


    const response =
      await fetch(
        `${API_BASE_URL}/ask-ai`,
        {

          method:
            "POST",

          headers: {

            "Content-Type":
              "application/json"

          },

          body:
            JSON.stringify({
              question
            })

        }
      );


    if (!response.ok) {

      throw new Error(
        `AI server error: ${response.status}`
      );

    }


    const data =
      await response.json();


    if (data.answer) {

      setOutput(
        data.answer
      );


      speak(
        data.answer
      );


    } else {

      setOutput(
        "AI response nahi mila."
      );

    }


  } catch (error) {

    console.error(
      "AI Error:",
      error
    );


    setOutput(
      "AI server error."
    );

  }

}


// ============================================================
// CLEANUP
// ============================================================

window.addEventListener(
  "beforeunload",
  () => {

    stopAutoDetect();


    isListening =
      false;


    if (recognition) {

      try {

        recognition.stop();

      } catch (error) {

        console.warn(
          "Recognition cleanup warning:",
          error
        );

      }

    }


    if (currentStream) {

      currentStream
        .getTracks()
        .forEach(
          track =>
            track.stop()
        );


      currentStream =
        null;

    }


    stopSpeaking();

  }
);


// ============================================================
// INITIALIZATION
// ============================================================

updateCameraButton();


console.log(
  "NETRA frontend initialized."
);


console.log(
  "API Base URL:",
  API_BASE_URL
);