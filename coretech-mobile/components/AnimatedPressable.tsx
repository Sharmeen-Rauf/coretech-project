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
//
// Animates the Pressable itself (via Animated.createAnimatedComponent)
// instead of wrapping children in a separate inner Animated.View. The
// earlier version put the caller's `style` - which often carries
// flexDirection/alignItems for a row of icon+text - on the outer Pressable,
// but then laid the actual children out inside an unstyled inner View that
// silently fell back to RN's default column direction, breaking any
// intended row layout (confirmed live: the Dashboard's primary CTA card and
// the job form's submit button both rendered icon/text stacked vertically
// instead of side-by-side). Applying `style` directly to the single
// animated element removes that extra, differently-laid-out wrapper.
const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

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
    <AnimatedPressableBase
      style={[style, { transform: [{ scale }] }]}
      onPressIn={(e: any) => {
        animateTo(0.96);
        onPressIn?.(e);
      }}
      onPressOut={(e: any) => {
        animateTo(1);
        onPressOut?.(e);
      }}
      {...rest}
    >
      {children}
    </AnimatedPressableBase>
  );
}
