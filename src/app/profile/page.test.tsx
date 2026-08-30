import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  updateProfile: vi.fn(),
}));

let profile: {
  displayName: string;
  avatar: string;
  backgroundColor: string;
} | null = null;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({ profile, updateProfile: mocks.updateProfile }),
}));

vi.mock('../../components/Panel/UserPanel', () => ({
  default: ({ user }: { user: { avatarDir: string; backgroundColor: string } }) => (
    <output data-testid="user-panel">{user.avatarDir}:{user.backgroundColor}</output>
  ),
}));

import ProfilePage from './page';

beforeEach(() => {
  vi.clearAllMocks();
  profile = null;
  mocks.updateProfile.mockResolvedValue(undefined);
});

describe('ProfilePage', () => {
  it('shows the specified default profile while the profile is loading', () => {
    render(<ProfilePage />);

    expect(screen.getByLabelText('表示名')).toHaveProperty('value', '名前');
    expect(screen.getByRole('radio', { name: /unknown_user/ })).toHaveProperty('checked', true);
    expect(screen.getByTestId('user-panel').textContent).toBe('unknown_user:#535353');
  });

  it('updates the chat preview immediately as form values change', () => {
    render(<ProfilePage />);

    fireEvent.change(screen.getByLabelText('表示名'), { target: { value: '花子' } });
    fireEvent.click(screen.getByRole('radio', { name: /girl1/ }));
    fireEvent.click(screen.getByRole('radio', { name: '背景色 #789bc5' }));

    expect(screen.getByText('花子')).toBeTruthy();
    expect(screen.getByTestId('user-panel').textContent).toBe('girl1:#789bc5');
  });

  it('keeps the page visible and shows an error when saving fails', async () => {
    mocks.updateProfile.mockRejectedValue(new Error('保存できません'));
    render(<ProfilePage />);

    fireEvent.submit(screen.getByRole('button', { name: '保存' }).closest('form')!);

    expect((await screen.findByRole('alert')).textContent).toBe('保存できません');
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('disables saving while the update is in progress and returns home on success', async () => {
    let completeSave: (() => void) | undefined;
    mocks.updateProfile.mockImplementation(() => new Promise<void>(resolve => {
      completeSave = resolve;
    }));
    render(<ProfilePage />);

    fireEvent.submit(screen.getByRole('button', { name: '保存' }).closest('form')!);

    expect(screen.getByRole('button', { name: '保存中...' })).toHaveProperty('disabled', true);
    completeSave?.();

    await waitFor(() => {
      expect(mocks.updateProfile).toHaveBeenCalledWith({
        displayName: '名前',
        avatar: 'unknown_user',
        backgroundColor: '#535353',
      });
      expect(mocks.push).toHaveBeenCalledWith('/');
    });
  });
});