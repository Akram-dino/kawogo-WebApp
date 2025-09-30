require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const path = require('path');

// Remove this line completely - don't use form-data package
// const FormData = require('form-data');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve frontend files from the frontend directory
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'cd.html'));
});

// File upload setup
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// API endpoint
app.post('/api/analyze', upload.single('image'), async (req, res) => {
  try {
    console.log('Received analyze request');
    
    if (!req.file) {
      console.log('No file uploaded');
      return res.status(400).json({ error: 'No image uploaded' });
    }

    console.log('File received:', req.file.originalname, req.file.size, 'bytes');

    // Check environment variables
    if (!process.env.ROBOFLOW_API) {
      console.error('ROBOFLOW_API environment variable not set');
      return res.status(500).json({ error: 'Roboflow API not configured' });
    }

    // 1. Send to Roboflow
    console.log('Sending to Roboflow...');
    
    // Try base64 encoding first (most common for Roboflow)
    const base64Image = req.file.buffer.toString('base64');
    
    const roboflowResponse = await axios.post(
      process.env.ROBOFLOW_API,
      base64Image,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 30000 // 30 second timeout
      }
    );

    console.log('Roboflow response:', roboflowResponse.data);

    const diseaseCode = roboflowResponse.data.predictions?.[0]?.class || "Healthy";
    const confidence = roboflowResponse.data.predictions?.[0]?.confidence
      ? Math.round(roboflowResponse.data.predictions[0].confidence * 100)
      : "N/A";

    console.log('Disease detected:', diseaseCode, 'Confidence:', confidence);

    // 2. Get advice from Gemini or use fallback
    let advice;
    if (diseaseCode === "Healthy") {
      advice = "No treatment needed! Your plant looks healthy.";
      console.log('Using healthy plant message');
    } else {
      try {
        if (!process.env.GEMINI_API_KEY) {
          console.warn('Gemini API key not set, using fallback advice');
          advice = getFallbackAdvice(diseaseCode);
        } else {
          console.log('Gemini API key found, attempting to get advice from Gemini...');
          console.log('Disease detected for Gemini:', diseaseCode);
          
          const geminiResponse = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
  contents: [{
    parts: [{
      text: `You are an agricultural assistant focusing on cassava. 
Always interpret abbreviations as cassava-related diseases only:

- CBSD = Cassava Brown Streak Disease
- CMD = Cassava Mosaic Disease
- CGM = Cassava Green Mite
- CBB = Cassava Bacterial Blight

Now, explain the disease ${diseaseCode} in simple language for farmers in 2–3 sentences: 
1) Symptoms 
2) Treatment or management practices`
    }]
  }]
},
            {
              headers: {
                'Content-Type': 'application/json'
              },
              timeout: 15000 // 15 second timeout
            }
          );
          
          console.log('Gemini response received successfully');
          advice = geminiResponse.data.candidates[0].content.parts[0].text;
          console.log('Gemini advice:', advice.substring(0, 50) + '...');
        }
      } catch (geminiError) {
        console.warn('Gemini request failed:', geminiError.response?.data || geminiError.message);
        console.log('Falling back to predefined advice');
        advice = getFallbackAdvice(diseaseCode);
      }
    }

    console.log('Sending response...');
    res.json({
      disease: diseaseCode,
      confidence,
      advice
    });

  } catch (error) {
    console.error('Analysis error:', error.response?.data || error.message);
    
    // More specific error messages
    if (error.code === 'ECONNREFUSED') {
      res.status(503).json({ error: 'External service unavailable. Please try again later.' });
    } else if (error.response?.status === 401) {
      res.status(500).json({ error: 'API authentication failed. Please check configuration.' });
    } else if (error.response?.status === 429) {
      res.status(429).json({ error: 'Rate limit exceeded. Please wait and try again.' });
    } else {
      res.status(500).json({ 
        error: 'Analysis failed', 
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
});

// Fallback advice function
function getFallbackAdvice(diseaseCode) {
  const diseaseMap = {
    "CBB": {
      advice: "Cassava Bacterial Blight: Remove infected leaves, improve drainage, and spray with copper-based solutions."
    },
    "CMD": {
      advice: "Cassava Mosaic Disease: Uproot infected plants and use clean cuttings from resistant varieties."
    },
    "CBSD": {
      advice: "Cassava Brown Streak Disease: Destroy infected plants and rotate crops for 2 years."
    }
  };
  
  return diseaseMap[diseaseCode]?.advice || 
    `${diseaseCode} detected. Consult your local agriculture officer for diagnosis and treatment.`;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Kawogo Care Server is running',
    env: {
      roboflow: !!process.env.ROBOFLOW_API,
      gemini: !!process.env.GEMINI_API_KEY
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
  }
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Serving frontend from: ${frontendPath}`);
  console.log('Environment check:');
  console.log('- Roboflow API:', process.env.ROBOFLOW_API ? 'Configured' : 'Missing');
  console.log('- Gemini API:', process.env.GEMINI_API_KEY ? 'Configured' : 'Missing');
});