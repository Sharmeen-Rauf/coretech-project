import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { theme } from "../lib/theme";

// React error boundaries must be class components - there is no hooks
// equivalent. Without this at the root, any unhandled render error anywhere
// in the app closes the whole app outright instead of showing something
// recoverable. Mirrors coretech-mobile's ErrorBoundary.
export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.warn("[ErrorBoundary] caught:", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.heading}>Something Went Wrong</Text>
          <Text style={styles.body}>
            The app hit an unexpected error. You can try again, or close and reopen the app if
            it keeps happening.
          </Text>
          <TouchableOpacity onPress={this.handleReset} style={styles.button}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: theme.colors.card,
  },
  heading: {
    fontSize: 18,
    fontWeight: "bold",
    color: theme.colors.textPrimary,
    marginBottom: 10,
    textAlign: "center",
  },
  body: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  button: {
    height: 44,
    paddingHorizontal: 24,
    backgroundColor: theme.colors.primary,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 14,
  },
});
