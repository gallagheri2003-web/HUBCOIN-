import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Lazy/Safe Gemini AI Client
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// ----------------------------------------------------
// 1. BITCOIN LIVE ON-CHAIN REAL API ENDPOINTS
// ----------------------------------------------------

// Real Address Balance & Stats (Non-simulated, Live Mempool / Blockstream)
app.get("/api/btc/address/:address", async (req, res) => {
  const address = req.params.address?.trim();
  if (!address) {
    return res.status(400).json({ error: "Address is required" });
  }

  try {
    // Helper with timeout for resilient fetching of large addresses
    const fetchWithTimeout = async (url: string, timeoutMs = 8000) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        return res;
      } catch (err) {
        clearTimeout(timer);
        throw err;
      }
    };

    // Primary source: Mempool.space with resilient timeouts
    const [addrRes, utxoRes, txsRes] = await Promise.allSettled([
      fetchWithTimeout(`https://mempool.space/api/address/${encodeURIComponent(address)}`),
      fetchWithTimeout(`https://mempool.space/api/address/${encodeURIComponent(address)}/utxo`),
      fetchWithTimeout(`https://mempool.space/api/address/${encodeURIComponent(address)}/txs`),
    ]);

    let addressData: any = null;
    let utxoData: any[] = [];
    let txsData: any[] = [];

    if (addrRes.status === "fulfilled" && addrRes.value.ok) {
      addressData = await addrRes.value.json();
    } else {
      // Fallback to Blockstream API
      const fallbackAddr = await fetch(`https://blockstream.info/api/address/${encodeURIComponent(address)}`);
      if (fallbackAddr.ok) {
        addressData = await fallbackAddr.json();
      }
    }

    if (!addressData) {
      return res.status(404).json({ error: "Could not retrieve live on-chain address data. Verify address format." });
    }

    if (utxoRes.status === "fulfilled" && utxoRes.value.ok) {
      try {
        const rawUtxos = await utxoRes.value.json();
        if (Array.isArray(rawUtxos)) {
          // Cap/paginate large UTXO sets (e.g., max 100 UTXOs for high performance and stability)
          utxoData = rawUtxos.slice(0, 100);
        }
      } catch (e) {
        utxoData = [];
      }
    }

    if (txsRes.status === "fulfilled" && txsRes.value.ok) {
      try {
        const rawTxs = await txsRes.value.json();
        if (Array.isArray(rawTxs)) {
          // Cap large transaction lists (e.g., max 50 recent txs)
          txsData = rawTxs.slice(0, 50);
        }
      } catch (e) {
        txsData = [];
      }
    }

    const fundedSats = addressData.chain_stats.funded_txo_sum || 0;
    const spentSats = addressData.chain_stats.spent_txo_sum || 0;
    const confirmedBalanceSats = fundedSats - spentSats;

    const mempoolFunded = addressData.mempool_stats?.funded_txo_sum || 0;
    const mempoolSpent = addressData.mempool_stats?.spent_txo_sum || 0;
    const unconfirmedBalanceSats = mempoolFunded - mempoolSpent;

    const totalBalanceSats = confirmedBalanceSats + unconfirmedBalanceSats;
    const balanceBtc = totalBalanceSats / 100000000;
    const confirmedBtc = confirmedBalanceSats / 100000000;
    const unconfirmedBtc = unconfirmedBalanceSats / 100000000;

    res.json({
      address: addressData.address || address,
      balance: {
        totalBtc: balanceBtc,
        totalSats: totalBalanceSats,
        confirmedBtc,
        confirmedSats: confirmedBalanceSats,
        unconfirmedBtc,
        unconfirmedSats: unconfirmedBalanceSats,
      },
      stats: {
        txCount: (addressData.chain_stats.tx_count || 0) + (addressData.mempool_stats?.tx_count || 0),
        fundedTxoCount: addressData.chain_stats.funded_txo_count || 0,
        spentTxoCount: addressData.chain_stats.spent_txo_count || 0,
        totalReceivedBtc: fundedSats / 100000000,
        totalSentBtc: spentSats / 100000000,
      },
      utxos: utxoData.slice(0, 50),
      recentTxs: txsData.slice(0, 50).map((tx: any) => {
        let sentSats = 0;
        let receivedSats = 0;

        if (tx.vin) {
          for (const vin of tx.vin) {
            if (vin.prevout && vin.prevout.scriptpubkey_address === (addressData.address || address)) {
              sentSats += vin.prevout.value || 0;
            }
          }
        }
        if (tx.vout) {
          for (const vout of tx.vout) {
            if (vout.scriptpubkey_address === (addressData.address || address)) {
              receivedSats += vout.value || 0;
            }
          }
        }

        const netSats = receivedSats - sentSats;
        const txType: 'incoming' | 'outgoing' = netSats >= 0 ? 'incoming' : 'outgoing';
        const totalOut = tx.vout?.reduce((acc: number, o: any) => acc + (o.value || 0), 0) || 0;
        const netAmountSats = Math.abs(netSats) > 0 ? Math.abs(netSats) : totalOut;

        return {
          txid: tx.txid,
          version: tx.version,
          locktime: tx.locktime,
          size: tx.size,
          weight: tx.weight,
          fee: tx.fee,
          confirmed: tx.status?.confirmed,
          blockHeight: tx.status?.block_height,
          blockTime: tx.status?.block_time,
          inputsCount: tx.vin?.length || 0,
          outputsCount: tx.vout?.length || 0,
          totalOutputValueSats: totalOut,
          txType,
          netAmountSats,
          receivedSats,
          sentSats,
        };
      }),
      isLiveOnChain: true,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error fetching live BTC address:", error);
    res.status(500).json({ error: error.message || "Failed to fetch on-chain address" });
  }
});

