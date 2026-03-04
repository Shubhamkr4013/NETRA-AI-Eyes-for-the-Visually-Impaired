const startBtn = document.getElementById("startBtn");
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const output = document.getElementById("output");
const snapshotBtn = document.getElementById("snapshotBtn");
const voiceBtn = document.getElementById("voiceBtn");
const manualDetectBtn = document.getElementById("manualDetectBtn");
const startAutoDetectBtn = document.getElementById("startAutoDetectBtn");
const stopAutoDetectBtn = document.getElementById("stopAutoDetectBtn");
let autoDetectInterval = null;
let isDetecting = false;
let currentFacingMode = "environment"; // default back camera
let currentStream = null;
let roomMemory = {};


//Camera Switch Function
async function switchCamera(mode) {
  try {
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
    }

    currentFacingMode = mode;
   

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: currentFacingMode
      },
      audio: false
    });

    currentStream = stream;
    video.srcObject = stream;

    console.log("Camera switched to:", currentFacingMode);

  } catch (error) {
    console.error("Camera switch error:", error);
  }
}

// Start webcam
// Start / Switch webcam
startBtn.addEventListener("click", async (event) => {
  event.preventDefault();

  try {

    // Agar pehle se camera chal raha hai to stop karo
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
    }

    // Toggle camera (back ↔ front)
    currentFacingMode = currentFacingMode === "environment"
      ? "user"
      : "environment";

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: currentFacingMode
      },
      audio: false
    });

    currentStream = stream;
    video.srcObject = stream;

    console.log("Camera switched to:", currentFacingMode);

    // Button text change
    startBtn.innerText =
      currentFacingMode === "environment"
        ? "📷Switch to Front Camera"
        : "📷Switch to Back Camera";

  } catch (error) {
    alert("Camera access error!");
    console.error(error);
  }
});

// One-time detection
async function runDetectionOnce() {
  if (isDetecting) return;
  if (video.readyState < 2) return;

  isDetecting = true;
  output.innerText = "Detecting...";

  try {
    const ctx = canvas.getContext("2d");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const blob = await new Promise(resolve =>
      canvas.toBlob(resolve, "image/jpeg")
    );

    const formData = new FormData();
    formData.append("image", blob, "frame.jpg");

    const res = await fetch("http://10.30.229.68:5000/detect", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) throw new Error("Server error");

    const data = await res.json();
    narrateDetection(data);

  } catch (err) {
    console.error(err);
    output.innerText = "Detection failed.";
  }

  isDetecting = false;
}

// Helper function to estimate distance based on bounding box size
function estimateDistance(width, frameWidth, objectHeight) {
  // Calculate relative size of object in frame
  const relativeSize = width / frameWidth;
  
  // Base distance estimation on relative size
  // These thresholds are approximate and may need calibration
  if (relativeSize > 0.4) return 0.5;  // Very close
  else if (relativeSize > 0.3) return 1.0;  // Close
  else if (relativeSize > 0.2) return 1.5;  // Medium
  else if (relativeSize > 0.1) return 2.0;  // Far
  else return 3.0;  // Very far
}

