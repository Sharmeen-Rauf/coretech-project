import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Wrench, History, User, LayoutDashboard, Plus } from "lucide-react-native";

function NewInstallationButton() {
  const router = useRouter();
  return (
    <View style={styles.fabWrapper} pointerEvents="box-none">
      <TouchableOpacity
        onPress={() => router.push("/job/new")}
        style={styles.fab}
        activeOpacity={0.85}
      >
        <Plus size={26} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

export default function TabsLayout() {
  const router = useRouter();
  return (
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
        name="new-installation"
        options={{
          tabBarLabel: () => null,
          tabBarButton: () => <NewInstallationButton />,
        }}
        listeners={{
          tabPress: (e) => {
            // This "tab" is an action (open the new-installation form), not a
            // real destination - never let it actually switch to a blank tab.
            e.preventDefault();
            router.push("/job/new");
          },
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "Job History",
          tabBarLabel: "History",
          tabBarIcon: ({ color }) => <History size={20} color={color} />,
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
  );
}

const styles = StyleSheet.create({
  fabWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#00B4D8",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -22,
    shadowColor: "#00B4D8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
});
