import { useEffect, useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api, rag } from '../lib/api'
import { useAuthStore } from '../lib/store'
import { Post, Profile } from '../types'
import toast from 'react-hot-toast'
import {
  BarChart2, Users, FileText, Eye, Heart, MessageCircle,
  Mail, Trash2, PenLine, Shield, ScrollText, RefreshCw,
  ChevronLeft, ChevronRight, Filter, Search, Clock,
  TrendingUp, CheckCircle, AlertCircle, Globe, Lock
} from 'lucide-react'

type Tab = 'overview' | 'posts' | 'users' | 'audit'

interface AuditLog {
  id: string
  userId: string
  action: string
  resourceType: string
  resourceId: string
  details: string
  ipAddress: string
  createdAt: string
  userName: string
  userEmail: string
  userAvatar: string
}

interface AuditLogsResult {
  logs: AuditLog[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const ACTION_COLORS: Record<string, string> = {
  'post.create': '#22c55e',
  'post.update': '#3b82f6',
  'post.delete': '#ef4444',
  'comment.create': '#8b5cf6',
  'comment.delete': '#f97316',
  'user.role_change': '#f59e0b',
  'user.update_profile': '#06b6d4',
}

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  admin:  { bg: 'rgba(239,68,68,0.12)',   text: '#ef4444' },
  editor: { bg: 'rgba(245,158,11,0.12)',  text: '#f59e0b' },
  author: { bg: 'rgba(59,130,246,0.12)',  text: '#3b82f6' },
  reader: { bg: 'rgba(107,114,128,0.12)', text: '#6b7280' },
}

export default function AdminPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const [tab, setTab] = useState<Tab>('overview')
  const [stats, setStats] = useState<any>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [users, setUsers] = useState<Profile[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogsResult | null>(null)
  const [auditPage, setAuditPage] = useState(1)
  const [auditAction, setAuditAction] = useState('')
  const [auditUserId, setAuditUserId] = useState('')
  const [postSearch, setPostSearch] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [auditLoading, setAuditLoading] = useState(false)
  const [ingestingAll, setIngestingAll] = useState(false)
  const [ingestingId, setIngestingId] = useState<string | null>(null)

  // Auth guard
  useEffect(() => {
    if (!user) { navigate('/auth'); return }
    if (profile && profile.role !== 'admin' && profile.role !== 'editor') {
      navigate('/dashboard'); return
    }
  }, [user, profile])

  // Load core data
  useEffect(() => {
    if (!profile) return
    setLoading(true)
    Promise.all([
      api.getStats().then(setStats),
      api.getAdminPosts().then(setPosts),
      profile.role === 'admin' ? api.getAllUsers().then(setUsers) : Promise.resolve(),
    ]).finally(() => setLoading(false))
  }, [profile])

  // Load audit logs
  const loadAuditLogs = useCallback(async () => {
    if (profile?.role !== 'admin') return
    setAuditLoading(true)
    try {
      const data = await api.getAuditLogs({
        page: auditPage,
        pageSize: 25,
        action: auditAction || undefined,
        userId: auditUserId || undefined,
      })
      setAuditLogs(data)
    } catch {
      toast.error('Failed to load audit logs')
    } finally {
      setAuditLoading(false)
    }
  }, [profile, auditPage, auditAction, auditUserId])

  useEffect(() => {
    if (tab === 'audit') loadAuditLogs()
  }, [tab, auditPage, auditAction, auditUserId])

  const handleDeletePost = async (id: string) => {
    if (!confirm('Delete this post?')) return
    try {
      await api.deletePost(id)
      setPosts(ps => ps.filter(p => p.id !== id))
      toast.success('Post deleted')
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  /** Re-ingest a single post into the vector DB */
  const handleReIngest = async (postId: string) => {
    setIngestingId(postId)
    try {
      await api.ragIngest(postId)
      toast.success('Post re-ingested into vector DB')
    } catch (e: any) {
      toast.error(e.message ?? 'Ingest failed')
    } finally {
      setIngestingId(null)
    }
  }

  /** Bulk re-ingest ALL posts — for backfilling existing content */
  const handleBulkIngest = async () => {
    if (!confirm('Re-ingest all posts into the vector DB? This may take a minute.')) return
    setIngestingAll(true)
    let ok = 0
    for (const post of posts) {
      try { await api.ragIngest(post.id); ok++ } catch { /* skip failures */ }
    }
    toast.success('All posts ingested into vector DB')
    setIngestingAll(false)
  }

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await api.updateRole(userId, role)
      setUsers(us => us.map(u => u.id === userId ? { ...u, role: role as any } : u))
      toast.success(`Role updated to ${role}`)
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  if (!user || !profile || loading) return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: 'var(--text-subtle)' }} />
    </div>
  )

