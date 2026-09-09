// Shared color palette, lifted from the installer app (coretech-mobile) so
// both apps read as the same product family. Not DCR's palette - DCR is only
// a layout/navigation reference, see notes/MOBILE-ADMIN-APP-PLAN.md §12.
export const theme = {
  colors: {
    primary: "#00B4D8",
    primaryTint: "#F0FAFE",
    background: "#F8FAFC",
    card: "#FFFFFF",
    border: "#E2E8F0",
    textPrimary: "#1E293B",
    textSecondary: "#64748B",
    textMuted: "#94A3B8",
    textStrong: "#0F172A",
    success: "#059669",
    successTint: "#ECFDF5",
    warning: "#EA580C",
    warningTint: "#FFF7ED",
    error: "#DC2626",
    errorTint: "#FEE2E2",
    info: "#0891B2",
    infoTint: "#ECFEFF",
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
  },
} as const;
