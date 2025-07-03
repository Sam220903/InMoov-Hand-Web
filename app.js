import {
  GestureRecognizer,
  FilesetResolver,
  DrawingUtils
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

const demosSection = document.getElementById("demos");
let gestureRecognizer;
let runningMode = "IMAGE";
let enableWebcamButton;
let webcamRunning = false;
const videoHeight = "360px";
const videoWidth = "480px";

// Dictionary to map gesture names to their corresponding in Spanish names
const gestureList = {
  "None" : "-",
  "Unknown" : "Desconocido",
  "Closed_Fist": "Puño cerrado",
  "Open_Palm": "Palma abierta",
  "Pointing_Up": "Apuntando hacia arriba",
  "Thumb_Down": "Pulgar abajo",
  "Thumb_Up": "Pulgar arriba",
  "Victory": "Victoria",
  "ILoveYou": "Te quiero",
  "Left" : "Derecha",
  "Right" : "Izquierda",
}

// Before we can use HandLandmarker class we must wait for it to finish
// loading. Machine Learning models can be large and take a moment to
// get everything needed to run.
const createGestureRecognizer = async () => {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
  );
  gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
      delegate: "GPU"
    },
    runningMode: runningMode
  });
};
createGestureRecognizer();


/********************************************************************
// Demo 2: Continuously grab image from webcam stream and detect it.
********************************************************************/

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const raisedHandOutput = document.getElementById("raised_hand");
const gestureOutput = document.getElementById("gesture_output");
const fingersNumberOutput = document.getElementById("fingers_number");

// Check if webcam access is supported.
function hasGetUserMedia() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

// If webcam supported, add event listener to button for when user
// wants to activate it.
if (hasGetUserMedia()) {
  enableWebcamButton = document.getElementById("webcamButton");
  enableWebcamButton.addEventListener("click", enableCam);
} else {
  console.warn("getUserMedia() is not supported by your browser");
}

// Enable the live webcam view and start detection.
function enableCam(event) {
  if (!gestureRecognizer) {
    alert("Please wait for gestureRecognizer to load");
    return;
  }

  if (webcamRunning === true) {
    webcamRunning = false;
    enableWebcamButton.innerText = "Habilitar reconocimiento";
    
  } else {
    webcamRunning = true;
    enableWebcamButton.innerText = "Deshabilitar reconocimiento";
  }

  // getUsermedia parameters.
  const constraints = {
    video: true
  };

  // Activate the webcam stream.
  navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
    video.srcObject = stream;
    video.addEventListener("loadeddata", predictWebcam);
  });
}

let lastVideoTime = -1;
let results = undefined;

// Función para detectar el estado de cada dedo (1 = levantado, 0 = cerrado)
// Retorna array de 5 elementos: [pulgar, índice, medio, anular, meñique]
function getFingerStates(landmarks) {
  if (!landmarks || landmarks.length === 0) {
    return [0, 0, 0, 0, 0]; // Todos cerrados si no hay landmarks
  }
  
  const hand = landmarks[0]; // Tomar la primera mano detectada
  const fingerStates = [0, 0, 0, 0, 0]; // [pulgar, índice, medio, anular, meñique]
  
  // Índices de los landmarks para las puntas y articulaciones de los dedos
  const fingerTips = [4, 8, 12, 16, 20]; // Puntas: Pulgar, índice, medio, anular, meñique
  const fingerPips = [3, 6, 10, 14, 18]; // Articulaciones intermedias
  
  // Verificar cada dedo
  for (let i = 0; i < fingerTips.length; i++) {
    if (i === 0) { 
      // Pulgar (lógica especial mejorada)
      const tipX = hand[fingerTips[i]].x;
      const tipY = hand[fingerTips[i]].y;
      const ip = hand[3]; // Articulación interfalángica del pulgar
      const mcp = hand[2]; // Articulación metacarpo-falángica del pulgar
      const cmc = hand[1]; // Base del pulgar
      
      // Verificar si el pulgar está extendido usando múltiples criterios
      const isExtended = (
        // Criterio 1: La punta está más lejos de la base que la articulación intermedia
        Math.sqrt((tipX - cmc.x)**2 + (tipY - cmc.y)**2) > 
        Math.sqrt((ip.x - cmc.x)**2 + (ip.y - cmc.y)**2) * 1.1
      ) && (
        // Criterio 2: La punta no está muy cerca del centro de la palma
        Math.sqrt((tipX - hand[9].x)**2 + (tipY - hand[9].y)**2) > 0.06
      );
      
      if (isExtended) {
        fingerStates[i] = 1;
      }
    } else { 
      // Otros dedos (se mueven verticalmente)
      const tipY = hand[fingerTips[i]].y;
      const pipY = hand[fingerPips[i]].y;
      
      // El dedo está levantado si la punta está por encima de la articulación
      if (tipY < pipY) {
        fingerStates[i] = 1;
      }
    }
  }
  
  return fingerStates;
}



