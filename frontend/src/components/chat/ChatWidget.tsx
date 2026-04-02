import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Sparkles, Bot, Loader2 } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  loading?: boolean
}

interface ChatWidgetProps {
  /** When provided, the RAG query is scoped to this specific post's chunks */
  postId?: string
}

export default function ChatWidget({ postId }: ChatWidgetProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: postId
        ? "Hi! I've read this article and I'm ready to answer your questions about it. Ask away! ✨"
        : "Hello! I'm your Lifestyle Blog assistant. Ask me anything about our articles — food, travel, culture, wellness, and more. ✨"
    }
  ])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      inputRef.current?.focus()
    }
  }, [messages, open])

  const sendMessage = async () => {
    if (!input.trim() || streaming) return
    const question = input.trim()
    setInput('')

    // Add user message
    setMessages(m => [...m, { role: 'user', content: question }])
    setStreaming(true)

    // Add empty assistant bubble with loading state
    setMessages(m => [...m, { role: 'assistant', content: '', loading: true }])

    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/rag/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, postId: postId ?? null }),
        signal: abortRef.current.signal
      })

      if (!res.ok) throw new Error(`Server error: ${res.status}`)

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error('No readable stream')

      let buffer = ''
      let started = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()
          if (payload === '[DONE]') break

          try {
            const { token } = JSON.parse(payload)
            if (token) {
              started = true
              setMessages(m => {
                const last = { ...m[m.length - 1] }
                last.content += token
                last.loading = false
                return [...m.slice(0, -1), last]
              })
            }
          } catch { /* malformed SSE chunk, skip */ }
        }
      }

      // If no content came through at all
      if (!started) {
        setMessages(m => {
          const last = { ...m[m.length - 1] }
          last.content = "I couldn't find relevant information. Try rephrasing your question."
          last.loading = false
          return [...m.slice(0, -1), last]
        })
      }

    } catch (err: any) {
      if (err.name === 'AbortError') return
      setMessages(m => {
        const last = { ...m[m.length - 1] }
        last.content = 'Something went wrong. Please try again in a moment.'
        last.loading = false
        return [...m.slice(0, -1), last]
      })
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const stopStreaming = () => {
    abortRef.current?.abort()
    setStreaming(false)
    setMessages(m => {
      const last = m[m.length - 1]
      if (last?.loading) {
        return [...m.slice(0, -1), { ...last, content: '(stopped)', loading: false }]
      }
      return m
    })
  }

  return (
    <>
      {/* ── Floating trigger button ─────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Ask AI about this blog"
        aria-label="Open AI chat"
        className="fixed bottom-6 right-6 z-50 w-13 h-13 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"
        style={{
          background: open ? 'var(--text-muted)' : 'var(--text)',
          color: 'var(--bg)',
          width: 52,
          height: 52
        }}
      >
        {open
          ? <X size={20} />
          : <MessageCircle size={20} />
        }
      </button>

      {/* ── Chat panel ─────────────────────────────────────────────────────── */}
      <div
        className="fixed bottom-24 right-6 z-50 flex flex-col rounded-2xl shadow-2xl overflow-hidden transition-all duration-300"
        style={{
          width: 360,
          maxHeight: open ? 520 : 0,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          transform: open ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2 px-4 py-3"
          style={{ background: 'var(--text)', color: 'var(--bg)' }}
        >
          <Sparkles size={16} />
          <span className="font-semibold text-sm tracking-wide">
            {postId ? 'Ask about this article' : 'Blog AI Assistant'}
          </span>
          <span
            className="ml-auto text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            RAG-powered
          </span>
        </div>

        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3"
          style={{ maxHeight: 360, minHeight: 200 }}
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {msg.role === 'assistant' && (
                <div
                  className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
                  style={{ background: 'var(--accent)', color: 'var(--bg)' }}
                >
                  <Bot size={13} />
                </div>
              )}
              <div
                className="max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-relaxed"
                style={
                  msg.role === 'user'
                    ? { background: 'var(--text)', color: 'var(--bg)', borderBottomRightRadius: 4 }
                    : { background: 'var(--bg-secondary)', color: 'var(--text)', borderBottomLeftRadius: 4 }
                }
              >
                {msg.loading ? (
                  <span className="flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Thinking…</span>
                  </span>
                ) : (
                  <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div
          className="flex items-center gap-2 px-3 py-3"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask a question…"
            disabled={streaming}
            className="flex-1 text-sm px-3 py-2 rounded-xl outline-none transition"
            style={{
              background: 'var(--bg-secondary)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
            }}
          />
          <button
            onClick={streaming ? stopStreaming : sendMessage}
            disabled={!streaming && !input.trim()}
            className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition hover:opacity-80 active:scale-95 disabled:opacity-30"
            style={{ background: 'var(--text)', color: 'var(--bg)' }}
            title={streaming ? 'Stop' : 'Send'}
          >
            {streaming
              ? <X size={15} />
              : <Send size={15} />
            }
          </button>
        </div>

        {/* Footer note */}
        <p className="text-center pb-2" style={{ fontSize: 10, color: 'var(--text-subtle)' }}>
          Answers generated from blog content · may not be perfect
        </p>
      </div>
    </>
  )
}