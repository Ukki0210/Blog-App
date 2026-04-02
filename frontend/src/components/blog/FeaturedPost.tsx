import { Link } from 'react-router-dom'
import { Clock, Heart, ArrowRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Post } from '../../types'

export default function FeaturedPost({ post }: { post: Post }) {
  return (
    <Link to={`/post/${post.slug}`} className="group block mb-16">
      <div className="relative overflow-hidden rounded-2xl aspect-[16/7]" style={{ background: 'var(--bg-secondary)' }}>
        {post.coverImage && (
          <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.02]" />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12">
          <div className="flex items-center gap-2 mb-3">
            {post.category && <span className="text-[10px] tracking-[0.15em] uppercase text-white/70">{post.category}</span>}
            <span className="text-white/40">·</span>
            <span className="text-[10px] text-white/60">
              {post.publishedAt ? formatDistanceToNow(new Date(post.publishedAt), { addSuffix: true }) : ''}
            </span>
          </div>
          <h2 className="font-display text-3xl md:text-5xl font-medium text-white leading-tight mb-3 max-w-3xl">
            {post.title}
          </h2>
          {post.excerpt && (
            <p className="text-white/70 text-sm md:text-base max-w-xl mb-4 line-clamp-2">{post.excerpt}</p>
          )}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {post.authorAvatar ? (
                <img src={post.authorAvatar} alt="" className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs text-white">
                  {(post.authorName || 'A')[0]}
                </div>
              )}
              <span className="text-xs text-white/70">{post.authorName}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-white/50">
              <Clock size={11} /> {post.readingTime}m read
            </div>
            <div className="flex items-center gap-1 text-xs text-white/50">
              <Heart size={11} /> {post.likes}
            </div>
            <div className="ml-auto flex items-center gap-1.5 text-xs text-white/70 group-hover:text-white transition-colors">
              Read story <ArrowRight size={13} />
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
