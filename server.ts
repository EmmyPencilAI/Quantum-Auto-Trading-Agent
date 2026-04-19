import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import dotenv from "dotenv";
import { startTradingEngine } from "./src/services/tradingService";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// API Routes
app.post("/api/send-2fa", async (req, res) => {
  const { email, code } = req.body;
  console.log(`[2FA DEBUG] Sending code ${code} to email ${email}`);
  res.json({ success: true, message: "Verification code sent to your email." });
});

async function setupApp() {
  // Start the Quantum Background Trading Engine
  startTradingEngine();

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

// Export the app for Vercel
export default app;

// Only start the server if we're not running as a Vercel function (or if explicitly told to)
if (process.env.AIS_SERVER === 'true' || !process.env.VERCEL) {
  setupApp().then(() => {
    const PORT = 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Quantum Server running on http://0.0.0.0:${PORT}`);
    });
  });
}
