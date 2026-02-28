import './globals.css';
import type { Metadata } from 'next';
import { getWebEnv } from '../lib/env';

export const metadata: Metadata = {
  title: 'Monocore',
  description: 'Monocore SaaS foundation'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  getWebEnv();
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
