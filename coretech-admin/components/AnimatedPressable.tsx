import React, { useRef } from "react";
import { Animated, Pressable, PressableProps, ViewStyle, StyleProp } from "react-native";

type Props = Omit<PressableProps, "children" | "style"> & {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

// Ported from coretech-mobile's own AnimatedPressable - uses React Native's
// built-in Animated API, not react-native-reanimated, so it needs no babel
// plugin or extra native setup and stays a pure-JS change (ships via OTA).
// A brief scale-down on press is the single highest-leverage "this feels
// like an app, not a form" fix - every button/tile press now visibly
// responds instead of just silently navigating/submitting.
export default function AnimatedPressable({
  children,
  style,
  onPressIn,
  onPressOut,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  };

  return (
    <Pressable
      style={style}
      onPressIn={(e) => {
        animateTo(0.96);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        animateTo(1);
        onPressOut?.(e);
      }}
      {...rest}
    >
      <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
    </Pressable>
  );
}
