import type { Metadata } from 'next';
import { Inter, Outfit } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const outfit = Outfit({
  variable: '--font-outfit',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: '기장 교단 연금 시뮬레이터 | PROK Pension Simulator',
  description: '한국기독교장로회(PROK) 목회자 연금 납입 내역 조회 및 은퇴 시점 예상 연금액 시뮬레이션 시스템',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${inter.variable} ${outfit.variable}`}>
      <body>
        <div className="bg-glow-1"></div>
        <div className="bg-glow-2"></div>
        
        {/* Navigation Bar */}
        <nav className="glass-panel" style={{
          position: 'sticky',
          top: '1rem',
          margin: '1rem auto 0 auto',
          maxWidth: '1440px',
          width: 'calc(100% - 3rem)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.75rem 2rem',
          zIndex: 100,
          borderRadius: 'var(--radius-sm)'
        }}>
          <Link href="/" style={{ fontWeight: '800', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            <span style={{ color: 'var(--primary)' }}>⛪</span> 기장교단 연금재단
          </Link>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <Link href="/" style={{ fontSize: '0.9rem', fontWeight: '600' }}>
              목회자 검색 대시보드
            </Link>
            <Link href="/committee" style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--warning)' }}>
              ⚠️ 노령화 대책위 시뮬레이터
            </Link>
          </div>
        </nav>

        <main className="app-container animate-fade-in" style={{ paddingTop: '1.5rem' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