// Narration logic with distance estimation and object-specific descriptions
function narrateDetection(data) {
  const frameWidth = video.videoWidth;
  if (!data.detections || data.detections.length === 0) {
    output.innerText = "Kuch bhi nahi mila.";
    const utteranceNone = new SpeechSynthesisUtterance("Kuch bhi nahi mila.");
    utteranceNone.lang = "hi-IN";
    speechSynthesis.speak(utteranceNone);
    return;
  }

  // Helper function to get Hindi label
  function getHindiLabel(label) {
    switch (label) {
      case "person": return "vyakti";
      case "car": return "gaadi";
      case "bottle": return "botal";
      case "chair": return "kursi";
      case "cell phone": return "mobile phone";
      case "dog": return "kutta";
      case "cat": return "billi";
      case "handbag": return "bag";
      default: return label;
    }
  }

  // Group objects by type and collect individual descriptions
  const objectCounts = {};
  const objectDescriptions = [];
  
  data.detections.forEach(d => {
    const hindiLabel = getHindiLabel(d.label);
    
    // Count objects
    if (!objectCounts[hindiLabel]) {
      objectCounts[hindiLabel] = 0;
    }
    objectCounts[hindiLabel]++;
    
    // Get position and proximity
    const [x1, y1, x2, y2] = d.box;
    const centerX = (x1 + x2) / 2;
    const width = x2 - x1;
    const height = y2 - y1;
    
    let direction = "aage";
    if (centerX < frameWidth * 0.33) direction = "left mein";
    else if (centerX > frameWidth * 0.66) direction = "right mein";
    
    // Estimate distance for all objects
    const distance = estimateDistance(width, frameWidth, height);
    
    // Create individual description with object type
    objectDescriptions.push(`ek ${hindiLabel} ${direction} ${distance} meter dur hai`);
  });

  // 🔥 Store detected objects in memory
   roomMemory = { ...objectCounts };

  // Build the count part
  let countParts = [];
  for (const [label, count] of Object.entries(objectCounts)) {
    countParts.push(`${count} ${label}`);
  }
  const countSentence = countParts.join(", ");
  
  // Build the description part
  const descriptionSentence = objectDescriptions.join(", ");
  
  // Combine into final narration
  const hindiSentence = `Aapke saamne ${countSentence} hai, ${descriptionSentence}.`;
  output.innerText = hindiSentence;
  
  const utterance = new SpeechSynthesisUtterance(hindiSentence);
  utterance.lang = "hi-IN";
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

// Auto detection loop
function startAutoDetect() {
  if (autoDetectInterval) {
    console.log("Auto detect already running");
    return;
  }
  console.log("Starting auto detect");
  runDetectionOnce();
  autoDetectInterval = setInterval(runDetectionOnce, 15000); // Every 15 seconds
}

function stopAutoDetect() {
  if (!autoDetectInterval) {
    console.log("Auto detect not running");
    return;
  }
  clearInterval(autoDetectInterval);
  autoDetectInterval = null;
  console.log("Auto detect stopped");
}

// Snapshot
function takeSnapshot() {
  if (video.readyState < 2) {
    alert("Video not ready for snapshot");
    return;
  }
  const ctx = canvas.getContext("2d");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const link = document.createElement("a");
  canvas.toBlob((blob) => {
    link.href = URL.createObjectURL(blob);
    link.download = "snapshot.jpg";
    link.click();
  }, "image/jpeg");
}

// Voice command input
let recognition;
let isListening = false;
voiceBtn.addEventListener("click", () => {
  if (isListening) {
    recognition.stop();
    isListening = false;
    voiceBtn.innerText = "🎤 Start Voice Command";
    console.log("Voice recognition stopped manually");
    return;
  }
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Speech recognition not supported in this browser.");
    return;
  }
  recognition = new SpeechRecognition();
  recognition.lang = "hi-IN";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.continuous = true;
  recognition.onstart = () => {
    isListening = true;
    voiceBtn.innerText = "🛑 Stop Voice Command";
    console.log("🎤 Voice recognition started");
  };
  recognition.onresult = (event) => {
    let transcript = event.results[event.results.length - 1][0].transcript
        .toLowerCase()
        .trim()
        .replace(/[.,!?]/g, ""); // remove punctuation
    
    console.log("Voice input:", transcript);
    output.innerText = `Aapne kaha: "${transcript}"`;


    // 🤖 AI Query Mode
if (
  transcript.includes("what is") ||
  transcript.includes("वॉट इज़") ||
  transcript.includes("explain") ||
  transcript.includes("एक्सप्लेन ") ||
  transcript.includes("tell me") ||
  transcript.includes("batao") ||
  transcript.includes("samjhao") ||
  transcript.includes("kya hota hai") ||
  transcript.includes("ka matlab kya hai") ||
  transcript.includes("क्या है") ||
  transcript.includes("समझाओ") ||
  transcript.includes("बताओ") ||
  transcript.includes("क्या होता है")
) {
  askAI(transcript);
}


    // Camera voice commands
else if (
    transcript.includes("back camera") ||
    transcript.includes("rear camera") ||
    transcript.includes("पीछे का कैमरा") ||
    transcript.includes("back camera open")
) {
    switchCamera("environment");
}

else if (
    transcript.includes("front camera") ||
    transcript.includes("selfie camera") ||
    transcript.includes("आगे का कैमरा") ||
    transcript.includes("front camera open")
) {
    switchCamera("user");
}

    // Snapshot
    if (
        transcript.includes("tasveer lo") || 
        transcript.includes("tasvir lo") ||
        transcript.includes("तस्वीर लो") ||
        transcript.includes("Capture") ||
        transcript.includes("Snapshot") ||
        transcript.includes("तस्वीर")
    ) {
        takeSnapshot();
    }
    // Emergency
    else if (
    transcript.includes("madad chahiye") || 
    transcript.includes("madad karo") ||
    transcript.includes("help me") || 
    transcript.includes("help") ||
    transcript.includes("मदद करो") ||
    transcript.includes("ल्प मी") ||
    transcript.includes("मदद चाहिए")
) {
    triggerSOS();
}



// Reminder command
else if (
transcript.includes("reminder") ||
transcript.includes("रिमाइंडर ") ||
transcript.includes("yaad dilana") ||
transcript.includes("याद दिलाना")
){

const number = parseInt(transcript);

if(!isNaN(number)){

let seconds;


// seconds detection
if(
transcript.includes("second") ||
transcript.includes("seconds") ||
transcript.includes("sec") ||
transcript.includes("सेकंड")
){
seconds = number;
}

// minutes detection
else if(
transcript.includes("minute") ||
transcript.includes("minutes") ||
transcript.includes("मिनट")
){
seconds = number * 60;
}

else{

// default seconds for testing
seconds = number;

}

speechSynthesis.speak(
new SpeechSynthesisUtterance("Reminder set ho gaya")
);

startReminderTimer(seconds);

}

}


//memory store call
else if (
    transcript.includes("yaha kya tha") ||
    transcript.includes("pehle kya tha") ||
    transcript.includes("pehle kya dekha") ||
    transcript.includes("यहाँ क्या था") ||
    transcript.includes("पहले क्या देखा") ||
    transcript.includes("पहले क्या था")
) {
    recallMemory();
}

    // One-time detect
    else if (
      
        transcript.includes("detect") ||
        transcript.includes("aage kya hai") ||
        transcript.includes("डिटेक्ट") ||
        transcript.includes("आगे क्या है")
    ) {
        runDetectionOnce();
    }
    // Stop auto detect
    else if (
        transcript.includes("band karo") || 
        transcript.includes("stop") ||
        transcript.includes("स्टॉप") ||
        transcript.includes("बंद करो")
    ) {
        stopAutoDetect();
        recognition.stop();
    }


    // Start auto detect
    else if (
        transcript.includes("chalu karo") || 
        transcript.includes("start") || 
        transcript.includes("चालू करो") ||
        transcript.includes("स्टार्ट") ||
        transcript.includes("Auto Detect")
    ) {
        startAutoDetect();
    }
};

  recognition.onerror = (e) => {
    console.error("Voice command error:", e.error);
    output.innerText = "Voice command failed.";
  };
  recognition.onend = () => {
    console.log("Voice recognition ended");
    if (isListening) {
      recognition.start(); // restart automatically if still in listening mode
    }
  };
  recognition.start();
});

