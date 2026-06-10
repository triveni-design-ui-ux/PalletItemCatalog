import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

interface StatusBannerProps {
  /** Message to display. Pass null/undefined to hide the banner. */
  message: string | null | undefined;
  /** True while a background/foreground sync is in progress. */
  syncing?: boolean;
  /** True when the device has no network connectivity. */
  isOffline?: boolean;
}

/**
 * A slim, non-blocking status strip that sits at the top of the catalog list.
 *
 * Appearance rules:
 *  - Syncing  → blue spinner + "Syncing…"
 *  - Offline  → amber strip + message (e.g. "Showing cached data")
 *  - No cache + offline → red strip
 *  - null message + not syncing → renders nothing (zero height)
 */
export function StatusBanner({ message, syncing = false, isOffline = false }: StatusBannerProps) {
  const isNoCache =
    message === "No internet connection and no cached data available";

  if (!message && !syncing) return null;

  if (syncing && !message) {
    return (
      <View style={[styles.banner, styles.syncingBanner]}>
        <ActivityIndicator size="small" color="#2563EB" />
        <Text style={[styles.bannerText, styles.syncingText]}>Syncing…</Text>
      </View>
    );
  }

  const bannerStyle = isNoCache
    ? styles.errorBanner
    : isOffline
      ? styles.offlineBanner
      : styles.cachedBanner;

  const textStyle = isNoCache
    ? styles.errorText
    : isOffline
      ? styles.offlineText
      : styles.cachedText;

  const icon = isNoCache ? "🔴" : isOffline ? "🟡" : "💾";

  return (
    <View style={[styles.banner, bannerStyle]}>
      {syncing && <ActivityIndicator size="small" color="#92400E" style={styles.spinner} />}
      <Text style={[styles.bannerText, textStyle]} numberOfLines={1}>
        {icon} {syncing ? "Syncing…  " : ""}{message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },

  syncingBanner: {
    backgroundColor: "#EFF6FF",
  },

  offlineBanner: {
    backgroundColor: "#FFFBEB",
  },

  errorBanner: {
    backgroundColor: "#FEF2F2",
  },

  cachedBanner: {
    backgroundColor: "#F0FDF4",
  },

  bannerText: {
    fontSize: 12,
    fontWeight: "500",
    flexShrink: 1,
  },

  syncingText: {
    color: "#1D4ED8",
  },

  offlineText: {
    color: "#92400E",
  },

  errorText: {
    color: "#991B1B",
  },

  cachedText: {
    color: "#166534",
  },

  spinner: {
    marginRight: 2,
  },
});