// Real Live Transaction Lookup
app.get("/api/btc/tx/:txid", async (req, res) => {
  const txid = req.params.txid?.trim();
  if (!txid) {
    return res.status(400).json({ error: "TXID is required" });
  }

  try {
    const response = await fetch(`https://mempool.space/api/tx/${encodeURIComponent(txid)}`);
    if (!response.ok) {
      const fallback = await fetch(`https://blockstream.info/api/tx/${encodeURIComponent(txid)}`);
      if (!fallback.ok) {
        return res.status(404).json({ error: "Transaction not found on-chain" });
      }
      const data = await fallback.json();
      return res.json(data);
    }
    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    console.error("Error fetching live BTC tx:", error);
    res.status(500).json({ error: error.message || "Failed to fetch transaction" });
  }
});

// Real Recommended Mempool Network Fees
app.get("/api/btc/fees", async (req, res) => {
  try {
    const response = await fetch("https://mempool.space/api/v1/fees/recommended");
    if (!response.ok) {
      throw new Error("Failed to fetch mempool fees");
    }
    const data = await response.json();
    res.json({
      ...data,
      source: "mempool.space live api",
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error("Error fetching mempool fees:", error);
    // Fallback standard estimates if mempool rate-limits
    res.json({
      fastestFee: 24,
      halfHourFee: 18,
      hourFee: 12,
      economyFee: 8,
      minimumFee: 5,
      source: "fallback",
      timestamp: Date.now(),
    });
  }
});

// Real BTC Price & Market Metrics
app.get("/api/btc/price", async (req, res) => {
  try {
    const binanceRes = await fetch("https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT");
    if (binanceRes.ok) {
      const data = await binanceRes.json();
      return res.json({
        priceUsd: parseFloat(data.lastPrice),
        change24h: parseFloat(data.priceChangePercent),
        high24h: parseFloat(data.highPrice),
        low24h: parseFloat(data.lowPrice),
        volumeBtc: parseFloat(data.volume),
        quoteVolumeUsd: parseFloat(data.quoteVolume),
        source: "Binance Live Public API",
        timestamp: Date.now(),
      });
    }

    const coingeckoRes = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true"
    );
    if (coingeckoRes.ok) {
      const data = await coingeckoRes.json();
      return res.json({
        priceUsd: data.bitcoin.usd,
        change24h: data.bitcoin.usd_24h_change,
        volumeBtc: 0,
        quoteVolumeUsd: data.bitcoin.usd_24h_vol,
        source: "CoinGecko Live API",
        timestamp: Date.now(),
      });
    }

    res.json({
      priceUsd: 96500.0,
      change24h: 1.85,
      high24h: 97800.0,
      low24h: 94200.0,
      volumeBtc: 24500,
      quoteVolumeUsd: 2364000000,
      source: "Estimated reference",
      timestamp: Date.now(),
    });
  } catch (error: any) {
    res.json({
      priceUsd: 96500.0,
      change24h: 1.85,
      high24h: 97800.0,
      low24h: 94200.0,
      volumeBtc: 24500,
      quoteVolumeUsd: 2364000000,
      source: "Estimated reference",
      timestamp: Date.now(),
    });
  }
});

// Real Latest On-Chain Blocks
app.get("/api/btc/blocks", async (req, res) => {
  try {
    const response = await fetch("https://mempool.space/api/v1/blocks");
    if (!response.ok) {
      throw new Error("Failed to fetch blocks");
    }
    const blocks = await response.json();
    res.json(blocks.slice(0, 6));
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch blocks" });
  }
});

// Real Transaction Broadcast to Bitcoin Network
app.post("/api/btc/broadcast", async (req, res) => {
  const { txHex } = req.body;
  if (!txHex || typeof txHex !== "string") {
    return res.status(400).json({ error: "Raw transaction hex is required" });
  }

  try {
    const broadcastRes = await fetch("https://mempool.space/api/tx", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: txHex.trim(),
    });

    if (!broadcastRes.ok) {
      const errText = await broadcastRes.text();
      return res.status(400).json({ error: errText || "Transaction broadcast rejected by network" });
    }

    const txid = await broadcastRes.text();
    res.json({ success: true, txid: txid.trim(), message: "Transaction broadcasted to Bitcoin Mempool!" });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Network broadcast error" });
  }
});

