import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { AppProviders } from './providers';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'ConVos',
  description: 'Planes reales con validación, gamificación y recuerdos.',
};

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('convos-theme');if(t==='light'){document.documentElement.classList.remove('dark');}else{document.documentElement.classList.add('dark');}}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full max-w-[100vw] flex-col overflow-x-hidden">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
