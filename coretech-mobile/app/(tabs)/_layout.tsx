import React from "react";
import { Tabs } from "expo-router";
import { Wrench, History, User, LayoutDashboard } from "lucide-react-native";

export default function TabsLayout() {
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
