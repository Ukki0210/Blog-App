import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { Post, CATEGORIES } from '../types'
import PostCard from '../components/blog/PostCard'
import FeaturedPost from '../components/blog/FeaturedPost'
import { Loader2 } from 'lucide-react'

export default function HomePage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [featured, setFeatured] = useState<Post | null>(null)
  const [category, setCategory] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params: any = { page, pageSize: 9 }
    if (category) params.category = category
    api.getPosts(params).then(data => {
      setPosts(data.posts)
      setTotalPages(data.totalPages)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [category, page])

  useEffect(() => {
    api.getPosts({ featured: true, pageSize: 1 }).then(data => {
      if (data.posts?.length) setFeatured(data.posts[0])
    })
  }, [])

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Hero title */}
      <div className="mb-10">
        <p className="category-pill mb-3">Latest Stories</p>
        <h1 className="font-display text-5xl md:text-6xl font-normal leading-tight" style={{ color: 'var(--text)' }}>
          From the<br /><em>Journal</em>
        </h1>
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-2 mb-10 overflow-x-auto pb-2">
        <button
          onClick={() => { setCategory(''); setPage(1) }}
          className="flex-shrink-0 text-xs tracking-[0.1em] uppercase px-4 py-2 rounded-full border transition-all duration-200"
          style={{
            background: !category ? 'var(--text)' : 'transparent',
            color: !category ? 'var(--bg)' : 'var(--text-muted)',
            borderColor: !category ? 'var(--text)' : 'var(--border)'
          }}
        >
          All
        </button>
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => { setCategory(cat.value); setPage(1) }}
            className="flex-shrink-0 text-xs tracking-[0.1em] uppercase px-4 py-2 rounded-full border transition-all duration-200"
            style={{
              background: category === cat.value ? 'var(--text)' : 'transparent',
              color: category === cat.value ? 'var(--bg)' : 'var(--text-muted)',
              borderColor: category === cat.value ? 'var(--text)' : 'var(--border)'
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Featured post */}
      {featured && !category && page === 1 && <FeaturedPost post={featured} />}

      {/* Posts grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--text-subtle)' }} />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-24">
          <p className="font-display text-2xl mb-2" style={{ color: 'var(--text-muted)' }}>No stories yet</p>
          <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>Check back soon for new content</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-12">
          {posts.map((post, i) => (
            <PostCard key={post.id} post={post} index={i} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-16">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className="w-9 h-9 rounded-full text-xs border transition-all"
              style={{
                background: page === p ? 'var(--text)' : 'transparent',
                color: page === p ? 'var(--bg)' : 'var(--text-muted)',
                borderColor: page === p ? 'var(--text)' : 'var(--border)'
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
