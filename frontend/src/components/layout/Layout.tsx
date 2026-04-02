import { Outlet, Link, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { Search, Moon, Sun, Menu, X, PenLine, LayoutDashboard } from 'lucide-react'
import { useAuthStore } from '../../lib/store'
import { CATEGORIES } from '../../types'
import ChatWidget from '../chat/ChatWidget'

interface LayoutProps {
  darkMode: boolean
  toggleDark: () => void
}

export default function Layout({ darkMode, toggleDark }: LayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { user, profile, signOut } = useAuthStore()
  const location = useLocation()

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex flex-col leading-none group">
            <span className="font-display text-xl tracking-wide" style={{ color: 'var(--text)' }}>LIFESTYLE</span>
            <span className="text-[9px] tracking-[0.2em] uppercase" style={{ color: 'var(--text-subtle)' }}>Curated Living</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {CATEGORIES.map(cat => (
              <Link
                key={cat.value}
                to={`/category/${cat.value}`}
                className="text-[11px] tracking-[0.12em] uppercase transition-colors duration-200"
                style={{ color: isActive(`/category/${cat.value}`) ? 'var(--text)' : 'var(--text-muted)' }}
              >
                {cat.label}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Link to="/search" className="p-2 rounded-full transition-colors hover:bg-[var(--bg-secondary)]">
              <Search size={16} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
            </Link>
            <button onClick={toggleDark} className="p-2 rounded-full transition-colors hover:bg-[var(--bg-secondary)]">
              {darkMode
                ? <Sun size={16} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
                : <Moon size={16} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
              }
            </button>
            {user ? (
              <div className="flex items-center gap-2">
                {(profile?.role === 'author' || profile?.role === 'editor' || profile?.role === 'admin') && (
                  <Link to="/write"
                    className="hidden md:flex items-center gap-1.5 text-xs tracking-wide px-3 py-1.5 rounded-full border transition-colors hover:bg-[var(--bg-secondary)]"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                    <PenLine size={13} /> Write
                  </Link>
                )}
                {/* FIX: Avatar now links to /dashboard (user's own space) */}
                <Link to="/dashboard">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium overflow-hidden"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    {profile?.avatarUrl ? (
                      <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span style={{ color: 'var(--text)' }}>
                        {(profile?.fullName || profile?.email || 'U')[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                </Link>
              </div>
            ) : (
              <Link
                to="/auth"
                className="text-xs tracking-wide px-4 py-2 rounded-full font-medium transition-all"
                style={{ background: 'var(--text)', color: 'var(--bg)' }}
              >
                Sign In
              </Link>
            )}
            <button onClick={() => setMenuOpen(m => !m)} className="md:hidden p-2">
              {menuOpen ? <X size={18} style={{ color: 'var(--text)' }} /> : <Menu size={18} style={{ color: 'var(--text)' }} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t px-6 py-4" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
            <div className="flex flex-col gap-4">
              {CATEGORIES.map(cat => (
                <Link key={cat.value} to={`/category/${cat.value}`} onClick={() => setMenuOpen(false)}
                  className="text-xs tracking-[0.12em] uppercase" style={{ color: 'var(--text-muted)' }}>
                  {cat.label}
                </Link>
              ))}
              {user && (
                <>
                  <Link to="/dashboard" onClick={() => setMenuOpen(false)}
                    className="text-xs tracking-[0.12em] uppercase flex items-center gap-1.5"
                    style={{ color: 'var(--text-muted)' }}>
                    <LayoutDashboard size={12} /> Dashboard
                  </Link>
                  {(profile?.role === 'author' || profile?.role === 'editor' || profile?.role === 'admin') && (
                    <Link to="/write" onClick={() => setMenuOpen(false)}
                      className="text-xs tracking-[0.12em] uppercase flex items-center gap-1.5"
                      style={{ color: 'var(--text-muted)' }}>
                      <PenLine size={12} /> Write
                    </Link>
                  )}
                  {(profile?.role === 'admin' || profile?.role === 'editor') && (
                    <Link to="/admin" onClick={() => setMenuOpen(false)}
                      className="text-xs tracking-[0.12em] uppercase" style={{ color: 'var(--text-muted)' }}>Admin</Link>
                  )}
                  <button onClick={() => { signOut(); setMenuOpen(false) }}
                    className="text-xs tracking-[0.12em] uppercase text-left"
                    style={{ color: 'var(--text-muted)' }}>Sign Out</button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t mt-20" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row justify-between gap-8">
            <div>
              <p className="font-display text-2xl mb-1" style={{ color: 'var(--text)' }}>LIFESTYLE</p>
              <p className="text-xs tracking-[0.15em] uppercase" style={{ color: 'var(--text-subtle)' }}>Curated Living</p>
            </div>
            <div className="flex gap-10">
              <div>
                <p className="text-[10px] tracking-[0.15em] uppercase mb-3" style={{ color: 'var(--text-subtle)' }}>Explore</p>
                <div className="flex flex-col gap-2">
                  {CATEGORIES.map(cat => (
                    <Link key={cat.value} to={`/category/${cat.value}`}
                      className="text-sm transition-colors hover:opacity-70"
                      style={{ color: 'var(--text-muted)' }}>
                      {cat.label}
                    </Link>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] tracking-[0.15em] uppercase mb-3" style={{ color: 'var(--text-subtle)' }}>Account</p>
                <div className="flex flex-col gap-2">
                  {user ? (
                    <>
                      <Link to="/dashboard" className="text-sm" style={{ color: 'var(--text-muted)' }}>Dashboard</Link>
                      {(profile?.role === 'author' || profile?.role === 'editor' || profile?.role === 'admin') &&
                        <Link to="/write" className="text-sm" style={{ color: 'var(--text-muted)' }}>Write</Link>}
                    </>
                  ) : (
                    <Link to="/auth" className="text-sm" style={{ color: 'var(--text-muted)' }}>Sign In</Link>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t flex justify-between items-center" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>© {new Date().getFullYear()} Lifestyle. All rights reserved.</p>
            <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>Curated with care.</p>
          </div>
        </div>
      </footer>

      {/* Chatbot */}
      <ChatWidget />
    </div>
  )
}