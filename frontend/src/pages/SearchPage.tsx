import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { api } from '../lib/api'
import { Post } from '../types'
import PostCard from '../components/blog/PostCard'

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const q = searchParams.get('q')
    if (q) { setQuery(q); runSearch(q) }
  }, [])

  const runSearch = async (q: string) => {
    if (!q.trim()) return
    setLoading(true)
    setSearched(true)
    const data = await api.getPosts({ search: q, pageSize: 20 })
    setPosts(data.posts)
    setLoading(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchParams(query ? { q: query } : {})
    runSearch(query)
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="max-w-2xl mx-auto mb-12">
        <p className="category-pill mb-4 text-center">Search</p>
        <form onSubmit={handleSubmit} className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-subtle)' }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search stories, topics, authors…"
            className="w-full pl-11 pr-10 py-4 rounded-2xl text-sm outline-none transition-colors"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text)', border: '1px solid var(--border)' }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
          {query && (
            <button type="button" onClick={() => { setQuery(''); setPosts([]); setSearched(false) }}
              className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-subtle)' }}>
              <X size={14} />
            </button>
          )}
        </form>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--text-subtle)' }} />
        </div>
      ) : searched && posts.length === 0 ? (
        <div className="text-center py-20">
          <p className="font-display text-2xl mb-2" style={{ color: 'var(--text-muted)' }}>No results found</p>
          <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>Try different keywords</p>
        </div>
      ) : posts.length > 0 ? (
        <>
          <p className="text-xs mb-8" style={{ color: 'var(--text-subtle)' }}>{posts.length} result{posts.length !== 1 ? 's' : ''} for "{searchParams.get('q')}"</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post, i) => <PostCard key={post.id} post={post} index={i} />)}
          </div>
        </>
      ) : (
        <div className="text-center py-16">
          <p className="font-display text-4xl mb-4" style={{ color: 'var(--text)' }}>What are you<br />looking for?</p>
          <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>Search articles across culture, food, home, style, travel & wellness</p>
        </div>
      )}
    </div>
  )
}
