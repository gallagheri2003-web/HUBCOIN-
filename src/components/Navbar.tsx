import { FC } from 'react';
import { BtcPriceData } from '../types';
import { 
  Wallet, 
  Activity, 
  Send, 
  Bot, 
  Sparkles, 
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Zap
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  priceData: BtcPriceData | null;
  onRefreshPrice: () => void;
  isPriceLoading: boolean;
}

export const Navbar: FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  priceData,
  onRefreshPrice,
  isPriceLoading,
}) => {
  const tabs = [
    { id: 'wallet', label: '01. Wallet & UTXO Explorer', icon: Wallet },
    { id: 'payouts', label: '02. Personal Payouts', icon: ArrowUpRight },
    { id: 'ai-chat', label: '03. Gemini Crypto AI', icon: Bot },
  ];

  const isPositive = (priceData?.change24h ?? 0) >= 0;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-800 bg-[#0c0c0e]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        
        {/* Brand & Live Network Status */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded bg-amber-500 text-[#0c0c0e] font-black text-xl shadow-md">
            ₿
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-syne text-xl font-extrabold tracking-tight text-zinc-100 uppercase">
                SatoshiSuite
              </h1>
              <span className="inline-flex items-center gap-1 rounded bg-emerald-950/80 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-400 border border-emerald-800/50">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                MAINNET LIVE
              </span>
            </div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-amber-500/80">
              Bitcoin AI Intelligence & On-Chain Engine
            </p>
          </div>
        </div>

        {/* Live Market Price Widget */}
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          {priceData ? (
            <div className="flex items-center gap-3 rounded border border-zinc-800 bg-[#18181b] px-4 py-2 text-sm shadow-inner">
              <div className="flex flex-col">
                <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                  BTC / USD
                </span>
                <span className="font-mono text-base font-bold text-zinc-100">
                  ${priceData.priceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              
              <div className={`flex items-center gap-0.5 rounded px-2 py-0.5 font-mono text-xs font-bold ${
                isPositive ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40' : 'bg-rose-950 text-rose-400 border border-rose-800/40'
              }`}>
                {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                <span>{isPositive ? '+' : ''}{priceData.change24h.toFixed(2)}%</span>
              </div>

              <button
                id="btn-refresh-price"
                onClick={onRefreshPrice}
                disabled={isPriceLoading}
                title="Refresh Live Price"
                className="ml-1 rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isPriceLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          ) : (
            <div className="h-12 w-48 animate-pulse rounded bg-zinc-900 border border-zinc-800" />
          )}
        </div>
      </div>

      {/* Navigation Sub-bar */}
      <nav className="mx-auto flex max-w-7xl overflow-x-auto px-6 scrollbar-none">
        <div className="flex space-x-2 border-t border-zinc-800/80 py-2.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`nav-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 whitespace-nowrap rounded px-4 py-2 font-mono text-xs uppercase tracking-wider transition-all ${
                  isActive
                    ? 'bg-amber-500 text-[#0c0c0e] font-bold shadow-md'
                    : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-[#0c0c0e]' : 'text-amber-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </header>
  );
};

