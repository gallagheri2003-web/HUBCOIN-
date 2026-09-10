import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { WalletExplorer } from './components/WalletExplorer';
import { PayoutManager } from './components/PayoutManager';
import { MempoolDashboard } from './components/MempoolDashboard';
import { TxBroadcaster } from './components/TxBroadcaster';
import { GeminiChat } from './components/GeminiChat';
import { GeminiImageStudio } from './components/GeminiImageStudio';
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
    <div className="min-h-screen bg-zinc-100/70 font-sans text-zinc-900 flex flex-col selection:bg-amber-200 selection:text-amber-900">
      
      {/* Top Main Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        priceData={priceData}
        onRefreshPrice={fetchPrice}
        isPriceLoading={isPriceLoading}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
        {activeTab === 'wallet' && (
          <WalletExplorer priceData={priceData} feeData={feeData} />
        )}

        {activeTab === 'payouts' && (
          <PayoutManager priceData={priceData} feeData={feeData} />
        )}

        {activeTab === 'mempool' && (
          <MempoolDashboard
            priceData={priceData}
            feeData={feeData}
            onRefreshFees={fetchFees}
            isFeeLoading={isFeeLoading}
          />
        )}

        {activeTab === 'tx-tools' && (
          <TxBroadcaster />
        )}

        {activeTab === 'ai-chat' && (
          <GeminiChat />
        )}

        {activeTab === 'ai-image' && (
          <GeminiImageStudio />
        )}
      </main>

      {/* Modern Status Footer */}
      <footer className="border-t border-zinc-200 bg-white py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="font-serif font-bold text-zinc-800">SatoshiSuite</span>
            <span>•</span>
            <span>Live On-Chain Explorer & AI Cryptographic Intelligence</span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              Bitcoin Mainnet Node Active
            </span>
            <span>•</span>
            <a
              href="https://mempool.space"
              target="_blank"
              rel="noreferrer"
              className="hover:text-zinc-900 inline-flex items-center gap-1"
            >
              <span>Mempool.space Feed</span>
              <ExternalLink className="h-3 w-3" />
            </a>
            <span>•</span>
            <span className="font-mono">Gemini 3.7 Flash & Imagen Engine</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
