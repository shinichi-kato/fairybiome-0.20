
import * as React from 'react';
import { Box, Typography, Button, Card, CardContent, Stack } from '@mui/material';
import { Link } from 'gatsby';
import { AuthSwitch } from '../auth/AuthProvider'; 
import { useAuth } from '../auth/AuthProvider';

const HomeContent = () => {
  const { profile, signOut } = useAuth();

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', p: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        ようこそ、{profile?.displayName || 'ゲスト'} さん
      </Typography>

      <Card sx={{ mb: 2, border: '1px solid #eee' }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center">
            {/* アバター */}
            {profile?.avatar && (
              <Box
                sx={{
                  width: 64, height: 64, borderRadius: '50%',
                  backgroundColor: profile?.backgroundColor || '#ccc',
                  display: 'grid', placeItems: 'center', overflow: 'hidden',
                }}
                aria-label="アバター"
              >
                <img
                  src={`/avatar/user/${profile.avatar.dir}/${profile.avatar.file}`}
                  alt="avatar"
                  style={{ width: 40, height: 40 }}
                />
              </Box>
            )}

            <Box>
              <Typography variant="subtitle1">表示名</Typography>
              <Typography variant="body1">{profile?.displayName || '未設定'}</Typography>
              <Typography variant="subtitle2" sx={{ mt: 1 }}>背景色</Typography>
              <Box
                sx={{ width: 24, height: 24, borderRadius: '4px', backgroundColor: profile?.backgroundColor || '#ccc' }}
                aria-label="背景色"
              />
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <Button component={Link} to="/chat" variant="contained">
          チャットルームへ
        </Button>
        <Button component={Link} to="/profile" variant="outlined">
          プロフィールを編集
        </Button>
        <Button variant="text" onClick={async () => { await signOut(); }}>
          サインアウト
        </Button>
      </Stack>
    </Box>
  );
};

const IndexPage = () => {
  return (
    <AuthSwitch>
      <HomeContent />
    </AuthSwitch>
  );
};

export default IndexPage;
