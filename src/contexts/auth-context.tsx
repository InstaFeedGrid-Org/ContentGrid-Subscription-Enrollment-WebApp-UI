import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';

import type { AuthSession } from '@/lib/api';

type AuthContextValue = {
  signedInEmail: string | null;
  token: string | null;
  signIn: (session: AuthSession) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const value = useMemo(
    () => ({
      signedInEmail,
      token,
      signIn: (session: AuthSession) => {
        setSignedInEmail(session.user.email);
        setToken(session.token);
      },
      signOut: () => {
        setSignedInEmail(null);
        setToken(null);
      },
    }),
    [signedInEmail, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }

  return context;
}
