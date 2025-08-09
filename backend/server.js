import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// POST /translate
// Expects JSON body: { q: string, source: 'en'|..., target: 'kn'|... }
app.post("/translate", async (req, res) => {
  try {
    const { q, source = "en", target } = req.body;
    if (!q || !target) {
      return res.status(400).json({ error: "Missing 'q' or 'target' in request body" });
    }

    // MyMemory public API endpoint
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=${source}|${target}`;

    console.log("Calling translation API:", url);

    const response = await fetch(url);

    if (!response.ok) {
      const text = await response.text();
      return res.status(502).json({ error: "Translation provider error", details: text });
    }

    const data = await response.json();

    if (data?.responseData?.translatedText) {
      return res.json({ translatedText: data.responseData.translatedText });
    } else {
      return res.status(502).json({ error: "Invalid response from translation provider" });
    }
  } catch (err) {
    console.error("Translate error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
});

// Serve frontend SPA fallback (index.html)
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
