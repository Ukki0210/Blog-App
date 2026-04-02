import { create } from 'zustand'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'
import { Profile } from '../types'

interface AuthState {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  initialized: boolean
  setSession: (session: Session | null) => void
  fetchProfile: () => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  loading: false,
  initialized: false,

  setSession: async (session) => {
    // Prevent duplicate profile fetches when the session token hasn't changed.
    // Both getSession() and onAuthStateChange fire on page load, which previously
    // caused repeated calls to /api/users/me before the token was ready (401s).
    const currentToken = get().session?.access_token
    const newToken = session?.access_token

    if (currentToken === newToken && get().initialized) {
      return
    }

    set({ session, user: session?.user ?? null })

    if (session?.user) {
      await get().fetchProfile()
    } else {
      set({ profile: null })
    }

    set({ initialized: true })
  },

  fetchProfile: async () => {
    try {
      const profile = await api.getMe()
      set({ profile })
    } catch {
      set({ profile: null })
    }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null, profile: null, initialized: false })
  },
}))