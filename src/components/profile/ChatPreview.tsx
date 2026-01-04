
// src/components/profile/ChatPreview.tsx
import React from 'react';
import { Box } from '@mui/material';

type ChatPreviewProps = {
  message: string;
  faceURL?: string;        // 任意（今回選択は peace のみだがプレビューで顔があるなら表示）
  bodyURL: string;         // peace.svg（4:3）
  backgroundColor: string; // 吹き出し & アバター背景
};

export const ChatPreview: React.FC<ChatPreviewProps> = ({
  message,
  faceURL,
  bodyURL,
  backgroundColor,
}) => {
  const faceSize = 48;           // 顔（円形）直径
  const bodyWidth = 192;         // peace.svg 幅（指定）
  const bodyHeight = Math.round((4 / 3) * bodyWidth); // 256px
  const radius = 16;             // 角丸サイズ
  const tailSize = 12;           // テイルサイズ
  const bgSquareSize = bodyHeight;

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, p: 2 }}>
      {/* 吹き出し：右下のみradius 0、他は16px */}
      <Box sx={{ maxWidth: '70%' }}>
        <Box
          sx={{
            backgroundColor,
            color: '#fff',
            px: 2,
            py: 1.25,
            borderTopLeftRadius: `${radius}px`,
            borderTopRightRadius: `${radius}px`,
            borderBottomLeftRadius: `${radius}px`,
            borderBottomRightRadius: 0,         // ★右下だけ 0
            position: 'relative',
          }}
        >
          {message}

          {/* ★右下テイル（右下方向へ突き出す） */}
          <Box

            sx={{
              position: 'absolute',
              right: -tailSize,   // 吹き出しの外に少しはみ出す
              bottom: 0,          // 右下角に揃える
              width: 0,
              height: 0,
              borderStyle: 'solid',
              // 左下を塗りつぶす：bottom + left を背景色、top + right を透明
              borderTop: `${tailSize}px solid transparent`,
              borderRight: `${tailSize}px solid transparent`,
              borderBottom: `${tailSize}px solid ${backgroundColor}`,
              borderLeft: `${tailSize}px solid ${backgroundColor}`,
            }}

          />
        </Box>
      </Box>

      {/* 顔（任意表示） */}
      {faceURL && (
        <Box
          sx={{
            width: faceSize,
            height: faceSize,
            borderRadius: '50%',
            overflow: 'hidden',
            boxShadow: '0 0 0 2px #fff',
            backgroundColor,
            display: 'grid',
            placeItems: 'center',
          }}
          aria-label="顔アバター"
        >
          <img src={faceURL} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </Box>
      )}

      {/* 右下：peace.svg＋1/4扇形背景 */}
      <Box sx={{ position: 'relative', width: bodyWidth, height: bodyHeight }} aria-label="上半身アバター">
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            width: bgSquareSize,
            height: bgSquareSize,
            backgroundColor,
            borderTopLeftRadius: `${bgSquareSize}px`, // 左上が半円 → 右下1/4が見える
          }}
        />
        <img
          src={bodyURL}
          alt="peace"
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: bodyWidth,
            height: bodyHeight,
            objectFit: 'cover',
          }}
        />
      </Box>
    </Box>
  );
};

