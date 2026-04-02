import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
      <p className="font-display text-[8rem] leading-none font-normal opacity-10 mb-4" style={{ color: 'var(--text)' }}>404</p>
      <h1 className="font-display text-3xl mb-3" style={{ color: 'var(--text)' }}>Page not found</h1>
      <p className="text-sm mb-8 max-w-xs" style={{ color: 'var(--text-subtle)' }}>
        The story you're looking for seems to have wandered off.
      </p>
      <Link to="/" className="text-xs tracking-wide px-5 py-2.5 rounded-full"
        style={{ background: 'var(--text)', color: 'var(--bg)' }}>
        Back to Journal
      </Link>
    </div>
  )
}
