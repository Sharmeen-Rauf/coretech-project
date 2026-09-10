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
  // The real lever for the header-squeezed-against-the-status-bar bug -
  // confirmed by reading react-native-screens' own type definitions, not
  // guessed. Two earlier attempts (statusBarTranslucent, statusBarStyle)
  // targeted the wrong prop entirely - those control the *status bar's*
  // own translucency/content color, not the *header's* own inset padding.
  // headerTopInsetEnabled is the one that actually controls whether the
  // native header reserves space for the status bar; it's documented as
  // defaulting to true, but every app/screens/* page (Sell Out, ST1,
  // Sub Dealer List, Buzzcart, etc, confirmed via real device screenshots)
  // is still rendering squeezed against the status bar, so that default
  // isn't reliably applying in practice. Set explicitly instead of relying
  // on it.
  headerTopInsetEnabled: true,
  statusBarStyle: "dark" as const,
};
