import type { Metadata } from 'next';
import './globals.css';
import 'katex/dist/katex.min.css';

export const metadata: Metadata = {
  title: 'Cirlearn',
  description: 'K12 AI Tutor — image-based intent recognition with generative card UI',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" className="h-full">
      <body className="h-full" suppressHydrationWarning>{children}</body>
    </html>
  );
}
