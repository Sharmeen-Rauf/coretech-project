import { useCallback } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useFocusEffect } from "expo-router";

// Refetches on every in-app navigation focus (the existing pattern every
// screen already used) AND every time the app itself returns to the
// foreground from being backgrounded - a real gap plain useFocusEffect
// doesn't cover, since that only fires on in-app screen transitions, never
// on the OS bringing the app back from minimized/background. The AppState
// listener is only registered while the screen is actually focused
// (added/removed inside the focus effect's own lifecycle), so a
// backgrounded tab screen that's still mounted but not the active one
// doesn't keep silently refetching.
export function useRefreshOnFocus(load: () => void) {
  useFocusEffect(
    useCallback(() => {
      load();
      const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
        if (next === "active") load();
      });
      return () => sub.remove();
    }, [load])
  );
}
