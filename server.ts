import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Initialize Gemini SDK with telemetry User-Agent
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey
  ? new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// Endpoint for AI Subtask Generation (Pecah Tugasan)
app.post('/api/pecah-tugasan', async (req, res) => {
  if (!ai) {
    return res.status(500).json({
      error: 'Konfigurasi AI tidak dijumpai. Sila pastikan rahsia GEMINI_API_KEY telah ditetapkan.',
    });
  }

  const { tajuk, huraian } = req.body;
  if (!tajuk) {
    return res.status(400).json({ error: 'Tajuk tugasan diperlukan' });
  }

  try {
    const prompt = `Anda adalah pembantu pengurusan masa produktif. Pecahkan tugasan harian berikut kepada 3 hingga 5 langkah subtugasan (checklist) yang ringkas, praktikal, dan jelas dalam Bahasa Melayu.
    
    TUGASAN: "${tajuk}"
    ${huraian ? `HURAIAN: "${huraian}"` : ''}
    
    Tuliskan langkah-langkah tersebut secara terus-terang dan pastikan setiap satu bermula dengan kata kerja ringkas (cth: 'Sediakan', 'Semak', 'Draf', 'Beli', 'Hantar'). Sila pulangkan jawapan dalam format senarai JSON yang sah.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
          },
          description: "Senarai langkah subtugasan praktikal harian dalam Bahasa Melayu.",
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Jawapan daripada AI adalah kosong.');
    }

    const subtasks = JSON.parse(text.trim());
    return res.json({ subtasks });
  } catch (err: any) {
    console.error('Error generating subtasks:', err);
    return res.status(500).json({
      error: 'Gagal menjana subtugasan AI. ' + (err.message || ''),
    });
  }
});

// Endpoint for Productivity Tips / Coach Advice (Tips Harian)
app.post('/api/tips-harian', async (req, res) => {
  if (!ai) {
    return res.status(500).json({
      error: 'Konfigurasi AI tidak dijumpai.',
    });
  }

  const { totalTasks, completedTasks, columnsCount } = req.body;

  try {
    const prompt = `Anda adalah penasihat produktiviti peribadi yang mesra, pintar dan kelakar (Malaysian Productivity Coach). Berikan satu pesanan motivasi ringkas (maksimum 2 ayat pendek) dan satu tip praktikal harian dalam Bahasa Melayu berasaskan status tugasan pengguna hari ini:
    - Jumlah tugasan semasa: ${totalTasks}
    - Tugasan diselesaikan: ${completedTasks}
    - Pembahagian lajur: ${JSON.stringify(columnsCount)}

    Tulis dalam nada yang santai tetapi penuh inspirasi (Bahasa Melayu harian yang mesra, boleh gunakan perkataan popular seperti 'jom', 'cayalah', 'gempak', 'steady', 'terbaik'). Jangan terlalu skema atau kaku.

    Pulangkan jawapan dalam format JSON:
    {
      "motivasi": "kata-kata semangat harian yang membakar semangat",
      "tip": "tip praktikal harian berasaskan status semasa"
    }`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            motivasi: { type: Type.STRING },
            tip: { type: Type.STRING },
          },
          required: ['motivasi', 'tip'],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Jawapan tips daripada AI kosong.');
    }

    const result = JSON.parse(text.trim());
    return res.json(result);
  } catch (err: any) {
    console.error('Error generating tips:', err);
    return res.json({
      motivasi: "Teruskan usaha hebat anda untuk hari ini! Setiap langkah kecil membawa kepada kejayaan besar.",
      tip: "Pecahkan tugasan besar kepada bahagian kecil supaya anda tidak rasa terbeban."
    });
  }
});

// Setup Vite as middleware in dev, otherwise serve static production files
const isProd = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'preview';
const port = process.env.PORT || 3000;

async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
    
    // Serve index.html for all other routes to support client SPA routing
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let html = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        const template = await vite.transformIndexHtml(url, html);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    // Serve static compiled assets
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, () => {
    console.log(`Server sedang berjalan di http://localhost:${port}`);
  });
}

startServer();
