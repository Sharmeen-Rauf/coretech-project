import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { theme } from "../lib/theme";

interface ProgressRingProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
}

// Circular progress instead of a flat bar - the same underlying number
// reads as noticeably more polished as a ring (the "how far have I come"
// dashboard pattern), for no new dependency - react-native-svg was already
// installed.
export default function ProgressRing({ percent, size = 64, strokeWidth = 7 }: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.colors.background}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.colors.primary}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.centerText}>
          <Text style={styles.percentText}>{Math.round(clamped)}%</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centerText: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  percentText: {
    fontSize: 12,
    fontWeight: "bold",
    color: theme.colors.textStrong,
  },
});
