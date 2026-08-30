'use client';

import {
  type User,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  type Timestamp,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import { auth, db } from '../lib/firebase';

export type UserProfile = {
  displayName: string;
  avatar: string;
  backgroundColor: string;
  updatedAt: Timestamp | null;
};

export type AuthStatus =
  | 'loading'
  | 'unauthenticated'
  | 'emailVerificationRequired'
  | 'authenticated'
  | 'error';

type AuthContextValue = {
  user: User | null;
  profile: UserProfile | null;
  status: AuthStatus;
  error: string | null;
  signOut: () => Promise<void>;
  reloadUser: () => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  updateProfile: (update: Pick<UserProfile, 'displayName' | 'avatar' | 'backgroundColor'>) => Promise<void>;
};

type AuthState = Pick<AuthContextValue, 'user' | 'profile' | 'status' | 'error'>;

const DEFAULT_PROFILE = {
  displayName: '',
  avatar: 'boy1',
  backgroundColor: '#DDDDDD',
} as const;

const AuthContext = createContext<AuthContextValue | null>(null);

async function getOrCreateProfile(userId: string): Promise<UserProfile> {
  const profileRef = doc(db, 'users', userId);

  await runTransaction(db, async transaction => {
    const profileSnapshot = await transaction.get(profileRef);
    if (!profileSnapshot.exists()) {
      transaction.set(profileRef, {
        ...DEFAULT_PROFILE,
        updatedAt: serverTimestamp(),
      });
    }
  });

  const profileSnapshot = await getDoc(profileRef);
  if (!profileSnapshot.exists()) {
    throw new Error('プロフィールを作成できませんでした。');
  }

  return profileSnapshot.data() as UserProfile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    status: 'loading',
    error: null,
  });

  useEffect(() => {
    let disposed = false;

    const unsubscribe = onAuthStateChanged(auth, async user => {
      if (disposed) {
        return;
      }

      if (!user) {
        setState({ user: null, profile: null, status: 'unauthenticated', error: null });
        return;
      }

      if (!user.emailVerified) {
        setState({ user, profile: null, status: 'emailVerificationRequired', error: null });
        return;
      }

      try {
        const profile = await getOrCreateProfile(user.uid);
        if (!disposed) {
          setState({ user, profile, status: 'authenticated', error: null });
        }
      } catch (error) {
        if (!disposed) {
          setState({
            user,
            profile: null,
            status: 'error',
            error: error instanceof Error ? error.message : 'プロフィールの読み込みに失敗しました。',
          });
        }
      }
    });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  async function signOut() {
    await firebaseSignOut(auth);
  }

  async function reloadUser() {
    if (!auth.currentUser) {
      throw new Error('ログインしていません。');
    }
    await reload(auth.currentUser);
  }

  async function resendVerificationEmail() {
    if (!auth.currentUser) {
      throw new Error('ログインしていません。');
    }
    await sendEmailVerification(auth.currentUser);
  }

  async function updateProfile(update: Pick<UserProfile, 'displayName' | 'avatar' | 'backgroundColor'>) {
    if (!state.user) {
      throw new Error('ログインしていません。');
    }

    const displayName = update.displayName.trim();
    if (!displayName) {
      throw new Error('表示名を入力してください。');
    }

    const profileRef = doc(db, 'users', state.user.uid);
    await updateDoc(profileRef, {
      ...update,
      displayName,
      updatedAt: serverTimestamp(),
    });

    setState(current => current.profile ? {
      ...current,
      profile: { ...current.profile, ...update, displayName },
    } : current);
  }

  return (
    <AuthContext.Provider value={{ ...state, signOut, reloadUser, resendVerificationEmail, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }
  return context;
}