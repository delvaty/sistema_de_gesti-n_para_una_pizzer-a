import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';
import { Session, User } from '@supabase/supabase-js';
import { Tables } from '../types/supabase';

type Profile = Tables<'profiles'>;

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  checkSession: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  loading: true,
  setSession: (session) => {
    set({ session, user: session?.user ?? null });
  },
  setProfile: (profile) => {
    set({ profile });
  },
  checkSession: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      set({ session, user: session?.user ?? null });
      if (session?.user) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        if (error) throw error;
        set({ profile });
      }
    } catch (error) {
      console.error('Error checking session:', error);
    } finally {
      set({ loading: false });
    }
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null });
  },
}));

// Inicializar y escuchar cambios de autenticación
supabase.auth.onAuthStateChange((_event, session) => {
  useAuthStore.getState().setSession(session);
  // Si la sesión cambia (login/logout), recargar el perfil
  if (_event === 'SIGNED_IN' && session?.user) {
     supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data: profile, error }) => {
        if (error) {
          console.error('Error fetching profile on auth change:', error);
        } else {
          useAuthStore.getState().setProfile(profile);
        }
      });
  } else if (_event === 'SIGNED_OUT') {
    useAuthStore.getState().setProfile(null);
  }
});
