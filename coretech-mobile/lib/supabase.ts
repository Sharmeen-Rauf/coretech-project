import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

// SecureStore adapter for Supabase session storage in React Native
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    return SecureStore.deleteItemAsync(key);
  },
};

// Secret variables mapped from app.config.js
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cypbnnohtipwavcwukhl.supabase.co";
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5cGJubm9odGlwd2F2Y3d1a2hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MjQ3NTMsImV4cCI6MjA5NzIwMDc1M30.WnKhD-jy1likTKYtbdJcJ2JvzSNEPKn9M5U6NbjtCYo";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
