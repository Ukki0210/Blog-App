import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuthStore } from '../lib/store'
import { Post } from '../types'
import toast from 'react-hot-toast'
import {
  PenLine, Eye, Heart, MessageCircle, ExternalLink,
  LogOut, Edit2, Save, X, BookOpen, TrendingUp, Clock, User
} from 'lucide-react'

export default function UserDashboard() {
  const navigate = useNavigate()
  const { user, profile, fetchProfile, signOut } = useAuthStore()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    fullName: '', username: '', bio: '',
    avatarUrl: '', website: '', twitter: '', instagram: ''
  })

  useEffect(() => {
    if (!user) { navigate('/auth'); return }
    if (profile) {
      setForm({
        fullName: profile.fullName || '',
        username: profile.username || '',
        bio: profile.bio || '',
        avatarUrl: profile.avatarUrl || '',
        website: profile.website || '',
        twitter: profile.twitter || '',
        instagram: profile.instagram || '',
      })
      // load posts for authors/editors/admins
      if (profile.role !== 'reader') {
        api.getAdminPosts().then(setPosts).catch(() => {}).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    }
  }, [user, profile])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.updateProfile(form)
      await fetchProfile()
      setEditing(false)
      toast.success('Profile updated')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  const totalViews = posts.reduce((s, p) => s + p.views, 0)
  const totalLikes = posts.reduce((s, p) => s + p.likes, 0)
  const totalComments = posts.reduce((s, p) => s + p.commentCount, 0)
  const publishedCount = posts.filter(p => p.status === 'published').length
  const draftCount = posts.filter(p => p.status === 'draft').length

  const canWrite = profile && profile.role !== 'reader'

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">

      {/* Profile header */}
      <div className="rounded-2xl border p-6 mb-8" style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-2xl"
                style={{ background: 'var(--bg)', color: 'var(--text-muted)', border: '2px solid var(--border)' }}>
                {form.avatarUrl
                  ? <img src={form.avatarUrl} alt="" className="w-full h-full object-cover" />
                  : (profile?.fullName || profile?.email || 'U')[0].toUpperCase()
                }
              </div>
            </div>
            <div>
              <h1 className="font-display text-2xl" style={{ color: 'var(--text)' }}>
                {profile?.fullName || profile?.email?.split('@')[0] || 'My Dashboard'}
              </h1>
              {profile?.username && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>@{profile.username}</p>
              )}
              <span className="inline-block mt-1.5 text-[10px] px-2.5 py-0.5 rounded-full capitalize font-medium"
                style={{
                  background: profile?.role === 'admin' ? 'rgba(239,68,68,0.1)' :
                              profile?.role === 'editor' ? 'rgba(245,158,11,0.1)' :
                              profile?.role === 'author' ? 'rgba(59,130,246,0.1)' : 'rgba(107,114,128,0.1)',
                  color: profile?.role === 'admin' ? '#ef4444' :
                         profile?.role === 'editor' ? '#f59e0b' :
                         profile?.role === 'author' ? '#3b82f6' : '#6b7280'
                }}>
                {profile?.role}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start">
            {canWrite && (
              <Link to="/write"
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors hover:bg-[var(--bg)]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                <PenLine size={12} /> Write
              </Link>
            )}
            {(profile?.role === 'admin' || profile?.role === 'editor') && (
              <Link to="/admin"
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors hover:bg-[var(--bg)]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                Admin Panel →
              </Link>
            )}
            <button
              onClick={() => setEditing(e => !e)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors hover:bg-[var(--bg)]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              <Edit2 size={12} /> {editing ? 'Cancel' : 'Edit Profile'}
            </button>
            <button
              onClick={() => signOut().then(() => navigate('/'))}
              className="p-1.5 rounded-full border transition-colors hover:bg-[var(--bg)]"
              style={{ borderColor: 'var(--border)' }}>
              <LogOut size={13} style={{ color: 'var(--text-subtle)' }} />
            </button>
          </div>
        </div>

        {/* Bio */}
        {profile?.bio && !editing && (
          <p className="text-sm mt-4 leading-relaxed max-w-xl" style={{ color: 'var(--text-muted)' }}>
            {profile.bio}
          </p>
        )}

        {/* Edit form */}
        {editing && (
          <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {([
                ['fullName', 'Full Name'],
                ['username', 'Username'],
                ['avatarUrl', 'Avatar URL'],
                ['website', 'Website'],
                ['twitter', 'Twitter'],
                ['instagram', 'Instagram'],
              ] as const).map(([key, label]) => (
                <div key={key}>
                  <label className="text-[10px] uppercase tracking-wide block mb-1.5 font-medium"
                    style={{ color: 'var(--text-subtle)' }}>{label}</label>
                  <input
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-colors"
                    style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                  />
                </div>
              ))}
            </div>
            <div className="mb-4">
              <label className="text-[10px] uppercase tracking-wide block mb-1.5 font-medium"
                style={{ color: 'var(--text-subtle)' }}>Bio</label>
              <textarea
                value={form.bio}
                onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                rows={3}
                placeholder="Tell readers about yourself…"
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
                style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-full disabled:opacity-60"
                style={{ background: 'var(--text)', color: 'var(--bg)' }}>
                <Save size={12} /> {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-full border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                <X size={12} /> Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stats (for writers only) */}
      {canWrite && posts.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Published', value: publishedCount, icon: <BookOpen size={14} />, color: '#22c55e' },
            { label: 'Drafts', value: draftCount, icon: <Clock size={14} />, color: '#f59e0b' },
            { label: 'Total Views', value: totalViews, icon: <Eye size={14} />, color: '#3b82f6' },
            { label: 'Total Likes', value: totalLikes, icon: <Heart size={14} />, color: '#ef4444' },
          ].map(stat => (
            <div key={stat.label} className="p-4 rounded-2xl border"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}>
              <div className="flex items-center justify-between mb-2">
                <span style={{ color: stat.color }}>{stat.icon}</span>
              </div>
              <p className="font-display text-2xl" style={{ color: 'var(--text)' }}>
                {stat.value.toLocaleString()}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-subtle)' }}>{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Posts list */}
      {canWrite && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] tracking-[0.15em] uppercase font-medium" style={{ color: 'var(--text-subtle)' }}>
              Your Stories
            </p>
            <Link to="/write"
              className="flex items-center gap-1.5 text-xs"
              style={{ color: 'var(--accent)' }}>
              <PenLine size={12} /> New story
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: 'var(--text-subtle)' }} />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}>
              <PenLine size={24} className="mx-auto mb-3" style={{ color: 'var(--text-subtle)' }} />
              <p className="text-sm font-display mb-1" style={{ color: 'var(--text-muted)' }}>
                No stories yet
              </p>
              <p className="text-xs mb-4" style={{ color: 'var(--text-subtle)' }}>
                Share your first story with the world
              </p>
              <Link to="/write"
                className="inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-full"
                style={{ background: 'var(--text)', color: 'var(--bg)' }}>
                <PenLine size={12} /> Start writing
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              {posts.map((post) => (
                <div key={post.id}
                  className="flex items-center justify-between px-5 py-4 border-b last:border-0 hover:bg-[var(--bg-secondary)] transition-colors"
                  style={{ borderColor: 'var(--border)' }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                        {post.title}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{
                          background: post.status === 'published' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                          color: post.status === 'published' ? '#22c55e' : '#f59e0b'
                        }}>
                        {post.status}
                      </span>
                      {post.category && (
                        <span className="text-[10px]" style={{ color: 'var(--text-subtle)' }}>{post.category}</span>
                      )}
                      <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-subtle)' }}>
                        <Eye size={9} /> {post.views}
                      </span>
                      <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-subtle)' }}>
                        <Heart size={9} /> {post.likes}
                      </span>
                      <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-subtle)' }}>
                        <MessageCircle size={9} /> {post.commentCount}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-4 flex-shrink-0">
                    {post.status === 'published' && (
                      <Link to={`/post/${post.slug}`} target="_blank"
                        className="p-1.5 rounded-lg hover:bg-[var(--bg)] transition-colors"
                        style={{ color: 'var(--text-muted)' }}>
                        <ExternalLink size={13} />
                      </Link>
                    )}
                    <Link to={`/write/${post.id}`}
                      className="p-1.5 rounded-lg hover:bg-[var(--bg)] transition-colors"
                      style={{ color: 'var(--text-muted)' }}>
                      <PenLine size={13} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reader-only view */}
      {!canWrite && (
        <div className="text-center py-16 rounded-2xl border"
          style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}>
          <User size={28} className="mx-auto mb-4" style={{ color: 'var(--text-subtle)' }} />
          <h2 className="font-display text-xl mb-2" style={{ color: 'var(--text)' }}>Reader Account</h2>
          <p className="text-sm max-w-xs mx-auto" style={{ color: 'var(--text-muted)' }}>
            You can read and comment on stories. Contact an admin if you'd like to become an author.
          </p>
          <Link to="/"
            className="inline-flex items-center gap-1.5 text-xs mt-6 px-4 py-2 rounded-full"
            style={{ background: 'var(--text)', color: 'var(--bg)' }}>
            Browse stories →
          </Link>
        </div>
      )}
    </div>
  )
}