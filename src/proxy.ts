import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * First wall for /admin: refreshes the Supabase session cookie and sends
 * signed-out visitors to the login page. (Next.js 16 renamed middleware.ts
 * to proxy.ts; it runs on the Node.js runtime.) Pages and actions still
 * call requireAdmin(), and the database checks is_admin() again.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        },
      },
    },
  );

  // Do not put code between createServerClient and getClaims(): the call
  // refreshes an expired access token and writes the new cookies. The
  // project signs tokens with an asymmetric key, so the signature is checked
  // here without a round trip to Supabase Auth.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims.sub ? data.claims : null;

  const path = request.nextUrl.pathname;
  const isLogin = path === '/admin/login' || path.startsWith('/admin/login/');

  if (!user && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Admin pages are personal and must never be cached by a CDN.
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

export const config = {
  matcher: ['/admin/:path*'],
};
