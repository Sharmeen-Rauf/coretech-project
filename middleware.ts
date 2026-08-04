import { NextResponse, type NextRequest } from 'next/server';
import { createMiddlewareSupabaseClient } from '@/lib/supabase';

// Helper to decode JWT claims locally on the edge to avoid database querying timeouts
interface SessionDetails {
  role: string;
  status: string;
  amr: any[];
}

function getSessionDetailsFromToken(accessToken: string): SessionDetails {
  try {
    const parts = accessToken.split('.');
    if (parts.length !== 3) return { role: '', status: '', amr: [] };
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
      role: payload.user_role || payload.role || payload.app_metadata?.role || '',
      status: payload.user_status || '',
      amr: payload.amr || []
    };
  } catch (e) {
    console.error("Failed to parse details from JWT token:", e);
    return { role: '', status: '', amr: [] };
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
  let { role, status, amr } = getSessionDetailsFromToken(session.access_token);

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

  // If the hook is fresh, key is missing, or returned default/invalid role/status, fallback to db query with a strict 2s limit
  if (!role || !validRoles.includes(role) || !status) {
    try {
      const supabase = createMiddlewareSupabaseClient(request, response);
      const { data: profile } = await Promise.race([
        supabase
          .from('profiles')
          .select('role, status')
          .eq('id', session.user.id)
          .single(),
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Database Query Timeout')), 2000))
      ]);
      role = profile?.role || '';
      status = profile?.status || '';
    } catch (err) {
      console.warn("Middleware DB fallback query timed out or failed:", err);
      role = '';
      status = '';
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

  // Strict validation for specific roles inside /dashboard
  if (isDashboardRoute) {
    // A. Ensure active status for core dashboard roles
    if (status !== 'active') {
      const redirectResponse = NextResponse.redirect(new URL('/unauthorized', request.url));
      redirectResponse.cookies.set('mfa_verified', '', { path: '/', maxAge: 0 });
      return redirectResponse;
    }

    // B. High-Privilege TOTP MFA Enforcement for admin and country_head
    if (role === 'admin' || role === 'country_head') {
      const hasMfa = amr.some((r: any) => r === 'mfa' || r.method === 'mfa') || 
                     request.cookies.get('mfa_verified')?.value === 'true';
      if (!hasMfa) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }

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
