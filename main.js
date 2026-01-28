const express = require('express');
const multer = require('multer');
const axios = require('axios');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = process.env.PORT || 8000;

// Konfigurasi Multer (Penyimpanan memori)
const upload = multer({
    limits: { fileSize: 20 * 1024 * 1024 } // Batas 20MB
});

app.use(cors());
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash-preview-09-2025";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_PROMPT = `Anda adalah ahli produksi video profesional. Analisis video yang diberikan secara objektif... (sisanya sama dengan prompt Anda)`;

// Fungsi Helper untuk Retry Logic
async function callGeminiWithRetry(videoBase64, mimeType) {
    const retries = 5;
    for (let i = 0; i < retries; i++) {
        try {
            const delay = Math.pow(2, i) * 1000;
            if (i > 0) await new Promise(resolve => setTimeout(resolve, delay));

            const payload = {
                contents: [{
                    parts: [
                        { text: "Analisis video ini sesuai instruksi sistem yang diberikan." },
                        { inlineData: { mimeType: mimeType, data: videoBase64 } }
                    ]
                }],
                systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
                generationConfig: { responseMimeType: "application/json" }
            };

            const response = await axios.post(GEMINI_URL, payload, { timeout: 120000 });
            const jsonText = response.data.candidates[0].content.parts[0].text;
            return JSON.parse(jsonText);

        } catch (error) {
            if (i === retries - 1) throw error;
            console.log(`Retry ${i + 1} failed, retrying...`);
        }
    }
}

app.post('/analyze', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ detail: "File video diperlukan." });

        const videoBase64 = req.file.buffer.toString('base64');
        const mimeType = req.file.mimetype;

        const result = await callGeminiWithRetry(videoBase64, mimeType);
        res.json(result);

    } catch (error) {
        console.error(error);
        res.status(500).json({ detail: error.message || "Gagal memproses AI" });
    }
});

app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});