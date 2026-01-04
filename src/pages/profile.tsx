
// src/pages/profile.tsx
import * as React from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { Link, navigate } from 'gatsby';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import { AuthSwitch } from '../auth/AuthProvider';
import { ProfileEditor } from '../components/profile/Profile';

const PageHeader: React.FC = () => {
  const canGoBack =
    typeof window !== 'undefined' && window.history && window.history.length > 1;

  return (
    <Box
      sx={{
        maxWidth: 640,
        mx: 'auto',
        p: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      {/* ＜戻る */}
      {canGoBack ? (
        <IconButton onClick={() => navigate(-1)}>
          <NavigateBeforeIcon/>
        </IconButton>
      ) : (
        <IconButton component={Link} to="/">
          <NavigateBeforeIcon/>
        </IconButton>
      )}

    </Box>
  );
};

const ProfilePage: React.FC = () => {
  return (
    <>
      <PageHeader />
      <AuthSwitch>
        <ProfileEditor />
      </AuthSwitch>
    </>
  );
};

export default ProfilePage;

