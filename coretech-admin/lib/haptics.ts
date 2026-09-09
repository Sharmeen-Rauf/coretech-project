import * as Haptics from "expo-haptics";

// Thin wrapper so screens never call expo-haptics directly and never need
// their own try/catch - haptics can throw on unsupported hardware/web, and
// a failed vibration should never break a real action (submit, scan, sign
// out) around it.
export const haptics = {
  light: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  success: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  error: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  },
};
