import {
  TabList,
  Tabs,
  TabSlot,
  TabTrigger,
  TabTriggerSlotProps,
} from "expo-router/ui";
import { useContext } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ItemsContext } from "@/context/ItemsContext";
import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";

import { Spacing } from "@/constants/theme";

export default function AppTabs({ itemCount = 0 }: { itemCount?: number }) {
  const { totalItems } = useContext(ItemsContext);
  const displayCount = totalItems || itemCount;

  console.log("AppTabs - totalItems from context:", totalItems);
  console.log("AppTabs - displayCount:", displayCount);

  return (
    <View style={styles.container}>
      <ThemedView type="background" style={styles.headerContent}>
        <View style={styles.headerRow}>
          <ThemedText type="default" style={styles.companyName}>
            Pallet Items
          </ThemedText>
          <ThemedText type="default" style={styles.itemCountText}>
            {displayCount} items
          </ThemedText>
        </View>
      </ThemedView>
      <Tabs>
        <TabSlot style={styles.tabSlot} />
        <TabList style={styles.hiddenTabList}>
          <TabTrigger name="home" href="/" asChild>
            <TabButton>Home</TabButton>
          </TabTrigger>
          <TabTrigger name="explore" href="/explore" asChild>
            <TabButton>Explore</TabButton>
          </TabTrigger>
        </TabList>
      </Tabs>
    </View>
  );
}

export function TabButton({
  children,
  isFocused,
  ...props
}: TabTriggerSlotProps) {
  return (
    <Pressable
      {...props}
      style={({ pressed }) => (pressed ? styles.pressed : {})}
    >
      <ThemedView
        type={isFocused ? "backgroundSelected" : "backgroundElement"}
        style={styles.tabButtonView}
      >
        <ThemedText
          type="small"
          themeColor={isFocused ? "text" : "textSecondary"}
        >
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
  } as any,
  headerContent: {
    backgroundColor: "#ffffff",
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  } as any,
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  } as any,
  companyName: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
  } as any,
  itemCountText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
  } as any,
  tabSlot: {
    flex: 1,
    width: "100%",
  } as any,
  hiddenTabList: {
    display: "none",
  } as any,
  pressed: {
    opacity: 0.7,
  } as any,
  tabButtonView: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  } as any,
});
