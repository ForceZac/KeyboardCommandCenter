import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { detectOs } from '@/lib/detectOs';
import DownloadPageClient from './DownloadPageClient';

export const metadata: Metadata = {
  title: 'Download — Keyboard Command Center',
  description:
    'Download Keyboard Command Center for macOS or Windows. Instantly access 10,000+ shortcuts for every app without leaving the keyboard.',
  openGraph: {
    title: 'Download — Keyboard Command Center',
    description:
      'Download Keyboard Command Center for macOS or Windows. Instantly access 10,000+ shortcuts for every app without leaving the keyboard.',
  },
};

/**
 * /download — server component.
 * Reads the User-Agent header server-side so the correct primary download button
 * is pre-rendered on first paint (no hydration flash).
 */
export default async function DownloadPage() {
  const headersList = await headers();
  const ua = headersList.get('user-agent') ?? '';
  const serverDetectedOS = detectOs(ua);

  return <DownloadPageClient serverDetectedOS={serverDetectedOS} />;
}
