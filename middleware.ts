import { NextResponse, type NextRequest } from 'next/server';
import { createMiddlewareSupabaseClient } from '@/lib/supabase';

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
  // Query role from profiles table
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  const role = profile?.role || '';

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
