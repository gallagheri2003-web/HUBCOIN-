// SatoshiSuite Live Backend API Client (No Mock, No Demo)

export const api = {
  async getPrice() {
    const res = await fetch('/api/btc/price');
    if (!res.ok) throw new Error('Failed to fetch price');
    return await res.json();
  },

  async getFees() {
    const res = await fetch('/api/btc/fees');
    if (!res.ok) throw new Error('Failed to fetch fees');
    return await res.json();
  },

  async getAddress(address: string) {
    const res = await fetch(`/api/btc/address/${encodeURIComponent(address)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch live address data');
    }
    return await res.json();
  },

  async broadcastTx(rawHex: string) {
    const res = await fetch('/api/btc/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawHex })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Broadcast failed');
    return data.txid;
  },

  async getTxDetails(txid: string) {
    const res = await fetch(`https://mempool.space/api/tx/${txid}`);
    if (!res.ok) throw new Error('Transaction not found');
    return await res.json();
  },

  async sendGeminiChat(
    messages: Array<{ role: string; content: string }>,
    systemInstruction?: string,
    model?: string
  ) {
    const res = await fetch('/api/gemini/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, systemInstruction, model })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gemini chat error');
    return data;
  }
};
