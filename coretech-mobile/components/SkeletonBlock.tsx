import React, { useEffect, useRef } from "react";
import { Animated, ViewStyle, StyleProp } from "react-native";

// Pulsing placeholder for loading states, replacing a bare spinner - built on
// RN's own Animated API, same reasoning as AnimatedPressable/FadeInView.
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
        { backgroundColor: "#E2E8F0", borderRadius: 8 },
        style,
        { opacity },
      ]}
    />
  );
}
