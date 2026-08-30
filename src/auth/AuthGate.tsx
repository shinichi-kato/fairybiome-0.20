'use client';

import { type ReactNode, useState } from 'react';
import FirebaseAuthScreen from './FirebaseAuthScreen';
import { useAuth } from './AuthProvider';

function VerificationRequired() {
  const { reloadUser, resendVerificationEmail, signOut } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function resend() {
    setBusy(true);
    try {
      await resendVerificationEmail();
      setMessage('確認メールを再送しました。受信箱をご確認ください。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '確認メールを再送できませんでした。');
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    setBusy(true);
    try {
      await reloadUser();
      setMessage('確認状態を更新しました。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '確認状態を更新できませんでした。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-message" aria-live="polite">
      <h1>メールアドレスを確認してください</h1>
      <p>受信した確認メールのリンクを開いた後、確認状態を更新してください。</p>
      {message && <p>{message}</p>}
      <div className="auth-actions">
        <button type="button" onClick={refresh} disabled={busy}>確認状態を更新</button>
        <button type="button" onClick={resend} disabled={busy}>確認メールを再送</button>
        <button type="button" onClick={() => void signOut()} disabled={busy}>サインアウト</button>
      </div>
    </main>
  );
}

function AuthFailure() {
  const { error, signOut } = useAuth();

  return (
    <main className="auth-message" role="alert">
      <h1>プロフィールを読み込めませんでした</h1>
      <p>{error ?? '時間をおいて再度ログインしてください。'}</p>
      <button type="button" onClick={() => void signOut()}>サインアウト</button>
    </main>
  );
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === 'loading') {
    return <main className="auth-message">読み込み中...</main>;
  }

  if (status === 'unauthenticated') {
    return <FirebaseAuthScreen />;
  }

  if (status === 'emailVerificationRequired') {
    return <VerificationRequired />;
  }

  if (status === 'error') {
    return <AuthFailure />;
  }

  return <>{children}</>;
}