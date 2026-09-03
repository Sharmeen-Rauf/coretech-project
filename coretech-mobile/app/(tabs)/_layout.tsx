import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Wrench, User, LayoutDashboard, Plus } from "lucide-react-native";

// Floating action button, rendered once here (outside the Tabs navigator, as
// an absolutely-positioned sibling) rather than per-screen, so it overlays
// whichever of the 3 real tabs is active instead of living inside one
// screen's own layout. Previously this was a fake 4th Tabs.Screen raised
// above the bar with a negative margin - visually cramped, and only ever
// showed on top of the bar itself, not as a true floating button.
function NewInstallationFab() {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.push("/job/new")}
      style={styles.fab}
      activeOpacity={0.85}
    >
      <Plus size={26} color="#FFFFFF" />
    </TouchableOpacity>
  );
}

export default function TabsLayout() {
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
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
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
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Dashboard",
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
});
