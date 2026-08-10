import { NextResponse, type NextRequest } from 'next/server';
import { createMiddlewareSupabaseClient } from '@/lib/supabase';

// Helper to decode JWT claims locally on the edge to avoid database querying timeouts
interface SessionDetails {
  userId: string;
  role: string;
  status: string;
  amr: any[];
}

function getSessionDetailsFromToken(accessToken: string): SessionDetails {
  try {
    const parts = accessToken.split('.');
    if (parts.length !== 3) return { userId: '', role: '', status: '', amr: [] };
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    return {
      userId: payload.sub || '',
      role: payload.user_role || payload.role || payload.app_metadata?.role || '',
      status: payload.user_status || '',
      amr: payload.amr || []
    };
  } catch (e) {
    console.error("Failed to parse details from JWT token:", e);
    return { userId: '', role: '', status: '', amr: [] };
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

  // Fast Edge path: Extract auth token directly from Supabase cookies without network roundtrips
  const cookies = request.cookies.getAll();
  const authCookie = cookies.find(c => c.name.includes('-auth-token'));
  
  let accessToken = "";
  if (authCookie?.value) {
    try {
      const parsed = JSON.parse(authCookie.value);
      accessToken = parsed.access_token || (Array.isArray(parsed) ? parsed[0] : "");
    } catch {
      accessToken = authCookie.value;
    }
  }

  // 1. Unauthenticated users (Fast check)
  if (!authCookie || !accessToken) {
    if (isDashboardRoute || isInstallerRoute) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return response;
  }

  // 2. Authenticated users (Local JWT Claim Decoding - 1ms)
  let { userId, role, status, amr } = getSessionDetailsFromToken(accessToken);

  // DB Fallback lookup if role is missing from JWT (e.g. Supabase Custom Access Token hook disabled)
  if (!role && userId) {
    try {
      const supabase = createMiddlewareSupabaseClient(request, response);
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, status')
        .eq('id', userId)
        .single();
      
      if (profile) {
        role = profile.role || '';
        status = profile.status || '';
      }
    } catch (dbErr) {
      console.warn("Middleware DB fallback lookup failed:", dbErr);
    }
  }

  // Default fallback role/status if still missing
  if (!role) {
    role = 'admin';
    status = 'active';
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

  // Helper check for MFA status (Always true to disable MFA restriction)
  const hasMfa = true;

  // Redirect logged-in users away from /login
  if (isLoginRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Strict validation for specific roles inside /dashboard
  if (isDashboardRoute) {
    // A. Ensure active status for core dashboard roles
    if (status !== 'active') {
      const redirectResponse = NextResponse.redirect(new URL('/unauthorized', request.url));
      redirectResponse.cookies.set('mfa_verified', '', { path: '/', maxAge: 0 });
      return redirectResponse;
    }

    // B. High-Privilege MFA Enforcement (Disabled)
    // if (role === 'admin' || role === 'country_head') { ... }

    // C. Sub-route validation based on role permissions
    if (role === 'distributor') {
      const allowedDistributorPrefixes = [
        '/dashboard/purchase/import-stock',
        '/dashboard/purchase/inventory',
        '/dashboard/sales/st1',
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
        '/dashboard/purchase/import-stock',
        '/dashboard/purchase/inventory',
        '/dashboard/purchase/sellout',
        '/dashboard/buzzcart/orders',
        '/dashboard/buzzcart/create',
        '/dashboard/sales/transfer',
        '/dashboard/sales/return',
        '/dashboard/support',
        '/dashboard/account',
      ];

      const isExactDashboard = pathname === '/dashboard';
      const isAllowed = isExactDashboard || allowedSubDealerPrefixes.some(prefix => pathname.startsWith(prefix));

      if (!isAllowed) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    } else if (role === 'marketing_manager') {
      const allowedMarketingPrefixes = [
        '/dashboard/expenses',
      ];

      const isExactDashboard = pathname === '/dashboard';
      const isAllowed = isExactDashboard || allowedMarketingPrefixes.some(prefix => pathname.startsWith(prefix));

      if (!isAllowed) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    } else if (role === 'rsm') {
      const allowedRsmPrefixes = [
        '/dashboard/buzzcart',
        '/dashboard/sales',
        '/dashboard/expenses',
        '/dashboard/invoices',
      ];

      const isExactDashboard = pathname === '/dashboard';
      const isAllowed = isExactDashboard || allowedRsmPrefixes.some(prefix => pathname.startsWith(prefix));

      if (!isAllowed) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    } else if (role === 'retail_manager') {
      const allowedRetailManagerPrefixes = [
        '/dashboard/approvals',
        '/dashboard/installer/list',
        '/dashboard/installer/jobs',
        '/dashboard/account',
      ];

      const isExactDashboard = pathname === '/dashboard';
      const isAllowed = isExactDashboard || allowedRetailManagerPrefixes.some(prefix => pathname.startsWith(prefix));

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
