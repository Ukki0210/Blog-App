import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Underline from '@tiptap/extension-underline'
import {
  Bold, Italic, Underline as UnderlineIcon, Link2,
  Image as ImageIcon, List, ListOrdered, Quote,
  Heading2, Heading3, Save, Send, Eye, X,
  Sparkles, ChevronRight, Loader2, RotateCcw, Wand2
} from 'lucide-react'
import { api } from '../lib/api'
import { useAuthStore } from '../lib/store'
import { CATEGORIES } from '../types'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

// ── AI panel state ────────────────────────────────────────────────────────────
type AiState = 'idle' | 'generating' | 'done' | 'error'

export default function WritePage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { user, profile } = useAuthStore()
  const [title, setTitle] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState('')
  const [coverImage, setCoverImage] = useState('')
  const [coverPreview, setCoverPreview] = useState('')
  const [status, setStatus] = useState<'draft' | 'published'>('draft')
  const [featured, setFeatured] = useState(false)
  const [saving, setSaving] = useState(false)
  const [postId, setPostId] = useState<string | null>(id || null)
  const [loaded, setLoaded] = useState(false)

  // AI panel
  const [aiOpen, setAiOpen] = useState(false)
  const [aiInstructions, setAiInstructions] = useState('')
  const [aiState, setAiState] = useState<AiState>('idle')
  const [aiProgress, setAiProgress] = useState<string[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const contentBufferRef = useRef('')

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Tell your story… or use the AI assistant ✨' }),
      Link.configure({ openOnClick: false }),
      Image,
      Underline,
    ],
    editorProps: { attributes: { class: 'tiptap-editor' } }
  })

  useEffect(() => {
    if (!user) { navigate('/auth'); return }
    if (profile && profile.role === 'reader') { navigate('/'); return }

    if (id && editor && !loaded) {
      api.getAdminPosts().then(posts => {
        const post = posts.find((p: any) => p.id === id)
        if (post) {
          setTitle(post.title || '')
          setExcerpt(post.excerpt || '')
          setCategory(post.category || '')
          setTags(post.tags?.join(', ') || '')
          setCoverImage(post.coverImage || '')
          setCoverPreview(post.coverImage || '')
          setStatus(post.status || 'draft')
          setFeatured(post.featured || false)
          editor.commands.setContent(post.content || '')
          setLoaded(true)
        }
      }).catch(() => {})
    }
  }, [user, profile, id, editor, loaded])

  useEffect(() => {
    if (!postId || !editor) return
    const interval = setInterval(() => handleSave('draft', true), 30000)
    return () => clearInterval(interval)
  }, [postId, title, editor])

  const handleCoverUrlChange = (url: string) => {
    setCoverImage(url)
    if (url.trim()) {
      const img = new window.Image()
      img.onload = () => setCoverPreview(url)
      img.onerror = () => setCoverPreview('')
      img.src = url
    } else {
      setCoverPreview('')
    }
  }

  const handleSave = async (saveStatus: 'draft' | 'published' = status, silent = false) => {
    if (!title.trim() || !editor) {
      if (!silent) toast.error('Please add a title first')
      return
    }
    setSaving(true)
    const data = {
      title, excerpt, content: editor.getHTML(), coverImage,
      category, tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      status: saveStatus, featured, metaDescription: excerpt
    }
    try {
      if (postId) {
        await api.updatePost(postId, data)
        if (!silent) toast.success(saveStatus === 'published' ? '✓ Published!' : '✓ Draft saved')
        if (saveStatus === 'published' && status !== 'published') setStatus('published')
      } else {
        const post = await api.createPost(data)
        setPostId(post.id)
        if (!silent) toast.success(saveStatus === 'published' ? '✓ Published!' : '✓ Draft saved')
        if (saveStatus === 'published') navigate(`/post/${post.slug}`)
        else navigate(`/write/${post.id}`, { replace: true })
      }
    } catch (e: any) {
      if (!silent) toast.error(e.message || 'Save failed')
    }
    setSaving(false)
  }

  // ── AI Generation ─────────────────────────────────────────────────────────
  const handleAiGenerate = async () => {
    if (!title.trim()) { toast.error('Enter a title first'); return }

    setAiState('generating')
    setAiProgress([])
    contentBufferRef.current = ''
    editor?.commands.clearContent()

    const { data: { session } } = await supabase.auth.getSession()
    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/aiwrite/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({ title, instructions: aiInstructions || null }),
        signal: abortRef.current.signal
      })

      if (!res.ok) throw new Error(`Server error ${res.status}`)

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let inContent = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()
          if (payload === '[DONE]') { inContent = false; break }

          try {
            const evt = JSON.parse(payload)
            const { field, value: val } = evt

            if (field === 'error') {
              toast.error(val); setAiState('error'); return
            }
            if (field === 'excerpt') {
              setExcerpt(val)
              setAiProgress(p => [...p, '✓ Summary written'])
            }
            if (field === 'category') {
              setCategory(val)
              setAiProgress(p => [...p, `✓ Category: ${val}`])
            }
            if (field === 'tags') {
              setTags(val)
              setAiProgress(p => [...p, '✓ Tags generated'])
            }
            if (field === 'coverImage') {
              handleCoverUrlChange(val)
              setAiProgress(p => [...p, '✓ Cover image set'])
            }
            if (field === 'contentStart') {
              inContent = true
              setAiProgress(p => [...p, '✍ Writing article…'])
            }
            if (field === 'contentToken' && inContent) {
              contentBufferRef.current += val
              // Batch-insert into editor every ~200 chars for performance
              if (contentBufferRef.current.length > 200) {
                const current = editor?.getHTML() ?? ''
                editor?.commands.setContent(current + contentBufferRef.current, false)
                contentBufferRef.current = ''
              }
            }
            if (field === 'contentEnd') {
              // Flush remaining buffer
              if (contentBufferRef.current) {
                const current = editor?.getHTML() ?? ''
                const full = current + contentBufferRef.current
                editor?.commands.setContent(full, false)
                contentBufferRef.current = ''
              }
              setAiProgress(p => [...p, '✓ Article complete!'])
            }
          } catch { /* malformed SSE */ }
        }
      }

      setAiState('done')
      setAiOpen(false)
      toast.success('Article generated! Review and edit before publishing.')
    } catch (err: any) {
      if (err.name === 'AbortError') { setAiState('idle'); return }
      toast.error(err.message || 'Generation failed')
      setAiState('error')
    }
  }

  const stopGeneration = () => {
    abortRef.current?.abort()
    setAiState('idle')
    setAiProgress([])
  }

  const addImage = () => {
    const url = prompt('Image URL:')
    if (url) editor?.chain().focus().setImage({ src: url }).run()
  }
  const addLink = () => {
    const url = prompt('URL:')
    if (url) editor?.chain().focus().setLink({ href: url }).run()
  }

  if (!user) return null

  const toolbarButtons = [
    { icon: <Bold size={14} />, action: () => editor?.chain().focus().toggleBold().run(), active: editor?.isActive('bold') },
    { icon: <Italic size={14} />, action: () => editor?.chain().focus().toggleItalic().run(), active: editor?.isActive('italic') },
    { icon: <UnderlineIcon size={14} />, action: () => editor?.chain().focus().toggleUnderline().run(), active: editor?.isActive('underline') },
    { icon: <Heading2 size={14} />, action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), active: editor?.isActive('heading', { level: 2 }) },
    { icon: <Heading3 size={14} />, action: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(), active: editor?.isActive('heading', { level: 3 }) },
    { icon: <List size={14} />, action: () => editor?.chain().focus().toggleBulletList().run(), active: editor?.isActive('bulletList') },
    { icon: <ListOrdered size={14} />, action: () => editor?.chain().focus().toggleOrderedList().run(), active: editor?.isActive('orderedList') },
    { icon: <Quote size={14} />, action: () => editor?.chain().focus().toggleBlockquote().run(), active: editor?.isActive('blockquote') },
    { icon: <Link2 size={14} />, action: addLink, active: editor?.isActive('link') },
    { icon: <ImageIcon size={14} />, action: addImage, active: false },
  ]

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <p className="text-xs tracking-[0.15em] uppercase" style={{ color: 'var(--text-subtle)' }}>
            {postId ? (id ? 'Editing post' : 'Draft saved') : 'New story'}
          </p>
          <button
            onClick={() => setStatus(s => s === 'draft' ? 'published' : 'draft')}
            className="text-[10px] tracking-wide uppercase px-2.5 py-1 rounded-full border transition-all"
            style={{
              borderColor: status === 'published' ? 'var(--accent)' : 'var(--border)',
              color: status === 'published' ? 'var(--accent)' : 'var(--text-subtle)',
              background: status === 'published' ? 'rgba(114,138,110,0.08)' : 'transparent'
            }}>
            {status === 'published' ? '● Published' : '○ Draft'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          {/* AI Button */}
          <button
            onClick={() => setAiOpen(o => !o)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all hover:scale-105"
            style={{
              borderColor: aiOpen ? 'var(--accent)' : 'var(--border)',
              color: aiOpen ? 'var(--accent)' : 'var(--text-muted)',
              background: aiOpen ? 'rgba(114,138,110,0.08)' : 'transparent'
            }}>
            <Sparkles size={12} />
            Write with AI
          </button>
          <button
            onClick={() => handleSave('draft')}
            disabled={saving || !title}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors hover:bg-[var(--bg-secondary)] disabled:opacity-40"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <Save size={12} /> {saving ? 'Saving…' : 'Save draft'}
          </button>
          <button
            onClick={() => handleSave('published')}
            disabled={saving || !title}
            className="flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-full transition-colors disabled:opacity-40"
            style={{ background: 'var(--text)', color: 'var(--bg)' }}>
            <Send size={12} /> {postId ? 'Update' : 'Publish'}
          </button>
        </div>
      </div>

      {/* ── AI Assistant Panel ── */}
      {aiOpen && (
        <div
          className="mb-8 rounded-2xl overflow-hidden"
          style={{ border: '1px solid var(--accent)', background: 'var(--bg-secondary)' }}
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-5 py-3"
            style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
            <div className="flex items-center gap-2">
              <Wand2 size={14} />
              <span className="text-sm font-semibold tracking-wide">AI Writing Assistant</span>
            </div>
            <button onClick={() => setAiOpen(false)} className="opacity-70 hover:opacity-100">
              <X size={15} />
            </button>
          </div>

          <div className="px-5 py-4">
            {aiState === 'idle' || aiState === 'error' ? (
              <>
                {/* Title preview */}
                <div className="mb-4 p-3 rounded-xl" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                  <p className="text-[10px] tracking-widest uppercase mb-1" style={{ color: 'var(--text-subtle)' }}>Writing article for</p>
                  <p className="text-sm font-medium" style={{ color: title ? 'var(--text)' : 'var(--text-subtle)' }}>
                    {title || 'Enter a title above first…'}
                  </p>
                </div>

                {/* Optional instructions */}
                <div className="mb-4">
                  <label className="block text-xs tracking-wide uppercase mb-2" style={{ color: 'var(--text-subtle)' }}>
                    Extra instructions <span style={{ color: 'var(--text-subtle)', fontWeight: 400, textTransform: 'none' }}>(optional)</span>
                  </label>
                  <textarea
                    value={aiInstructions}
                    onChange={e => setAiInstructions(e.target.value)}
                    placeholder="E.g. 'Focus on budget travel tips' or 'Write for beginners' or 'Include local Coorg food recommendations'…"
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
                    style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                  />
                </div>

                {/* What AI will generate */}
                <div className="mb-4 flex flex-wrap gap-2">
                  {['📝 Full article (500-700 words)', '✦ Excerpt / summary', '🏷 Category & tags', '🖼 Cover image'].map(item => (
                    <span key={item} className="text-[11px] px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(114,138,110,0.12)', color: 'var(--accent)' }}>
                      {item}
                    </span>
                  ))}
                </div>

                <button
                  onClick={handleAiGenerate}
                  disabled={!title.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all hover:opacity-90 disabled:opacity-40"
                  style={{ background: 'var(--text)', color: 'var(--bg)' }}>
                  <Sparkles size={14} />
                  Generate Full Article
                  <ChevronRight size={14} />
                </button>

                {aiState === 'error' && (
                  <p className="mt-2 text-xs text-center" style={{ color: '#ef4444' }}>
                    Generation failed. Check your internet connection and try again.
                  </p>
                )}
              </>
            ) : (
              /* Generating state */
              <div className="py-2">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent)' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                      {aiState === 'done' ? 'Done!' : 'Generating your article…'}
                    </span>
                  </div>
                  {aiState === 'generating' && (
                    <button
                      onClick={stopGeneration}
                      className="text-xs px-2.5 py-1 rounded-lg border"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                      Stop
                    </button>
                  )}
                </div>

                {/* Progress log */}
                <div className="space-y-1.5">
                  {aiProgress.map((msg, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs"
                      style={{ color: msg.startsWith('✓') ? 'var(--accent)' : 'var(--text-muted)' }}>
                      {msg}
                    </div>
                  ))}
                  {aiState === 'generating' && (
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-subtle)' }}>
                      <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--accent)' }} />
                      Working…
                    </div>
                  )}
                </div>

                {/* Regenerate button after done */}
                {aiState === 'done' && (
                  <button
                    onClick={() => { setAiState('idle'); setAiProgress([]) }}
                    className="mt-4 flex items-center gap-1.5 text-xs"
                    style={{ color: 'var(--text-muted)' }}>
                    <RotateCcw size={11} /> Regenerate
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Cover image ── */}
      <div className="mb-6">
        <div className="relative">
          <input
            value={coverImage}
            onChange={e => handleCoverUrlChange(e.target.value)}
            placeholder="Paste cover image URL here (e.g. https://images.unsplash.com/...)"
            className="w-full px-0 py-2 text-sm outline-none border-b bg-transparent pr-8"
            style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
          />
          {coverImage && (
            <button onClick={() => { setCoverImage(''); setCoverPreview('') }}
              className="absolute right-0 top-2" style={{ color: 'var(--text-subtle)' }}>
              <X size={14} />
            </button>
          )}
        </div>
        {coverPreview && (
          <div className="mt-3 rounded-xl overflow-hidden relative" style={{ aspectRatio: '16/5' }}>
            <img src={coverPreview} alt="Cover preview" className="w-full h-full object-cover"
              onError={() => setCoverPreview('')} />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
              style={{ background: 'rgba(0,0,0,0.3)' }}>
              <span className="text-white text-xs">Cover image</span>
            </div>
          </div>
        )}
        {coverImage && !coverPreview && (
          <p className="mt-2 text-xs" style={{ color: 'var(--text-subtle)' }}>
            ⚠ Could not load image. Check the URL is a direct image link.
          </p>
        )}
        {!coverImage && (
          <p className="mt-1.5 text-xs" style={{ color: 'var(--text-subtle)' }}>
            Tip: Use <a href="https://unsplash.com" target="_blank" rel="noreferrer"
              style={{ color: 'var(--accent)' }}>Unsplash</a> for free high-quality images.
            Right-click any image → "Copy image address"
          </p>
        )}
      </div>

      {/* ── Title ── */}
      <textarea
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Title"
        rows={2}
        className="w-full resize-none bg-transparent outline-none font-display text-4xl md:text-5xl leading-tight mb-4"
        style={{ color: 'var(--text)' }}
      />

      {/* ── Excerpt ── */}
      <textarea
        value={excerpt}
        onChange={e => setExcerpt(e.target.value)}
        placeholder="Write a short summary…"
        rows={2}
        className="w-full resize-none bg-transparent outline-none text-lg italic mb-6"
        style={{ color: 'var(--text-muted)', fontFamily: '"Playfair Display", serif' }}
      />

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-0.5 mb-4 p-2 rounded-xl border"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}>
        {toolbarButtons.map((btn, i) => (
          <button key={i} onClick={btn.action} className="p-2 rounded-lg transition-colors"
            style={{ background: btn.active ? 'var(--text)' : 'transparent', color: btn.active ? 'var(--bg)' : 'var(--text-muted)' }}>
            {btn.icon}
          </button>
        ))}
      </div>

      {/* ── Editor ── */}
      <EditorContent editor={editor} className="min-h-[400px]" />

      {/* ── Post settings ── */}
      <div className="mt-10 pt-8 border-t grid grid-cols-1 md:grid-cols-2 gap-4"
        style={{ borderColor: 'var(--border)' }}>
        <div>
          <label className="block text-xs tracking-wide uppercase mb-2" style={{ color: 'var(--text-subtle)' }}>Category</label>
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text)', border: '1px solid var(--border)' }}>
            <option value="">Select category</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs tracking-wide uppercase mb-2" style={{ color: 'var(--text-subtle)' }}>Tags</label>
          <input value={tags} onChange={e => setTags(e.target.value)}
            placeholder="lifestyle, food, travel (comma-separated)"
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text)', border: '1px solid var(--border)' }}
          />
        </div>
        {(profile?.role === 'admin' || profile?.role === 'editor') && (
          <div className="flex items-center gap-3 md:col-span-2">
            <button onClick={() => setFeatured(f => !f)}
              className="w-10 h-5 rounded-full relative transition-colors flex-shrink-0"
              style={{ background: featured ? 'var(--accent)' : 'var(--border)' }}>
              <span className="absolute w-4 h-4 bg-white rounded-full top-0.5 transition-transform"
                style={{ left: featured ? '22px' : '2px' }} />
            </button>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Feature this post on homepage</span>
          </div>
        )}
      </div>

      {/* ── Bottom publish bar ── */}
      <div className="mt-8 pt-6 border-t flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
          {status === 'published' ? 'This post is live on your blog' : 'This post is saved as a draft'}
        </p>
        <div className="flex gap-2">
          {status === 'draft' && postId && (
            <button onClick={() => handleSave('published')} disabled={saving}
              className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-full disabled:opacity-40"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              <Eye size={12} /> Publish now
            </button>
          )}
          {status === 'published' && (
            <button onClick={() => handleSave('draft')} disabled={saving}
              className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-full border disabled:opacity-40"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              Unpublish
            </button>
          )}
        </div>
      </div>
    </div>
  )
}