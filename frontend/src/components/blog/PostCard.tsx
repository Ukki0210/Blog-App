import { Link } from 'react-router-dom'
import { Heart, MessageCircle, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Post } from '../../types'

interface PostCardProps {
  post: Post
  index?: number
}

export default function PostCard({ post, index = 0 }: PostCardProps) {
  const delay = `${index * 80}ms`

  return (
    <div
      className="post-card group animate-fade-up"
      style={{ animationDelay: delay, animationFillMode: 'backwards' }}
    >
      <Link to={`/post/${post.slug}`}>
        {/* Image */}
        <div className="overflow-hidden rounded-xl mb-4 aspect-[4/3]" style={{ background: 'var(--bg-secondary)' }}>
          {post.coverImage ? (
            <img src={post.coverImage} alt={post.title} className="post-card-image" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="font-display text-4xl font-medium opacity-10" style={{ color: 'var(--text)' }}>
                {post.category?.[0]?.toUpperCase() || 'L'}
              </span>
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2 mb-2">
          {post.category && <span className="category-pill">{post.category}</span>}
          <span className="text-[10px]" style={{ color: 'var(--text-subtle)' }}>·</span>
          <span className="text-[10px]" style={{ color: 'var(--text-subtle)' }}>
            {post.publishedAt ? formatDistanceToNow(new Date(post.publishedAt), { addSuffix: true }) : formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
          </span>
        </div>

        {/* Title */}
        <h2 className="font-display text-xl leading-snug mb-2 group-hover:opacity-70 transition-opacity" style={{ color: 'var(--text)' }}>
          {post.title}
        </h2>

        {/* Excerpt */}
        {post.excerpt && (
          <p className="text-sm leading-relaxed line-clamp-2 mb-3" style={{ color: 'var(--text-muted)' }}>
            {post.excerpt}
          </p>
        )}
      </Link>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {post.authorAvatar ? (
            <img src={post.authorAvatar} alt="" className="w-6 h-6 rounded-full object-cover" />
          ) : (
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px]" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
              {(post.authorName || 'A')[0]}
            </div>
          )}
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{post.authorName || 'Anonymous'}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-subtle)' }}>
            <Clock size={11} />
            {post.readingTime}m
          </span>
          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-subtle)' }}>
            <Heart size={11} />
            {post.likes}
          </span>
          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-subtle)' }}>
            <MessageCircle size={11} />
            {post.commentCount}
          </span>
        </div>
      </div>
    </div>
  )
}