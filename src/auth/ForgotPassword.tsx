
import React, { useState } from 'react';
import { Box, TextField, Button, Typography } from '@mui/material';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase/app';

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const handleReset = async () => {
    setMsg(null); setErr(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setMsg('パスワードリセット用のメールを送信しました。受信箱をご確認ください。');
    } catch (e: any) {
      const code = e?.code as string | undefined;
      const message =
        code === 'auth/invalid-email' ? 'メールアドレスの形式が不正です' :
        code === 'auth/user-not-found' ? '該当するユーザが見つかりません' :
        '送信に失敗しました';
      setErr(message);
    }
  };

  return (
    <Box sx={{ maxWidth: 420, mx: 'auto', p: 2 }}>
      <TextField
        label="メールアドレス"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        fullWidth
        margin="normal"
      />
      {msg && <Typography color="primary">{msg}</Typography>}
      {err && <Typography color="error">{err}</Typography>}
      <Box sx={{ mt: 2 }}>
        <Button fullWidth variant="contained" onClick={handleReset}>
          リセットリンクを送信
        </Button>
      </Box>
    </Box>
  );
};
