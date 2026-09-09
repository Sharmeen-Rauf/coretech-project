import React, { useEffect, useRef } from "react";
import { Animated, ViewStyle, StyleProp } from "react-native";
import { theme } from "../lib/theme";

// Ported from coretech-mobile's own SkeletonBlock - pulsing placeholder for
// loading states, built on RN's own Animated API (no new dependency).
export default function SkeletonBlock({ style }: { style?: StyleProp<ViewStyle> }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={[
        { backgroundColor: theme.colors.border, borderRadius: theme.radius.sm },
        style,
        { opacity },
      ]}
    />
  );
}
