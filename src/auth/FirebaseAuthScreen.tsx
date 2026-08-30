'use client';

import { initializeUI } from '@firebase-oss/ui-core';
import {
  FirebaseUIProvider,
  ForgotPasswordAuthScreen,
  GoogleSignInButton,
  SignInAuthScreen,
  SignUpAuthScreen,
} from '@firebase-oss/ui-react';
import { jaJp } from '@firebase-oss/ui-translations';
import { sendEmailVerification } from 'firebase/auth';
import { useState } from 'react';
import { app, auth } from '../lib/firebase';

type Screen = 'signIn' | 'signUp' | 'forgotPassword';

const ui = initializeUI({ app, auth, locale: jaJp });

export default function FirebaseAuthScreen() {
  const [screen, setScreen] = useState<Screen>('signIn');

  async function handleSignUp() {
    if (auth.currentUser && !auth.currentUser.emailVerified) {
      await sendEmailVerification(auth.currentUser);
    }
  }

  return (
    <FirebaseUIProvider ui={ui}>
      <main className="auth-screen">
        <section className="auth-panel" aria-label="妖精バイオームのログイン">
          <header className="auth-heading">
            <p>妖精バイオーム</p>
            <h1>{screen === 'signUp' ? 'アカウントをつくる' : screen === 'forgotPassword' ? 'パスワードを再設定' : 'ログイン'}</h1>
          </header>
          {screen === 'signIn' && (
            <SignInAuthScreen
              onSignUpClick={() => setScreen('signUp')}
              onForgotPasswordClick={() => setScreen('forgotPassword')}
            >
              <GoogleSignInButton themed="neutral" />
            </SignInAuthScreen>
          )}
          {screen === 'signUp' && (
            <SignUpAuthScreen onSignInClick={() => setScreen('signIn')} onSignUp={handleSignUp}>
              <GoogleSignInButton themed="neutral" />
            </SignUpAuthScreen>
          )}
          {screen === 'forgotPassword' && (
            <ForgotPasswordAuthScreen onBackToSignInClick={() => setScreen('signIn')} />
          )}
        </section>
      </main>
    </FirebaseUIProvider>
  );
}