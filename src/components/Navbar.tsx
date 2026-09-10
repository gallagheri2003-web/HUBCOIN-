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
  ArrowUpRight
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
    { id: 'wallet', label: 'Wallet & UTXO Explorer', icon: Wallet },
    { id: 'payouts', label: 'Personal Payouts & Wallets', icon: ArrowUpRight },
    { id: 'mempool', label: 'Mempool & Fee Engine', icon: Activity },
    { id: 'tx-tools', label: 'TX Lookup & Broadcaster', icon: Send },
    { id: 'ai-chat', label: 'Gemini Crypto AI', icon: Bot },
    { id: 'ai-image', label: 'AI Image Studio', icon: Sparkles },
  ];

  const isPositive = (priceData?.change24h ?? 0) >= 0;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/95 backdrop-blur-md transition-colors">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        
        {/* Brand & Live Network Status */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm ring-2 ring-amber-500/20">
            <span className="font-mono text-xl font-black">₿</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-lg font-bold tracking-tight text-zinc-900">
                SatoshiSuite
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Mainnet Live
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              Live On-Chain Explorer & AI Cryptographic Suite
            </p>
          </div>
        </div>

        {/* Live Market Price Widget */}
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          {priceData ? (
            <div className="flex items-center gap-2.5 rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-1.5 text-sm">
              <div className="flex flex-col">
                <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                  BTC / USD
                </span>
                <span className="font-mono text-sm font-bold text-zinc-900">
                  ${priceData.priceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              
              <div className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-semibold ${
                isPositive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                <span>{isPositive ? '+' : ''}{priceData.change24h.toFixed(2)}%</span>
              </div>

              <button
                id="btn-refresh-price"
                onClick={onRefreshPrice}
                disabled={isPriceLoading}
                title="Refresh Live Price"
                className="ml-1 rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 transition disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isPriceLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          ) : (
            <div className="h-10 w-44 animate-pulse rounded-lg bg-zinc-100" />
          )}
        </div>
      </div>

      {/* Navigation Sub-bar */}
      <nav className="mx-auto flex max-w-7xl overflow-x-auto px-4 sm:px-6 scrollbar-none">
        <div className="flex space-x-1 border-t border-zinc-100 py-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`nav-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-zinc-900 text-white shadow-xs'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-amber-400' : 'text-zinc-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </header>
  );
};
