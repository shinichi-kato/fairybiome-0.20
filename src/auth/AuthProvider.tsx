/*
AuthProvider
============

## 概要
Firebase Authenticationを利用してチャットルーム用のユーザ認証を行うUIとプロフィール管理を提供します。

---

## セキュリティポリシー
- ユーザはメールアドレスとパスワードで認証。
- パスワードポリシー：数字と記号必須、最低8文字（フロント側でバリデーション）。
- メール検証：確認メール送信を行い、確認済みユーザのみサインイン可能。
- Firestoreルール：`users/{uid}` は公開読み取り可能、本人のみ書き込み可能。

```firestore
match /users/{uid} {
  allow read: if true;
  allow create, update, delete: if request.auth != null && request.auth.uid == uid;
}
```

---

## UI要件
- 提供UI：
  - サインアップ（SignUp）
  - サインイン（SignIn）
  - サインアウト（SignOut）
  - パスワードリセット（ForgotPassword）
  - メール検証後の再読み込み誘導（EmailVerificationPrompt）
- スマートフォン縦長画面を想定、主要CTAは画面下部固定。
- フロントで即時バリデーション。
- アクセシビリティ：MUIデフォルト。
- 日本語のみ対応。

---

## プロフィール管理
- Firestoreに保存するプロフィール：
```json
{
  "displayName": "string",
  "avatar": { "dir": "string", "file": "peace.svg" },
  "backgroundColor": "#ffcc00",
  "updatedAt": "Timestamp"
}
```
- アバター候補：`static/avatar/user/{avatarDir}/peace.svg`。
- 背景色パレット：`gatsby-config.js` の `siteMetadata.backgroundColorPalette` で提供。

---

## Firebase Auth関連
- 永続化：`browserLocalPersistence`。
- サインアウト時：Firestore購読解除（チャット側で管理）。
- プロバイダ追加：将来検討。

---

## Gatsby関連
- SSR中は認証状態を使用しない。
- 環境変数：`.env.local` に設定し `.gitignore` 対象。デプロイ時は GitHub Actions Secrets を使用。

---

## 実装方針
- **AuthProvider**：認証状態とプロフィールをContextで管理。
- **Resultオブジェクト方式**：`signIn` / `signUp` / `updateProfile` / `reloadUser` は `{ ok, message, code }` を返却。
- **AuthSwitchコンポーネント**：認証状態に応じてUIを切り替え（未ログイン→SignTabs、未検証→EmailVerificationPrompt、検証済→children）。
- **再送機能**：未検証時に確認メール再送ボタンを提供（`sendEmailVerification`）。
- **通知機構**：`notify()` と Snackbarでエラーメッセージや成功メッセージを表示。

---

*/



import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendEmailVerification,
    signOut as fbSignOut,
    User as FirebaseUser,
} from 'firebase/auth';

import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase/app';

import { Box, Typography, CircularProgress } from '@mui/material';

import { SignTabs } from './SignTabs';
import { EmailVerificationPrompt } from './EmailVerificationPrompt';


type Profile = {
    displayName: string;
    avatar: { dir: string; file: string }; // 'peace.svg'
    backgroundColor: string;
    updatedAt?: any;
};

type Result = {
    ok: boolean;
    message?: string; // ユーザ向け日本語メッセージ
    code?: string;    // 例: 'auth/email-not-verified'
};

