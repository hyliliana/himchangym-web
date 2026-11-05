import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
const COOKIE = 'gym_session';
const allowed = new Map([
  ['auth/signup', ['POST']], ['auth/login', ['POST']], ['auth/me', ['GET']],
  ['auth/logout', ['POST']], ['auth/change-password', ['POST']], ['catalog', ['GET']],
  ['member/notification-preferences', ['GET','PATCH']],
  ['member/dashboard', ['GET']], ['member/profile', ['PATCH']], ['member/reservations', ['POST']],
]);

async function proxy(request: NextRequest, context: {params: Promise<{path: string[]}>}) {
  const { path } = await context.params;
  const route = path.join('/');
  const methods = allowed.get(route) ?? (/^member\/reservations\/\d+\/(cancel|reschedule)$/.test(route) ? ['POST'] : /^member\/passes\/\d+\/receipts$/.test(route) ? ['GET'] : []);
  if (!methods.includes(request.method)) return NextResponse.json({message: '이 요청은 회원 서비스에서 사용할 수 없어요.'}, {status: 404});
  if (request.method !== 'GET') {
    const origin = request.headers.get('origin');
    if (origin) {
      let originHost = '';
      try { originHost = new URL(origin).host; } catch { /* Invalid origins are rejected below. */ }
      if (originHost !== request.headers.get('host')) return NextResponse.json({message: '올바른 페이지에서 다시 시도해 주세요.'}, {status: 403});
    }
  }
  const base = process.env.BACKEND_URL;
  if (!base) return NextResponse.json({message: '서비스 연결을 준비 중이에요. 잠시 후 다시 시도해 주세요.'}, {status: 503});
  const token = request.cookies.get(COOKIE)?.value;
  const headers: Record<string, string> = {'Content-Type': 'application/json'};
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    let body: string | undefined;
    if (request.method !== 'GET') {
      const incoming = await request.json().catch(() => ({}));
      if (route === 'auth/login') incoming.kind = 'member';
      body = JSON.stringify(incoming);
    }
    const upstream = await fetch(`${base.replace(/\/$/, '')}/${route}`, {method: request.method, headers, body, cache: 'no-store', signal: AbortSignal.timeout(15000)});
    const data = await upstream.json().catch(() => ({}));
    const authResponse = route === 'auth/login' || route === 'auth/signup';
    if (upstream.ok && (authResponse || route === 'auth/me') && data.user?.kind !== 'member') {
      return NextResponse.json({message: '회원 계정으로 로그인해 주세요.'}, {status: 403});
    }
    const response = NextResponse.json(upstream.ok ? (authResponse ? {user: data.user} : data) : {message: typeof data.message === 'string' ? data.message : '요청을 처리하지 못했어요. 다시 시도해 주세요.'}, {status: upstream.status});
    response.headers.set('Cache-Control', 'no-store');
    if (upstream.ok && authResponse && typeof data.token === 'string') response.cookies.set(COOKIE, data.token, {httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7});
    if ((route === 'auth/logout' && upstream.ok) || (upstream.status === 401 && !['auth/login','auth/change-password'].includes(route))) response.cookies.set(COOKIE, '', {httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0});
    return response;
  } catch {
    return NextResponse.json({message: '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.'}, {status: 502});
  }
}
export { proxy as GET, proxy as POST, proxy as PATCH };
