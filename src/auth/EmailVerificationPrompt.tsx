
// src/components/auth/EmailVerificationPrompt.tsx

import React, { useState,useEffect } from 'react';
import { Box, Typography, Button, Snackbar, Alert, Stack } from '@mui/material';
import { useAuth } from './AuthProvider';

export const EmailVerificationPrompt: React.FC = () => {
    const { requiresEmailVerification, reloadUser, resendVerificationEmail, lastMessage, notify } = useAuth();
    const [inline, setInline] = useState<string | null>(null);
    const [cooldown, setCooldown] = useState<number>(0); // 秒

    if (!requiresEmailVerification) return null;


    useEffect(() => {
        let timer: any;
        if (requiresEmailVerification) {
            timer = setInterval(async () => {
                const res = await reloadUser();
                if (res.ok && !requiresEmailVerification) {
                    notify('メール確認が完了しました');
                    clearInterval(timer);
                }
            }, 5000); // 5秒間隔
        }
        return () => timer && clearInterval(timer);
    }, [requiresEmailVerification, reloadUser, notify]);


    const handleReload = async () => {
        const res = await reloadUser();
        if (!res.ok) {
            setInline(res.message ?? '再読み込みに失敗しました');
            notify(res.message ?? '再読み込みに失敗しました');
        } else {
            notify('メール確認が完了しました');
        }
    };

    const handleResend = async () => {
        if (cooldown > 0) return;
        const res = await resendVerificationEmail();
        if (!res.ok) {
            setInline(res.message ?? '確認メールの再送に失敗しました');
            notify(res.message ?? '確認メールの再送に失敗しました');
        } else {
            notify(res.message ?? '確認メールを再送しました');
            // 60秒のクールダウン例
            setCooldown(60);
            const timer = setInterval(() => {
                setCooldown(prev => {
                    if (prev <= 1) { clearInterval(timer); return 0; }
                    return prev - 1;
                });
            }, 1000);
        }
    };

    return (
        <Box sx={{ maxWidth: 420, mx: 'auto', p: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
                メール確認が必要です
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
                受信メールの確認リンクをクリックした後、下のボタンで再読み込みしてください。
            </Typography>

            <Stack spacing={1} direction="column">
                <Button variant="contained" fullWidth onClick={handleReload}>
                    再読み込み
                </Button>
                <Button
                    variant="outlined"
                    fullWidth
                    onClick={handleResend}
                    disabled={cooldown > 0}
                >
                    {cooldown > 0 ? `確認メールを再送 (${cooldown}s)` : '確認メールを再送'}
                </Button>
            </Stack>

            {inline && <Typography color="error" sx={{ mt: 1 }}>{inline}</Typography>}

            <Snackbar open={!!lastMessage} autoHideDuration={4000} onClose={() => notify(null)}>
                <Alert severity="info" onClose={() => notify(null)} sx={{ width: '100%' }}>
                    {lastMessage}
                </Alert>
            </Snackbar>
        </Box>
    );
};
