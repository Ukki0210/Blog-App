import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import { Eye, EyeOff, Github } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AuthPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const inputStyle = {
    background: 'var(--bg-secondary)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) =>
    (e.target.style.borderColor = 'var(--accent)')
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) =>
    (e.target.style.borderColor = 'var(--border)')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email)
        if (error) throw error
        toast.success('Check your email for reset instructions')
        setMode('signin')

      } else if (mode === 'signup') {
        // 1. Create auth user
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error

        // 2. If email confirmation is disabled, session is available immediately
        //    Update the profile with name + username right away
        if (data.session) {
          try {
            await api.updateProfile({
              fullName: fullName || undefined,
              username: username || undefined,
            })
          } catch {
            // Non-fatal — profile fields can be set later in dashboard
          }
          toast.success('Welcome! Your account is ready.')
          navigate('/')
        } else {
          // Email confirmation required — session not yet available
          toast.success('Account created! Check your email to verify, then sign in.')
          setMode('signin')
        }

      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        toast.success('Welcome back!')
        navigate('/')
      }
    } catch (err: any) {
      toast.error(err.message)
    }
    setLoading(false)
  }

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  const handleGitHub = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: window.location.origin },
    })
  }

  const switchMode = (next: typeof mode) => {
    setMode(next)
    setEmail('')
    setPassword('')
    setFullName('')
    setUsername('')
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-10">
          <p className="font-display text-3xl mb-1" style={{ color: 'var(--text)' }}>LIFESTYLE</p>
          <p className="text-[10px] tracking-[0.2em] uppercase" style={{ color: 'var(--text-subtle)' }}>
            {mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset password'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Full Name — signup only */}
          {mode === 'signup' && (
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Full name"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
              style={inputStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          )}

          {/* Username — signup only */}
          {mode === 'signup' && (
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="Username (letters, numbers, _)"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
              style={inputStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          )}

          {/* Email */}
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email address"
            required
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors"
            style={inputStyle}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />

          {/* Password */}
          {mode !== 'reset' && (
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'Password (min 6 characters)' : 'Password'}
                required
                minLength={mode === 'signup' ? 6 : undefined}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors pr-12"
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
              />
              <button
                type="button"
                onClick={() => setShowPass(s => !s)}
                className="absolute right-4 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-subtle)' }}
              >
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-medium tracking-wide transition-opacity disabled:opacity-60"
            style={{ background: 'var(--text)', color: 'var(--bg)' }}
          >
            {loading
              ? '…'
              : mode === 'signin'
              ? 'Sign In'
              : mode === 'signup'
              ? 'Create Account'
              : 'Send Reset Link'}
          </button>
        </form>

        {/* OAuth */}
        {mode !== 'reset' && (
          <>
            <div className="my-5 flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>or</span>
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            </div>
            <div className="space-y-2">
              <button
                onClick={handleGoogle}
                className="w-full py-2.5 rounded-xl text-sm border flex items-center justify-center gap-2 transition-colors hover:bg-[var(--bg-secondary)]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </button>
              <button
                onClick={handleGitHub}
                className="w-full py-2.5 rounded-xl text-sm border flex items-center justify-center gap-2 transition-colors hover:bg-[var(--bg-secondary)]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                <Github size={15} /> Continue with GitHub
              </button>
            </div>
          </>
        )}

        {/* Mode switchers */}
        <div className="mt-6 text-center space-y-2">
          {mode === 'signin' && (
            <>
              <button onClick={() => switchMode('reset')} className="text-xs block w-full" style={{ color: 'var(--text-subtle)' }}>
                Forgot password?
              </button>
              <button onClick={() => switchMode('signup')} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                No account? <span style={{ color: 'var(--accent)' }}>Sign up</span>
              </button>
            </>
          )}
          {mode === 'signup' && (
            <button onClick={() => switchMode('signin')} className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Already have an account? <span style={{ color: 'var(--accent)' }}>Sign in</span>
            </button>
          )}
          {mode === 'reset' && (
            <button onClick={() => switchMode('signin')} className="text-xs" style={{ color: 'var(--accent)' }}>
              Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  )
}