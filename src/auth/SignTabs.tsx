
import React, { useState } from 'react';
import { Box, Tabs, Tab, TextField, Button, Typography, Link, Snackbar, Alert } from '@mui/material';
import { useAuth } from './AuthProvider';

const isValidPassword = (pw: string) => {
  const hasDigit = /[0-9]/.test(pw);
  const hasSymbol = /[^A-Za-z0-9]/.test(pw);
  return pw.length >= 8 && hasDigit && hasSymbol;
};

export const SignTabs: React.FC = () => {
  const { signIn, signUp, requiresEmailVerification, lastMessage, notify } = useAuth();
  const [tab, setTab] = useState(0); // 0: sign in, 1: sign up

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const emailError = email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'メール形式が不正です' : '';
  const passwordError = password && !isValidPassword(password) ? '数字と記号を含む8文字以上で入力してください' : '';

  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const canSubmit =
    email && !emailError &&
    password && !passwordError &&
    (tab === 0 || (tab === 1 && displayName));

  const handleSubmit = async () => {
    setInlineError(null);
    if (!canSubmit) return;
    setLoading(true);
    const result = tab === 0
      ? await signIn(email, password)
      : await signUp(email, password, {
        displayName,
        avatar: { dir: 'default', file: 'peace.svg' },
        backgroundColor: '#535353',
      });
    setLoading(false);
    if (!result.ok) {
      setInlineError(result.message ?? 'エラーが発生しました');
      notify(result.message ?? 'エラーが発生しました');
    } else {
      notify(tab === 0 ? 'サインインに成功しました' : (result.message ?? '登録に成功しました'));
    }
  };

  return (
    <Box sx={{ maxWidth: 420, mx: 'auto', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth">
        <Tab label="サインイン" />
        <Tab label="新規登録" />
      </Tabs>

      <Box sx={{ p: 2, flex: 1, overflow: 'auto' }}>
        <TextField
          label="メールアドレス"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={!!emailError}
          helperText={emailError || ' '}
          fullWidth
          margin="normal"
        />
        <TextField
          label="パスワード"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={!!passwordError}
          helperText={passwordError || ' '}
          fullWidth
          margin="normal"
        />

        {tab === 1 && (
          <TextField
            label="表示名"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            fullWidth
            margin="normal"
            helperText="チャットで表示される名前です"
          />
        )}

        {requiresEmailVerification && (
          <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
            メール確認が未完了です。受信メールのリンクをクリックした後、再読み込みしてください。
          </Typography>
        )}

        {inlineError && (
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            {inlineError}
          </Typography>
        )}

        <Box sx={{ mt: 2 }}>
          <Link>forgotパスワードを忘れた場合はこちら</Link>
        </Box>
      </Box>

      <Box sx={{ p: 2, borderTop: '1px solid #eee' }}>
        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={handleSubmit}
          disabled={!canSubmit || loading}
        >
          {tab === 0 ? 'サインイン' : '登録してメール確認へ'}
        </Button>
      </Box>

      <Snackbar
        open={!!lastMessage}
        autoHideDuration={4000}
        onClose={() => notify(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="info" onClose={() => notify(null)} sx={{ width: '100%' }}>
          {lastMessage}
        </Alert>
      </Snackbar>
    </Box >
  );
};
