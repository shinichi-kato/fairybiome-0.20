/*
プロフィール編集画面
====================

## 模擬画面
チャットUI風の模擬画面を表示してユーザが編集の効果をわかるようにする。
模擬画面のレイアウトは以下の通り
```

{ [displayName]     }
{  テキスト         }> (icon)

<UserPanel user={user} panelWidth={192} />
```

## 名前(displayName)
* 空文字列禁止

## アバター(avatar)
* /static/avatar/user/からディレクトリを選択。
*
## 背景色
* /siteConfig.jsのbackgroundColorsから選択。


## その他
* 保存ボタン(->firestoreのusersコレクションを更新)  
* 戻るボタン

*/
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { siteConfig } from '../../../siteConfig';
import { useAuth } from '../../auth/AuthProvider';
import UserPanel from '../../components/Panel/UserPanel';

const AVATARS = ['boy1', 'girl1', 'unknown_user'] as const;

const DEFAULT_PROFILE = {
  displayName: '名前',
  avatar: 'unknown_user',
  backgroundColor: siteConfig.backgroundColorPalette[0],
};

type EditableProfile = {
  displayName: string;
  avatar: string;
  backgroundColor: string;
};

export default function ProfilePage() {
  const { profile, updateProfile } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState<EditableProfile>(DEFAULT_PROFILE);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setForm({
        displayName: profile.displayName,
        avatar: profile.avatar,
        backgroundColor: profile.backgroundColor,
      });
    }
  }, [profile]);

  function updateForm(update: Partial<EditableProfile>) {
    setError(null);
    setForm(current => ({ ...current, ...update }));
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const displayName = form.displayName.trim();
    if (!displayName) {
      setError('表示名を入力してください。');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await updateProfile({ ...form, displayName });
      router.push('/');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'プロフィールを保存できませんでした。');
    } finally {
      setIsSaving(false);
    }
  }

  return (
      <main className="min-h-screen bg-secondary px-4 py-10 text-gray-900">
        <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
          <form className="space-y-8" onSubmit={saveProfile}>
            <header className="space-y-2">
              <h1 className="text-2xl font-bold text-primary">プロフィール編集</h1>
              <p className="text-sm text-gray-700">あなたの表示名とアイコンを設定します。</p>
            </header>

            <div className="space-y-2">
              <label className="block font-semibold" htmlFor="displayName">表示名</label>
              <input
                id="displayName"
                className="w-full max-w-md border-2 border-gray-400 bg-white px-3 py-2 focus:border-primary focus:outline-2 focus:outline-primary"
                value={form.displayName}
                onChange={event => updateForm({ displayName: event.target.value })}
                required
                disabled={isSaving}
              />
            </div>

            <fieldset className="space-y-3" disabled={isSaving}>
              <legend className="font-semibold">アバター</legend>
              <div className="flex flex-wrap gap-3">
                {AVATARS.map(avatar => (
                  <label
                    key={avatar}
                    className={`cursor-pointer border-2 bg-white p-2 ${form.avatar === avatar ? 'border-primary' : 'border-gray-300'}`}
                  >
                    <input
                      className="sr-only"
                      type="radio"
                      name="avatar"
                      value={avatar}
                      checked={form.avatar === avatar}
                      onChange={() => updateForm({ avatar })}
                    />
                    <img
                      className="h-24 w-24 object-contain"
                      src={`/avatar/user/${avatar}/peace.svg`}
                      alt={`${avatar} のアバター`}
                    />
                    <span className="mt-1 block text-center text-sm">{avatar}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-3" disabled={isSaving}>
              <legend className="font-semibold">背景色</legend>
              <div className="flex flex-wrap gap-3">
                {siteConfig.backgroundColorPalette.map(color => (
                  <label key={color} className="cursor-pointer">
                    <input
                      className="sr-only"
                      type="radio"
                      name="backgroundColor"
                      aria-label={`背景色 ${color}`}
                      value={color}
                      checked={form.backgroundColor === color}
                      onChange={() => updateForm({ backgroundColor: color })}
                    />
                    <span
                      className={`block h-10 w-10 border-4 ${form.backgroundColor === color ? 'border-primary' : 'border-white'}`}
                      style={{ backgroundColor: color }}
                    />
                  </label>
                ))}
              </div>
            </fieldset>

            {error && <p role="alert" className="font-medium text-red-700">{error}</p>}

            <div className="flex flex-wrap gap-3">
              <button
                className="bg-primary px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={isSaving}
              >
                {isSaving ? '保存中...' : '保存'}
              </button>
              <Link className="border-2 border-primary px-5 py-3 font-semibold text-primary" href="/">
                戻る
              </Link>
            </div>
          </form>

          <section className="space-y-4" aria-label="プレビュー">
            <h2 className="text-lg font-bold">プレビュー</h2>
            <div className="flex items-end gap-2">
              <div className="max-w-48 border-2 border-gray-500 bg-white p-3">
                <p className="font-semibold">{form.displayName}</p>
                <p>こんにちは！</p>
              </div>
              <span className="mb-4 text-gray-700" aria-hidden="true">&gt;</span>
            </div>
            <UserPanel
              user={{
                displayName: form.displayName,
                avatarDir: form.avatar,
                backgroundColor: form.backgroundColor,
              }}
              panelWidth={192}
            />
          </section>
        </div>
      </main>
  );
}
