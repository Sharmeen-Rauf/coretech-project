import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

// React error boundaries must be class components - there is no hooks
// equivalent. Without this at the root, any unhandled render error anywhere
// in the app (not just the two specific crashes already fixed elsewhere)
// closes the whole app outright instead of showing something recoverable.
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
    backgroundColor: "#FFFFFF",
  },
  heading: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 10,
    textAlign: "center",
  },
  body: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  button: {
    height: 44,
    paddingHorizontal: 24,
    backgroundColor: "#00B4D8",
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
