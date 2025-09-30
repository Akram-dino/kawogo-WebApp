const FormData = require('form-data');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const path = require('path');
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
const upload = multer({ storage: multer.memoryStorage() });

// API endpoint
app.post('/api/analyze', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    // 1. Send to Roboflow
    const roboform = new FormData();
    roboform.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });

    const roboflowResponse = await axios.post(
      process.env.ROBOFLOW_API,
      roboform,
      { headers: roboform.getHeaders() }
    );

    const diseaseCode = roboflowResponse.data.predictions?.[0]?.class || "Healthy";
    const confidence = roboflowResponse.data.predictions?.[0]?.confidence 
      ? Math.round(roboflowResponse.data.predictions[0].confidence * 100) 
      : "N/A";

    // 2. Get advice from OpenAI
    let advice;
    if (diseaseCode === "Healthy") {
      advice = "No treatment needed! Your plant looks healthy.";
    } else {
      const openaiResponse = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: "gpt-3.5-turbo",
          messages: [{
            role: "user",
            content: `Explain cassava disease ${diseaseCode} simply: 1) Symptoms 2) Treatment`
          }],
          temperature: 0.7,
          max_tokens: 100
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      advice = openaiResponse.data.choices[0].message.content;
    }

    res.json({
      disease: diseaseCode,
      confidence,
      advice
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Kawogo Care Server is running' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Serving frontend from: ${frontendPath}`);
});