type AuthContextValue = {
    user: FirebaseUser | null;
    profile: Profile | null;
    loading: boolean;
    requiresEmailVerification: boolean;
    resendVerificationEmail: () => Promise<Result>;

    // 通知（Snackbar等で使う想定）
    lastMessage: string | null;
    notify: (msg: string | null) => void;

    signIn: (email: string, password: string) => Promise<Result>;
    signUp: (email: string, password: string, initialProfile: Partial<Profile>) => Promise<Result>;
    signOut: () => Promise<Result>;
    updateProfile: (patch: Partial<Profile>) => Promise<Result>;
    reloadUser: () => Promise<Result>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [requiresEmailVerification, setRequiresEmailVerification] = useState(false);
    const [lastMessage, setLastMessage] = useState<string | null>(null);

    const notify = (msg: string | null) => setLastMessage(msg);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            setUser(u);
            if (!u) {
                setProfile(null);
                setRequiresEmailVerification(false);
                setLoading(false);
                return;
            }
            if (!u.emailVerified) {
                setProfile(null);
                setRequiresEmailVerification(true);
                setLoading(false);
                return;
            }
            const ref = doc(db, 'users', u.uid);
            const snap = await getDoc(ref);
            setProfile(snap.exists() ? (snap.data() as Profile) : null);
            setRequiresEmailVerification(false);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const signIn = async (email: string, password: string): Promise<Result> => {
        try {
            const cred = await signInWithEmailAndPassword(auth, email, password);
            if (!cred.user.emailVerified) {
                await fbSignOut(auth);
                setRequiresEmailVerification(true);
                return {
                    ok: false,
                    code: 'auth/email-not-verified',
                    message: 'メール確認が未完了です。確認メールのリンクをクリックした後、再読み込みしてください。',
                };
            }
            return { ok: true };
        } catch (e: any) {
            const code = e?.code as string | undefined;
            const message =
                code === 'auth/invalid-email' ? 'メールアドレスの形式が不正です' :
                    code === 'auth/user-not-found' ? '該当するユーザが見つかりません' :
                        code === 'auth/wrong-password' ? 'パスワードが正しくありません' :
                            'サインインに失敗しました';
            return { ok: false, code, message };
        }
    };

    const signUp = async (email: string, password: string, initialProfile: Partial<Profile>): Promise<Result> => {
        try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            await sendEmailVerification(cred.user);

            const ref = doc(db, 'users', cred.user.uid);
            const payload: Profile = {
                displayName: initialProfile.displayName ?? '',
                avatar: initialProfile.avatar ?? { dir: 'default', file: 'peace.svg' },
                backgroundColor: initialProfile.backgroundColor ?? '#535353',
                updatedAt: serverTimestamp(),
            };
            await setDoc(ref, payload, { merge: true });

            await fbSignOut(auth);
            setRequiresEmailVerification(true);
            return {
                ok: true,
                code: 'auth/sign-up-success-await-verification',
                message: '登録しました。確認メールのリンクをクリックした後、再度サインインして再読み込みしてください。',
            };
        } catch (e: any) {
            const code = e?.code as string | undefined;
            const message =
                code === 'auth/email-already-in-use' ? 'このメールアドレスは既に使用されています' :
                    code === 'auth/invalid-email' ? 'メールアドレスの形式が不正です' :
                        code === 'auth/weak-password' ? 'パスワードが弱すぎます' :
                            '登録に失敗しました';
            return { ok: false, code, message };
        }
    };

    const signOut = async (): Promise<Result> => {
        try {
            await fbSignOut(auth);
            setProfile(null);
            return { ok: true };
        } catch (e: any) {
            return { ok: false, code: e?.code, message: 'サインアウトに失敗しました' };
        }
    };

    const updateProfile = async (patch: Partial<Profile>): Promise<Result> => {
        try {
            if (!user) return { ok: false, code: 'auth/not-signed-in', message: '未ログインです' };
            const ref = doc(db, 'users', user.uid);
            await updateDoc(ref, { ...patch, updatedAt: serverTimestamp() });
            setProfile(prev => prev ? { ...prev, ...patch } as Profile : prev);
            return { ok: true };
        } catch (e: any) {
            return { ok: false, code: e?.code, message: 'プロフィールの更新に失敗しました' };
        }
    };

    const reloadUser = async (): Promise<Result> => {
        try {
            if (!auth.currentUser) return { ok: false, code: 'auth/not-signed-in', message: '未ログインです' };
            await auth.currentUser.reload();
            const u = auth.currentUser;
            setUser(u);
            setRequiresEmailVerification(!u.emailVerified);
            if (u.emailVerified) {
                const ref = doc(db, 'users', u.uid);
                const snap = await getDoc(ref);
                setProfile(snap.exists() ? (snap.data() as Profile) : null);
            }
            return { ok: true };
        } catch (e: any) {
            return { ok: false, code: e?.code, message: '再読み込みに失敗しました' };
        }
    };


    const resendVerificationEmail = async (): Promise<Result> => {
        try {
            const u = auth.currentUser;
            if (!u) return { ok: false, code: 'auth/not-signed-in', message: '未ログインです' };
            if (u.emailVerified) return { ok: true, message: 'すでにメール確認済みです' };
            await sendEmailVerification(u);
            return { ok: true, message: '確認メールを再送しました。受信箱をご確認ください。' };
        } catch (e: any) {
            const code = e?.code as string | undefined;
            const message =
                code === 'auth/too-many-requests' ? '短時間に複数回の送信が行われました。しばらくしてから再度お試しください。' :
                    '確認メールの再送に失敗しました';
            return { ok: false, code, message };
        }
    };


    const value = useMemo<AuthContextValue>(() => ({
        user, profile, loading, requiresEmailVerification,
        lastMessage, notify,
        signIn, signUp, signOut, updateProfile, reloadUser,
        resendVerificationEmail,
    }), [user, profile, loading, requiresEmailVerification, lastMessage]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};


/**
 * 認証状態に応じて表示を切り替える高階コンポーネント。
 * - loading: ローディング表示
 * - 未ログイン: SignTabs
 * - 未検証: EmailVerificationPrompt
 * - 検証済み: children をそのまま表示
 */
export const AuthSwitch: React.FC<{
    loadingFallback?: React.ReactNode;
    unauthenticatedFallback?: React.ReactNode;
    unverifiedFallback?: React.ReactNode;
    children: React.ReactNode;
}> = ({ loadingFallback, unauthenticatedFallback, unverifiedFallback, children }) => {
    const { user, loading, requiresEmailVerification } = useAuth();

    if (loading) {
        return (
            <>
                {loadingFallback ?? (
                    <Box sx={{ maxWidth: 480, mx: 'auto', p: 3, display: 'grid', placeItems: 'center' }}>
                        <CircularProgress />
                        <Typography sx={{ mt: 2 }}>読み込み中...</Typography>
                    </Box>
                )}
            </>
        );
    }

    if (!user) {
        return (
            <>
                {unauthenticatedFallback ?? (
                    <Box sx={{ maxWidth: 480, mx: 'auto' }}>
                        <Typography variant="h5" sx={{ p: 2 }}>ようこそ</Typography>
                        <SignTabs />
                    </Box>
                )}
            </>
        );
    }

    if (requiresEmailVerification) {
        return (
            <>
                {unverifiedFallback ?? (
                    <Box sx={{ maxWidth: 480, mx: 'auto', p: 2 }}>
                        <EmailVerificationPrompt />
                    </Box>
                )}
            </>
        );
    }

    // 検証済みユーザ
    return <>{children}</>;
};
