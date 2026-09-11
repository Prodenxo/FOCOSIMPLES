import { Inter } from 'next/font/google';
import Script from 'next/script';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata = {
  title: 'Foco Simples',
  description: 'Gestão financeira simples para o seu negócio.',
};

const themeInitScript = `(function(){try{var k='@financas_pessoais:theme';var t=localStorage.getItem(k)||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <Script src="/env-config.js" strategy="beforeInteractive" />
      <body className={`${inter.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
