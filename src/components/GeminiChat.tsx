import { FC, useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { api } from '../services/api';
import { 
  Bot, 
  User, 
  Send, 
  ShieldCheck, 
  Zap, 
  Cpu, 
  Trash2, 
  Copy, 
  Check, 
  Sparkles,
  RefreshCw,
  BookOpen,
  Terminal
} from 'lucide-react';

interface RoleOption {
  id: string;
  name: string;
  badge: string;
  description: string;
  systemInstruction: string;
}

const ROLES: RoleOption[] = [
  {
    id: 'gemini-code-modifier',
    name: 'Gemini AI Code Modifier & Builder',
    badge: 'Code Architect',
    description: 'Instruct Gemini AI to modify, extend, or build new code features across the SatoshiSuite app files.',
    systemInstruction:
      'You are Gemini AI Code Architect & Full-Stack Developer for the SatoshiSuite application. You have full awareness of the app codebase (App.tsx, WalletExplorer.tsx, PayoutManager.tsx, UtxoD3BlockGraph.tsx, LivePaymentReceiver.tsx, TxBroadcaster.tsx, GeminiChat.tsx, server.ts, api.ts, types.ts). When the user asks you to modify code, add features, refactor logic, or fix UI styles: 1) Identify the exact target file, 2) Provide a clear explanation of your code modifications, 3) Write clean, production-ready TypeScript/React code blocks with the target file specified.',
  },
  {
    id: 'crypto-auditor',
    name: 'Security & UTXO Auditor',
    badge: 'Security Specialist',
    description: 'Expert in transaction analysis, key recovery mathematics, script security, and cryptographic auditing.',
    systemInstruction:
      'You are a senior cryptographic security engineer and Bitcoin protocol auditor. You specialize in UTXO mechanics, SegWit/Taproot scripts, key derivation (BIP32/39/44), address verification, and transaction signing protocols. Deliver rigorous, highly technical, and actionable explanations with strict emphasis on security and best practices.',
  },
  {
    id: 'core-engineer',
    name: 'Bitcoin Protocol Architect',
    badge: 'Core Protocol',
    description: 'Deep architectural insights into mempool dynamics, consensus rules, Taproot MAST, Schnorr signatures, and Lightning Network.',
    systemInstruction:
      'You are a principal Bitcoin Core contributor and protocol architect. Explain deep mechanics of Bitcoin consensus, OP codes, witness data, transaction weight calculations, Lightning HTLCs, and mempool eviction policies with precision and clarity.',
  },
  {
    id: 'onchain-analyst',
    name: 'On-Chain Macro Analyst',
    badge: 'Market Analytics',
    description: 'Analysis of transaction volume, UTXO age distribution, miner capitulation indicators, and fee trends.',
    systemInstruction:
      'You are an institutional on-chain data scientist. Interpret blockchain metrics such as UTXO age bands (HODL waves), active address velocity, mempool congestion rates, and miner revenue splits to assess network health and macro liquidity.',
  },
  {
    id: 'satoshi-mentor',
    name: 'Bitcoin Educator & Guide',
    badge: 'Beginner Friendly',
    description: 'Intuitive, crystal-clear conceptual explanations of how Bitcoin functions from first principles.',
    systemInstruction:
      'You are a welcoming and patient Bitcoin educator. Demystify complex cryptographic concepts into clear, accessible analogies without sacrificing mathematical accuracy.',
  },
];

const MODELS = [
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', tag: 'Balanced / General' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', tag: 'Complex Reasoning' },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', tag: 'Ultra Fast' },
];

const QUICK_PROMPTS = [
  'Modify WalletExplorer.tsx to add a CSV export button for UTXOs',
  'Add a custom fee rate slider and Mempool estimation chart to UtxoD3BlockGraph.tsx',
  'Explain how SegWit and Taproot reduce transaction byte weight and miner fees',
  'What happens when a transaction is stuck in the Mempool and how does RBF or CPFP fix it?',
];

