import { supabase } from './supabase'

// ─── ROOT CAUSE OF CORS ERRORS ────────────────────────────────────────────────
// The old code used:  const API_URL = 'http://localhost:5000'
// then called:        fetch(`${API_URL}/api/posts`)
//
// That sends the request directly from the browser to localhost:5000 — bypassing
// the Vite dev proxy entirely. The browser enforces CORS on cross-origin requests,
// and the backend would need to return Access-Control-Allow-Origin headers.
//
// The fix: use RELATIVE paths (/api/...) with NO host prefix.
// vite.config.ts already has:  proxy: { '/api': 'http://localhost:5000' }
// Relative paths go through that proxy → same origin → zero CORS issues.
// ─────────────────────────────────────────────────────────────────────────────

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }
  return headers
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = await getAuthHeaders()
  const res = await fetch(path, {           // ← relative path, no host
    ...options,
    headers: { ...headers, ...options.headers },
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(error.message || `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  // Posts
  getPosts: (params: Record<string, string | number | boolean | undefined> = {}) => {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => v !== undefined && query.set(k, String(v)))
    return request<any>(`/api/posts?${query}`)
  },
  getPost:      (slug: string)           => request<any>(`/api/posts/${slug}`),
  getRelated:   (id: string)             => request<any>(`/api/posts/related/${id}`),
  getAdminPosts:()                        => request<any>('/api/posts/admin/all'),
  getPostById:  (id: string)             => request<any>(`/api/posts/edit/${id}`),
  createPost:   (data: any)              => request<any>('/api/posts', { method: 'POST', body: JSON.stringify(data) }),
  updatePost:   (id: string, data: any)  => request<any>(`/api/posts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePost:   (id: string)             => request<void>(`/api/posts/${id}`, { method: 'DELETE' }),
  likePost:     (id: string)             => request<{ liked: boolean }>(`/api/posts/${id}/like`, { method: 'POST' }),
  getStats:     ()                        => request<any>('/api/posts/stats'),

  // Comments
  getComments:    (postId: string) => request<any>(`/api/comments/${postId}`),
  createComment:  (data: any)      => request<any>('/api/comments', { method: 'POST', body: JSON.stringify(data) }),
  deleteComment:  (id: string)     => request<void>(`/api/comments/${id}`, { method: 'DELETE' }),
  likeComment:    (id: string)     => request<{ liked: boolean }>(`/api/comments/${id}/like`, { method: 'POST' }),

  // Users
  getMe:         ()                        => request<any>('/api/users/me'),
  updateProfile: (data: any)               => request<any>('/api/users/me', { method: 'PUT', body: JSON.stringify(data) }),
  getProfile:    (id: string)              => request<any>(`/api/users/${id}`),
  getAllUsers:    ()                        => request<any>('/api/users/admin/all'),
  updateRole:    (id: string, role: string)=> request<void>(`/api/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
  subscribeNewsletter: (email: string)     => request<any>('/api/users/newsletter', { method: 'POST', body: JSON.stringify({ email }) }),

  // Audit logs (admin only)
  getAuditLogs: (params: { page?: number; pageSize?: number; action?: string; userId?: string } = {}) => {
    const query = new URLSearchParams()
    if (params.page)     query.set('page',     String(params.page))
    if (params.pageSize) query.set('pageSize', String(params.pageSize))
    if (params.action)   query.set('action',   params.action)
    if (params.userId)   query.set('userId',   params.userId)
    return request<any>(`/api/users/admin/audit-logs?${query}`)
  },

  // RAG
  ragIngest: (postId: string) =>
    request<any>(`/api/rag/ingest/${postId}`, { method: 'POST' }),
}
// RAG helpers (exported separately for direct use if needed outside ChatWidget)
export const rag = {
  /** Manually re-ingest a post's content into the vector DB (admin use) */
  ingest: (postId: string) =>
    fetch(`/api/rag/ingest/${postId}`, { method: 'POST' }),

  /**
   * Stream an answer from the RAG pipeline.
   * Returns an async generator of string tokens.
   * Usage: for await (const token of rag.ask('question', postId)) { ... }
   */
  async *ask(question: string, postId?: string | null): AsyncGenerator<string> {
    const res = await fetch('/api/rag/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, postId: postId ?? null }),
    })
    if (!res.ok || !res.body) throw new Error(`RAG error: ${res.status}`)

    const reader  = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer    = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6).trim()
        if (payload === '[DONE]') return
        try { yield JSON.parse(payload).token ?? '' } catch { /* skip */ }
      }
    }
  },
}