import { FC, useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { api } from '../services/api';
import { BtcPriceData } from '../types';
import { 
  Zap, 
  Copy, 
  Check, 
  QrCode, 
  Volume2, 
  VolumeX, 
  Radio, 
  Sparkles, 
  ArrowDownLeft, 
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Play
} from 'lucide-react';

interface LivePaymentReceiverProps {
  address: string;
  walletLabel?: string;
  priceData: BtcPriceData | null;
  onPaymentDetected?: (amountBtc: number, txid: string) => void;
}

export const LivePaymentReceiver: FC<LivePaymentReceiverProps> = ({
  address,
  walletLabel = 'My Primary Personal Vault',
  priceData,
  onPaymentDetected,
}) => {
  const [amountBtc, setAmountBtc] = useState<string>('0.005');
  const [memo, setPayoutMemo] = useState<string>('Personal Vault Payment');
  const [qrUrl, setQrUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // Live Listener States
  const [isListening, setIsListening] = useState<boolean>(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(true);
  const [lastTxCount, setLastTxCount] = useState<number | null>(null);
  const [recentLivePayments, setRecentLivePayments] = useState<Array<{ id: string; amountBtc: number; time: string; txid: string; isSimulated?: boolean }>>([]);
  const [liveBannerAlert, setLiveBannerAlert] = useState<{ amountBtc: number; txid: string; isSimulated?: boolean } | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(false);

  const btcPrice = priceData?.priceUsd || 95000;
  const parsedAmountBtc = parseFloat(amountBtc) || 0;
  const parsedAmountSats = Math.round(parsedAmountBtc * 100000000);
  const parsedAmountUsd = parsedAmountBtc * btcPrice;

  const bitcoinUri = `bitcoin:${address}?amount=${parsedAmountBtc > 0 ? parsedAmountBtc : ''}&label=${encodeURIComponent(memo)}`;

  // Synthesize Web Audio chime
  const playPaymentSound = () => {
    if (!isAudioEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      // Play two-tone bell chime (C5 then E5)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';

      osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc2.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12); // E5

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc1.connect(gain);
      osc2.connect(gain);

      gain.connect(ctx.destination);

      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.15);

      osc2.start(ctx.currentTime + 0.12);
      osc2.stop(ctx.currentTime + 0.6);
    } catch (e) {
      console.warn('Audio chime playback omitted:', e);
    }
  };

  // Generate QR Code on parameter changes
  useEffect(() => {
    const generateQr = async () => {
      try {
        const url = await QRCode.toDataURL(bitcoinUri, {
          margin: 1,
          width: 220,
          color: { dark: '#18181b', light: '#ffffff' },
        });
        setQrUrl(url);
      } catch (err) {
        console.error('Failed generating payment QR code:', err);
      }
    };
    generateQr();
  }, [address, amountBtc, memo]);

  // Live Polling engine for on-chain mempool transactions
  const pollOnChainTransactions = async () => {
    if (!address || !isListening) return;
    setIsPolling(true);
    try {
      const res = await api.getAddress(address);
      const currentCount = res.stats.txCount;

      if (lastTxCount !== null && currentCount > lastTxCount) {
        // New transaction detected!
        const latestTx = res.recentTxs[0];
        const newTxid = latestTx?.txid || `live-tx-${Date.now()}`;
        const newBtc = latestTx ? latestTx.totalOutputValueSats / 100000000 : parsedAmountBtc || 0.005;

        // Play chime & alert
        playPaymentSound();

        const paymentRecord = {
          id: `live-${Date.now()}`,
          amountBtc: newBtc,
          time: new Date().toLocaleTimeString(),
          txid: newTxid,
        };

        setRecentLivePayments((prev) => [paymentRecord, ...prev]);
        setLiveBannerAlert({ amountBtc: newBtc, txid: newTxid });

        if (onPaymentDetected) {
          onPaymentDetected(newBtc, newTxid);
        }

        setTimeout(() => setLiveBannerAlert(null), 8000);
      }

      setLastTxCount(currentCount);
    } catch (e) {
      console.warn('Live listener polling tick error:', e);
    } finally {
      setIsPolling(false);
    }
  };

  useEffect(() => {
    pollOnChainTransactions();
    const interval = setInterval(pollOnChainTransactions, 6000);
    return () => clearInterval(interval);
  }, [address, isListening, lastTxCount]);

  const handleCopyUri = () => {
    navigator.clipboard.writeText(bitcoinUri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs space-y-5">
      
      {/* Live Payment Detected Banner Alert */}
      {liveBannerAlert && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 shadow-md animate-bounce flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white font-bold">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 font-bold text-sm">
                <span>🎉 Live Payment Received!</span>
                {liveBannerAlert.isSimulated && (
                  <span className="rounded bg-emerald-200 px-2 py-0.5 text-[10px] text-emerald-900 font-bold">
                    Test Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-emerald-800 font-mono">
                +{liveBannerAlert.amountBtc.toFixed(8)} BTC (≈ ${(liveBannerAlert.amountBtc * btcPrice).toFixed(2)} USD)
              </p>
              <p className="text-[10px] text-emerald-700 font-mono truncate max-w-sm">
                TXID: {liveBannerAlert.txid}
              </p>
            </div>
          </div>

          <button
            onClick={() => setLiveBannerAlert(null)}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-950 px-2 py-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-100 pb-4 gap-3">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-amber-500/10 p-2 text-amber-600">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-serif text-base font-bold text-zinc-900">
              Get Paid Live (Interactive Invoice & Listener)
            </h3>
            <p className="text-xs text-zinc-500">
              Live on-chain Mempool listener & payment request generator for target wallet
            </p>
          </div>
        </div>

        {/* Live Listener Status Badge */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAudioEnabled(!isAudioEnabled)}
            className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5 transition ${
              isAudioEnabled ? 'border-zinc-300 bg-zinc-50 text-zinc-800' : 'border-zinc-200 bg-zinc-100 text-zinc-400'
            }`}
            title={isAudioEnabled ? 'Audio chime enabled' : 'Audio chime muted'}
          >
            {isAudioEnabled ? <Volume2 className="h-3.5 w-3.5 text-emerald-600" /> : <VolumeX className="h-3.5 w-3.5" />}
            <span>{isAudioEnabled ? 'Sound On' : 'Muted'}</span>
          </button>

          <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            <Radio className={`h-3.5 w-3.5 text-emerald-600 ${isPolling ? 'animate-ping' : 'animate-pulse'}`} />
            <span>Mempool Listener Active</span>
          </div>
        </div>
      </div>

      {/* Grid: Invoice Generator Form vs Live QR Code */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        
        {/* Left Inputs (7 cols) */}
        <div className="md:col-span-7 space-y-4">
          <div className="rounded-xl bg-zinc-50 p-3.5 border border-zinc-200/80 space-y-1">
            <span className="text-[11px] font-semibold text-zinc-500 block">Receiving Wallet Target:</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-zinc-900">{walletLabel}</span>
            </div>
            <p className="font-mono text-xs font-semibold text-amber-900 break-all select-all">
              {address}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Requested Amount (BTC)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.0001"
                  min="0.00001"
                  value={amountBtc}
                  onChange={(e) => setAmountBtc(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm font-mono text-zinc-900 focus:border-amber-500 focus:outline-none"
                />
                <span className="absolute right-3 top-2.5 text-xs font-bold text-zinc-400">BTC</span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-400 font-mono">
                = {parsedAmountSats.toLocaleString()} Sats (≈ ${parsedAmountUsd.toFixed(2)} USD)
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Payment Memo / Label
              </label>
              <input
                type="text"
                value={memo}
                onChange={(e) => setPayoutMemo(e.target.value)}
                placeholder="e.g. Invoice #1042"
                className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-xs text-zinc-900 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Quick preset buttons */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-zinc-500 font-medium">Quick Amounts:</span>
            {['0.001', '0.005', '0.01', '0.025', '0.1'].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setAmountBtc(val)}
                className={`rounded-lg border px-2 py-0.5 font-mono transition ${
                  amountBtc === val
                    ? 'border-amber-500 bg-amber-50 text-amber-900 font-bold'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100'
                }`}
              >
                {val} BTC
              </button>
            ))}
          </div>
        </div>

        {/* Right QR Code & URI (5 cols) */}
        <div className="md:col-span-5 flex flex-col items-center justify-center rounded-xl bg-zinc-50 p-4 border border-zinc-200/80 space-y-3">
          {qrUrl ? (
            <img src={qrUrl} alt="Bitcoin Payment QR" className="h-44 w-44 rounded-xl border bg-white p-2 shadow-2xs" />
          ) : (
            <div className="h-44 w-44 rounded-xl bg-zinc-200 animate-pulse" />
          )}

          <div className="w-full space-y-2 text-center">
            <button
              onClick={handleCopyUri}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 shadow-2xs hover:bg-zinc-100 transition"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? 'URI Copied!' : 'Copy Bitcoin URI'}</span>
            </button>

            <p className="font-mono text-[10px] text-zinc-400 break-all px-2">
              {bitcoinUri}
            </p>
          </div>
        </div>

      </div>

      {/* Recent Live Incoming Payments Table */}
      {recentLivePayments.length > 0 && (
        <div className="pt-3 border-t border-zinc-100 space-y-2">
          <span className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
            <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
            Detected Live Incoming Payments Session Log ({recentLivePayments.length})
          </span>

          <div className="space-y-1.5">
            {recentLivePayments.map((p) => (
              <div key={p.id} className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-emerald-800">+{p.amountBtc.toFixed(8)} BTC</span>
                  <span className="text-zinc-500">at {p.time}</span>
                </div>

                <a
                  href={`https://mempool.space/tx/${p.txid}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[11px] text-zinc-500 hover:text-zinc-900 flex items-center gap-1"
                >
                  <span>{p.txid.slice(0, 10)}...</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
