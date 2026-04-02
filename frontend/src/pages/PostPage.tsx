import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Heart, MessageCircle, Clock, Eye, Share2, ArrowLeft, Trash2 } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { api } from '../lib/api'
import { Post, Comment } from '../types'
import { useAuthStore } from '../lib/store'
import PostCard from '../components/blog/PostCard'
import ChatWidget from '../components/chat/ChatWidget'
import toast from 'react-hot-toast'

export default function PostPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [related, setRelated] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [liking, setLiking] = useState(false)

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    api.getPost(slug).then(p => {
      setPost(p)
      setLoading(false)
      return Promise.all([
        api.getComments(p.id).then(setComments),
        api.getRelated(p.id).then(setRelated)
      ])
    }).catch(() => { setLoading(false); navigate('/') })
  }, [slug])

  const handleLike = async () => {
    if (!user || !post) { toast.error('Sign in to like posts'); return }
    setLiking(true)
    const { liked } = await api.likePost(post.id)
    setPost(p => p ? { ...p, likes: p.likes + (liked ? 1 : -1), userLiked: liked } : p)
    setLiking(false)
  }

  const handleComment = async (parentId?: string) => {
    if (!user || !post) { toast.error('Sign in to comment'); return }
    if (!commentText.trim()) return
    const comment = await api.createComment({ postId: post.id, parentId: parentId || null, content: commentText.trim() })
    if (parentId) {
      setComments(cs => cs.map(c => c.id === parentId ? { ...c, replies: [...c.replies, comment] } : c))
    } else {
      setComments(cs => [...cs, { ...comment, replies: [] }])
    }
    setCommentText('')
    setReplyTo(null)
    toast.success('Comment posted')
  }

  const handleDeleteComment = async (id: string) => {
    await api.deleteComment(id)
    setComments(cs => cs.filter(c => c.id !== id).map(c => ({ ...c, replies: c.replies.filter(r => r.id !== id) })))
    toast.success('Comment deleted')
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
    toast.success('Link copied to clipboard')
  }

  if (loading) return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--text-subtle)' }} />
    </div>
  )

  if (!post) return null

  return (
    <article className="max-w-7xl mx-auto px-6 py-12">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-xs tracking-wide mb-10 transition-opacity hover:opacity-60" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeft size={14} /> Back
      </button>

      {/* Header */}
      <header className="max-w-3xl mb-10">
        <div className="flex items-center gap-2 mb-4">
          {post.category && (
            <Link to={`/category/${post.category}`} className="category-pill">{post.category}</Link>
          )}
          <span style={{ color: 'var(--text-subtle)' }} className="text-[10px]">·</span>
          <span className="text-[10px]" style={{ color: 'var(--text-subtle)' }}>
            {post.publishedAt ? format(new Date(post.publishedAt), 'MMMM d, yyyy') : 'Draft'}
          </span>
        </div>
        <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-normal leading-tight mb-6" style={{ color: 'var(--text)' }}>
          {post.title}
        </h1>
        {post.excerpt && (
          <p className="text-lg leading-relaxed mb-8" style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontFamily: '"Playfair Display", serif' }}>
            {post.excerpt}
          </p>
        )}
        <div className="flex items-center justify-between pb-6 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            {post.authorAvatar ? (
              <img src={post.authorAvatar} alt="" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                {(post.authorName || 'A')[0]}
              </div>
            )}
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{post.authorName || 'Anonymous'}</p>
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-subtle)' }}>
                <Clock size={10} /> {post.readingTime} min read
                <span>·</span>
                <Eye size={10} /> {post.views} views
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleLike} disabled={liking}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all"
              style={{
                borderColor: post.userLiked ? 'var(--accent)' : 'var(--border)',
                color: post.userLiked ? 'var(--accent)' : 'var(--text-muted)',
                background: post.userLiked ? 'rgba(114, 138, 110, 0.08)' : 'transparent'
              }}>
              <Heart size={12} fill={post.userLiked ? 'currentColor' : 'none'} /> {post.likes}
            </button>
            <button onClick={handleShare} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all hover:bg-[var(--bg-secondary)]" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              <Share2 size={12} />
            </button>
          </div>
        </div>
      </header>

      {/* Cover image */}
      {post.coverImage && (
        <div className="rounded-2xl overflow-hidden mb-12 aspect-[16/7]">
          <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover" />
        </div>
      )}

      {/* Content + Sidebar */}
      <div className="flex gap-16">
        <div className="flex-1 max-w-3xl">
          <div className="post-content" dangerouslySetInnerHTML={{ __html: post.content }} />

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-10 pt-8 border-t" style={{ borderColor: 'var(--border)' }}>
              {post.tags.map(tag => (
                <Link key={tag} to={`/search?tag=${tag}`}
                  className="text-xs px-3 py-1 rounded-full border transition-colors hover:bg-[var(--bg-secondary)]"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                  #{tag}
                </Link>
              ))}
            </div>
          )}

          {/* Comments */}
          <section className="mt-16">
            <h3 className="font-display text-2xl mb-8" style={{ color: 'var(--text)' }}>
              {comments.length} {comments.length === 1 ? 'Response' : 'Responses'}
            </h3>

            {/* Comment form */}
            {user ? (
              <div className="mb-8">
                <textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Share your thoughts…"
                  rows={3}
                  className="w-full resize-none rounded-xl p-4 text-sm outline-none transition-colors"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text)', border: '1px solid var(--border)' }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
                <div className="flex justify-end mt-2">
                  <button onClick={() => handleComment()} disabled={!commentText.trim()}
                    className="text-xs px-4 py-2 rounded-full transition-colors disabled:opacity-40"
                    style={{ background: 'var(--text)', color: 'var(--bg)' }}>
                    Publish response
                  </button>
                </div>
              </div>
            ) : (
              <Link to="/auth" className="block text-center text-sm py-4 rounded-xl mb-8 border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-secondary)' }}>
                Sign in to leave a response
              </Link>
            )}

            {/* Comment list */}
            <div className="space-y-6">
              {comments.map(comment => (
                <CommentItem key={comment.id} comment={comment} user={user} profile={profile}
                  onDelete={handleDeleteComment} onReply={(id: string | null) => setReplyTo(id)}
                  replyTo={replyTo} commentText={commentText} setCommentText={setCommentText}
                  onSubmitReply={handleComment} />
              ))}
            </div>
          </section>
        </div>

        {/* Sticky sidebar */}
        <aside className="hidden lg:block w-64 flex-shrink-0">
          <div className="sticky top-24">
            <p className="text-[10px] tracking-[0.15em] uppercase mb-4" style={{ color: 'var(--text-subtle)' }}>More to read</p>
            <div className="space-y-6">
              {related.map(p => (
                <Link key={p.id} to={`/post/${p.slug}`} className="group block">
                  {p.coverImage && (
                    <div className="rounded-lg overflow-hidden aspect-video mb-2">
                      <img src={p.coverImage} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                  )}
                  <p className="category-pill mb-1">{p.category}</p>
                  <p className="text-sm font-display leading-snug group-hover:opacity-60 transition-opacity" style={{ color: 'var(--text)' }}>{p.title}</p>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Post-scoped RAG chat — anchored to this specific post's content */}
      <ChatWidget postId={post.id} />

      {/* Related (mobile) */}
      {related.length > 0 && (
        <section className="lg:hidden mt-16">
          <p className="text-[10px] tracking-[0.15em] uppercase mb-6" style={{ color: 'var(--text-subtle)' }}>More stories</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {related.map(p => <PostCard key={p.id} post={p} />)}
          </div>
        </section>
      )}
    </article>
  )
}

function CommentItem({ comment, user, profile, onDelete, onReply, replyTo, commentText, setCommentText, onSubmitReply }: any) {
  return (
    <div className="animate-fade-up">
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs overflow-hidden" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
          {comment.authorAvatar ? <img src={comment.authorAvatar} alt="" className="w-full h-full object-cover" /> : (comment.authorName || 'A')[0]}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>{comment.authorName || 'Anonymous'}</span>
            <span className="text-[10px]" style={{ color: 'var(--text-subtle)' }}>{formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}</span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{comment.content}</p>
          <div className="flex items-center gap-3 mt-2">
            {user && (
              <button onClick={() => onReply(comment.id)} className="text-[10px] tracking-wide uppercase" style={{ color: 'var(--text-subtle)' }}>Reply</button>
            )}
            {user && (user.id === comment.authorId || profile?.role === 'admin') && (
              <button onClick={() => onDelete(comment.id)} className="text-[10px] text-red-400 tracking-wide uppercase">Delete</button>
            )}
          </div>

          {/* Reply form */}
          {replyTo === comment.id && (
            <div className="mt-3">
              <textarea value={commentText} onChange={e => setCommentText(e.target.value)}
                placeholder="Write a reply…" rows={2}
                className="w-full resize-none rounded-lg p-3 text-sm outline-none"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text)', border: '1px solid var(--border)' }} />
              <div className="flex gap-2 mt-1.5">
                <button onClick={() => onSubmitReply(comment.id)}
                  className="text-xs px-3 py-1.5 rounded-full" style={{ background: 'var(--text)', color: 'var(--bg)' }}>Reply</button>
                <button onClick={() => onReply(null)} className="text-xs px-3 py-1.5 rounded-full border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>Cancel</button>
              </div>
            </div>
          )}

          {/* Nested replies */}
          {comment.replies?.length > 0 && (
            <div className="mt-4 pl-4 border-l space-y-4" style={{ borderColor: 'var(--border)' }}>
              {comment.replies.map((reply: Comment) => (
                <CommentItem key={reply.id} comment={reply} user={user} profile={profile} onDelete={onDelete} onReply={onReply} replyTo={replyTo} commentText={commentText} setCommentText={setCommentText} onSubmitReply={onSubmitReply} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}