  const statCards = [
    { label: 'Published', value: stats?.published_posts ?? 0, icon: <Globe size={15} />, color: '#22c55e' },
    { label: 'Drafts', value: stats?.draft_posts ?? 0, icon: <Lock size={15} />, color: '#f59e0b' },
    { label: 'Total Views', value: stats?.total_views ?? 0, icon: <Eye size={15} />, color: '#3b82f6' },
    { label: 'Total Likes', value: stats?.total_likes ?? 0, icon: <Heart size={15} />, color: '#ef4444' },
    { label: 'Comments', value: stats?.total_comments ?? 0, icon: <MessageCircle size={15} />, color: '#8b5cf6' },
    { label: 'Users', value: stats?.total_users ?? 0, icon: <Users size={15} />, color: '#06b6d4' },
    { label: 'Subscribers', value: stats?.subscribers ?? 0, icon: <Mail size={15} />, color: '#f97316' },
  ]

  const filteredPosts = posts.filter(p =>
    !postSearch || p.title.toLowerCase().includes(postSearch.toLowerCase())
  )
  const filteredUsers = users.filter(u =>
    !userSearch || (u.email + (u.fullName || '')).toLowerCase().includes(userSearch.toLowerCase())
  )

  const isAdmin = profile.role === 'admin'
  const tabs: Tab[] = ['overview', 'posts', ...(isAdmin ? ['users', 'audit'] as Tab[] : [])]

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <p className="category-pill mb-1">Control Panel</p>
          <h1 className="font-display text-4xl font-normal" style={{ color: 'var(--text)' }}>
            {isAdmin ? 'Admin Dashboard' : 'Editor Dashboard'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-subtle)' }}>
            Logged in as <strong style={{ color: 'var(--text-muted)' }}>{profile.fullName || profile.email}</strong>
            &nbsp;·&nbsp;
            <span style={{ color: ROLE_COLORS[profile.role]?.text }}>{profile.role}</span>
          </p>
        </div>
        <Link to="/write"
          className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-full"
          style={{ background: 'var(--text)', color: 'var(--bg)' }}>
          <PenLine size={12} /> New Post
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 p-1 rounded-xl w-fit" style={{ background: 'var(--bg-secondary)' }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="text-xs tracking-wide px-4 py-2 rounded-lg capitalize transition-colors flex items-center gap-1.5"
            style={{
              background: tab === t ? 'var(--bg)' : 'transparent',
              color: tab === t ? 'var(--text)' : 'var(--text-muted)',
              boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none'
            }}>
            {t === 'overview' && <BarChart2 size={12} />}
            {t === 'posts' && <FileText size={12} />}
            {t === 'users' && <Users size={12} />}
            {t === 'audit' && <ScrollText size={12} />}
            {t}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-10">
            {statCards.map(card => (
              <div key={card.label} className="p-5 rounded-2xl border relative overflow-hidden"
                style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}>
                <div className="absolute top-4 right-4 p-2 rounded-xl"
                  style={{ background: card.color + '18', color: card.color }}>
                  {card.icon}
                </div>
                <p className="font-display text-3xl mt-2 mb-1" style={{ color: 'var(--text)' }}>
                  {card.value.toLocaleString()}
                </p>
                <p className="text-[11px] tracking-wide" style={{ color: 'var(--text-subtle)' }}>{card.label}</p>
              </div>
            ))}
          </div>

          {/* Recent posts mini-list */}
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}>
              <p className="text-xs tracking-[0.12em] uppercase font-medium" style={{ color: 'var(--text-subtle)' }}>
                Recent Posts
              </p>
              <button onClick={() => setTab('posts')} className="text-xs" style={{ color: 'var(--accent)' }}>
                View all →
              </button>
            </div>
            {posts.slice(0, 5).map((post, i) => (
              <div key={post.id}
                className="flex items-center justify-between px-5 py-3 border-b last:border-0 hover:bg-[var(--bg-secondary)] transition-colors"
                style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs w-4 text-center" style={{ color: 'var(--text-subtle)' }}>{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm truncate" style={{ color: 'var(--text)' }}>{post.title}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-subtle)' }}>
                      {post.category} · <Eye size={8} className="inline" /> {post.views} · <Heart size={8} className="inline" /> {post.likes}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full ml-3 flex-shrink-0"
                  style={{
                    background: post.status === 'published' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
                    color: post.status === 'published' ? '#22c55e' : '#f59e0b'
                  }}>
                  {post.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── POSTS ── */}
      {tab === 'posts' && (
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div className="relative flex-1 max-w-xs">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-subtle)' }} />
              <input
                value={postSearch}
                onChange={e => setPostSearch(e.target.value)}
                placeholder="Search posts…"
                className="w-full pl-8 pr-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text)', border: '1px solid var(--border)' }}
              />
            </div>
            <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
              {filteredPosts.length} post{filteredPosts.length !== 1 ? 's' : ''}
            </p>
            {/* Bulk RAG re-ingest button */}
            <button
              onClick={handleBulkIngest}
              disabled={ingestingAll || posts.length === 0}
              title="Re-ingest all posts into the RAG vector database"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition disabled:opacity-40"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}
            >
              <RefreshCw size={11} className={ingestingAll ? 'animate-spin' : ''} />
              {ingestingAll ? 'Ingesting…' : 'Re-ingest All (RAG)'}
            </button>
          </div>

          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            {filteredPosts.length === 0 ? (
              <p className="text-sm py-12 text-center" style={{ color: 'var(--text-subtle)' }}>No posts found</p>
            ) : filteredPosts.map((post, i) => (
              <div key={post.id}
                className="flex items-center justify-between px-5 py-4 border-b last:border-0 hover:bg-[var(--bg-secondary)] transition-colors"
                style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <span className="text-xs w-5 text-right flex-shrink-0" style={{ color: 'var(--text-subtle)' }}>{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{post.title}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
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
                      {post.featured && (
                        <span className="text-[10px]" style={{ color: '#f59e0b' }}>★ Featured</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-4 flex-shrink-0">
                  <Link to={`/write/${post.id}`}
                    className="p-1.5 rounded-lg hover:bg-[var(--bg)] transition-colors" style={{ color: 'var(--text-muted)' }}>
                    <PenLine size={13} />
                  </Link>
                  {post.status === 'published' && (
                    <Link to={`/post/${post.slug}`} target="_blank"
                      className="p-1.5 rounded-lg hover:bg-[var(--bg)] transition-colors" style={{ color: 'var(--text-muted)' }}>
                      <Eye size={13} />
                    </Link>
                  )}
                  <button
                    onClick={() => handleReIngest(post.id)}
                    disabled={ingestingId === post.id}
                    title="Re-ingest this post into the RAG vector DB"
                    className="p-1.5 rounded-lg hover:bg-[var(--bg)] transition-colors disabled:opacity-40"
                    style={{ color: 'var(--accent)' }}
                  >
                    <RefreshCw size={13} className={ingestingId === post.id ? 'animate-spin' : ''} />
                  </button>
                  <button onClick={() => handleDeletePost(post.id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors text-red-400">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── USERS ── */}
      {tab === 'users' && isAdmin && (
        <div>
          <div className="flex items-center gap-3 mb-5">
            <div className="relative flex-1 max-w-xs">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-subtle)' }} />
              <input
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Search users…"
                className="w-full pl-8 pr-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text)', border: '1px solid var(--border)' }}
              />
            </div>
            <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
              {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            {/* Table header */}
            <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}>
              <div className="col-span-5 text-[10px] tracking-[0.12em] uppercase" style={{ color: 'var(--text-subtle)' }}>User</div>
              <div className="col-span-3 text-[10px] tracking-[0.12em] uppercase" style={{ color: 'var(--text-subtle)' }}>Joined</div>
              <div className="col-span-4 text-[10px] tracking-[0.12em] uppercase" style={{ color: 'var(--text-subtle)' }}>Role</div>
            </div>
            {filteredUsers.map(u => (
              <div key={u.id}
                className="grid grid-cols-12 gap-4 items-center px-5 py-4 border-b last:border-0 hover:bg-[var(--bg-secondary)] transition-colors"
                style={{ borderColor: 'var(--border)' }}>
                {/* User info */}
                <div className="col-span-5 flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm overflow-hidden flex-shrink-0"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                    {u.avatarUrl
                      ? <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" />
                      : (u.fullName || u.email)[0].toUpperCase()
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm truncate font-medium" style={{ color: 'var(--text)' }}>
                      {u.fullName || u.username || '—'}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-subtle)' }}>{u.email}</p>
                  </div>
                </div>
                {/* Joined date */}
                <div className="col-span-3">
                  <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                    {new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                {/* Role selector */}
                <div className="col-span-4 flex items-center gap-2">
                  <div className="px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0"
                    style={{
  background: (ROLE_COLORS[u.role] || ROLE_COLORS.reader).bg,
  color: (ROLE_COLORS[u.role] || ROLE_COLORS.reader).text,
}}>
                    <Shield size={9} className="inline mr-1" />
                    {u.role}
                  </div>
                  {u.id !== user?.id && (
                    <select
                      value={u.role}
                      onChange={e => handleRoleChange(u.id, e.target.value)}
                      className="text-xs px-2 py-1.5 rounded-lg outline-none cursor-pointer ml-1"
                      style={{ background: 'var(--bg-secondary)', color: 'var(--text)', border: '1px solid var(--border)' }}>
                      {['reader', 'author', 'editor', 'admin'].map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  )}
                  {u.id === user?.id && (
                    <span className="text-[10px] ml-2" style={{ color: 'var(--text-subtle)' }}>(you)</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── AUDIT LOGS ── */}
      {tab === 'audit' && isAdmin && (
        <div>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <div className="relative">
              <Filter size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-subtle)' }} />
              <input
                value={auditAction}
                onChange={e => { setAuditAction(e.target.value); setAuditPage(1) }}
                placeholder="Filter by action…"
                className="pl-8 pr-3 py-2 rounded-xl text-sm outline-none w-48"
                style={{ background: 'var(--bg-secondary)', color: 'var(--text)', border: '1px solid var(--border)' }}
              />
            </div>
            <button
              onClick={() => { setAuditAction(''); setAuditUserId(''); setAuditPage(1) }}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              <RefreshCw size={11} /> Reset
            </button>
            {auditLogs && (
              <p className="text-xs ml-auto" style={{ color: 'var(--text-subtle)' }}>
                {auditLogs.total.toLocaleString()} total events
              </p>
            )}
          </div>

          {/* Quick action filters */}
          <div className="flex flex-wrap gap-2 mb-5">
            {['post.create', 'post.update', 'post.delete', 'user.role_change', 'comment.create'].map(action => (
              <button
                key={action}
                onClick={() => { setAuditAction(auditAction === action ? '' : action); setAuditPage(1) }}
                className="text-[10px] px-2.5 py-1 rounded-full border transition-all"
                style={{
                  borderColor: auditAction === action ? ACTION_COLORS[action] || 'var(--border)' : 'var(--border)',
                  color: auditAction === action ? ACTION_COLORS[action] || 'var(--text-muted)' : 'var(--text-subtle)',
                  background: auditAction === action ? (ACTION_COLORS[action] || '#000') + '15' : 'transparent'
                }}>
                {action}
              </button>
            ))}
          </div>

          {/* Logs table */}
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <div className="grid grid-cols-12 gap-3 px-5 py-3 border-b"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-secondary)' }}>
              <div className="col-span-3 text-[10px] tracking-[0.12em] uppercase" style={{ color: 'var(--text-subtle)' }}>Time</div>
              <div className="col-span-2 text-[10px] tracking-[0.12em] uppercase" style={{ color: 'var(--text-subtle)' }}>User</div>
              <div className="col-span-2 text-[10px] tracking-[0.12em] uppercase" style={{ color: 'var(--text-subtle)' }}>Action</div>
              <div className="col-span-5 text-[10px] tracking-[0.12em] uppercase" style={{ color: 'var(--text-subtle)' }}>Details</div>
            </div>

            {auditLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: 'var(--text-subtle)' }} />
              </div>
            ) : !auditLogs || auditLogs.logs.length === 0 ? (
              <div className="text-center py-12">
                <ScrollText size={24} className="mx-auto mb-3" style={{ color: 'var(--text-subtle)' }} />
                <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>No audit logs found</p>
              </div>
            ) : auditLogs.logs.map(log => (
              <div key={log.id}
                className="grid grid-cols-12 gap-3 items-start px-5 py-3.5 border-b last:border-0 hover:bg-[var(--bg-secondary)] transition-colors"
                style={{ borderColor: 'var(--border)' }}>
                {/* Time */}
                <div className="col-span-3">
                  <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                    <Clock size={10} style={{ color: 'var(--text-subtle)', flexShrink: 0 }} />
                    {new Date(log.createdAt).toLocaleString('en-US', {
                      month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
                {/* User */}
                <div className="col-span-2 flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] overflow-hidden flex-shrink-0"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                    {log.userAvatar
                      ? <img src={log.userAvatar} alt="" className="w-full h-full object-cover" />
                      : (log.userName || log.userEmail || '?')[0].toUpperCase()
                    }
                  </div>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    {log.userName || log.userEmail?.split('@')[0] || 'Unknown'}
                  </p>
                </div>
                {/* Action badge */}
                <div className="col-span-2">
                  <span className="inline-block text-[10px] px-2 py-0.5 rounded-full font-mono"
                    style={{
                      background: (ACTION_COLORS[log.action] || '#6b7280') + '18',
                      color: ACTION_COLORS[log.action] || '#6b7280'
                    }}>
                    {log.action}
                  </span>
                </div>
                {/* Details */}
                <div className="col-span-5">
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    {log.details || '—'}
                  </p>
                  {log.resourceId && (
                    <p className="text-[10px] mt-0.5 font-mono" style={{ color: 'var(--text-subtle)' }}>
                      {log.resourceType}/{log.resourceId.slice(0, 8)}…
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {auditLogs && auditLogs.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                Page {auditLogs.page} of {auditLogs.totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setAuditPage(p => Math.max(1, p - 1))}
                  disabled={auditPage <= 1}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border disabled:opacity-40"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                  <ChevronLeft size={12} /> Prev
                </button>
                <button
                  onClick={() => setAuditPage(p => Math.min(auditLogs.totalPages, p + 1))}
                  disabled={auditPage >= auditLogs.totalPages}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border disabled:opacity-40"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                  Next <ChevronRight size={12} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}