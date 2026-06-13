import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Adaptive AI Tutor',
  description: 'An intelligent tutoring system that adapts to how you learn',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg text-slate-100 antialiased min-h-screen">{children}</body>
    </html>
  );
}
