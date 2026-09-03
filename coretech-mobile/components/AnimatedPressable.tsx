import React, { useRef } from "react";
import { Animated, Pressable, PressableProps, ViewStyle, StyleProp } from "react-native";

type Props = Omit<PressableProps, "children" | "style"> & {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

// Uses React Native's own built-in Animated API, not react-native-reanimated -
// this needs no babel plugin or extra native setup, so it can't silently
// misbehave the way three other "just add the library" assumptions already
// did on this project (expo-asset, expo-file-system, the Blob upload).
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
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
