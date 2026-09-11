import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { WalletExplorer } from './components/WalletExplorer';
import { PayoutManager } from './components/PayoutManager';
import { GeminiChat } from './components/GeminiChat';
import { BtcPriceData, MempoolFees } from './types';
import { api } from './services/api';
import { ShieldCheck, Cpu, Database, Activity, Bot, Sparkles, ExternalLink } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('wallet');
  const [priceData, setPriceData] = useState<BtcPriceData | null>(null);
  const [feeData, setFeeData] = useState<MempoolFees | null>(null);
  const [isPriceLoading, setIsPriceLoading] = useState<boolean>(false);
  const [isFeeLoading, setIsFeeLoading] = useState<boolean>(false);

  const fetchPrice = async () => {
    setIsPriceLoading(true);
    try {
      const data = await api.getPrice();
      setPriceData(data);
    } catch (err) {
      console.warn('Price sync error:', err);
    } finally {
      setIsPriceLoading(false);
    }
  };

  const fetchFees = async () => {
    setIsFeeLoading(true);
    try {
      const data = await api.getFees();
      setFeeData(data);
    } catch (err) {
      console.warn('Fee sync error:', err);
    } finally {
      setIsFeeLoading(false);
    }
  };

  useEffect(() => {
    fetchPrice();
    fetchFees();

    // Periodic live updates every 45 seconds
    const interval = setInterval(() => {
      fetchPrice();
      fetchFees();
    }, 45000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#0c0c0e] font-sans text-[#e4e4e7] flex flex-col selection:bg-amber-500 selection:text-[#0c0c0e]">
      
      {/* Top Main Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        priceData={priceData}
        onRefreshPrice={fetchPrice}
        isPriceLoading={isPriceLoading}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-6 py-8">
        {activeTab === 'wallet' && (
          <WalletExplorer priceData={priceData} feeData={feeData} />
        )}

        {activeTab === 'payouts' && (
          <PayoutManager priceData={priceData} feeData={feeData} />
        )}

        {activeTab === 'ai-chat' && (
          <GeminiChat />
        )}
      </main>

      {/* Variation 2 Status Footer */}
      <footer className="border-t border-zinc-800 bg-[#0c0c0e] px-6 py-4">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-[11px] opacity-70">
          <div>SATOSHISUITE PROTOCOL // V3.7</div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            <span>GEMINI ENGINE & IMAGEN ACTIVE</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
