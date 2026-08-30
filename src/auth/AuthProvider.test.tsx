import { act, render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDoc: vi.fn(),
  onAuthStateChanged: vi.fn(),
  runTransaction: vi.fn(),
  sendEmailVerification: vi.fn(),
  signOut: vi.fn(),
  updateDoc: vi.fn(),
}));

vi.mock('../lib/firebase', () => ({
  auth: {},
  db: {},
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: mocks.onAuthStateChanged,
  reload: vi.fn(),
  sendEmailVerification: mocks.sendEmailVerification,
  signOut: mocks.signOut,
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_database, collection, id) => ({ collection, id })),
  getDoc: mocks.getDoc,
  runTransaction: mocks.runTransaction,
  serverTimestamp: vi.fn(() => 'server-timestamp'),
  updateDoc: mocks.updateDoc,
}));

import { AuthProvider, useAuth } from './AuthProvider';

let authStateChangedCallback: ((user: { uid: string; emailVerified: boolean } | null) => Promise<void>) | undefined;
let authContext: ReturnType<typeof useAuth> | undefined;

function AuthProbe() {
  authContext = useAuth();
  return <output>{authContext.status}</output>;
}

function renderProvider(children: ReactNode = <AuthProbe />) {
  return render(<AuthProvider>{children}</AuthProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  authContext = undefined;
  authStateChangedCallback = undefined;
  mocks.onAuthStateChanged.mockImplementation((_auth, callback) => {
    authStateChangedCallback = callback;
    return vi.fn();
  });
  mocks.runTransaction.mockImplementation(async (_database, update) => {
    await update({
      get: vi.fn().mockResolvedValue({ exists: () => false }),
      set: vi.fn(),
    });
  });
  mocks.getDoc.mockResolvedValue({
    exists: () => true,
    data: () => ({
      displayName: '',
      avatar: 'boy1',
      backgroundColor: '#DDDDDD',
      updatedAt: null,
    }),
  });
});

describe('AuthProvider', () => {
  it('provisions the requested default profile for a verified user', async () => {
    renderProvider();

    await act(async () => {
      await authStateChangedCallback?.({ uid: 'user-1', emailVerified: true });
    });

    expect(screen.getByText('authenticated')).toBeTruthy();
    expect(mocks.runTransaction).toHaveBeenCalledOnce();
    expect(mocks.getDoc).toHaveBeenCalledOnce();
    expect(authContext?.profile).toMatchObject({
      displayName: '',
      avatar: 'boy1',
      backgroundColor: '#DDDDDD',
    });
  });

  it('does not provision a profile until an email address is verified', async () => {
    renderProvider();

    await act(async () => {
      await authStateChangedCallback?.({ uid: 'user-1', emailVerified: false });
    });

    expect(screen.getByText('emailVerificationRequired')).toBeTruthy();
    expect(mocks.runTransaction).not.toHaveBeenCalled();
  });

  it('rejects an empty display name when a profile is saved', async () => {
    renderProvider();

    await act(async () => {
      await authStateChangedCallback?.({ uid: 'user-1', emailVerified: true });
    });

    await expect(authContext?.updateProfile({
      displayName: '   ',
      avatar: 'boy1',
      backgroundColor: '#DDDDDD',
    })).rejects.toThrow('表示名を入力してください。');
    expect(mocks.updateDoc).not.toHaveBeenCalled();
  });
});