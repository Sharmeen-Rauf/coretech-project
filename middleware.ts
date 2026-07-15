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
    return payload.user_role || payload.role || payload.app_metadata?.role || '';
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

  const pathname = request.nextUrl.pathname;
  const isDashboardRoute = pathname.startsWith('/dashboard');
  const isLoginRoute = pathname === '/login';
  const isInstallerRoute = pathname === '/installer';

  // Redirect /dashboard/installer/register to public /installer/register
  if (pathname === '/dashboard/installer/register') {
    return NextResponse.redirect(new URL('/installer/register', request.url));
  }

  // Fast check: If no auth cookies are present, session is guaranteed to be null.
  // This bypasses calling Supabase Auth API entirely for guest/login pages.
  const cookies = request.cookies.getAll();
  const hasAuthCookie = cookies.some(c => c.name.includes('-auth-token'));

  let session = null;

  if (hasAuthCookie) {
    const supabase = createMiddlewareSupabaseClient(request, response);
    try {
      // Fetch session with a strict 2-second timeout to prevent middleware hanging
      const { data } = await Promise.race([
        supabase.auth.getSession(),
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Session Retrieve Timeout')), 2000))
      ]);
      session = data?.session || null;
    } catch (e) {
      console.warn("Middleware getSession timed out or failed:", e);
    }
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

  const validRoles = [
    'admin', 
    'employee', 
    'distributor', 
    'sub_dealer', 
    'installer', 
    'country_head', 
    'rsm', 
    'retail_manager', 
    'marketing_manager'
  ];

  // If the hook is fresh, key is missing, or returned default/invalid role, fallback to db query with a strict 2s limit
  if (!role || !validRoles.includes(role)) {
    try {
      const supabase = createMiddlewareSupabaseClient(request, response);
      const { data: profile } = await Promise.race([
        supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single(),
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Database Query Timeout')), 2000))
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
