import { createClient as createJSClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { type NextRequest, type NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

// Single shared instance of standard browser client
export const supabase = createJSClient(supabaseUrl, supabaseAnonKey);

export function createClientComponentClient() {
  return createJSClient(supabaseUrl, supabaseAnonKey);
}

// For Server Components / Actions / Route Handlers
export function createServerComponentClient() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { cookies } = require('next/headers');
  const cookieStore = cookies();
  
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
  });
}

// For Edge Middleware
export function createMiddlewareSupabaseClient(request: NextRequest, response: NextResponse) {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set({ name, value, ...options });
          response.cookies.set({ name, value, ...options });
        });
      },
    },
  });
}
