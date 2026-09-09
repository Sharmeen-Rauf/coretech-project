import React from "react";
import { View, ActivityIndicator } from "react-native";
import { Tabs } from "expo-router";
import { Home, Search, Target, User } from "lucide-react-native";
import { PermissionsProvider, useMyPermissions } from "../../lib/permissionsContext";
import { SN_LOOKUP_KEY, TARGET_KEY } from "../../lib/navConfig";
import { theme } from "../../lib/theme";
import { screenHeaderOptions } from "../../lib/navHeader";
import NotificationBell from "../../components/NotificationBell";

// The fixed four-slot bottom bar, permanently: Home / SN Lookup / Target /
// Account, in that order - a closed list, no other permission can ever
// occupy it (§12.1). Home and Account are universal; SN Lookup and Target
// are conditional on the caller's own mobile grant and simply absent when
// not granted - never backfilled by anything else, never promoted from or
// to the Home icon grid.
//
// Every tab now gets the same native header as app/screens/* (title +
// consistent styling), instead of Home/Target hand-rolling their own
// in-body heading text while SN Lookup/Account had none at all - that
// inconsistency (and Target's leaked internal "(Read Only)" wording) is
// gone now that the title is a single source of truth: this file's own
// `title` option, nothing rendered inside each screen's body.
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
        ...screenHeaderOptions,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
          headerRight: () => <NotificationBell />,
        }}
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
