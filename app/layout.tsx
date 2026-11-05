import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: '힘찬짐 · 내 운동', description: '이용권 확인부터 PT 예약과 운동기록까지, 힘찬짐 회원 서비스' };
export default function Layout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="ko"><body>{children}</body></html>;
}
