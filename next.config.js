import fs from 'fs';
import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Firebase Hosting で SSR をサポート
  experimental: {
    // 設定はここに必要に応じて追加
  },

  // 環境変数
  env: {
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    STATIC_FILES: getStaticFilesJson(),
    NEXT_PUBLIC_STATIC_FILES: getStaticFilesJson(),
  },

  // Turbopack 互換設定
  turbopack: {},

  // webpack 設定
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization.runtimeChunk = 'single';
    }
    return config;
  },
};

function collectStaticFiles(dir, files = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectStaticFiles(entryPath, files);
      continue;
    }

    if (entry.isFile()) {
      files.push(normalizePath(path.relative(process.cwd(), entryPath)));
    }
  }

  return files;
}

function normalizePath(filePath) {
  return filePath.split(path.sep).join('/');
}

function getStaticFilesJson() {
  const files = [];
  const botsDir = path.join(process.cwd(), 'static', 'bots');
  collectStaticFiles(botsDir, files);

  const WordTagPath = path.join(process.cwd(), 'static', 'tags', 'global.json');
  if (fs.existsSync(WordTagPath)) {
    files.push(normalizePath(path.relative(process.cwd(), WordTagPath)));
  }

  return JSON.stringify(files);
}

export default nextConfig;
