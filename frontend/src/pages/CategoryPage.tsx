import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { Post } from '../types'
import PostCard from '../components/blog/PostCard'
import { Loader2 } from 'lucide-react'

export default function CategoryPage() {
  const { category } = useParams<{ category: string }>()
  const [posts, setPosts] = useState<Post[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.getPosts({ category, page, pageSize: 9 }).then(data => {
      setPosts(data.posts)
      setTotalPages(data.totalPages)
      setLoading(false)
    })
  }, [category, page])

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="mb-10">
        <p className="category-pill mb-2">Category</p>
        <h1 className="font-display text-5xl font-normal capitalize" style={{ color: 'var(--text)' }}>
          {category}
        </h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={22} className="animate-spin" style={{ color: 'var(--text-subtle)' }} />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-24">
          <p className="font-display text-2xl mb-2" style={{ color: 'var(--text-muted)' }}>No stories yet</p>
          <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>Check back soon</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map((post, i) => <PostCard key={post.id} post={post} index={i} />)}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-16">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)}
              className="w-9 h-9 rounded-full text-xs border transition-all"
              style={{ background: page === p ? 'var(--text)' : 'transparent', color: page === p ? 'var(--bg)' : 'var(--text-muted)', borderColor: page === p ? 'var(--text)' : 'var(--border)' }}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
