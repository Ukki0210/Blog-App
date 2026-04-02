import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuthStore } from '../lib/store'
import { Post } from '../types'
import toast from 'react-hot-toast'
import { LogOut, ExternalLink, PenLine } from 'lucide-react'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, profile, fetchProfile, signOut } = useAuthStore()
  const [posts, setPosts] = useState<Post[]>([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ fullName: '', username: '', bio: '', avatarUrl: '', website: '', twitter: '', instagram: '' })

  useEffect(() => {
    if (!user) { navigate('/auth'); return }
    if (profile) setForm({ fullName: profile.fullName || '', username: profile.username || '', bio: profile.bio || '', avatarUrl: profile.avatarUrl || '', website: profile.website || '', twitter: profile.twitter || '', instagram: profile.instagram || '' })
    if (profile?.role !== 'reader') api.getAdminPosts().then(setPosts).catch(() => {})
  }, [user, profile])

  const handleSave = async () => {
    try { await api.updateProfile(form); await fetchProfile(); setEditing(false); toast.success('Profile updated') }
    catch (e: any) { toast.error(e.message) }
  }

  if (!user) return null

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="flex items-start justify-between mb-12">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-xl" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
            {form.avatarUrl ? <img src={form.avatarUrl} alt="" className="w-full h-full object-cover" /> : (profile?.fullName || profile?.email || 'U')[0].toUpperCase()}
          </div>
          <div>
            <p className="font-display text-2xl" style={{ color: 'var(--text)' }}>{profile?.fullName || profile?.email?.split('@')[0]}</p>
            <p className="text-xs tracking-wide mt-0.5 capitalize" style={{ color: 'var(--text-subtle)' }}>{profile?.role}</p>
            {profile?.bio && <p className="text-sm mt-2 max-w-md" style={{ color: 'var(--text-muted)' }}>{profile.bio}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditing(e => !e)} className="text-xs px-3 py-1.5 rounded-full border transition-colors hover:bg-[var(--bg-secondary)]" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            {editing ? 'Cancel' : 'Edit profile'}
          </button>
          <button onClick={() => signOut().then(() => navigate('/'))} className="p-2 rounded-full border" style={{ borderColor: 'var(--border)' }}>
            <LogOut size={13} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>
      </div>

      {editing && (
        <div className="rounded-2xl p-6 mb-10 border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {(['fullName', 'username', 'avatarUrl', 'website', 'twitter', 'instagram'] as const).map(key => (
              <div key={key}>
                <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: 'var(--text-subtle)' }}>{key}</label>
                <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }} />
              </div>
            ))}
          </div>
          <div className="mb-4">
            <label className="text-[10px] uppercase tracking-wide block mb-1" style={{ color: 'var(--text-subtle)' }}>Bio</label>
            <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} rows={3}
              className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }} />
          </div>
          <button onClick={handleSave} className="text-xs px-4 py-2 rounded-full" style={{ background: 'var(--text)', color: 'var(--bg)' }}>Save</button>
        </div>
      )}

      {posts.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] tracking-[0.15em] uppercase" style={{ color: 'var(--text-subtle)' }}>Your stories</p>
            <a href="/write" className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--accent)' }}><PenLine size={12} /> New</a>
          </div>
          <div className="space-y-2">
            {posts.map(post => (
              <div key={post.id} className="flex items-center justify-between p-4 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <p className="text-sm" style={{ color: 'var(--text)' }}>{post.title}</p>
                  <span className="text-[10px] uppercase" style={{ color: post.status === 'published' ? 'var(--accent)' : 'var(--text-subtle)' }}>{post.status}</span>
                </div>
                <div className="flex gap-1">
                  {post.status === 'published' && <a href={`/post/${post.slug}`} target="_blank" className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)]" style={{ color: 'var(--text-muted)' }}><ExternalLink size={13} /></a>}
                  <a href={`/write/${post.id}`} className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)]" style={{ color: 'var(--text-muted)' }}><PenLine size={13} /></a>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
