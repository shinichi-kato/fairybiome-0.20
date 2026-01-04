/*
# ユーザプロフィール編集
========================

## 概要
現在のユーザプロフィールを編集し、AuthProviderの関数を利用してFirestoreに保存・反映します。編集UIはチャット風プレビューを備え、表示名、アバター、背景色を設定可能です。

---

## UI要件
- 構成要素：
  - **チャット風プレビュー**：
    - 吹き出し：角丸16px（右下のみradius 0）、右下テイル（左下塗りつぶし三角形）。
    - peace.svg（上半身）を幅192pxで表示、背面に下揃えの正方形＋左上corner-radius=高さ → 1/4扇形背景。
    - 吹き出し背景色＝アバター背景色。
  - **表示名入力**：必須、最大32文字。
  - **背景色選択**：gatsby-config.jsの`siteMetadata.backgroundColorPalette`から取得し、吹き出しとアバター背景に反映。
  - **アバター選択**：
    - `peace.svg`のみを横スクロール可能な`<ImageList/>`で表示。
    - ファイル名が`_`で始まるものは除外（ギミック用）。
    - 選択状態は枠線強調＋「選択中」ラベル表示。

---

## アバター画像仕様
- peace.svg：高さ:幅 = 4:3（上半身）。
- avatar.svg：高さ:幅 = 1:1（顔）。※現在のUIではpeace.svgのみ選択対象。

---

## Firestore構造
```json
{
  "displayName": "string",
  "avatar": { "dir": "string", "file": "peace.svg" },
  "backgroundColor": "#ffcc00",
  "updatedAt": "Timestamp"
}
```

- `users/{uid}` は公開読み取り可能、本人のみ書き込み可能。

---

## AuthProvider連携
- 認証状態とプロフィールをContextで管理。
- Resultオブジェクト方式：
```ts
{ ok: boolean; message?: string; code?: string }
```
- 保存時は`updateProfile()`を利用し、成功・失敗をSnackbarで通知。
- 認証分岐は`AuthSwitch`で責務分離（未ログイン→SignTabs、未検証→EmailVerificationPrompt、検証済→ProfileEditor）。

---

*/
import * as React from 'react';
import { useState, useMemo } from 'react';
import {
  Box, Typography, TextField, ToggleButton, ToggleButtonGroup, Button, Snackbar, Alert,
  ImageList, ImageListItem, ImageListItemBar

} from '@mui/material';
import { useAuth } from '../../auth/AuthProvider';
import { useBackgroundPalette } from '../../hooks/useBackgroundPalette';
import { useUserAvatarSets } from '../../hooks/useAvatarFiles';
import { ChatPreview } from './ChatPreview';