async function predictWebcam() {
  const webcamElement = document.getElementById("webcam");
  // Now let's start detecting the stream.
  if (runningMode === "IMAGE") {
    runningMode = "VIDEO";
    await gestureRecognizer.setOptions({ runningMode: "VIDEO" });
  }
  let nowInMs = Date.now();
  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    results = gestureRecognizer.recognizeForVideo(video, nowInMs);
  }

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  const drawingUtils = new DrawingUtils(canvasCtx);

  canvasElement.style.height = videoHeight;
  webcamElement.style.height = videoHeight;
  canvasElement.style.width = videoWidth;
  webcamElement.style.width = videoWidth;

  if (results.landmarks) {
    for (const landmarks of results.landmarks) {
      drawingUtils.drawConnectors(
        landmarks,
        GestureRecognizer.HAND_CONNECTIONS,
        {
          color: "#00FF00",
          lineWidth: 5
        }
      );
      drawingUtils.drawLandmarks(landmarks, {
        color: "#FF0000",
        lineWidth: 2
      });
    }
  }
  canvasCtx.restore();
  
  // Obtener estados de los dedos si hay landmarks disponibles
  let fingerStates = [0, 0, 0, 0, 0];
  if (results.landmarks && results.landmarks.length > 0) {
    fingerStates = getFingerStates(results.landmarks);
    sendDataToSerial("$" + getFingerStates(results.landmarks).join(""));
  }


  
  if (results.gestures.length > 0) {
    const categoryName = results.gestures[0][0].categoryName;
    const categoryScore = parseFloat(
      results.gestures[0][0].score * 100
    ).toFixed(2);
    const handedness = results.handednesses[0][0].displayName;

    if (categoryName === 'Closed_Fist') {
      fingerStates = [0, 0, 0, 0, 0]; // Todos los dedos cerrados
    }
    
    // Mostrar información del gesto y estados de dedos
    raisedHandOutput.innerText = `${gestureList[handedness] || handedness}`;
    gestureOutput.innerText = `${gestureList[categoryName] || categoryName}`;
    fingersNumberOutput.innerText = `${fingerStates.reduce((sum, state) => sum + state, 0)}`;
    console.log("Estados de los dedos:", [fingerStates.join(", ")]);
   }
      // Call this function again to keep predicting when the browser is ready.
      if (webcamRunning === true) {
        window.requestAnimationFrame(predictWebcam);
      }
}


// ----------------- Serial Communication -----------------


const serialConnectionButton = document.getElementById("serialConnection");
serialConnectionButton.addEventListener("click", connectSerial);


let serialPort = null;

async function connectSerial() {
  if (!navigator.serial) {
    alert("Web Serial API is not supported.");
    return;
  }

  try {
    serialPort = await navigator.serial.requestPort();
    await serialPort.open({ baudRate: 9600 });
    console.log("Serial connected.");
  } catch (err) {
    console.error("Serial connection failed:", err);
  }
}

// Send data to the serial port
async function sendDataToSerial(data) {
  if (!serialPort || !serialPort.writable) {
    console.warn("Serial port not open.");
    return;
  }

  const writer = serialPort.writable.getWriter();
  await writer.write(new TextEncoder().encode(data));
  writer.releaseLock();
}




