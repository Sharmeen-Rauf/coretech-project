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
      {/* width: "100%" + alignItems: "center" - without these, this
          Animated.View sizes itself to its widest child's own natural
          width (React Native's default) instead of filling the Pressable.
          For Home's grid tiles specifically, that widest child is the
          label Text, not the icon - for a short label ("Sell Out") that's
          close enough to the icon's own 40px width that the bug was
          invisible, but for longer labels ("Distributor View", "Sub
          Dealer List", "Sub-Dealer View") the label became far wider than
          the icon, and with no alignItems set here the icon (having an
          explicit width) landed at this View's default cross-axis start -
          its left edge - instead of centered under the label. Found by
          measuring real device screenshots pixel-by-pixel (icon-box
          center vs the tile's actual card boundary, not just the icon's
          own small box, which was already fine) after two rounds of
          chasing individual icon glyphs turned out to be the wrong layer
          entirely - this wrapper affects every button and tile in the
          app, not just Home's grid. */}
      <Animated.View style={{ width: "100%", alignItems: "center", transform: [{ scale }] }}>{children}</Animated.View>
    </Pressable>
  );
}