export const ProfileEditor = () => {
  const { profile, updateProfile, notify, lastMessage } = useAuth();
  const palette = useBackgroundPalette();
  const avatarSets = useUserAvatarSets();

  // 初期値
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [backgroundColor, setBackgroundColor] = useState(profile?.backgroundColor ?? palette[0]);
  const [avatarDir, setAvatarDir] = useState(profile?.avatar?.dir ?? (avatarSets[0]?.dir ?? 'default'));
  const [saving, setSaving] = useState(false);
  const [inlineErr, setInlineErr] = useState<string | null>(null);

  // 選択中ディレクトリの画像URLペア
  const selected = useMemo(
    () => avatarSets.find(a => a.dir === avatarDir) ?? avatarSets[0],
    [avatarDir, avatarSets]
  );

  const handleSave = async () => {
    setInlineErr(null); setSaving(true);
    const res = await updateProfile({
      displayName,
      backgroundColor,
      avatar: { dir: avatarDir, file: 'peace.svg' }, // 仕様：firestoreには peace.svg を記録
    });
    setSaving(false);
    if (!res.ok) {
      setInlineErr(res.message ?? '保存に失敗しました');
      notify(res.message ?? '保存に失敗しました');
    } else {
      notify('保存しました');
    }
  };

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', py: 1 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>プロフィール編集</Typography>

      {/* チャット風プレビュー（背景色＝吹き出し背景＝アバター背景） */}
      {selected && (
        <ChatPreview
          message={displayName ? `${displayName} のプレビューです` : 'プレビューです'}
          faceURL={selected.avatarURL}
          bodyURL={selected.peaceURL}
          backgroundColor={backgroundColor}
        />
      )}

      {/* 表示名 */}
      <TextField
        label="表示名"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        fullWidth
        margin="normal"
        inputProps={{ maxLength: 32 }}
        helperText="チャットで表示される名前（最大32文字）"
      />

      {/* 背景色パレット（吹き出しとアバター背景に反映） */}
      <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>背景色（吹き出し／アバター背景）</Typography>
      <ToggleButtonGroup
        exclusive
        value={backgroundColor}
        onChange={(_, v) => v && setBackgroundColor(v)}
        sx={{ flexWrap: 'wrap', gap: 1 }}
      >
        {palette.map((c) => (
          <ToggleButton key={c} value={c} sx={{ width: 40, height: 40, p: 0, border: '1px solid #ccc' }}>
            <Box sx={{ width: '100%', height: '100%', backgroundColor: c }} />
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {/* アバター選択（dir単位） */}


      <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
        アバター選択
      </Typography>

      <Box
        sx={{
          // 枠全体の制御：スマホ画面幅で横スクロール
          overflowX: 'auto',
        }}
      >
        <ImageList
          cols={Math.max(avatarSets.length, 1)}
          gap={8}
          rowHeight={90} // 4:3 の高さ → 幅120pxに合わせるなら 90px
          sx={{
            m: 0,
            gridAutoFlow: 'column', // 横方向に並べる
            gridTemplateColumns: `repeat(${avatarSets.length}, 120px)`, // サムネ幅
            gridTemplateRows: '90px',
            flexWrap: 'nowrap', // 横並び
            overflowX: 'auto',  // スクロールバー
            transform: 'translateZ(0)', // スムーズスクロール
            p: 0.5,
          }}
        >
          {avatarSets.map((set) => {
            const selected = set.dir === avatarDir;
            return (
              <ImageListItem
                key={set.dir}
                onClick={() => setAvatarDir(set.dir)}
                sx={{
                  width: 120,
                  height: 90,
                  borderRadius: 1,
                  cursor: 'pointer',
                  border: selected ? '2px solid #1976d2' : '1px solid #ccc',
                  boxShadow: selected ? '0 0 0 2px rgba(25,118,210,0.2)' : 'none',
                  overflow: 'hidden',
                  position: 'relative',
                  backgroundColor: '#fff',
                }}
              >
                {/* peace.svg を大きめ表示（幅120px） */}
                <img
                  src={set.peaceURL}
                  alt={`${set.dir}/peace.svg`}
                  loading="lazy"
                  style={{
                    width: 120,
                    height: 90, // 4:3 → 90px
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />

                {/* 選択ラベル（右上） */}
                {selected && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      px: 0.75,
                      py: 0.25,
                      fontSize: 11,
                      borderRadius: 1,
                      bgcolor: 'primary.main',
                      color: '#fff',
                    }}
                  >
                    選択中
                  </Box>
                )}

                {/* ディレクトリ名（下部） */}
                <ImageListItemBar
                  title={set.dir}
                  position="below"
                  sx={{
                    textAlign: 'center',
                    fontSize: 12,
                    lineHeight: 1.2,
                    mt: 0.5,
                  }}
                />
              </ImageListItem>
            );
          })}
        </ImageList>
      </Box>


      {inlineErr && <Typography color="error" sx={{ mt: 1 }}>{inlineErr}</Typography>}

      {/* 主要CTA（下部固定に近づけるため余白調整） */}
      <Box sx={{ mt: 3 }}>
        <Button variant="contained" fullWidth disabled={saving} onClick={handleSave}>
          保存
        </Button>
      </Box>

      <Snackbar open={!!lastMessage} autoHideDuration={4000} onClose={() => notify(null)}>
        <Alert severity="info" onClose={() => notify(null)} sx={{ width: '100%' }}>
          {lastMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

