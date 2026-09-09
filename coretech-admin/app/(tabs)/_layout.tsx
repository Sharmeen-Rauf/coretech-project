import React from "react";
import { View, ActivityIndicator } from "react-native";
import { Tabs } from "expo-router";
import { Home, Search, Target, User } from "lucide-react-native";
import { PermissionsProvider, useMyPermissions } from "../../lib/permissionsContext";
import { SN_LOOKUP_KEY, TARGET_KEY } from "../../lib/navConfig";
import { theme } from "../../lib/theme";

// The fixed four-slot bottom bar, permanently: Home / SN Lookup / Target /
// Account, in that order - a closed list, no other permission can ever
// occupy it (§12.1). Home and Account are universal; SN Lookup and Target
// are conditional on the caller's own mobile grant and simply absent when
// not granted - never backfilled by anything else, never promoted from or
// to the Home icon grid.
function TabsShell() {
  const { loading, keys } = useMyPermissions();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.colors.card }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }}
      />
      <Tabs.Protected guard={keys.includes(SN_LOOKUP_KEY)}>
        <Tabs.Screen
          name="sn-lookup"
          options={{ title: "SN Lookup", tabBarIcon: ({ color, size }) => <Search color={color} size={size} /> }}
        />
      </Tabs.Protected>
      <Tabs.Protected guard={keys.includes(TARGET_KEY)}>
        <Tabs.Screen
          name="target"
          options={{ title: "Target", tabBarIcon: ({ color, size }) => <Target color={color} size={size} /> }}
        />
      </Tabs.Protected>
      <Tabs.Screen
        name="account"
        options={{ title: "Account", tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }}
      />
    </Tabs>
  );
}

export default function TabsLayout() {
  return (
    <PermissionsProvider>
      <TabsShell />
    </PermissionsProvider>
  );
}
