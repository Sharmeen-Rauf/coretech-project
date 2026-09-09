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
};
