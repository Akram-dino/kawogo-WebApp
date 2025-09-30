// Configuration (will be handled by backend)
const BACKEND_API = "http://localhost:5000/api/analyze"; // Your Node.js backend endpoint

// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const uploadBtn = document.getElementById('uploadBtn');
const imageUpload = document.getElementById('imageUpload');
const imagePreview = document.getElementById('imagePreview');
const analyzeBtn = document.getElementById('analyzeBtn');
const cameraBtn = document.getElementById('cameraBtn');
const captureBtn = document.getElementById('captureBtn');
const cameraFeed = document.getElementById('cameraFeed');

// Handle click on upload area
uploadArea.addEventListener('click', () => imageUpload.click());
uploadBtn.addEventListener('click', () => imageUpload.click());

// Handle file selection
imageUpload.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    
    reader.onload = function(event) {
      imagePreview.src = event.target.result;
      imagePreview.style.display = 'block';
      analyzeBtn.disabled = false;
      uploadArea.classList.add('active');
      
      // Update upload area text
      uploadArea.querySelector('h3').textContent = 'Image Selected';
      uploadArea.querySelector('p').textContent = file.name;
    }
    
    reader.readAsDataURL(file);
  }
});

// Drag and drop functionality
uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('active');
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('active');
});

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('active');
  
  const file = e.dataTransfer.files[0];
  if (file && file.type.match('image.*')) {
    imageUpload.files = e.dataTransfer.files;
    const event = new Event('change');
    imageUpload.dispatchEvent(event);
  }
});

// Camera functionality
cameraBtn.addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'environment' } 
    });
    
    cameraFeed.srcObject = stream;
    cameraFeed.style.display = 'block';
    imagePreview.style.display = 'none';
    captureBtn.style.display = 'inline-block';
    analyzeBtn.style.display = 'none';
    
    uploadArea.querySelector('h3').textContent = 'Camera Ready';
    uploadArea.querySelector('p').textContent = 'Position the leaf and click Capture';
    
  } catch (err) {
    console.error("Camera error:", err);
    alert("Could not access the camera. Please check permissions.");
  }
});

// Capture image from camera
captureBtn.addEventListener('click', () => {
  const canvas = document.createElement('canvas');
  canvas.width = cameraFeed.videoWidth;
  canvas.height = cameraFeed.videoHeight;
  canvas.getContext('2d').drawImage(cameraFeed, 0, 0);
  
  canvas.toBlob((blob) => {
    const file = new File([blob], 'captured-image.jpg', { type: 'image/jpeg' });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    imageUpload.files = dataTransfer.files;
    
    // Trigger the image preview update
    const event = new Event('change');
    imageUpload.dispatchEvent(event);
    
    // Clean up camera
    cameraFeed.srcObject.getTracks().forEach(track => track.stop());
    cameraFeed.style.display = 'none';
    captureBtn.style.display = 'none';
    analyzeBtn.style.display = 'inline-block';
  }, 'image/jpeg', 0.9);
});

// Main analysis function
async function analyzeImage() {
    const file = imageUpload.files[0];
    if (!file) return;
    
    // Show loading state
    document.getElementById('loadingIndicator').style.display = 'block';
    document.getElementById('prediction').style.display = 'none';
    document.getElementById('advice').style.display = 'none';
    
    try {
        // Create FormData and send to backend
        const formData = new FormData();
        formData.append('image', file);
        
        const response = await fetch(BACKEND_API, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(await response.text());
        }
        
        const { disease, confidence, advice } = await response.json();
        
        // Display results
        document.getElementById('predictionText').innerHTML = `
            <strong>${disease}</strong> detected with <strong>${confidence}%</strong> confidence.
        `;
        document.getElementById('adviceText').textContent = advice;
        
        document.getElementById('prediction').style.display = 'block';
        document.getElementById('advice').style.display = 'block';
        
    } catch (error) {
        console.error("Error:", error);
        document.getElementById('predictionText').innerHTML = `
            <span style="color: var(--error);">${error.message || "Error processing image"}</span>
        `;
        document.getElementById('prediction').style.display = 'block';
    } finally {
        document.getElementById('loadingIndicator').style.display = 'none';
    }
}

// Connect analyze button
analyzeBtn.addEventListener('click', analyzeImage);

// Fallback data (in case backend fails during development)
function getFallbackData(code) {
    const diseaseMap = {
        "CBB": {
            fullName: "Cassava Bacterial Blight",
            advice: "Remove infected leaves, improve drainage, and spray with copper-based solutions."
        },
        "CMD": {
            fullName: "Cassava Mosaic Disease",
            advice: "Uproot infected plants and use clean cuttings from resistant varieties."
        },
        "CBSD": {
            fullName: "Cassava Brown Streak Disease",
            advice: "Destroy infected plants and rotate crops for 2 years."
        },
        "Healthy": {
            fullName: "Healthy Cassava Plant",
            advice: "No treatment needed! Your plant looks healthy."
        }
    };
    
    return diseaseMap[code] || {
        fullName: code || "Unknown",
        advice: "Consult your local agriculture officer for diagnosis and treatment."
    };
}