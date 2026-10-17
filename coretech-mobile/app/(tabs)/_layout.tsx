import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Wrench, User, LayoutDashboard, Plus, Bell } from "lucide-react-native";
import { supabase } from "../../lib/supabase";

// Floating action button, rendered once here (outside the Tabs navigator, as
// an absolutely-positioned sibling) rather than per-screen, so it overlays
// whichever of the 3 real tabs is active instead of living inside one
// screen's own layout. Previously this was a fake 4th Tabs.Screen raised
// above the bar with a negative margin - visually cramped, and only ever
// showed on top of the bar itself, not as a true floating button.
//
// `bottom: 80` was tuned assuming the tab bar below it stops at a fixed
// height - on edge-to-edge Android (15+) the bar itself now grows by the
// system gesture-nav inset (see tabBarStyle below), so this needs to grow
// by the same amount to keep the same visual gap above it, confirmed live
// on a real Android 16 device.
function NewInstallationFab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <TouchableOpacity
      onPress={() => router.push("/job/new")}
      style={[styles.fab, { bottom: 80 + insets.bottom }]}
      activeOpacity={0.85}
    >
      <Plus size={26} color="#FFFFFF" />
    </TouchableOpacity>
  );
}

// Small brand mark shown on every tab's header, next to the title - matches
// the circular "CT" badge already used on the login screen, so the brand
// reads consistently whether you're signed out or inside the app.
function HeaderLogo() {
  return (
    <View style={styles.headerLogo}>
      <Text style={styles.headerLogoText}>CT</Text>
    </View>
  );
}

// Fetched once per app session (not re-fetched per tab switch) - good
// enough for "do I have something new" without needing a realtime
// subscription, matching how the rest of this app treats notifications/
// jobs as plain fetch-on-open data, not live-updating.
function NotificationBell() {
  const router = useRouter();
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) return;

        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        const role = profile?.role || "installer";

        const { data: notifs } = await supabase
          .from("notifications")
          .select("id")
          .overlaps("target_role", ["all", role])
          .order("created_at", { ascending: false })
          .limit(20);
        const ids = (notifs || []).map((n: any) => n.id);
        if (ids.length === 0) return;

        const { data: reads } = await supabase
          .from("notification_reads")
          .select("notification_id")
          .eq("user_id", user.id)
          .in("notification_id", ids);
        const readIds = new Set((reads || []).map((r: any) => r.notification_id));
        setHasUnread(ids.some((id: string) => !readIds.has(id)));
      } catch (err) {
        console.warn("Failed to check unread notifications", err);
      }
    })();
  }, []);

  return (
    <TouchableOpacity onPress={() => router.push("/notifications")} style={styles.bellButton}>
      <Bell size={22} color="#1E293B" />
      {hasUnread ? <View style={styles.bellDot} /> : null}
    </TouchableOpacity>
  );
}

export default function TabsLayout() {
  // This fixed-height tabBarStyle override replaces Expo Router's own
  // default tab bar, which otherwise accounts for the bottom safe-area
  // inset automatically (confirmed by comparison: the admin app's Tabs,
  // which has no such override, renders correctly on the same Android 16
  // device).
  //
  // A manual `height: 60 + insets.bottom` was tried first and failed live:
  // debug output confirmed insets.bottom really was 48 (SafeAreaProvider
  // working correctly), yet the bar still rendered with the old broken
  // layout - screenOptions.tabBarStyle doesn't reliably re-apply when
  // insets arrive asynchronously after the first render. Dropping
  // height/padding from the override entirely instead, so React
  // Navigation's own default tab bar sizing (which already handles this
  // internally and correctly, same as admin's) takes over - no manual
  // insets math left to go stale.
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: "#00B4D8",
          tabBarInactiveTintColor: "#64748B",
          tabBarStyle: {
            backgroundColor: "#FFFFFF",
            borderTopWidth: 1,
            borderTopColor: "#E2E8F0",
            paddingTop: 8,
            paddingBottom: 24,
          },
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: "bold",
          },
          headerStyle: {
            backgroundColor: "#FFFFFF",
            borderBottomWidth: 1,
            borderBottomColor: "#E2E8F0",
          },
          headerTitleStyle: {
            fontSize: 16,
            fontWeight: "bold",
            color: "#1E293B",
          },
          headerLeft: () => <HeaderLogo />,
          headerRight: () => <NotificationBell />,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "CoreTECH Installer",
            tabBarLabel: "Dashboard",
            tabBarIcon: ({ color }) => <LayoutDashboard size={20} color={color} />,
          }}
        />
        <Tabs.Screen
          name="jobs"
          options={{
            title: "My Jobs",
            tabBarLabel: "Jobs",
            tabBarIcon: ({ color }) => <Wrench size={20} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "My Profile",
            tabBarLabel: "Profile",
            tabBarIcon: ({ color }) => <User size={20} color={color} />,
          }}
        />
      </Tabs>
      <NewInstallationFab />
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 20,
    bottom: 80,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#00B4D8",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  headerLogo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#00B4D8",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 16,
  },
  headerLogoText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 11,
  },
  bellButton: {
    marginRight: 16,
    padding: 4,
  },
  bellDot: {
    position: "absolute",
    top: 2,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#DC2626",
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
});
