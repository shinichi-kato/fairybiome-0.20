import type { Metadata } from 'next';
import Providers from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: '妖精バイオーム',
  description: 'A chatbot ecosystem powered by Firebase and Next.js',
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#a2466c" />
        <link rel="icon" href="/images/icon.svg" type="image/svg+xml" />
      </head>
      <body className="bg-secondary text-gray-900">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
