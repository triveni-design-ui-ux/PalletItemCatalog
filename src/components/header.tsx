import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Spacing } from "@/constants/theme";

interface HeaderProps {
  onMessagePress?: () => void;
  onFilterPress?: () => void;
  onNotificationPress?: () => void;
  onProfilePress?: () => void;
  onSearch?: (text: string) => void;
  profileImage?: string;
  notificationBadge?: number;
  messageBadge?: number;
}

export function Header({
  onMessagePress,
  onFilterPress,
  onNotificationPress,
  onProfilePress,
  onSearch,
  profileImage,
  notificationBadge = 0,
  messageBadge = 0,
}: HeaderProps) {
  const [searchText, setSearchText] = useState("");

  const colors = {
    background: "#FFFFFF",
    searchBg: "#EEF3F8",
    searchText: "#1A1A1A",
    searchPlaceholder: "#8A9AB0",
    searchIcon: "#5C7A99",
    icon: "#56687A",
    border: "#E8E8E8",
    title: "#111827",
    logoBlue: "#0A66C2",
    badgeRed: "#CC1016",
    badgeBorder: "#FFFFFF",
  };

  const handleSearchChange = (text: string) => {
    console.log("Header Search:", text);
    setSearchText(text);
    onSearch?.(text);
  };

  const [filterVisible, setFilterVisible] = useState(false);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        },
      ]}
    >
      {/* Top Row */}
      <View style={styles.topRow}>
        {/* Left: Logo */}
        <View style={styles.leftSection}>
          <View style={styles.logoContainer}>
            <Image
              source={require("@/assets/images/splash-icon.png")}
              style={styles.logoIcon}
              resizeMode="contain"
            />
            <Text
              style={[styles.logoText, { color: colors.title }]}
              numberOfLines={1}
            >
              Pallet OMS Item Catalog
            </Text>
          </View>
        </View>

        {/* Right: Action Icons */}
        <View style={styles.actionsRow}>
          {/* Filter */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={onFilterPress}
            activeOpacity={0.65}
          >
            <Ionicons name="funnel-outline" size={24} color={colors.icon} />
          </TouchableOpacity>

          {/* Notifications */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={onNotificationPress}
            activeOpacity={0.65}
          >
            <Ionicons
              name="notifications-outline"
              size={24}
              color={colors.icon}
            />
            {notificationBadge > 0 && (
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: colors.badgeRed,
                    borderColor: colors.badgeBorder,
                  },
                ]}
              >
                <Text style={styles.badgeText}>
                  {notificationBadge > 99 ? "99+" : notificationBadge}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchRow}>
        <View
          style={[styles.searchContainer, { backgroundColor: colors.searchBg }]}
        >
          <Ionicons
            name="search"
            size={17}
            color={colors.searchIcon}
            style={styles.searchIcon}
          />
          <TextInput
            style={[styles.searchInput, { color: colors.searchText }]}
            placeholder="Search"
            placeholderTextColor={colors.searchPlaceholder}
            value={searchText}
            onChangeText={handleSearchChange}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 0.5,
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.three,
    paddingTop: 10,
    paddingBottom: 8,
  },

  leftSection: {
    flex: 1,
    justifyContent: "center",
  },

  logoContainer: {
    flexDirection: "row",
    alignItems: "center", // vertical alignment
    flexWrap: "nowrap",
  },

  logoIcon: {
    width: 28,
    height: 28,
    marginRight: 8,
  },

  logoText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 20,
  },

  avatarWrapper: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: "hidden",
  },

  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },

  avatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },

  logoMark: {
    flex: 1,
    minWidth: 0,
    height: 30,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },

  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
  },

  badgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
    lineHeight: 12,
  },

  searchRow: {
    paddingHorizontal: Spacing.three,
    paddingBottom: 12,
  },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 6,
    height: 36,
    paddingHorizontal: 12,
  },

  searchIcon: {
    marginRight: 8,
  },

  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
});
