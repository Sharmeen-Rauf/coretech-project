import { NextResponse, type NextRequest } from 'next/server';
import { createMiddlewareSupabaseClient } from '@/lib/supabase';

// Helper to decode JWT claims locally on the edge to avoid database querying timeouts
function getRoleFromToken(accessToken: string): string {
  try {
    const parts = accessToken.split('.');
    if (parts.length !== 3) return '';
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    return payload.role || payload.app_metadata?.role || '';
  } catch (e) {
    console.error("Failed to parse role from JWT token:", e);
    return '';
  }
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createMiddlewareSupabaseClient(request, response);

  // Get session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const pathname = request.nextUrl.pathname;
  const isDashboardRoute = pathname.startsWith('/dashboard');
  const isLoginRoute = pathname === '/login';
  const isInstallerRoute = pathname === '/installer';

  // Redirect /dashboard/installer/register to public /installer/register
  if (pathname === '/dashboard/installer/register') {
    return NextResponse.redirect(new URL('/installer/register', request.url));
  }

  // 1. Unauthenticated users
  if (!session) {
    if (isDashboardRoute || isInstallerRoute) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return response;
  }

  // 2. Authenticated users
  // Decode role locally from access token claims (fast edge path)
  let role = getRoleFromToken(session.access_token);

  // If the hook is fresh or key is missing, fallback to db query with a strict 3s limit
  if (!role) {
    try {
      const { data: profile } = await Promise.race([
        supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single(),
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Database Query Timeout')), 3000))
      ]);
      role = profile?.role || '';
    } catch (err) {
      console.warn("Middleware DB fallback query timed out or failed:", err);
      role = '';
    }
  }

  // Installer role protection
  if (role === 'installer') {
    if (isDashboardRoute || isLoginRoute) {
      return NextResponse.redirect(new URL('/installer', request.url));
    }
    return response;
  }

  // Non-installer trying to access /installer route
  if (isInstallerRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Redirect logged-in users away from /login
  if (isLoginRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Strict sub-route validation for specific roles inside /dashboard
  if (isDashboardRoute) {
    if (role === 'distributor') {
      const allowedDistributorPrefixes = [
        '/dashboard/purchase/import-stock',
        '/dashboard/purchase/inventory',
        '/dashboard/buzzcart/orders',
        '/dashboard/buzzcart/create',
        '/dashboard/users',
        '/dashboard/sales/transfer',
        '/dashboard/sales/return',
        '/dashboard/account',
      ];
      
      const isExactDashboard = pathname === '/dashboard';
      const isAllowed = isExactDashboard || allowedDistributorPrefixes.some(prefix => pathname.startsWith(prefix));

      if (!isAllowed) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    } else if (role === 'sub_dealer') {
      const allowedSubDealerPrefixes = [
        '/dashboard/buzzcart/orders',
        '/dashboard/buzzcart/create',
        '/dashboard/support',
        '/dashboard/account',
      ];

      const isExactDashboard = pathname === '/dashboard';
      const isAllowed = isExactDashboard || allowedSubDealerPrefixes.some(prefix => pathname.startsWith(prefix));

      if (!isAllowed) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: ['/dashboard', '/dashboard/:path*', '/login', '/installer'],
};
