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
  // Traced statusBarTranslucent into react-native-screens' actual Android
  // source (ScreenWindowTraits.kt) before touching this again - its own
  // code comment says setting it true makes the screen "consume all the
  // top insets so no padding will be added under the status bar." That's
  // backwards from what was needed here: it suppresses the header's own
  // default top-inset padding (isTopInsetEnabled defaults to true in
  // ScreenStackHeaderConfig.kt) instead of adding any. A prior attempt set
  // this to true, which never actually fixed the original spacing
  // complaint - removed entirely now, back to native-stack's own default
  // inset handling.
  //
  // statusBarStyle is unrelated to translucency - it only controls the
  // status bar content's contrast color, and correctly fixed a real
  // regression (the prior attempt above left it on "auto," which
  // misjudged contrast on a real device and rendered the clock/icons
  // invisible). Keeping this one, pinned to match the dark icon style used
  // everywhere else in the app (app/_layout.tsx's own <StatusBar
  // style="dark" />).
  statusBarStyle: "dark" as const,
};
