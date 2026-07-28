import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, User, Send, Plus, Trash2, Image as ImageIcon, Sparkles, 
  Wand2, Palette, RefreshCw, Copy, Sliders, MessageSquare, Eye
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating, activeToolName]);

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

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText !== undefined ? customText : inputMessage;
    if (!textToSend.trim() && attachedImages.length === 0) return;
    if (isGenerating) return;

    const currentImages = [...attachedImages];
    setInputMessage('');
    setAttachedImages([]);
    setIsGenerating(true);
    setActiveToolName(null);

    const userMsg: Message = {
      role: 'user',
      content: textToSend,
      images: currentImages,
      created_at: new Date().toISOString()
    };

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
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.detail || `${isZh ? '伺服器回應錯誤' : 'Server returned'} ${res.status}`;
        throw new Error(errMsg);
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

  const renderMarkdown = (text: string) => {
    if (!text) return null;

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {parts.map((p, idx) => {
          if (p.type === 'image' && p.url) {
            const imgUrl = p.url;
            return (
              <div key={idx} style={{
                margin: '12px 0',
                borderRadius: '12px',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(10, 10, 20, 0.8)',
                maxWidth: '420px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
              }}>
                <img src={imgUrl} alt={p.alt || ''} style={{ width: '100%', height: 'auto', maxHeight: '380px', objectFit: 'cover', display: 'block' }} />
                <div style={{
                  padding: '8px 12px',
                  background: 'rgba(20, 20, 35, 0.9)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: '#cbd5e1'
                }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.alt || 'Generated Reference'}</span>
                  <button 
                    onClick={() => handleCopy(imgUrl)}
                    style={{
                      padding: '4px 10px',
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Copy size={12} /> {copiedText === imgUrl ? (isZh ? '已複製' : 'Copied') : (isZh ? '複製連結' : 'Copy URL')}
                  </button>
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
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {textBlocks.map((tb, tbIdx) => {
                  if (tb.type === 'code' && tb.code !== undefined) {
                    const codeStr = tb.code;
                    return (
                      <div key={tbIdx} style={{
                        margin: '8px 0',
                        borderRadius: '8px',
                        background: '#070712',
                        border: '1px solid rgba(100, 255, 218, 0.2)',
                        padding: '12px',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        color: '#64ffda',
                        position: 'relative',
                        overflowX: 'auto'
                      }}>
                        <button 
                          onClick={() => handleCopy(codeStr)}
                          style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            padding: '3px 8px',
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: '#fff',
                            borderRadius: '4px',
                            fontSize: '10px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Copy size={10} /> {copiedText === codeStr ? (isZh ? '已複製' : 'Copied') : (isZh ? '複製Prompt' : 'Copy Prompt')}
                        </button>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{codeStr}</pre>
                      </div>
                    );
                  } else {
                    return (
                      <div key={tbIdx} style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
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
    <div style={{
      display: 'flex',
      height: 'calc(100vh - 120px)',
      minHeight: '600px',
      background: 'rgba(18, 18, 30, 0.85)',
      borderRadius: '16px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      overflow: 'hidden',
      boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(20px)'
    }}>
      {/* 1. Left Sidebar - Sessions History */}
      {showSidebar && (
        <div style={{
          width: '260px',
          background: 'rgba(10, 10, 18, 0.95)',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0
        }}>
          <div style={{
            padding: '16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#fff', fontSize: '14px' }}>
              <Bot size={18} style={{ color: '#818cf8' }} />
              <span>{isZh ? 'AI 會話歷史' : 'Sessions History'}</span>
            </div>
            <button 
              onClick={handleNewSession}
              style={{
                padding: '6px 10px',
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title={isZh ? '新建風格會話' : 'New Session'}
            >
              <Plus size={14} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {conversations.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                {isZh ? '尚無對話記錄' : 'No sessions yet'}
              </div>
            ) : (
              conversations.map(c => (
                <div
                  key={c.id}
                  onClick={() => setActiveConvId(c.id)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s',
                    background: activeConvId === c.id 
                      ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(168, 85, 247, 0.25))' 
                      : 'transparent',
                    color: activeConvId === c.id ? '#c7d2fe' : '#94a3b8',
                    border: activeConvId === c.id ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid transparent'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <MessageSquare size={14} style={{ color: activeConvId === c.id ? '#818cf8' : '#64748b', flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                      {c.title || 'Untitled Session'}
                    </span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteSession(c.id, e)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title={isZh ? '刪除會話' : 'Delete Session'}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 2. Main Workspace */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(12, 12, 22, 0.7)', position: 'relative' }}>
        {/* Header */}
        <div style={{
          padding: '12px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(15, 15, 28, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              onClick={() => setShowSidebar(!showSidebar)}
              style={{
                padding: '6px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#94a3b8',
                cursor: 'pointer',
                display: 'flex'
              }}
            >
              <Sliders size={16} />
            </button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>
                  🤖 {isZh ? 'PhotoLab AI Style Agent' : 'PhotoLab AI Style Agent'}
                </span>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '10px',
                  background: 'rgba(74, 222, 128, 0.15)',
                  color: '#4ade80',
                  border: '1px solid rgba(74, 222, 128, 0.3)',
                  fontWeight: 600
                }}>
                  {isZh ? '雙語視覺 Agent' : 'Bilingual Vision Agent'}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>
                {isZh ? '協助風格創作者分析圖像、生成Prompt模板、繪製參考圖與自動建庫' : 'Assists style creators in vision analysis, prompt engineering, reference photo generation & style management'}
              </p>
            </div>
          </div>

          <button
            onClick={handleNewSession}
            style={{
              padding: '6px 14px',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 500
            }}
          >
            <Plus size={14} /> {isZh ? '開新對話' : 'New Session'}
          </button>
        </div>

        {/* Chat Messages List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          {messages.length === 0 ? (
            <div style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              maxWidth: '480px',
              margin: '0 auto',
              padding: '20px'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '20px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(168, 85, 247, 0.25))',
                border: '1px solid rgba(168, 85, 247, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#a855f7',
                marginBottom: '16px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
              }}>
                <Sparkles size={32} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>
                {isZh ? '歡迎使用 PhotoLab AI 展位風格 Agent' : 'Welcome to PhotoLab AI Style Agent'}
              </h3>
              <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.6, marginBottom: '24px' }}>
                {isZh 
                  ? '您可以直接拖曳/上傳靈感照片進行 Vision AI 分析，讓我為您生成遵守規範的英文 Prompt 模板，呼叫 RunningHub 繪圖並建立風格！' 
                  : 'You can upload inspiration images for Vision AI analysis, generate PhotoLab-compliant prompt templates, render RunningHub V2 reference photos, and build new styles!'}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', width: '100%' }}>
                <button
                  onClick={() => handleSendMessage(isZh ? '請幫我列出目前的風格庫，並分析其狀況' : 'List all current styles and summarize them')}
                  style={{
                    padding: '14px',
                    background: 'rgba(20, 20, 35, 0.8)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: '#fff',
                    transition: 'all 0.2s'
                  }}
                >
                  <Palette size={18} style={{ color: '#818cf8', marginBottom: '4px' }} />
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{isZh ? '檢視現有風格庫' : 'List Styles Catalog'}</div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{isZh ? '查看現有風格與模型' : 'Check active styles'}</div>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    padding: '14px',
                    background: 'rgba(20, 20, 35, 0.8)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: '#fff',
                    transition: 'all 0.2s'
                  }}
                >
                  <Eye size={18} style={{ color: '#c084fc', marginBottom: '4px' }} />
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{isZh ? '上傳圖片視覺分析' : 'Analyze Image Vision'}</div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{isZh ? '提取色彩光影與材質' : 'Extract colors & style'}</div>
                </button>
              </div>
            </div>
          ) : (
            messages.map((m, idx) => (
              <div 
                key={idx} 
                style={{
                  display: 'flex',
                  gap: '12px',
                  justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                {m.role === 'assistant' && (
                  <div style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    flexShrink: 0,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    marginTop: '2px'
                  }}>
                    <Bot size={20} />
                  </div>
                )}

                <div style={{
                  maxWidth: '680px',
                  borderRadius: '16px',
                  padding: '14px 18px',
                  fontSize: '13px',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
                  background: m.role === 'user'
                    ? 'linear-gradient(135deg, #6366f1, #9333ea)'
                    : 'rgba(22, 22, 38, 0.95)',
                  color: '#fff',
                  border: m.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.1)',
                  borderTopRightRadius: m.role === 'user' ? '2px' : '16px',
                  borderTopLeftRadius: m.role === 'assistant' ? '2px' : '16px'
                }}>
                  {/* User attached images preview */}
                  {m.images && m.images.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                      {m.images.map((img, imgIdx) => (
                        <img 
                          key={imgIdx} 
                          src={img} 
                          alt="attached" 
                          style={{ width: '90px', height: '90px', objectFit: 'cover', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)' }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Render content */}
                  {renderMarkdown(m.content)}

                  {/* Streaming state */}
                  {m.isStreaming && !m.content && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a5b4fc', padding: '4px 0' }}>
                      <Sparkles size={14} className="animate-spin" />
                      <span>{isZh ? 'AI 正在思考與呼叫工具...' : 'AI is analyzing & executing...'}</span>
                    </div>
                  )}
                </div>

                {m.role === 'user' && (
                  <div style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#e2e8f0',
                    flexShrink: 0,
                    marginTop: '2px'
                  }}>
                    <User size={18} />
                  </div>
                )}
              </div>
            ))
          )}

          {/* Active Tool Execution Indicator */}
          {activeToolName && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 16px',
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '12px',
              fontSize: '12px',
              color: '#c7d2fe',
              maxWidth: '400px'
            }}>
              <RefreshCw size={14} className="animate-spin" style={{ color: '#818cf8' }} />
              <span>
                {isZh ? `正在執行工具：${activeToolName}...` : `Executing tool: ${activeToolName}...`}
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 3. Quick Action Chips */}
        <div style={{
          padding: '8px 20px',
          background: 'rgba(15, 15, 28, 0.7)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflowX: 'auto'
        }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '6px 12px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '8px',
              color: '#e2e8f0',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            <ImageIcon size={13} style={{ color: '#c084fc' }} />
            {isZh ? '分析靈感圖片' : 'Analyze Image'}
          </button>

          <button
            onClick={() => handleSendMessage(isZh ? '請幫我構思一款「賽博朋克夜景」風格的 Prompt 模板' : 'Craft a cyberpunk neon style prompt template')}
            style={{
              padding: '6px 12px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '8px',
              color: '#e2e8f0',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            <Wand2 size={13} style={{ color: '#818cf8' }} />
            {isZh ? '構思風格 Prompt' : 'Craft Prompt'}
          </button>

          <button
            onClick={() => handleSendMessage(isZh ? '使用 RunningHub V2 (nb2-cheap) 幫我生成一張吉卜力動漫風格的參考圖' : 'Generate a Ghibli anime style reference image using nb2-cheap')}
            style={{
              padding: '6px 12px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '8px',
              color: '#e2e8f0',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            <Palette size={13} style={{ color: '#34d399' }} />
            {isZh ? '生成參考圖' : 'Generate Ref Photo'}
          </button>

          <button
            onClick={() => handleSendMessage(isZh ? '我想新建一個風格，請引導我完成設定' : 'Guide me to create a new style step by step')}
            style={{
              padding: '6px 12px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '8px',
              color: '#e2e8f0',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            <Plus size={13} style={{ color: '#fbbf24' }} />
            {isZh ? '引導新建風格' : 'Create Style Wizard'}
          </button>
        </div>

        {/* 4. Chat Input Controls */}
        <div style={{
          padding: '16px 20px',
          background: 'rgba(10, 10, 20, 0.95)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          {attachedImages.length > 0 && (
            <div style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '10px',
              padding: '8px',
              background: 'rgba(0,0,0,0.4)',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              {attachedImages.map((img, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={img} alt="preview" style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px' }} />
                  <button 
                    onClick={() => setAttachedImages(prev => prev.filter((_, idx) => idx !== i))}
                    style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-6px',
                      background: '#f43f5e',
                      color: '#fff',
                      borderRadius: '50%',
                      border: 'none',
                      width: '18px',
                      height: '18px',
                      fontSize: '10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              accept="image/*" 
              multiple 
              style={{ display: 'none' }} 
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: '10px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '10px',
                color: '#e2e8f0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
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
              style={{
                flex: 1,
                background: 'rgba(5, 5, 12, 0.8)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '10px',
                padding: '10px 16px',
                fontSize: '13px',
                color: '#fff',
                outline: 'none'
              }}
            />

            <button
              onClick={() => handleSendMessage()}
              disabled={isGenerating || (!inputMessage.trim() && attachedImages.length === 0)}
              style={{
                padding: '10px 18px',
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                opacity: isGenerating || (!inputMessage.trim() && attachedImages.length === 0) ? 0.5 : 1,
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)'
              }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
