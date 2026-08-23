import { NextResponse, type NextRequest } from 'next/server';
import { createMiddlewareSupabaseClient } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { PERMISSION_CATALOG } from '@/lib/permissionCatalog';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Short-lived cache for the granted-routes-per-role lookup below. Safe to
// share across every caller on the same role, because role_permissions
// grants are per-ROLE, not per-user - the exact same allowed-routes list is
// correct for every user of that role at once. Lives only as long as this
// edge isolate stays warm (best-effort, not guaranteed across cold starts),
// and a miss just falls through to the same DB query as before, so there's
// no correctness risk from missing the cache - only a lost speedup.
const ROUTE_CACHE_TTL_MS = 45_000;
const routeCacheByRole = new Map<string, { routes: string[]; expiresAt: number }>();

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
      const redirectResponse = NextResponse.redirect(new URL('/login', request.url));
      redirectResponse.cookies.set('user_role', '', { path: '/', maxAge: 0 });
      redirectResponse.cookies.set('user_status', '', { path: '/', maxAge: 0 });
      return redirectResponse;
    }
    return response;
  }

  // 2. Authenticated users (Local JWT Claim Decoding - 1ms)
  let { userId, role, status, amr } = getSessionDetailsFromToken(accessToken);

  // Check cookie role/status first to avoid slow DB checks and prevent redirect loops
  const cookieRole = request.cookies.get('user_role')?.value;
  const cookieStatus = request.cookies.get('user_status')?.value;
  if (cookieRole) {
    role = cookieRole;
  }
  if (cookieStatus) {
    status = cookieStatus;
  }

  // DB Fallback lookup if role or status is missing (e.g. cookies cleared or token doesn't have claims)
  if ((!role || !status) && userId) {
    try {
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role, status')
        .eq('id', userId)
        .single();
      
      if (profile) {
        role = profile.role || role || '';
        status = profile.status || status || '';
      }
    } catch (dbErr) {
      console.warn("Middleware DB fallback lookup failed:", dbErr);
    }
  }

  // Default fallback role/status if still missing
  if (!role) {
    if (isInstallerRoute) {
      role = 'installer';
    } else {
      role = 'admin';
    }
  }
  if (!status) {
    status = 'active';
  }

  // Helper function to redirect with cookies synchronized
  const redirectWithCookies = (urlStr: string) => {
    const r = NextResponse.redirect(new URL(urlStr, request.url));
    r.cookies.set('user_role', role, { path: '/', maxAge: 2592000, sameSite: 'lax' });
    r.cookies.set('user_status', status, { path: '/', maxAge: 2592000, sameSite: 'lax' });
    return r;
  };

  // Installer role protection
  if (role === 'installer') {
    if (isDashboardRoute || isLoginRoute) {
      return redirectWithCookies('/installer');
    }
    // Set cookies on installer page response
    response.cookies.set('user_role', 'installer', { path: '/', maxAge: 2592000, sameSite: 'lax' });
    response.cookies.set('user_status', status, { path: '/', maxAge: 2592000, sameSite: 'lax' });
    return response;
  }

  // Non-installer trying to access /installer route
  if (isInstallerRoute) {
    return redirectWithCookies('/dashboard');
  }

  // Helper check for MFA status (Always true to disable MFA restriction)
  const hasMfa = true;

  // Redirect logged-in users away from /login
  if (isLoginRoute) {
    return redirectWithCookies('/dashboard');
  }

  // Strict validation for specific roles inside /dashboard
  if (isDashboardRoute) {
    // A. Ensure active status for core dashboard roles
    if (status !== 'active') {
      const redirectResponse = NextResponse.redirect(new URL('/unauthorized', request.url));
      redirectResponse.cookies.set('mfa_verified', '', { path: '/', maxAge: 0 });
      redirectResponse.cookies.set('user_role', '', { path: '/', maxAge: 0 });
      redirectResponse.cookies.set('user_status', '', { path: '/', maxAge: 0 });
      return redirectResponse;
    }

    // B. High-Privilege MFA Enforcement (Disabled)
    // if (role === 'admin' || role === 'country_head') { ... }

    // C. Sub-route validation, data-driven from Role Management (roles/role_permissions).
    // Admin is structurally unrestricted - never depends on table data being correct.
    // Home and Account are universal for every active role, never gated by permissions.
    // Permission changes now apply within ROUTE_CACHE_TTL_MS (45s) rather than
    // the very next request - a deliberate trade against real, measured CPU
    // pressure from this query firing on literally every navigation, for
    // every non-admin role. A short staleness window was judged worth it
    // over that cost.
    const isExactDashboard = pathname === '/dashboard';
    const isAccountRoute = pathname.startsWith('/dashboard/account');

    if (role !== 'admin' && !isExactDashboard && !isAccountRoute) {
      try {
        let allowedRoutes: string[] | null = null;
        const cached = routeCacheByRole.get(role);
        if (cached && cached.expiresAt > Date.now()) {
          allowedRoutes = cached.routes;
        }

        if (!allowedRoutes) {
          const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          });

          // Single round trip instead of two sequential ones (role lookup, then
          // permissions lookup) - resolved via one embedded-filter query
          // instead of two awaits.
          const { data: perms } = await supabaseAdmin
            .from('role_permissions')
            .select('permission_key, roles!inner(name)')
            .eq('roles.name', role)
            .eq('granted', true);

          const grantedKeys = new Set((perms || []).map((p) => p.permission_key));
          allowedRoutes = PERMISSION_CATALOG.flatMap((g) => g.items)
            .filter((item) => grantedKeys.has(item.key))
            .map((item) => item.route);

          routeCacheByRole.set(role, { routes: allowedRoutes, expiresAt: Date.now() + ROUTE_CACHE_TTL_MS });
        }

        const isAllowed = allowedRoutes.some((route) => pathname.startsWith(route));
        if (!isAllowed) {
          return redirectWithCookies('/dashboard');
        }
      } catch (permErr) {
        console.warn('Middleware permission lookup failed, denying by default:', permErr);
        return redirectWithCookies('/dashboard');
      }
    }
  }

  // Set cookies on response for valid non-installer pages
  response.cookies.set('user_role', role, { path: '/', maxAge: 2592000, sameSite: 'lax' });
  response.cookies.set('user_status', status, { path: '/', maxAge: 2592000, sameSite: 'lax' });
  return response;
}

export const config = {
  matcher: ['/dashboard', '/dashboard/:path*', '/login', '/installer'],
};
