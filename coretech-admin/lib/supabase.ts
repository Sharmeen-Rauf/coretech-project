import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

// Android's SecureStore backend has a practical ~2048-byte ceiling per value
// (no such limit on iOS) - confirmed live during Phase 4's device test
// ("Value being stored in SecureStore is larger than 2048 bytes and it may
// not be stored successfully"). Supabase's full session object easily
// exceeds that on Android: alongside the access/refresh tokens, it embeds a
// complete `user` object (email, user_metadata, app_metadata, identities...)
// that duplicates most of what's already encoded in the access token's JWT
// payload. Nothing in this app ever reads anything off session.user besides
// `.id` - lib/access.ts's resolveAdminAccess re-fetches role/name from the
// database fresh on every check rather than trusting anything cached here -
// so it's safe to drop everything else before it's written, on every save
// (including the ones triggered by autoRefreshToken, since every write goes
// through this same adapter).
const SESSION_USER_FIELDS_TO_KEEP = ["id"];

function trimSessionForStorage(value: string): string {
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && parsed.user && typeof parsed.user === "object") {
      const trimmedUser: Record<string, unknown> = {};
      for (const field of SESSION_USER_FIELDS_TO_KEEP) {
        if (field in parsed.user) trimmedUser[field] = parsed.user[field];
      }
      parsed.user = trimmedUser;
    }
    return JSON.stringify(parsed);
  } catch {
    return value; // Not a session object (or not JSON) - leave untouched.
  }
}

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    return SecureStore.setItemAsync(key, trimSessionForStorage(value));
  },
  removeItem: (key: string) => {
    return SecureStore.deleteItemAsync(key);
  },
};

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || "https://cypbnnohtipwavcwukhl.supabase.co";
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
