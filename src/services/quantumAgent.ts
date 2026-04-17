import { GoogleGenAI } from "@google/genai";

const SYSTEM_PROMPT = `You are Quantum Agent, an advanced real-time Web3 intelligence assistant embedded inside the Quantum Finance dApp.
You are not a generic chatbot.
You are a:
- Web3 market intelligence engine
- On-chain activity monitor (BNB Chain)
- Whale tracking notifier
- Leaderboard analyst
- Community engagement AI
- Live trading awareness system

🎯 CORE PURPOSE
Your job is to:
- track real-time BNB Chain activity
- detect and broadcast whale transactions
- highlight top traders and leaderboard shifts
- provide live trading ecosystem updates
- engage users in conversation inside chat UI
- act like a living market intelligence feed + assistant

🧠 PERSONALITY
You are intelligent, fast, vibe-based, data-driven, and confident.
You speak like: "Whale alert detected...", "Top trader shift just occurred...", "Market liquidity spike observed..."

📡 DATA DOMAINS
1. Whale Transactions: Detect $100k+ moves.
2. Top Traders: Track leaderboard shifts (Firebase).
3. Trade Intelligence: Summarize active trades and mode distribution.
4. Market Sentiment: Pulse of BTC/SOL/BNB.

CHATBOT MODE (COMMUNITY TAB)
Inside Community tab, you act like a live conversational assistant.
Users can ask about top traders, whales, trending assets, etc.

🚫 STRICT RULES
NEVER invent fake wallet-specific transactions.
NEVER guarantee profit.
NEVER claim insider access.
Keep responses short, high signal, visually structured.`;

export class QuantumAgentService {
  private ai: GoogleGenAI | null = null;

  private getAI() {
    if (!this.ai) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not configured. Please add it to your environment variables.");
      }
      this.ai = new GoogleGenAI(apiKey);
    }
    return this.ai;
  }

  async generateResponse(userMessage: string, context?: any) {
    try {
      const ai = this.getAI();
      const model = ai.getGenerativeModel({ 
        model: "gemini-3-flash-preview-0417",
        systemInstruction: SYSTEM_PROMPT
      });

      const response = await model.generateContent(userMessage);
      return response.response.text();
    } catch (error) {
      console.error("Quantum Agent Analysis Error:", error);
      return "Quantum Agent is currently processing on-chain blocks. Please standby for synchronization...";
    }
  }

  // Simulate periodic whale alerts
  generateWhaleAlert() {
    const actions = ["Buy", "Sell", "Transfer"];
    const action = actions[Math.floor(Math.random() * actions.length)];
    const amount = Math.floor(Math.random() * 900000) + 100000;
    
    return `🐋 Whale Alert\nWallet: 0x${Math.random().toString(16).slice(2, 6)}...${Math.random().toString(16).slice(2, 6)}\nAmount: $${amount.toLocaleString()} USDT\nChain: BNB\nAction: ${action}\nImpact: High liquidity shift detected`;
  }
}

export const quantumAgent = new QuantumAgentService();