// Button click bindings with preventDefault
snapshotBtn.addEventListener("click", (e) => {
  e.preventDefault();
  takeSnapshot();
});
manualDetectBtn.addEventListener("click", (e) => {
  e.preventDefault();
  runDetectionOnce();
});
startAutoDetectBtn.addEventListener("click", (e) => {
  e.preventDefault();
  startAutoDetect();
});
stopAutoDetectBtn.addEventListener("click", (e) => {
  e.preventDefault();
  stopAutoDetect();
});

// Floating voice button trigger
const floatingVoice = document.getElementById("floatingVoice");

if (floatingVoice) {
  floatingVoice.addEventListener("click", () => {
    voiceBtn.click(); 
  });
}

document.addEventListener("DOMContentLoaded", () => {

  const themeToggle = document.getElementById("themeToggle");

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      document.body.classList.toggle("light-mode");

      // Button icon change
      if (document.body.classList.contains("light-mode")) {
        themeToggle.innerText = "🌞 Dark Mode";
      } else {
        themeToggle.innerText = "🌙 Light Mode";
      }
    });
  }

});

//showSOS
function showSOS() {
  const overlay = document.getElementById("sosOverlay");
  if (overlay) {
    overlay.style.display = "flex";
  }
  const siren = document.getElementById("sirenSound");

  if (siren) {
  siren.currentTime = 0;
  siren.play();
  }

  // Strong emergency vibration pattern
  if (navigator.vibrate) {
    navigator.vibrate([
      300, 200,
      300, 200,
      600, 300,
      600
    ]);
  }
}

