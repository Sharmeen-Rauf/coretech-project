import { theme } from "./theme";

// One shared native-header look, reused by both the root Stack (app/screens/*)
// and the Tabs navigator ((tabs)/_layout.tsx) - a single definition instead of
// two copies that could drift. React Navigation's native header already
// accounts for the status bar/safe-area inset on its own, so giving it a real
// background color (rather than leaving every screen headerless) is also
// what fixes the raw white gap screens showed above their content.
export const screenHeaderOptions = {
  headerShown: true,
  headerStyle: { backgroundColor: theme.colors.card },
  headerTitleStyle: { color: theme.colors.textPrimary, fontSize: 16, fontWeight: "bold" as const },
  headerTintColor: theme.colors.primary,
  headerShadowVisible: false,
  // expo-status-bar's <StatusBar> (app/_layout.tsx) defaults to
  // translucent: true when the prop isn't set - the status bar area is
  // genuinely translucent (content draws underneath it) app-wide. The
  // Tabs navigator's own JS-rendered header already accounts for that via
  // react-native-safe-area-context's real measured inset, which is why
  // tab screens (Home/Target/Account) look correct. react-native-screens'
  // native header (used by the root Stack for every app/screens/* page)
  // defaults its own statusBarTranslucent to false - i.e. it assumes the
  // OS already reserved the status bar's space and doesn't add its own
  // top padding - so on every pushed screen the header rendered flush
  // against the actual (translucent) status bar, reading as "overlapping
  // the clock." Declaring the real value here tells the native header the
  // truth, so it adds the same top padding the Tabs header already does.
  statusBarTranslucent: true,
};
