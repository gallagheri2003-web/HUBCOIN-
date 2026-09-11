import { FC, useState, useEffect } from 'react';
import { BtcAddressData, BtcPriceData, MempoolFees } from '../types';
import { api } from '../services/api';
import { UtxoD3BlockGraph } from './UtxoD3BlockGraph';
import { LivePaymentReceiver } from './LivePaymentReceiver';
import { FederalComplianceVerifier } from './FederalComplianceVerifier';
import QRCode from 'qrcode';
import { 
  Search, 
  Copy, 
  Check, 
  ExternalLink, 
  Layers, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ShieldCheck, 
  Coins, 
  Clock, 
  Calculator, 
  AlertCircle,
  Database,
  Hash,
  ChevronRight,
  Info,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Calendar,
  SlidersHorizontal,
  RefreshCw,
  X
} from 'lucide-react';

interface WalletExplorerProps {
  priceData: BtcPriceData | null;
  feeData: MempoolFees | null;
}

const PRESET_ADDRESSES = [
  { name: '⭐ My Personal Vault', address: 'bc1qq60szunmgzsmjdrjecrkwtpl38jv306hcmm7wm', label: 'Native SegWit (Bech32)' },
  { name: 'Satoshi Genesis', address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', label: 'Legacy (P2PKH)' },
  { name: 'Binance Cold Storage', address: '34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo', label: 'Nested SegWit (P2SH)' },
  { name: 'Bitfinex Cold Vault', address: 'bc1qgdjqv0av3q56jvd82tkdjpy7gdp9ut8tlqmgrpmv24sq90ecnvqqjwvw97', label: 'Native SegWit (Bech32)' },
  { name: 'Sample Taproot', address: 'bc1p5d7rjq7g6rdk2yhzks9s2uma66tm2mgpqjj62azzttf5kv8cc0hs9hurze', label: 'Taproot (P2TR)' },
];

export const WalletExplorer: FC<WalletExplorerProps> = ({ priceData, feeData }) => {
  const [inputAddress, setInputAddress] = useState('bc1qq60szunmgzsmjdrjecrkwtpl38jv306hcmm7wm');
  const [data, setData] = useState<BtcAddressData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  // Interactive Fee/Transfer Calculator state
  const [calcSendAmountBtc, setCalcSendAmountBtc] = useState<string>('0.005');
  const [calcFeeRate, setCalcFeeRate] = useState<number>(feeData?.halfHourFee || 15);
  const [calcTargetAddress, setCalcTargetAddress] = useState<string>('bc1qar0srrr7xfkwyfpwwhcqivteqyv5vfwj3pvea');

  // Transaction filtering and sorting state
  const [txFilterType, setTxFilterType] = useState<'all' | 'incoming' | 'outgoing'>('all');
  const [txFilterStatus, setTxFilterStatus] = useState<'all' | 'confirmed' | 'unconfirmed'>('all');
  const [txFilterDate, setTxFilterDate] = useState<'all' | '7d' | '30d' | '90d' | '365d'>('all');
  const [txSearchQuery, setTxSearchQuery] = useState<string>('');
  const [txSortOrder, setTxSortOrder] = useState<'desc' | 'asc'>('desc');

  const btcPrice = priceData?.priceUsd || 95000;

  // Compute filtered & sorted transactions
  const filteredTxs = (data?.recentTxs || []).filter((tx) => {
    // Type filter
    if (txFilterType === 'incoming' && tx.txType !== 'incoming') return false;
    if (txFilterType === 'outgoing' && tx.txType !== 'outgoing') return false;

    // Status filter
    if (txFilterStatus === 'confirmed' && !tx.confirmed) return false;
    if (txFilterStatus === 'unconfirmed' && tx.confirmed) return false;

    // Date range filter
    if (txFilterDate !== 'all' && tx.blockTime) {
      const txTimeMs = tx.blockTime * 1000;
      const nowMs = Date.now();
      const daysDiff = (nowMs - txTimeMs) / (1000 * 60 * 60 * 24);
      if (txFilterDate === '7d' && daysDiff > 7) return false;
      if (txFilterDate === '30d' && daysDiff > 30) return false;
      if (txFilterDate === '90d' && daysDiff > 90) return false;
      if (txFilterDate === '365d' && daysDiff > 365) return false;
    }

    // Search query
    if (txSearchQuery.trim()) {
      const q = txSearchQuery.trim().toLowerCase();
      const matchTxid = tx.txid.toLowerCase().includes(q);
      const matchHeight = tx.blockHeight ? tx.blockHeight.toString().includes(q) : false;
      const matchType = tx.txType?.toLowerCase().includes(q);
      if (!matchTxid && !matchHeight && !matchType) return false;
    }

    return true;
  }).sort((a, b) => {
    const timeA = a.blockTime || Date.now() / 1000;
    const timeB = b.blockTime || Date.now() / 1000;
    return txSortOrder === 'desc' ? timeB - timeA : timeA - timeB;
  });

  // Export Tax & Accounting CSV
  const handleExportCsv = () => {
    if (!data || filteredTxs.length === 0) return;

    const headers = [
      'TxID',
      'Date/Time (UTC)',
      'Type',
      'Status',
      'Block Height',
      'Net Amount (BTC)',
      'Net Amount (Sats)',
      'Est. USD Value ($)',
      'Fee (Sats)',
      'Fee (BTC)',
      'Inputs Count',
      'Outputs Count',
      'Size (vBytes)',
      'Mempool Explorer Link'
    ];

    const rows = filteredTxs.map((tx) => {
      const btcVal = tx.netAmountSats ? tx.netAmountSats / 100000000 : tx.totalOutputValueSats / 100000000;
      const satsVal = tx.netAmountSats || tx.totalOutputValueSats;
      const usdVal = (btcVal * btcPrice).toFixed(2);
      const feeBtc = (tx.fee / 100000000).toFixed(8);
      const txDate = tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : 'Mempool Unconfirmed';
      const statusStr = tx.confirmed ? 'Confirmed' : 'Unconfirmed';
      const typeStr = tx.txType === 'outgoing' ? 'OUTGOING (SENT)' : 'INCOMING (RECEIVED)';
      const linkStr = `https://mempool.space/tx/${tx.txid}`;

      return [
        tx.txid,
        txDate,
        typeStr,
        statusStr,
        tx.blockHeight || 'Pending',
        btcVal.toFixed(8),
        satsVal,
        usdVal,
        tx.fee,
        feeBtc,
        tx.inputsCount,
        tx.outputsCount,
        tx.size,
        linkStr
      ].map((field) => `"${String(field).replace(/"/g, '""')}"`).join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${data.address.slice(0, 12)}-tax-tx-history.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export Tax & Accounting JSON
  const handleExportJson = () => {
    if (!data || filteredTxs.length === 0) return;

    const exportPayload = {
      exportTimestamp: new Date().toISOString(),
      address: data.address,
      btcPriceUsd: btcPrice,
      totalExportedTransactions: filteredTxs.length,
      filterApplied: {
        type: txFilterType,
        status: txFilterStatus,
        dateRange: txFilterDate,
        searchQuery: txSearchQuery || null,
        sortOrder: txSortOrder
      },
      transactions: filteredTxs.map((tx) => {
        const btcVal = tx.netAmountSats ? tx.netAmountSats / 100000000 : tx.totalOutputValueSats / 100000000;
        return {
          txid: tx.txid,
          dateUtc: tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : null,
          type: tx.txType || 'incoming',
          status: tx.confirmed ? 'confirmed' : 'unconfirmed',
          blockHeight: tx.blockHeight || null,
          netAmountBtc: btcVal,
          netAmountSats: tx.netAmountSats || tx.totalOutputValueSats,
          estUsdValue: parseFloat((btcVal * btcPrice).toFixed(2)),
          feeSats: tx.fee,
          feeBtc: tx.fee / 100000000,
          inputsCount: tx.inputsCount,
          outputsCount: tx.outputsCount,
          sizeBytes: tx.size,
          mempoolUrl: `https://mempool.space/tx/${tx.txid}`
        };
      })
    };

    const jsonString = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${data.address.slice(0, 12)}-tax-tx-history.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const fetchAddressData = async (addrToFetch: string) => {
    const cleanAddr = addrToFetch.trim();
    if (!cleanAddr) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await api.getAddress(cleanAddr);
      setData(res);
      // Generate QR Code
      const qr = await QRCode.toDataURL(cleanAddr, {
        margin: 1,
        width: 160,
        color: { dark: '#18181b', light: '#ffffff' },
      });
      setQrCodeDataUrl(qr);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch on-chain address data');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAddressData(inputAddress);
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Real calculations based on current on-chain balance and standard 1-in 2-out SegWit Tx ~140 vBytes
  const currentBtcBalance = data?.balance.totalBtc || 0;
  const estimatedTxVBytes = 141; // typical native SegWit 1-input 2-output
  const estimatedFeeSats = Math.round(estimatedTxVBytes * calcFeeRate);
  const estimatedFeeBtc = estimatedFeeSats / 100000000;
  const parsedSendBtc = parseFloat(calcSendAmountBtc) || 0;
  const totalRequiredBtc = parsedSendBtc + estimatedFeeBtc;
  const hasSufficientFunds = currentBtcBalance >= totalRequiredBtc;
  const remainingSurplusBtc = Math.max(0, currentBtcBalance - totalRequiredBtc);

  return (
    <div className="space-y-6">
      {/* Search Bar & Address Input */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label htmlFor="btc-address-input" className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
              <Database className="h-4 w-4 text-amber-500" />
              <span>Inspect Bitcoin Wallet (Mainnet On-Chain)</span>
            </label>
            <span className="text-xs font-mono text-zinc-400">P2PKH • P2SH • Bech32 • Taproot</span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchAddressData(inputAddress);
            }}
            className="flex flex-col sm:flex-row gap-2"
          >
            <div className="relative flex-1">
              <input
                id="btc-address-input"
                type="text"
                value={inputAddress}
                onChange={(e) => setInputAddress(e.target.value)}
                placeholder="Enter any Bitcoin address (e.g., bc1q..., 1..., 3..., bc1p...)"
                className="w-full rounded-xl border border-zinc-300 bg-zinc-50/50 px-4 py-2.5 pl-10 font-mono text-sm text-zinc-900 placeholder-zinc-400 transition focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-400" />
            </div>

            <button
              id="btn-inspect-address"
              type="submit"
              disabled={isLoading || !inputAddress.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-zinc-800 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Scanning Chain...</span>
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  <span>Inspect On-Chain</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-xs font-medium text-zinc-500">Live Presets:</span>
            {PRESET_ADDRESSES.map((preset) => (
              <button
                key={preset.address}
                id={`preset-${preset.name.toLowerCase().replace(/\s+/g, '-')}`}
                type="button"
                onClick={() => {
                  setInputAddress(preset.address);
                  fetchAddressData(preset.address);
                }}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                  inputAddress === preset.address
                    ? 'border-amber-500 bg-amber-50 text-amber-900 font-semibold'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-100'
                }`}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
          <div className="flex-1">
            <p className="font-semibold">Query Failed</p>
            <p className="text-rose-700">{error}</p>
          </div>
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Main Wallet Overview Card */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              
              {/* Address Details & QR Code */}
              <div className="flex flex-col sm:flex-row items-start gap-4 flex-1">
                {qrCodeDataUrl && (
                  <div className="rounded-xl border border-zinc-200 bg-white p-2 shadow-xs shrink-0">
                    <img src={qrCodeDataUrl} alt="Address QR Code" className="h-28 w-28 rounded-lg" />
                    <p className="text-center text-[10px] font-medium text-zinc-400 mt-1">Bitcoin QR</p>
                  </div>
                )}

                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                      <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
                      Live Verified Address
                    </span>
                    <span className="text-xs text-zinc-400">
                      Updated: {new Date(data.lastUpdated).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 rounded-lg bg-zinc-50 p-2.5 border border-zinc-200/80">
                    <span className="font-mono text-xs sm:text-sm font-bold text-zinc-900 break-all select-all">
                      {data.address}
                    </span>
                    <button
                      id="btn-copy-address"
                      onClick={() => handleCopy(data.address)}
                      title="Copy Address"
                      className="rounded p-1 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 transition shrink-0"
                    >
                      {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    </button>
                    <a
                      href={`https://mempool.space/address/${data.address}`}
                      target="_blank"
                      rel="noreferrer"
                      title="View on Mempool.space"
                      className="rounded p-1 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 transition shrink-0"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>

                  {/* Summary Metric Chips */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 text-xs">
                    <div className="rounded-lg bg-zinc-50 p-2 border border-zinc-100">
                      <span className="text-zinc-500 block">Total Transactions</span>
                      <span className="font-mono font-bold text-zinc-900">{data.stats.txCount.toLocaleString()}</span>
                    </div>
                    <div className="rounded-lg bg-zinc-50 p-2 border border-zinc-100">
                      <span className="text-zinc-500 block">Total Received</span>
                      <span className="font-mono font-bold text-emerald-700">
                        {data.stats.totalReceivedBtc.toLocaleString(undefined, { maximumFractionDigits: 4 })} BTC
                      </span>
                    </div>
                    <div className="rounded-lg bg-zinc-50 p-2 border border-zinc-100 col-span-2 sm:col-span-1">
                      <span className="text-zinc-500 block">Total Sent</span>
                      <span className="font-mono font-bold text-rose-700">
                        {data.stats.totalSentBtc.toLocaleString(undefined, { maximumFractionDigits: 4 })} BTC
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Balances Display Panel */}
              <div className="flex flex-col rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-5 text-white shadow-md lg:w-80 shrink-0">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                  Current On-Chain Balance
                </span>
                
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-mono text-3xl font-black tracking-tight text-white">
                    {data.balance.totalBtc.toFixed(8)}
                  </span>
                  <span className="font-sans text-lg font-bold text-amber-400">BTC</span>
                </div>

                <div className="mt-1 flex items-center justify-between text-xs text-zinc-300">
                  <span className="font-mono">{data.balance.totalSats.toLocaleString()} Sats</span>
                  <span className="font-semibold text-emerald-400">
                    ≈ ${(data.balance.totalBtc * btcPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                  </span>
                </div>

                <div className="mt-4 border-t border-zinc-700/60 pt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between text-zinc-300">
                    <span>Confirmed On-Chain:</span>
                    <span className="font-mono text-white font-medium">{data.balance.confirmedBtc.toFixed(8)} BTC</span>
                  </div>
                  {data.balance.unconfirmedBtc !== 0 && (
                    <div className="flex justify-between text-amber-300 font-medium">
                      <span>Unconfirmed (Mempool):</span>
                      <span className="font-mono">{data.balance.unconfirmedBtc.toFixed(8)} BTC</span>
                    </div>
                  )}
                  <div className="flex justify-between text-zinc-400">
                    <span>Active UTXO Count:</span>
                    <span className="font-mono font-medium text-white">{data.utxos.length}</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Live Payment Engine & Invoice Generator for Target Wallet */}
          <LivePaymentReceiver
            address={data.address}
            walletLabel={PRESET_ADDRESSES.find(p => p.address === data.address)?.name || 'Inspected Bitcoin Wallet'}
            priceData={priceData}
            onPaymentDetected={() => {
              // Refresh on-chain address data when live payment arrives
              fetchAddressData(data.address);
            }}
          />

          {/* Federal Self-Custody Message Auto-Signer & Compliance Verifier */}
          <FederalComplianceVerifier
            address={data.address}
            priceData={priceData}
          />

          {/* Interactive Fund Allocation & Transaction Planner (Based on real on-chain UTXO model) */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
                  <Calculator className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-serif text-base font-bold text-zinc-900">
                    Non-Mock UTXO Allocation & Fee Calculator
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Live mathematical calculation based on genuine network mempool fee rates & SegWit weights
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-zinc-700">
                  Send Amount (BTC)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.0001"
                    min="0.00000546"
                    value={calcSendAmountBtc}
                    onChange={(e) => setCalcSendAmountBtc(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm font-mono text-zinc-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-zinc-400">BTC</span>
                </div>
                <div className="flex gap-1 text-[11px]">
                  {['0.001', '0.005', '0.01', '0.05'].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCalcSendAmountBtc(amt)}
                      className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-zinc-700 hover:bg-zinc-200"
                    >
                      {amt}
                    </button>
                  ))}
                  {currentBtcBalance > 0 && (
                    <button
                      type="button"
                      onClick={() => setCalcSendAmountBtc(Math.max(0, currentBtcBalance - estimatedFeeBtc).toFixed(8))}
                      className="rounded bg-amber-100 px-2 py-0.5 font-semibold text-amber-900 hover:bg-amber-200"
                    >
                      Max
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-semibold text-zinc-700">
                  Network Fee Rate (sat/vB)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    value={calcFeeRate}
                    onChange={(e) => setCalcFeeRate(parseInt(e.target.value) || 1)}
                    className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm font-mono text-zinc-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-zinc-400">sat/vB</span>
                </div>
                {feeData && (
                  <div className="flex gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setCalcFeeRate(feeData.fastestFee)}
                      className="rounded bg-emerald-50 px-2 py-0.5 font-medium text-emerald-800 hover:bg-emerald-100"
                    >
                      Fast ({feeData.fastestFee})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalcFeeRate(feeData.halfHourFee)}
                      className="rounded bg-blue-50 px-2 py-0.5 font-medium text-blue-800 hover:bg-blue-100"
                    >
                      Medium ({feeData.halfHourFee})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalcFeeRate(feeData.economyFee)}
                      className="rounded bg-zinc-100 px-2 py-0.5 font-medium text-zinc-700 hover:bg-zinc-200"
                    >
                      Eco ({feeData.economyFee})
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-semibold text-zinc-700">
                  Recipient Destination Address
                </label>
                <input
                  type="text"
                  value={calcTargetAddress}
                  onChange={(e) => setCalcTargetAddress(e.target.value)}
                  placeholder="bc1q..."
                  className="w-full rounded-xl border border-zinc-300 px-3 py-2 font-mono text-xs text-zinc-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>

            {/* Calculated Breakdown Results */}
            <div className="mt-5 rounded-xl bg-zinc-50 border border-zinc-200 p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-zinc-500 block">Estimated Virtual Size:</span>
                  <span className="font-mono font-bold text-zinc-900">~{estimatedTxVBytes} vBytes</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Calculated Miner Fee:</span>
                  <span className="font-mono font-bold text-amber-700">
                    {estimatedFeeSats.toLocaleString()} Sats ({estimatedFeeBtc.toFixed(8)} BTC)
                  </span>
                  <span className="text-[10px] text-zinc-400 block">≈ ${(estimatedFeeBtc * btcPrice).toFixed(2)} USD</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Total Required:</span>
                  <span className="font-mono font-bold text-zinc-900">{totalRequiredBtc.toFixed(8)} BTC</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Solvency Status:</span>
                  <span className={`font-semibold inline-flex items-center gap-1 ${
                    hasSufficientFunds ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    {hasSufficientFunds ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> Sufficient Funds
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-3.5 w-3.5" /> Insufficient Balance
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* D3 Color-Coded UTXO Age & Size Graph */}
          <UtxoD3BlockGraph utxos={data.utxos} priceData={priceData} />

          {/* UTXO (Unspent Transaction Outputs) List */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-amber-500" />
                <h3 className="font-serif text-base font-bold text-zinc-900">
                  Unspent Transaction Outputs (UTXOs)
                </h3>
              </div>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-mono font-semibold text-zinc-700">
                {data.utxos.length} Available UTXOs
              </span>
            </div>

            {data.utxos.length === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-400">
                No unspent transaction outputs detected on-chain for this address.
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-zinc-100 text-zinc-500 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-3 px-3">UTXO Outpoint (TXID : VOUT)</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Block Height</th>
                      <th className="py-3 px-3 text-right">Value (Sats)</th>
                      <th className="py-3 px-3 text-right">Value (BTC)</th>
                      <th className="py-3 px-3 text-right">Mempool</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 font-mono">
                    {data.utxos.map((utxo, idx) => (
                      <tr key={`${utxo.txid}-${utxo.vout}`} className="hover:bg-zinc-50/80 transition">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-zinc-400 font-sans">#{idx + 1}</span>
                            <span className="font-bold text-zinc-900 max-w-[200px] truncate" title={utxo.txid}>
                              {utxo.txid.slice(0, 10)}...{utxo.txid.slice(-8)}
                            </span>
                            <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] text-zinc-800">
                              :{utxo.vout}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-sans">
                          {utxo.status.confirmed ? (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                              <Check className="h-3 w-3" /> Confirmed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                              <Clock className="h-3 w-3" /> In Mempool
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-zinc-600">
                          {utxo.status.block_height ? utxo.status.block_height.toLocaleString() : 'Pending'}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-zinc-900">
                          {utxo.value.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-amber-700">
                          {(utxo.value / 100000000).toFixed(8)} BTC
                        </td>
                        <td className="py-3 px-3 text-right">
                          <a
                            href={`https://mempool.space/tx/${utxo.txid}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center text-zinc-400 hover:text-zinc-900"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* On-Chain Transaction History & Tax/Accounting Export Suite */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs space-y-5">
            
            {/* Header with Title and CSV/JSON Export Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-100 pb-4 gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-amber-500" />
                  <h3 className="font-serif text-base font-bold text-zinc-900">
                    On-Chain Transaction Audit & Accounting History
                  </h3>
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-900">
                    {filteredTxs.length} of {data.recentTxs.length} Transactions
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Filter by date, type, and status, and export full tax report files in CSV or JSON
                </p>
              </div>

              {/* Tax & Accounting Export Buttons */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  id="btn-export-csv"
                  onClick={handleExportCsv}
                  disabled={filteredTxs.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <span>Export CSV (Tax/Excel)</span>
                </button>

                <button
                  type="button"
                  id="btn-export-json"
                  onClick={handleExportJson}
                  disabled={filteredTxs.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-bold text-zinc-800 hover:bg-zinc-100 transition shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FileText className="h-4 w-4 text-zinc-600" />
                  <span>Export JSON</span>
                </button>
              </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
                
                {/* Search query input (4 cols) */}
                <div className="lg:col-span-4 relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                  <input
                    type="text"
                    value={txSearchQuery}
                    onChange={(e) => setTxSearchQuery(e.target.value)}
                    placeholder="Search TXID, Block, Type..."
                    className="w-full rounded-xl border border-zinc-300 bg-white pl-9 pr-8 py-1.5 text-xs font-mono text-zinc-900 focus:border-amber-500 focus:outline-none"
                  />
                  {txSearchQuery && (
                    <button
                      onClick={() => setTxSearchQuery('')}
                      className="absolute right-2.5 top-2 text-zinc-400 hover:text-zinc-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Transaction Type Filter (2 cols) */}
                <div className="lg:col-span-2">
                  <select
                    value={txFilterType}
                    onChange={(e: any) => setTxFilterType(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-800 focus:border-amber-500 focus:outline-none"
                  >
                    <option value="all">Type: All</option>
                    <option value="incoming">📥 Incoming (Received)</option>
                    <option value="outgoing">📤 Outgoing (Sent)</option>
                  </select>
                </div>

                {/* Confirmed Status Filter (2 cols) */}
                <div className="lg:col-span-2">
                  <select
                    value={txFilterStatus}
                    onChange={(e: any) => setTxFilterStatus(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-800 focus:border-amber-500 focus:outline-none"
                  >
                    <option value="all">Status: All</option>
                    <option value="confirmed">✅ Confirmed Only</option>
                    <option value="unconfirmed">⏳ Mempool Only</option>
                  </select>
                </div>

                {/* Date Range Filter (2 cols) */}
                <div className="lg:col-span-2">
                  <select
                    value={txFilterDate}
                    onChange={(e: any) => setTxFilterDate(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-800 focus:border-amber-500 focus:outline-none"
                  >
                    <option value="all">Date: All Time</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                    <option value="90d">Last 90 Days</option>
                    <option value="365d">Last 365 Days</option>
                  </select>
                </div>

                {/* Sort Order Toggle (2 cols) */}
                <div className="lg:col-span-2 flex items-center gap-2">
                  <button
                    onClick={() => setTxSortOrder(txSortOrder === 'desc' ? 'asc' : 'desc')}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 flex items-center justify-center gap-1.5"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-500" />
                    <span>{txSortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</span>
                  </button>
                </div>

              </div>

              {/* Active Filter Pill badges & Reset Button */}
              {(txFilterType !== 'all' || txFilterStatus !== 'all' || txFilterDate !== 'all' || txSearchQuery) && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-zinc-200/60 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-zinc-500">Active Filters:</span>
                    {txFilterType !== 'all' && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-900">
                        Type: {txFilterType}
                      </span>
                    )}
                    {txFilterStatus !== 'all' && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-900">
                        Status: {txFilterStatus}
                      </span>
                    )}
                    {txFilterDate !== 'all' && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-900">
                        Date: {txFilterDate}
                      </span>
                    )}
                    {txSearchQuery && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-900">
                        Query: "{txSearchQuery}"
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setTxFilterType('all');
                      setTxFilterStatus('all');
                      setTxFilterDate('all');
                      setTxSearchQuery('');
                      setTxSortOrder('desc');
                    }}
                    className="text-[11px] font-semibold text-amber-800 hover:text-amber-950 underline"
                  >
                    Reset All Filters
                  </button>
                </div>
              )}
            </div>

            {/* Transactions List / Cards */}
            {filteredTxs.length === 0 ? (
              <div className="py-12 text-center text-sm text-zinc-400 space-y-1">
                <p className="font-semibold text-zinc-600">No transactions match the selected filters.</p>
                <p className="text-xs">Try resetting filters or expanding the date range query.</p>
              </div>
            ) : (
              <div className="mt-2 divide-y divide-zinc-100">
                {filteredTxs.map((tx) => {
                  const isIncoming = tx.txType !== 'outgoing';
                  const btcVal = tx.netAmountSats ? tx.netAmountSats / 100000000 : tx.totalOutputValueSats / 100000000;
                  const usdVal = btcVal * btcPrice;

                  return (
                    <div key={tx.txid} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-50/80 rounded-xl px-3 transition">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {/* Direction Indicator Badge */}
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                              isIncoming ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'
                            }`}
                          >
                            {isIncoming ? (
                              <>
                                <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600" /> Received (IN)
                              </>
                            ) : (
                              <>
                                <ArrowUpRight className="h-3.5 w-3.5 text-rose-600" /> Sent (OUT)
                              </>
                            )}
                          </span>

                          <span className="font-mono text-xs font-bold text-zinc-900 truncate max-w-[180px] sm:max-w-none" title={tx.txid}>
                            {tx.txid.slice(0, 12)}...{tx.txid.slice(-8)}
                          </span>

                          {tx.confirmed ? (
                            <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              Block #{tx.blockHeight?.toLocaleString()}
                            </span>
                          ) : (
                            <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 animate-pulse">
                              In Mempool
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 font-mono">
                          {tx.blockTime && (
                            <span className="font-sans text-zinc-600 font-medium">
                              📅 {new Date(tx.blockTime * 1000).toLocaleString()}
                            </span>
                          )}
                          <span>Fee: {tx.fee} Sats</span>
                          <span>Size: {tx.size} vB</span>
                          <span>Ins/Outs: {tx.inputsCount}/{tx.outputsCount}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <div className="text-right">
                          <span className={`font-mono text-sm font-bold block ${isIncoming ? 'text-emerald-700' : 'text-zinc-900'}`}>
                            {isIncoming ? '+' : '-'}{btcVal.toFixed(8)} BTC
                          </span>
                          <span className="text-[11px] font-medium text-zinc-500">
                            ≈ ${usdVal.toFixed(2)} USD
                          </span>
                        </div>
                        <a
                          href={`https://mempool.space/tx/${tx.txid}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-zinc-200 p-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition"
                          title="Inspect Transaction on Mempool.space"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>

        </div>
      )}
    </div>
  );
};