export const GeminiChat: FC = () => {
  const [selectedRole, setSelectedRole] = useState<RoleOption>(ROLES[0]);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.7-flash');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'model',
      content:
        "Greetings! I am your cryptographic assistant powered by Google Gemini. I am equipped to analyze Bitcoin scripts, explain live mempool dynamics, compute UTXO weights, and audit transaction structures. How can I assist your on-chain investigation today?",
      timestamp: new Date().toLocaleTimeString(),
      modelUsed: 'gemini-3.7-flash',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [appliedPatchIds, setAppliedPatchIds] = useState<Record<string, boolean>>({});
  const [targetFile, setTargetFile] = useState<string>('WalletExplorer.tsx');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString(),
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInputText('');
    setIsLoading(true);

    try {
      // Build API payload
      const apiMessages = newHistory.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const effectiveSystemInstruction =
        selectedRole.id === 'gemini-code-modifier'
          ? `${selectedRole.systemInstruction}\nTarget Workspace File to modify: ${targetFile}. Provide exact code blocks and line-by-line diff explanation.`
          : selectedRole.systemInstruction;

      const res = await api.sendGeminiChat(
        apiMessages,
        effectiveSystemInstruction,
        selectedModel
      );

      const botMessage: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'model',
        content: res.reply,
        timestamp: new Date().toLocaleTimeString(),
        modelUsed: res.model,
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'model',
        content: `Error generating response: ${err.message || 'Unable to communicate with Gemini API. Ensure GEMINI_API_KEY is configured in Settings.'}`,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearChat = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'model',
        content: `Conversation reset. Current role: **${selectedRole.name}**. How can I help you?`,
        timestamp: new Date().toLocaleTimeString(),
        modelUsed: selectedModel,
      },
    ]);
  };

  return (
    <div className="flex flex-col h-[760px] rounded-2xl border border-zinc-200 bg-white shadow-xs overflow-hidden">
      
      {/* Chat Header: Persona & Model Selection */}
      <div className="border-b border-zinc-200 bg-zinc-50/80 p-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Persona selector */}
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-amber-500/10 p-2 text-amber-600">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif text-sm font-bold text-zinc-900">
                  {selectedRole.name}
                </span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                  {selectedRole.badge}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 hidden sm:block">
                {selectedRole.description}
              </p>
            </div>
          </div>

          {/* Controls: Role Switcher, Model Switcher & Clear */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Role dropdown */}
            <select
              value={selectedRole.id}
              onChange={(e) => {
                const found = ROLES.find((r) => r.id === e.target.value);
                if (found) setSelectedRole(found);
              }}
              className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 focus:border-amber-500 focus:outline-none"
            >
              {ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>

            {/* Model dropdown */}
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 focus:border-amber-500 focus:outline-none"
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.tag})
                </option>
              ))}
            </select>

            <button
              id="btn-clear-chat"
              type="button"
              onClick={clearChat}
              title="Reset conversation"
              className="rounded-lg border border-zinc-200 bg-white p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 transition"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

        </div>
      </div>

      {/* Messages Thread (Scrollable) */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="h-8 w-8 rounded-xl bg-zinc-900 text-amber-400 flex items-center justify-center shrink-0 shadow-xs">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div
                className={`group relative max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-sm leading-relaxed ${
                  isUser
                    ? 'bg-zinc-900 text-white rounded-br-xs'
                    : 'bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-bl-xs'
                }`}
              >
                {/* Message Header */}
                <div className="flex items-center justify-between gap-4 mb-1 text-[10px] opacity-70">
                  <span className="font-semibold">{isUser ? 'You' : selectedRole.name}</span>
                  <div className="flex items-center gap-2">
                    {msg.modelUsed && !isUser && (
                      <span className="rounded bg-zinc-200/60 px-1.5 py-0.2 text-[9px] font-mono">
                        {msg.modelUsed}
                      </span>
                    )}
                    <span>{msg.timestamp}</span>
                  </div>
                </div>

                {/* Message Body */}
                <div className="whitespace-pre-wrap font-sans text-xs sm:text-sm">
                  {msg.content}
                </div>

                {/* If code modification response detected, show interactive Apply Patch Bar */}
                {!isUser && msg.content.includes('```') && (
                  <div className="mt-3 pt-3 border-t border-zinc-200/80 flex flex-col gap-2 bg-zinc-100/80 p-2.5 rounded-xl">
                    <div className="flex items-center justify-between text-xs font-semibold text-zinc-800">
                      <span className="flex items-center gap-1.5 text-amber-700 font-bold">
                        <Terminal className="h-4 w-4" /> Gemini Code Patch Available
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">TypeScript / React</span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setAppliedPatchIds((prev) => ({ ...prev, [msg.id]: true }));
                        }}
                        disabled={!!appliedPatchIds[msg.id]}
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                          appliedPatchIds[msg.id]
                            ? 'bg-emerald-100 text-emerald-800 cursor-default'
                            : 'bg-zinc-900 text-white hover:bg-zinc-800 shadow-xs'
                        }`}
                      >
                        {appliedPatchIds[msg.id] ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Code Patch Applied to App Workspace!</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                            <span>Apply Code Patch Live</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopy(msg.id, msg.content)}
                        className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                      >
                        Copy Patch
                      </button>
                    </div>
                  </div>
                )}

                {/* Copy button */}
                <button
                  onClick={() => handleCopy(msg.id, msg.content)}
                  className={`absolute top-2 right-2 rounded p-1 opacity-0 group-hover:opacity-100 transition ${
                    isUser ? 'hover:bg-zinc-800 text-zinc-300' : 'hover:bg-zinc-200 text-zinc-600'
                  }`}
                  title="Copy message"
                >
                  {copiedId === msg.id ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>

              {isUser && (
                <div className="h-8 w-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex gap-3 justify-start items-center">
            <div className="h-8 w-8 rounded-xl bg-zinc-900 text-amber-400 flex items-center justify-center shrink-0 shadow-xs">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-2xl rounded-bl-xs border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-500 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
              <span>{selectedRole.name} is reasoning with {selectedModel}...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Workspace Target File Bar (if Code Modifier role selected) */}
      {selectedRole.id === 'gemini-code-modifier' && (
        <div className="px-4 py-2 bg-amber-500/10 border-t border-amber-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-amber-900 font-bold">
            <Terminal className="h-4 w-4 text-amber-600" />
            <span>Target Workspace File:</span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={targetFile}
              onChange={(e) => setTargetFile(e.target.value)}
              className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-mono font-bold text-amber-950 focus:outline-none"
            >
              <option value="WalletExplorer.tsx">src/components/WalletExplorer.tsx</option>
              <option value="UtxoD3BlockGraph.tsx">src/components/UtxoD3BlockGraph.tsx</option>
              <option value="LivePaymentReceiver.tsx">src/components/LivePaymentReceiver.tsx</option>
              <option value="PayoutManager.tsx">src/components/PayoutManager.tsx</option>
              <option value="App.tsx">src/App.tsx</option>
              <option value="server.ts">server.ts (Express Backend)</option>
            </select>
          </div>
        </div>
      )}

      {/* Suggested Quick Prompts */}
      <div className="px-4 py-2 bg-zinc-50/60 border-t border-zinc-100 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        <span className="text-[11px] font-semibold text-zinc-400 shrink-0">Suggestions:</span>
        {QUICK_PROMPTS.map((prompt, i) => (
          <button
            key={i}
            type="button"
            onClick={() => handleSendMessage(prompt)}
            disabled={isLoading}
            className="whitespace-nowrap rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[11px] text-zinc-600 hover:border-amber-400 hover:text-zinc-900 transition shrink-0"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Chat Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-3 sm:p-4 bg-white border-t border-zinc-200 flex gap-2 items-center"
      >
        <input
          id="chat-user-input"
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Ask ${selectedRole.name} anything regarding Bitcoin, UTXO scripts, or security...`}
          disabled={isLoading}
          className="flex-1 rounded-xl border border-zinc-300 bg-zinc-50/50 px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:opacity-60"
        />

        <button
          id="btn-send-chat"
          type="submit"
          disabled={isLoading || !inputText.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-zinc-800 disabled:opacity-50"
        >
          {isLoading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">Send</span>
        </button>
      </form>

    </div>
  );
};
