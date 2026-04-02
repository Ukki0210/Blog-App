import { useState } from 'react'
import { api } from '../../lib/api'
import toast from 'react-hot-toast'

export default function NewsletterBanner() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    try {
      await api.subscribeNewsletter(email)
      setSubmitted(true)
      toast.success('You\'re subscribed!')
    } catch (e: any) {
      toast.error(e.message)
    }
    setLoading(false)
  }

  return (
    <section className="border-t border-b my-20" style={{ borderColor: 'var(--border)' }}>
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <p className="category-pill mb-4">Newsletter</p>
        <h2 className="font-display text-4xl font-normal mb-3" style={{ color: 'var(--text)' }}>
          Stories worth<br /><em>slowing down for</em>
        </h2>
        <p className="text-sm mb-8 max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>
          Curated essays on living well, delivered thoughtfully. No noise, just substance.
        </p>

        {submitted ? (
          <p className="text-sm" style={{ color: 'var(--accent)' }}>Thank you for subscribing ✦</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2 max-w-sm mx-auto">
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com" required
              className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text)', border: '1px solid var(--border)' }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
            <button type="submit" disabled={loading}
              className="px-4 py-2.5 rounded-xl text-xs tracking-wide whitespace-nowrap disabled:opacity-60"
              style={{ background: 'var(--text)', color: 'var(--bg)' }}>
              {loading ? '…' : 'Subscribe'}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
