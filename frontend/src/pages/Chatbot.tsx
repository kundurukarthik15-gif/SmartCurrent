// frontend/src/pages/Chatbot.tsx
import React, { useContext, useState, useRef, useEffect } from 'react';
import { 
  MessageSquareCode, 
  Send, 
  Sparkles,
  HelpCircle,
  TrendingUp,
  Leaf,
  Layers,
  Cpu
} from 'lucide-react';
import { PropertyContext, AuthContext, API_BASE } from '../App';

interface Message {
  sender: 'user' | 'bot';
  text: string;
}

export default function Chatbot() {
  const auth = useContext(AuthContext);
  const propCtx = useContext(PropertyContext);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  
  const activeMeter = propCtx?.activeMeter;
  const activeProperty = propCtx?.activeProperty;

  // Add initial message on mount
  useEffect(() => {
    if (activeProperty && activeMeter) {
      setMessages([
        {
          sender: 'bot',
          text: `⚡ **Hello! I am your Smart AI Energy Assistant.**\n\nI have loaded details for your property **${activeProperty.name}** (Meter: \`${activeMeter.meter_number}\`). Ask me anything about your billing trends, tariff slabs, consumption spikes, or energy efficiency. Use the suggestion chips below to start quickly!`
        }
      ]);
    } else {
      setMessages([
        {
          sender: 'bot',
          text: `⚡ **Hello! I am your Smart AI Energy Assistant.**\n\nPlease add a property and select a meter connection to unlock account-specific billing analysis.`
        }
      ]);
    }
  }, [activeMeter]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || !activeMeter) return;
    
    // Add user message
    const userMsg: Message = { sender: 'user', text: textToSend };
    setMessages(prev => [...prev, userMsg]);
    setUserInput("");
    setIsTyping(true);

    try {
      const res = await fetch(`${API_BASE}/chatbot/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${auth?.token}`
        },
        body: JSON.stringify({
          question: textToSend,
          meter_id: activeMeter.id
        })
      });

      const data = await res.json();
      if (res.ok) {
        setMessages(prev => [...prev, { sender: 'bot', text: data.answer }]);
      } else {
        setMessages(prev => [...prev, { sender: 'bot', text: "Sorry, I had an error accessing your billing records. Please check database logs." }]);
      }
    } catch {
      setMessages(prev => [...prev, { sender: 'bot', text: "Unable to reach the AI chatbot server. Make sure FastAPI server is running." }]);
    } finally {
      setIsTyping(false);
    }
  };

  // Basic regex markdown helper to map string inputs to clean HTML
  const formatMarkdown = (txt: string) => {
    return txt.split("\n").map((line, i) => {
      let formatted = line;
      
      // Headings: ### Title
      if (formatted.startsWith("### ")) {
        return <h4 key={i} className="text-sm font-extrabold text-slate-800 dark:text-white mt-4 mb-2 first:mt-0">{formatted.replace("### ", "")}</h4>;
      }
      
      // Bold text: **text**
      const boldRegex = /\*\*(.*?)\*\*/g;
      const parts = [];
      let lastIndex = 0;
      let match;
      
      while ((match = boldRegex.exec(formatted)) !== null) {
        if (match.index > lastIndex) {
          parts.push(formatted.substring(lastIndex, match.index));
        }
        parts.push(<strong key={match.index} className="font-extrabold text-indigo-500">{match[1]}</strong>);
        lastIndex = boldRegex.lastIndex;
      }
      if (lastIndex < formatted.length) {
        parts.push(formatted.substring(lastIndex));
      }
      
      const content = parts.length > 0 ? parts : formatted;

      // Bullet lists
      if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        return (
          <div key={i} className="flex gap-2 ml-3 my-1">
            <span className="text-indigo-500 font-bold">•</span>
            <span className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{line.replace(/^[-*]\s+/, "")}</span>
          </div>
        );
      }

      // Ordered lists (numbers)
      const numMatch = line.trim().match(/^(\d+)\.\s+(.*)/);
      if (numMatch) {
        return (
          <div key={i} className="flex gap-2 ml-3 my-1">
            <span className="text-indigo-500 font-bold">{numMatch[1]}.</span>
            <span className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{numMatch[2]}</span>
          </div>
        );
      }
      
      return (
        <p key={i} className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 min-h-[1rem]">
          {content}
        </p>
      );
    });
  };

  const suggestionChips = [
    { text: "Why is my bill high?", icon: TrendingUp },
    { text: "How can I reduce my bill?", icon: Leaf },
    { text: "Predict my next month's bill.", icon: Cpu },
    { text: "Explain my tariff calculations.", icon: Layers }
  ];

  return (
    <div className="flex flex-col h-[76vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-xl overflow-hidden">
      
      {/* Bot Header */}
      <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/20">
            <MessageSquareCode className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-850 dark:text-white">AI Energy Assistant</h3>
            <p className="text-[10px] text-emerald-500 font-bold flex items-center gap-1">
              <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-ping"></span> Live context-aware agent
            </p>
          </div>
        </div>
        {activeProperty && (
          <span className="bg-slate-100 dark:bg-slate-800 text-[10px] font-bold px-2.5 py-1 rounded-lg">
            Context: {activeProperty.name}
          </span>
        )}
      </div>

      {/* Messages Thread */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`
              max-w-[75%] p-4 rounded-2xl shadow-sm border space-y-2
              ${msg.sender === 'user' 
                ? 'bg-indigo-500 border-indigo-400 text-white rounded-tr-none' 
                : 'bg-slate-50 border-slate-100 dark:bg-slate-800/40 dark:border-slate-800 rounded-tl-none'}
            `}>
              {msg.sender === 'user' ? (
                <p className="text-xs leading-relaxed font-semibold">{msg.text}</p>
              ) : (
                <div className="space-y-1.5">{formatMarkdown(msg.text)}</div>
              )}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
              <span className="h-1.5 w-1.5 bg-indigo-500 rounded-full animate-bounce"></span>
              <span className="h-1.5 w-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
              <span className="h-1.5 w-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestion Chips */}
      {messages.length < 5 && (
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/20 flex flex-wrap gap-2">
          {suggestionChips.map((chip, idx) => {
            const IconComp = chip.icon;
            return (
              <button
                key={idx}
                disabled={!activeMeter}
                onClick={() => handleSend(chip.text)}
                className="bg-white hover:bg-indigo-50 dark:bg-slate-850 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xxs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-40"
              >
                <IconComp className="h-3.5 w-3.5 text-indigo-500" />
                {chip.text}
              </button>
            );
          })}
        </div>
      )}

      {/* Input panel */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder={activeMeter ? "Ask details like: 'Compare my last 5 bills' or 'Predict next month'..." : "Sync meter connection first"}
            disabled={!activeMeter || isTyping}
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend(userInput)}
            className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs outline-none focus:border-indigo-500 disabled:opacity-40"
          />
          <button
            onClick={() => handleSend(userInput)}
            disabled={!activeMeter || !userInput.trim() || isTyping}
            className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-xl transition-colors shadow-lg shadow-indigo-600/10 disabled:opacity-40 flex-shrink-0"
          >
            <Send className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

    </div>
  );
}