// ----------------------------------------------------
// 2. GEMINI AI MULTI-TURN CHAT API (With Role Selection)
// ----------------------------------------------------

app.post("/api/gemini/chat", async (req, res) => {
  const ai = getGeminiClient();
  if (!ai) {
    return res.status(500).json({
      error: "Gemini API key is not configured. Please set GEMINI_API_KEY in Settings > Secrets.",
    });
  }

  const {
    messages,
    systemInstruction,
    model = "gemini-3.7-flash",
  } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Messages array is required" });
  }

  try {
    // Valid supported models
    const validModels = ["gemini-3.7-flash", "gemini-3.1-pro-preview", "gemini-3.1-flash-lite"];
    const selectedModel = validModels.includes(model) ? model : "gemini-3.7-flash";

    // Format contents
    const formattedContents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    }));

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: formattedContents,
      config: {
        systemInstruction:
          systemInstruction ||
          "You are an expert Bitcoin & Blockchain Engineer and cryptographic analyst. Provide accurate, clear, and comprehensive guidance on Bitcoin protocol, UTXO models, script verification, on-chain analytics, privacy best practices, and security principles.",
      },
    });

    const reply = response.text || "No response generated.";
    res.json({ reply, model: selectedModel });
  } catch (error: any) {
    console.error("Gemini chat error:", error);
    res.status(500).json({ error: error.message || "Gemini chat request failed" });
  }
});

// ----------------------------------------------------
// 3. GEMINI IMAGE GENERATION (1K, 2K, 4K resolution)
// ----------------------------------------------------

app.post("/api/gemini/generate-image", async (req, res) => {
  const ai = getGeminiClient();
  if (!ai) {
    return res.status(500).json({
      error: "Gemini API key is not configured. Please set GEMINI_API_KEY in Settings > Secrets.",
    });
  }

  const {
    prompt,
    aspectRatio = "1:1",
    imageSize = "1K",
    model = "gemini-3.1-flash-image",
  } = req.body;

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Image prompt is required" });
  }

  // Supported image models: gemini-3-pro-image-preview, gemini-3.1-flash-image, imagen-3.0-generate-002
  const candidateModels = [
    model,
    "gemini-3-pro-image-preview",
    "gemini-3.1-flash-image",
    "imagen-3.0-generate-002",
  ];

  let lastError: any = null;

  for (const m of candidateModels) {
    try {
      if (m.startsWith("imagen-")) {
        const response = await ai.models.generateImages({
          model: m,
          prompt,
          config: {
            numberOfImages: 1,
            aspectRatio: aspectRatio as any,
            outputMimeType: "image/png",
          },
        });

        const image = response.generatedImages?.[0]?.image;
        if (image?.imageBytes) {
          const imageUrl = `data:image/png;base64,${image.imageBytes}`;
          return res.json({
            imageUrl,
            aspectRatio,
            imageSize,
            prompt,
            model: m,
          });
        }
      } else {
        const response = await ai.models.generateContent({
          model: m,
          contents: {
            parts: [{ text: prompt }],
          },
          config: {
            imageConfig: {
              aspectRatio: aspectRatio as any,
              imageSize: imageSize as any,
            },
          },
        });

        let imageUrl: string | null = null;
        let descriptionText = "";

        if (response.candidates && response.candidates[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
              const mimeType = part.inlineData.mimeType || "image/png";
              imageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
            } else if (part.text) {
              descriptionText += part.text;
            }
          }
        }

        if (imageUrl) {
          return res.json({
            imageUrl,
            aspectRatio,
            imageSize,
            prompt,
            model: m,
            textNotes: descriptionText,
          });
        }
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`Model ${m} failed for image generation, trying next:`, err?.message || err);
    }
  }

  return res.status(500).json({
    error: lastError?.message || "Failed to generate image with Gemini models",
  });
});

// ----------------------------------------------------
// VITE MIDDLEWARE & SERVER STARTUP
// ----------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Bitcoin Wallet & Gemini AI Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
