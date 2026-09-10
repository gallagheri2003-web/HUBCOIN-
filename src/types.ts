export interface BtcBalance {
  totalBtc: number;
  totalSats: number;
  confirmedBtc: number;
  confirmedSats: number;
  unconfirmedBtc: number;
  unconfirmedSats: number;
}

export interface BtcStats {
  txCount: number;
  fundedTxoCount: number;
  spentTxoCount: number;
  totalReceivedBtc: number;
  totalSentBtc: number;
}

export interface BtcUtxo {
  txid: string;
  vout: number;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
  value: number;
}

export interface BtcTransactionSummary {
  txid: string;
  version: number;
  locktime: number;
  size: number;
  weight: number;
  fee: number;
  confirmed: boolean;
  blockHeight?: number;
  blockTime?: number;
  inputsCount: number;
  outputsCount: number;
  totalOutputValueSats: number;
  txType?: 'incoming' | 'outgoing';
  netAmountSats?: number;
  receivedSats?: number;
  sentSats?: number;
}

export interface BtcAddressData {
  address: string;
  balance: BtcBalance;
  stats: BtcStats;
  utxos: BtcUtxo[];
  recentTxs: BtcTransactionSummary[];
  isLiveOnChain: boolean;
  lastUpdated: string;
}

export interface MempoolFees {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
  source: string;
  timestamp: number;
}

export interface BtcPriceData {
  priceUsd: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volumeBtc: number;
  quoteVolumeUsd: number;
  source: string;
  timestamp: number;
}

export interface BlockInfo {
  id: string;
  height: number;
  version: number;
  timestamp: number;
  tx_count: number;
  size: number;
  weight: number;
  merkle_root: string;
  previousblockhash: string;
  mediantime: number;
  nonce: number;
  bits: number;
  difficulty: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  modelUsed?: string;
}

export interface GeneratedImage {
  id: string;
  imageUrl: string;
  prompt: string;
  imageSize: '1K' | '2K' | '4K';
  aspectRatio: string;
  timestamp: string;
  model: string;
}

export interface PayoutWallet {
  id: string;
  label: string;
  address: string;
  addressType: 'Native SegWit (Bech32)' | 'Taproot (Bech32m)' | 'Nested SegWit (P2SH)' | 'Legacy (P2PKH)' | 'Unknown';
  isDefault: boolean;
  addedAt: string;
  lastUsedAt?: string;
  confirmedBalanceSats?: number;
  unconfirmedBalanceSats?: number;
  totalReceivedBtc?: number;
}

export interface PayoutRecord {
  id: string;
  timestamp: string;
  destinationAddress: string;
  walletLabel: string;
  grossAmountBtc: number;
  grossAmountSats: number;
  estimatedFeeSats: number;
  feeRateSatVb: number;
  netPayoutBtc: number;
  netPayoutSats: number;
  status: 'drafted' | 'ready_to_sign' | 'broadcasted' | 'confirmed';
  txid?: string;
  notes?: string;
}