//triggerSOS
async function triggerSOS() {

  showSOS(); // visual popup

  const utter = new SpeechSynthesisUtterance("Madad ke liye sandesh bheja ja raha hai");
  utter.lang = "hi-IN";
  speechSynthesis.speak(utter);

  if (!navigator.geolocation) {
    speechSynthesis.speak(
        new SpeechSynthesisUtterance("Location support nahi hai")
    );
    return;
}

  navigator.geolocation.getCurrentPosition(async (position) => {

    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;

    try {
      const response = await fetch("http://10.30.229.68:5000/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude, longitude })
      });

      const data = await response.json();
      if (data.success) {

  console.log("SOS sent");

  if (navigator.vibrate) {
    navigator.vibrate(0);
  }

  setTimeout(() => {
    const overlay = document.getElementById("sosOverlay");
    if (overlay) overlay.style.display = "none";
    const siren = document.getElementById("sirenSound");
    if (siren) {
      siren.pause();
      siren.currentTime = 0;
      }
  }, 6000);
}
      else {
  console.error(data.error);
}

    } catch (error) {
      console.error(error);
    }

  });
}

const sosBtn = document.getElementById("sosBtn");

if (sosBtn) {
  sosBtn.addEventListener("click", (e) => {
    e.preventDefault();
    triggerSOS();
  });
}


function recallMemory() {

  if (!roomMemory || Object.keys(roomMemory).length === 0) {
    const msg = "Abhi tak koi vastu detect nahi hui.";
    output.innerText = msg;

    const utter = new SpeechSynthesisUtterance(msg);
    utter.lang = "hi-IN";
    speechSynthesis.speak(utter);
    return;
  }

  let memoryParts = [];

  for (const [label, count] of Object.entries(roomMemory)) {
    memoryParts.push(`${count} ${label}`);
  }

  const sentence = `Yaha pehle ${memoryParts.join(", ")} detect hui thi.`;

  output.innerText = sentence;

  const utter = new SpeechSynthesisUtterance(sentence);
  utter.lang = "hi-IN";
  speechSynthesis.speak(utter);
}



// Reminder Timer System
let reminderInterval;
let alertPlayed = false;

function startReminderTimer(seconds){

const container = document.getElementById("reminderContainer");
const timer = document.getElementById("timerCount");

const alertSound = document.getElementById("alertSound");
const reminderSound = document.getElementById("reminderSound");

container.style.display = "block";
timer.innerText = seconds;

alertPlayed = false;

reminderInterval = setInterval(()=>{

seconds--;

timer.innerText = seconds;


// 🔴 Last 5 seconds alert
if(seconds <=5 && seconds >0){

container.classList.add("reminder-danger");

if(!alertPlayed){

alertSound.currentTime = 0;
alertSound.play();

alertPlayed = true;

}

}


// ⏰ Reminder finished
if(seconds <=0){

clearInterval(reminderInterval);

container.style.display = "none";

container.classList.remove("reminder-danger");

alertPlayed = false;


// 🔇 STOP ALERT SOUND
if(alertSound){
alertSound.pause();
alertSound.currentTime = 0;
}


// 🔔 FINAL REMINDER SOUND
if(reminderSound){
reminderSound.play();
}

speechSynthesis.speak(
new SpeechSynthesisUtterance("Reminder time ho gaya")
);

}

},1000);

}




// AI Function

async function askAI(question) {

  try {

    output.innerText = "Soch raha hoon...";

    const response = await fetch("http://127.0.0.1:5000/ask-ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      
      body: JSON.stringify({ question })
    });

    const data = await response.json();

    if (data.answer) {

      output.innerText = data.answer;

      const utter = new SpeechSynthesisUtterance(data.answer);
      utter.lang = "hi-IN";
      speechSynthesis.speak(utter);

    } else {

      output.innerText = "AI response nahi mila.";

    }

  } catch (error) {

    console.error("AI Error:", error);
    output.innerText = "AI server error.";

  }
}