import React, { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Bell } from "lucide-react-native";
import { mobileApiFetch } from "../lib/api";
import { theme } from "../lib/theme";

// Home-only bell (§18) - now a header button (headerRight on the Home tab)
// instead of living in Home's own body, so it sits on the same native
// header bar every other screen uses. Refetches the unread count on every
// focus (fetch-on-open, no realtime, per §18/§7).
export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      mobileApiFetch<{ success: boolean; unreadCount: number }>("/api/mobile/notifications")
        .then((res) => setUnreadCount(res.success ? res.unreadCount : 0))
        .catch(() => {});
    }, [])
  );

  return (
    <TouchableOpacity style={styles.button} onPress={() => router.push("/screens/notifications")}>
      <Bell color={theme.colors.textPrimary} size={20} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    marginRight: theme.spacing.md,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.error,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "bold",
  },
});
