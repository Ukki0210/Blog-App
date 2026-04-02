import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { supabase } from './lib/supabase'
import { useAuthStore } from './lib/store'
import Layout from './components/layout/Layout'
import HomePage from './pages/HomePage'
import PostPage from './pages/PostPage'
import CategoryPage from './pages/CategoryPage'
import SearchPage from './pages/SearchPage'
import AuthPage from './pages/AuthPage'
import ProfilePage from './pages/ProfilePage'
import UserDashboard from './pages/UserDashboard'
import WritePage from './pages/WritePage'
import AdminPage from './pages/AdminPage'
import NotFoundPage from './pages/NotFoundPage'

export default function App() {
  const { setSession } = useAuthStore()
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark'
  })

  useEffect(() => {
    // Track whether the initial getSession() call has completed.
    // Supabase fires onAuthStateChange with INITIAL_SESSION immediately on
    // subscribe, which would call setSession twice on load and cause duplicate
    // /api/users/me requests. We skip the listener until getSession() finishes.
    let ready = false

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      ready = true
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!ready) return   // skip the duplicate INITIAL_SESSION event
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [darkMode])

  return (
    <BrowserRouter>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--bg-secondary)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            fontFamily: '"DM Sans", sans-serif',
            fontSize: '0.875rem',
            fontWeight: 300,
          },
        }}
      />
      <Routes>
        <Route element={<Layout darkMode={darkMode} toggleDark={() => setDarkMode(d => !d)} />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/post/:slug" element={<PostPage />} />
          <Route path="/category/:category" element={<CategoryPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/auth" element={<AuthPage />} />
          {/* /profile still works as a public profile view */}
          <Route path="/profile" element={<ProfilePage />} />
          {/* /dashboard is the new logged-in user dashboard */}
          <Route path="/dashboard" element={<UserDashboard />} />
          <Route path="/write" element={<WritePage />} />
          <Route path="/write/:id" element={<WritePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}