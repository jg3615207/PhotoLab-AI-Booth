import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, User, Send, Plus, Trash2, Image as ImageIcon, Sparkles, 
  Wand2, Palette, RefreshCw, Check, Copy, AlertCircle, ChevronRight, 
  MessageSquare, Sliders, Play, Code, Eye
} from 'lucide-react';
import { useAdminLang } from '../context/AdminLangContext';

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

interface Message {
  id?: number;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  images?: string[];
  tool_calls?: any[];
  tool_results?: any[];
  created_at?: string;
  isStreaming?: boolean;
}

interface AgentTabProps {
  onNavigateToStyles?: () => void;
}

export const AgentTab: React.FC<AgentTabProps> = ({ onNavigateToStyles }) => {
  const { lang } = useAdminLang();
  const isZh = lang === 'zh-Hant';

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [activeToolName, setActiveToolName] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating, activeToolName]);

  // Load conversations list
  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/agent/conversations');
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
        if (data.length > 0 && !activeConvId) {
          setActiveConvId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  // Load active conversation history
  useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }
    const loadHistory = async () => {
      try {
        const res = await fetch(`/api/agent/conversations/${activeConvId}`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error('Failed to load conversation history:', err);
      }
    };
    loadHistory();
  }, [activeConvId]);

  // Start a new session
  const handleNewSession = async () => {
    try {
      const res = await fetch('/api/agent/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: isZh ? '新風格會話' : 'New Style Session' })
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(prev => [data, ...prev]);
        setActiveConvId(data.id);
        setMessages([]);
        setAttachedImages([]);
        setInputMessage('');
      }
    } catch (err) {
      console.error('Failed to create new session:', err);
    }
  };

  // Delete conversation
  const handleDeleteSession = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(isZh ? '確定要刪除此對話嗎？' : 'Delete this conversation?')) return;
    try {
      await fetch(`/api/agent/conversations/${convId}`, { method: 'DELETE' });
      setConversations(prev => prev.filter(c => c.id !== convId));
      if (activeConvId === convId) {
        const remaining = conversations.filter(c => c.id !== convId);
        setActiveConvId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  // Image Upload Handling
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          setAttachedImages(prev => [...prev, evt.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Paste image from clipboard
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (evt) => {
            if (evt.target?.result) {
              setAttachedImages(prev => [...prev, evt.target!.result as string]);
            }
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  // Copy helper
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Send message stream
  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText !== undefined ? customText : inputMessage;
    if (!textToSend.trim() && attachedImages.length === 0) return;
    if (isGenerating) return;

    const currentImages = [...attachedImages];
    setInputMessage('');
    setAttachedImages([]);
    setIsGenerating(true);
    setActiveToolName(null);

    // Optimistically push user message
    const userMsg: Message = {
      role: 'user',
      content: textToSend,
      images: currentImages,
      created_at: new Date().toISOString()
    };

    // Placeholder assistant streaming message
    const assistantMsg: Message = {
      role: 'assistant',
      content: '',
      isStreaming: true,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: activeConvId,
          message: textToSend,
          images: currentImages,
          lang: lang
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const block of lines) {
          const eventMatch = block.match(/^event:\s*(.+)$/m);
          const dataMatch = block.match(/^data:\s*(.+)$/m);

          if (eventMatch && dataMatch) {
            const eventType = eventMatch[1].trim();
            const rawData = dataMatch[1].trim();
            try {
              const parsed = JSON.parse(rawData);

              if (eventType === 'message_start') {
                if (parsed.conversation_id && (!activeConvId || activeConvId !== parsed.conversation_id)) {
                  setActiveConvId(parsed.conversation_id);
                  fetchConversations();
                }
              } else if (eventType === 'text_delta') {
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === 'assistant') {
                    last.content += parsed.delta;
                  }
                  return updated;
                });
              } else if (eventType === 'tool_start') {
                setActiveToolName(parsed.tool);
              } else if (eventType === 'tool_result') {
                setActiveToolName(null);
              } else if (eventType === 'message_end') {
                setMessages(prev => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last) {
                    last.isStreaming = false;
                  }
                  return updated;
                });
              }
            } catch (e) {
              console.error('SSE parse error:', e);
            }
          }
        }
      }
    } catch (err: any) {
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && last.role === 'assistant') {
          last.content += `\n\n⚠️ ${isZh ? '無法連接 AI Agent 服務' : 'Failed to connect to AI Agent service'}: ${err.message}`;
          last.isStreaming = false;
        }
        return updated;
      });
    } finally {
      setIsGenerating(false);
      setActiveToolName(null);
      fetchConversations();
    }
  };

  // Render markdown text formatting (images, code blocks, bold, line breaks)
  const renderMarkdown = (text: string) => {
    if (!text) return null;

    // Split text by markdown image tags ![caption](url)
    const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const parts = [];
    let lastIdx = 0;
    let match;

    while ((match = imgRegex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        parts.push({ type: 'text', content: text.substring(lastIdx, match.index) });
      }
      parts.push({ type: 'image', alt: match[1], url: match[2] });
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < text.length) {
      parts.push({ type: 'text', content: text.substring(lastIdx) });
    }

    return (
      <div className="space-y-3">
        {parts.map((p, idx) => {
          if (p.type === 'image' && p.url) {
            const imgUrl = p.url;
            return (
              <div key={idx} className="my-3 rounded-xl overflow-hidden border border-slate-700/60 bg-slate-900/60 shadow-xl max-w-md">
                <img src={imgUrl} alt={p.alt || ''} className="w-full h-auto object-cover max-h-96" />
                <div className="p-2 bg-slate-800/80 flex items-center justify-between text-xs text-slate-300">
                  <span className="truncate">{p.alt || 'Generated Reference'}</span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleCopy(imgUrl)}
                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-200 flex items-center gap-1 transition"
                    >
                      <Copy size={12} /> {copiedText === imgUrl ? (isZh ? '已複製' : 'Copied') : (isZh ? '複製連結' : 'Copy URL')}
                    </button>
                  </div>
                </div>
              </div>
            );
          } else {
            const textContent = p.content || '';
            const codeBlockRegex = /```([\s\S]*?)```/g;
            const textBlocks: { type: 'plain' | 'code'; text?: string; code?: string }[] = [];
            let tLastIdx = 0;
            let tMatch;

            while ((tMatch = codeBlockRegex.exec(textContent)) !== null) {
              if (tMatch.index > tLastIdx) {
                textBlocks.push({ type: 'plain', text: textContent.substring(tLastIdx, tMatch.index) });
              }
              textBlocks.push({ type: 'code', code: tMatch[1].trim() });
              tLastIdx = tMatch.index + tMatch[0].length;
            }
            if (tLastIdx < textContent.length) {
              textBlocks.push({ type: 'plain', text: textContent.substring(tLastIdx) });
            }

            return (
              <div key={idx} className="space-y-2">
                {textBlocks.map((tb, tbIdx) => {
                  if (tb.type === 'code' && tb.code !== undefined) {
                    const codeStr = tb.code;
                    return (
                      <div key={tbIdx} className="my-2 rounded-lg bg-slate-950 border border-slate-800 p-3 font-mono text-xs text-emerald-400 relative group overflow-x-auto">
                        <button 
                          onClick={() => handleCopy(codeStr)}
                          className="absolute top-2 right-2 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] flex items-center gap-1 opacity-80 group-hover:opacity-100 transition"
                        >
                          <Copy size={10} /> {copiedText === codeStr ? (isZh ? '已複製' : 'Copied') : (isZh ? '複製Prompt' : 'Copy Prompt')}
                        </button>
                        <pre className="whitespace-pre-wrap break-words">{codeStr}</pre>
                      </div>
                    );
                  } else {
                    return (
                      <div key={tbIdx} className="whitespace-pre-wrap leading-relaxed">
                        {tb.text || ''}
                      </div>
                    );
                  }
                })}
              </div>
            );
          }
        })}
      </div>
    );
  };

  return (
    <div className="flex h-[calc(100vh-100px)] bg-slate-950/80 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl backdrop-blur-xl">
      {/* 1. Left Sidebar - Conversation History */}
      <div className={`${showSidebar ? 'w-64' : 'w-0'} transition-all duration-300 bg-slate-900/90 border-r border-slate-800 flex flex-col overflow-hidden`}>
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-slate-200 text-sm">
            <Bot className="text-indigo-400" size={18} />
            <span>{isZh ? 'AI 會話歷史' : 'Sessions History'}</span>
          </div>
          <button 
            onClick={handleNewSession}
            className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition shadow-md flex items-center gap-1 text-xs"
            title={isZh ? '新建風格會話' : 'New Session'}
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-xs">
              {isZh ? '尚無對話記錄' : 'No sessions yet'}
            </div>
          ) : (
            conversations.map(c => (
              <div
                key={c.id}
                onClick={() => setActiveConvId(c.id)}
                className={`p-2.5 rounded-xl text-xs cursor-pointer flex items-center justify-between group transition ${
                  activeConvId === c.id 
                    ? 'bg-gradient-to-r from-indigo-900/60 to-purple-900/60 text-indigo-200 border border-indigo-500/30' 
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <MessageSquare size={13} className={activeConvId === c.id ? 'text-indigo-400' : 'text-slate-500'} />
                  <span className="truncate font-medium">{c.title || 'Untitled Session'}</span>
                </div>
                <button
                  onClick={(e) => handleDeleteSession(c.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 2. Main Chat Workspace */}
      <div className="flex-1 flex flex-col bg-slate-950/60 relative">
        {/* Header */}
        <div className="px-6 py-3 border-b border-slate-800/80 bg-slate-900/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition"
            >
              <Sliders size={16} />
            </button>
            <div>
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <span>🤖 {isZh ? 'PhotoLab AI Style Agent' : 'PhotoLab AI Style Agent'}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {isZh ? '雙語多工具' : 'Bilingual Vision Agent'}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                {isZh ? '協助風格創作者分析圖像、生成Prompt模板、繪製參考圖與自動建庫' : 'Assists style creators in vision analysis, prompt engineering, reference photo generation & style management'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleNewSession}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs flex items-center gap-1.5 transition"
            >
              <Plus size={13} /> {isZh ? '開新對話' : 'New Session'}
            </button>
          </div>
        </div>

        {/* Messages Stream Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4 shadow-xl">
                <Sparkles size={32} />
              </div>
              <h3 className="text-base font-semibold text-slate-200 mb-2">
                {isZh ? '歡迎使用 PhotoLab AI 展位風格 Agent' : 'Welcome to PhotoLab AI Style Agent'}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                {isZh 
                  ? '我可以幫您分析靈感照片風格、自動寫出符合 PhotoLab 規範的 Prompt 模板、生成 RunningHub V2 參考圖並直接儲存至風格庫。' 
                  : 'I can analyze inspiration images, craft PhotoLab-compliant prompt templates, generate RunningHub V2 reference photos, and create new styles directly in your library.'}
              </p>

              {/* Action Cards */}
              <div className="grid grid-cols-2 gap-2.5 w-full">
                <button
                  onClick={() => handleSendMessage(isZh ? '請幫我列出目前的風格庫，並分析其優缺點' : 'List all current styles and suggest improvements')}
                  className="p-3 bg-slate-900/80 hover:bg-indigo-950/40 border border-slate-800 hover:border-indigo-500/40 rounded-xl text-left transition text-xs group"
                >
                  <Palette className="text-indigo-400 mb-1 group-hover:scale-110 transition" size={16} />
                  <div className="font-medium text-slate-200">{isZh ? '檢視現有風格庫' : 'List Styles Catalog'}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{isZh ? '查看現有風格與模型' : 'Check active styles'}</div>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 bg-slate-900/80 hover:bg-purple-950/40 border border-slate-800 hover:border-purple-500/40 rounded-xl text-left transition text-xs group"
                >
                  <Eye className="text-purple-400 mb-1 group-hover:scale-110 transition" size={16} />
                  <div className="font-medium text-slate-200">{isZh ? '上傳圖片視覺分析' : 'Analyze Image Vision'}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{isZh ? '提取色彩光影與材質' : 'Extract colors & style'}</div>
                </button>
              </div>
            </div>
          ) : (
            messages.map((m, idx) => (
              <div 
                key={idx} 
                className={`flex gap-3.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-lg mt-0.5">
                    <Bot size={18} />
                  </div>
                )}

                <div className={`max-w-2xl rounded-2xl p-4 text-xs shadow-lg ${
                  m.role === 'user'
                    ? 'bg-gradient-to-br from-indigo-600 to-purple-700 text-white rounded-tr-none'
                    : 'bg-slate-900/90 border border-slate-800 text-slate-200 rounded-tl-none'
                }`}>
                  {/* Attached user images */}
                  {m.images && m.images.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {m.images.map((img, imgIdx) => (
                        <img 
                          key={imgIdx} 
                          src={img} 
                          alt="attached" 
                          className="w-24 h-24 object-cover rounded-lg border border-white/20 shadow-md"
                        />
                      ))}
                    </div>
                  )}

                  {/* Message content */}
                  {renderMarkdown(m.content)}

                  {/* Streaming indicator */}
                  {m.isStreaming && !m.content && (
                    <div className="flex items-center gap-2 text-slate-400 py-1">
                      <Sparkles size={14} className="animate-spin text-indigo-400" />
                      <span>{isZh ? 'AI 正在思考與呼叫工具...' : 'AI is thinking & analyzing...'}</span>
                    </div>
                  )}
                </div>

                {m.role === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-0.5">
                    <User size={18} />
                  </div>
                )}
              </div>
            ))
          )}

          {/* Active Tool Call Loading Badge */}
          {activeToolName && (
            <div className="flex items-center gap-3 p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl text-xs text-indigo-300 max-w-md animate-pulse">
              <RefreshCw size={14} className="animate-spin text-indigo-400" />
              <span>
                {isZh ? `正在執行工具：${activeToolName}...` : `Executing tool: ${activeToolName}...`}
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 3. Quick Action Button Bar */}
        <div className="px-6 py-2 bg-slate-900/60 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 rounded-lg text-xs text-slate-300 flex items-center gap-1.5 shrink-0 transition"
          >
            <ImageIcon size={13} className="text-purple-400" />
            {isZh ? '分析靈感圖片' : 'Analyze Image'}
          </button>

          <button
            onClick={() => handleSendMessage(isZh ? '請幫我構思一款「賽博朋克夜景」風格的 Prompt 模板' : 'Craft a cyberpunk neon style prompt template')}
            className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 rounded-lg text-xs text-slate-300 flex items-center gap-1.5 shrink-0 transition"
          >
            <Wand2 size={13} className="text-indigo-400" />
            {isZh ? '構思風格 Prompt' : 'Craft Prompt'}
          </button>

          <button
            onClick={() => handleSendMessage(isZh ? '使用 RunningHub V2 (nb2-cheap) 幫我生成一張吉卜力動漫風格的參考圖' : 'Generate a Ghibli anime style reference image using nb2-cheap')}
            className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 rounded-lg text-xs text-slate-300 flex items-center gap-1.5 shrink-0 transition"
          >
            <Palette size={13} className="text-emerald-400" />
            {isZh ? '生成參考圖' : 'Generate Ref Photo'}
          </button>

          <button
            onClick={() => handleSendMessage(isZh ? '我想新建一個風格，請引導我完成設定' : 'Guide me to create a new style step by step')}
            className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-700/60 rounded-lg text-xs text-slate-300 flex items-center gap-1.5 shrink-0 transition"
          >
            <Plus size={13} className="text-amber-400" />
            {isZh ? '引導新建風格' : 'Create Style Wizard'}
          </button>
        </div>

        {/* 4. Chat Input Section */}
        <div className="p-4 bg-slate-900/90 border-t border-slate-800">
          {/* Attached image preview strip */}
          {attachedImages.length > 0 && (
            <div className="flex gap-2 mb-2 p-2 bg-slate-950 rounded-xl border border-slate-800">
              {attachedImages.map((img, i) => (
                <div key={i} className="relative group">
                  <img src={img} alt="preview" className="w-12 h-12 object-cover rounded-lg border border-slate-700" />
                  <button 
                    onClick={() => setAttachedImages(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white rounded-full p-0.5 text-[10px] hover:bg-rose-500 transition"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              accept="image/*" 
              multiple 
              className="hidden" 
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition border border-slate-700/60"
              title={isZh ? '上傳圖片 (可貼上或拖曳)' : 'Attach Image'}
            >
              <ImageIcon size={18} />
            </button>

            <input
              type="text"
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
              onPaste={handlePaste}
              placeholder={isZh ? '輸入訊息、描述需求，或直接貼上/上傳圖片 (Ctrl+V)...' : 'Type a message, describe prompt needs, or paste/attach image (Ctrl+V)...'}
              disabled={isGenerating}
              className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none transition placeholder:text-slate-600"
            />

            <button
              onClick={() => handleSendMessage()}
              disabled={isGenerating || (!inputMessage.trim() && attachedImages.length === 0)}
              className="p-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white rounded-xl transition shadow-lg flex items-center justify-center shrink-0"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
