import { Header } from "@/components/header";
import { StatusBanner } from "@/components/status-banner";
import { ItemsContext } from "@/context/ItemsContext";
import { useItems } from "@/hooks/useItems";
import {
  emptyFilters,
  type FilterCategory,
  type ItemCatalogItem,
  type ItemFilters,
} from "@/services/itemApi";
import { syncIntervals, type SyncIntervalMinutes } from "@/storage/itemStorage";
import { Ionicons } from "@expo/vector-icons";
import { useContext, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 20;
const SKELETON_ITEMS = Array.from({ length: 10 }, (_, index) => index);
const PLACEHOLDER_IMAGE = require("@/assets/images/no-image.png");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getItemImageUrl = (item: ItemCatalogItem): string | null => {
  if (item.image?.imageURL) return item.image.imageURL;

  if (item.image?.imagePath) {
    return item.image.imagePath.startsWith("http")
      ? item.image.imagePath
      : `http://45.77.221.159:49${item.image.imagePath}`;
  }

  return null;
};

const formatSyncTime = (timestamp: number | null): string => {
  if (!timestamp) return "Never";

  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60_000);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;

  const hrs = Math.floor(mins / 60);

  if (hrs < 24) return `${hrs}h ago`;

  return new Date(timestamp).toLocaleDateString();
};

// ─── ItemCard ─────────────────────────────────────────────────────────────────

function ItemCard({ item }: { item: ItemCatalogItem }) {
  const sourceImageUrl = getItemImageUrl(item);
  const [imageUrl, setImageUrl] = useState(sourceImageUrl);
  const [isImageLoading, setIsImageLoading] = useState(true);

  useEffect(() => {
    setImageUrl(sourceImageUrl);
    setIsImageLoading(true);
  }, [sourceImageUrl]);

  const handleImageError = () => {
    if (imageUrl) {
      setImageUrl(null);
      setIsImageLoading(true);
      return;
    }

    setIsImageLoading(false);
  };

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.8}>
      <View
        style={[styles.imageFrame, !imageUrl && { backgroundColor: "#f5f5f5" }]}
      >
        {isImageLoading && (
          <View style={[styles.skeletonBlock, styles.imageLoadingSkeleton]} />
        )}
        <Image
          source={imageUrl ? { uri: imageUrl } : PLACEHOLDER_IMAGE}
          style={styles.image}
          resizeMode="contain"
          onLoadStart={() => setIsImageLoading(true)}
          onLoadEnd={() => setIsImageLoading(false)}
          onError={handleImageError}
        />
      </View>

      <Text style={styles.itemCode}>
        {item.categoryTax?.primaryCategoryName || "Uncategorized"}
      </Text>

      <Text style={styles.itemName} numberOfLines={2}>
        {item.identity?.itemName || "No Name"}
      </Text>

      <View style={styles.metaRow}>
        <Text style={styles.category} numberOfLines={1}>
          {item.identity?.itemCode || "N/A"}
        </Text>

        <Text style={styles.price} numberOfLines={1}>
          ${item.pricing?.sellingPrice?.toFixed(2) || "0.00"}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={[styles.skeletonBlock, styles.skeletonImage]} />
      <View style={[styles.skeletonBlock, styles.skeletonCode]} />
      <View style={[styles.skeletonBlock, styles.skeletonName]} />
      <View style={[styles.skeletonBlock, styles.skeletonCategory]} />
      <View style={[styles.skeletonBlock, styles.skeletonPrice]} />
    </View>
  );
}

// ─── Category filter image (with no-image fallback) ───────────────────────────

function CategoryFilterImage({
  uri,
  style,
}: {
  uri: string | null;
  style: any;
}) {
  const [src, setSrc] = useState<any>(
    uri ? { uri } : PLACEHOLDER_IMAGE,
  );

  return (
    <Image
      source={src}
      style={style}
      resizeMode="cover"
      onError={() => setSrc(PLACEHOLDER_IMAGE)}
    />
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function Index() {
  const { setTotalItems } = useContext(ItemsContext);
  const insets = useSafeAreaInsets();

  // ── Local UI state ──
  const [searchQuery, setSearchQuery] = useState("");
  const [filterVisible, setFilterVisible] = useState(false);
  const [syncSettingsVisible, setSyncSettingsVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubCategories, setSelectedSubCategories] = useState<string[]>(
    [],
  );
  const [appliedFilters, setAppliedFilters] =
    useState<ItemFilters>(emptyFilters);
  const [page, setPage] = useState(1);

  // ── Offline-first hook (all data, search, filter from cache) ──
  const {
    items,
    allItems,
    filterCategories,
    totalRecords,
    loading,
    refreshing,
    syncing,
    isOffline,
    statusMessage,
    error,
    lastSyncAt,
    syncIntervalMinutes,
    setSyncIntervalMinutes,
    refresh,
  } = useItems({
    searchQuery,
    filters: appliedFilters,
    page,
    pageSize: ITEMS_PER_PAGE,
  });

  // Keep ItemsContext in sync with total
  useEffect(() => {
    setTotalItems(totalRecords);
  }, [totalRecords, setTotalItems]);

  const containerStyle = Platform.select({
    native: { paddingTop: 0 },
    web: { paddingTop: 0 },
  });

  // ── Filter helpers ──
  const activeCategory = useMemo(
    () =>
      filterCategories.find((c) => c.name === selectedCategory) ||
      filterCategories[0],
    [filterCategories, selectedCategory],
  );

  const visibleSubCategories = activeCategory?.subCategories || [];
  const allVisibleSubCategoriesSelected =
    visibleSubCategories.length > 0 &&
    visibleSubCategories.every((item) => selectedSubCategories.includes(item));

  const handleFilterPress = () => {
    // Restore the last applied selection when reopening the filter
    setSelectedCategory(
      appliedFilters.subCategories.length > 0
        ? (filterCategories.find((c) =>
            c.subCategories.some((s) => appliedFilters.subCategories.includes(s))
          )?.name ?? filterCategories[0]?.name ?? "")
        : (filterCategories[0]?.name ?? "")
    );
    setSelectedSubCategories(appliedFilters.subCategories);
    setFilterVisible(true);
  };

  const toggleSubCategory = (subCategory: string) => {
    setSelectedSubCategories((current) =>
      current.includes(subCategory)
        ? current.filter((item) => item !== subCategory)
        : [...current, subCategory],
    );
  };

  const handleSelectAllSubCategories = () => {
    if (!visibleSubCategories.length) return;

    setSelectedSubCategories((current) => {
      if (allVisibleSubCategoriesSelected) {
        return current.filter((item) => !visibleSubCategories.includes(item));
      }

      return Array.from(new Set([...current, ...visibleSubCategories]));
    });
  };

  const resetFilters = () => {
    setSelectedCategory(filterCategories[0]?.name || "");
    setSelectedSubCategories([]);
    setAppliedFilters(emptyFilters);
    setFilterVisible(false);
    setPage(1);
  };

  const applyFilters = () => {
    // Apply by subCategories only — supports multi-category selection
    setAppliedFilters({
      category: "",
      subCategories: selectedSubCategories,
    });
    setFilterVisible(false);
    setPage(1);
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    setPage(1);
  };

  // ── Infinite scroll (virtual — all data is in memory, just slicing) ──
  const handleEndReached = () => {
    if (items.length >= totalRecords) return;

    setPage((prev) => prev + 1);
  };

  // ── Render helpers ──
  const renderItem = ({ item }: { item: ItemCatalogItem }) => (
    <ItemCard item={item} />
  );

  const renderSkeletonItem = ({ item }: { item: number }) => (
    <SkeletonCard key={item} />
  );

  const keyExtractor = (item: ItemCatalogItem, index: number) =>
    String(item.id ?? item.itemId ?? item.identity?.itemCode ?? index);

  // ── Sync settings modal (kept as inline JSX below — do NOT define as a
  //    component inside render; that causes React to remount it every render)

  // ── Loading skeleton ──
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={[styles.container, containerStyle]}>
          <Header onSearch={handleSearch} onFilterPress={handleFilterPress} />
          <FlatList
            style={{ marginTop: 8 }}
            data={SKELETON_ITEMS}
            renderItem={renderSkeletonItem}
            keyExtractor={(item) => `skeleton-${item}`}
            numColumns={2}
            columnWrapperStyle={styles.row}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 10,
              paddingBottom: insets.bottom + 8,
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ── Error (network down + no cache) ──
  if (error && allItems.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <Header onSearch={handleSearch} onFilterPress={handleFilterPress} />
        <View style={styles.centerContainer}>
          <Ionicons name="cloud-offline-outline" size={52} color="#ccc" />
          <Text style={styles.errorHeading}>Could not load items</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => refresh()}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main catalog ──
  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={[styles.container, containerStyle]}>
        {/* Header — all platforms */}
        <Header onSearch={handleSearch} onFilterPress={handleFilterPress} />

        {/* Sync strip — shows status, manual Sync Now button, and gear for interval settings */}
        <View style={styles.syncBar}>
          {/* Left: status */}
          <View style={styles.syncBarLeft}>
            {syncing ? (
              <ActivityIndicator
                size="small"
                color="#0A84C6"
                style={{ marginRight: 6 }}
              />
            ) : (
              <Ionicons
                name="sync-outline"
                size={13}
                color="#0A84C6"
                style={{ marginRight: 4 }}
              />
            )}
            <Text style={styles.syncBarText} numberOfLines={1}>
              {syncing ? "Syncing…" : `Synced ${formatSyncTime(lastSyncAt)}`}
            </Text>
          </View>

          {/* Right: manual sync + settings */}
          <View style={styles.syncBarRight}>
            <TouchableOpacity
              style={[styles.syncNowBtn, syncing && styles.syncNowBtnDisabled]}
              onPress={syncing ? undefined : refresh}
              activeOpacity={0.75}
              disabled={syncing}
            >
              <Text style={styles.syncNowBtnText}>Sync Now</Text>
            </TouchableOpacity>

            {/* <TouchableOpacity
              style={styles.syncGearBtn}
              onPress={() => setSyncSettingsVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="settings-outline" size={15} color="#9EAABB" />
            </TouchableOpacity> */}
          </View>
        </View>

        {/* Product grid */}
        {items.length === 0 && searchQuery.trim() ? (
          <View style={styles.centerContainer}>
            <Ionicons name="search-outline" size={48} color="#ccc" />
            <Text style={styles.emptyHeading}>No items found</Text>
            <Text style={styles.emptyText}>
              Try searching for different keywords
            </Text>
          </View>
        ) : items.length === 0 && statusMessage ? (
          <View style={styles.centerContainer}>
            <Ionicons name="cloud-offline-outline" size={52} color="#ccc" />
            <Text style={styles.emptyHeading}>No cached data</Text>
            <Text style={styles.emptyText}>{statusMessage}</Text>
          </View>
        ) : (
          <FlatList
            style={{ marginTop: 8 }}
            data={items}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            numColumns={2}
            columnWrapperStyle={styles.row}
            showsVerticalScrollIndicator={false}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            // Performance knobs for 1k-10k items
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={10}
            removeClippedSubviews={Platform.OS !== "web"}
            getItemLayout={undefined}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={refresh}
                tintColor="#0A84C6"
                colors={["#0A84C6"]}
              />
            }
            contentContainerStyle={{
              paddingHorizontal: 10,
              paddingBottom: insets.bottom + 8,
            }}
            ListHeaderComponent={
              // Only show StatusBanner for offline / cached-data messages.
              // Do NOT pass syncing here — that was causing the second loader.
              statusMessage ? (
                <StatusBanner message={statusMessage} isOffline={isOffline} />
              ) : null
            }
            ListFooterComponent={
              items.length < totalRecords ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="small" color="#0A84C6" />
                </View>
              ) : null
            }
          />
        )}
      </View>

      {/* Filter modal */}
      <Modal
        visible={filterVisible}
        animationType="slide"
        onRequestClose={() => setFilterVisible(false)}
      >
        <SafeAreaView style={styles.filterScreen} edges={["top", "bottom"]}>
          <View style={styles.filterHeader}>
            <TouchableOpacity
              style={styles.filterHeaderButton}
              onPress={() => setFilterVisible(false)}
            >
              <Ionicons name="arrow-back" size={32} color="#111" />
            </TouchableOpacity>

            <Text style={styles.filterTitle}>FILTER</Text>

            <TouchableOpacity
              style={styles.filterHeaderButton}
              onPress={resetFilters}
            >
              <Text style={styles.resetText}>RESET</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.filterContent}>
            <ScrollView
              style={styles.categoryRail}
              showsVerticalScrollIndicator={false}
            >
              {filterCategories.map((category: FilterCategory) => {
                const isActive = activeCategory?.name === category.name;
                // Count how many of this category's subcategories are selected
                const selCount = category.subCategories.filter((s) =>
                  selectedSubCategories.includes(s)
                ).length;

                return (
                  <TouchableOpacity
                    key={category.name}
                    style={[
                      styles.categoryFilterItem,
                      isActive && styles.categoryFilterItemActive,
                    ]}
                    onPress={() => {
                      // Only change the VIEW — do NOT clear selections
                      setSelectedCategory(category.name);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.categoryImageOuter}>
                      <View
                        style={[
                          styles.categoryImageWrap,
                          isActive && styles.categoryImageWrapActive,
                        ]}
                      >
                        <CategoryFilterImage
                          uri={category.imageUrl}
                          style={styles.categoryFilterImage}
                        />
                      </View>
                      {selCount > 0 && (
                        <View style={styles.selectionBadge}>
                          <Text style={styles.selectionBadgeText}>
                            {selCount}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.categoryFilterText,
                        isActive && styles.categoryFilterTextActive,
                        selCount > 0 && styles.categoryFilterTextSelected,
                      ]}
                      numberOfLines={3}
                    >
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.subCategoryPanel}>
              <Text style={styles.sectionTitle}>SUB CATEGORIES</Text>

              {visibleSubCategories.length ? (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={handleSelectAllSubCategories}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name={
                        allVisibleSubCategoriesSelected
                          ? "checkbox"
                          : "square-outline"
                      }
                      size={20}
                      color={
                        allVisibleSubCategoriesSelected ? "#0A84C6" : "#C9D3DE"
                      }
                    />
                    <Text style={styles.checkboxText}>Select All</Text>
                  </TouchableOpacity>

                  {visibleSubCategories.map((subCategory) => {
                    const isSelected =
                      selectedSubCategories.includes(subCategory);

                    return (
                      <TouchableOpacity
                        key={subCategory}
                        style={styles.checkboxRow}
                        onPress={() => toggleSubCategory(subCategory)}
                        activeOpacity={0.75}
                      >
                        <Ionicons
                          name={isSelected ? "checkbox" : "square-outline"}
                          size={20}
                          color={isSelected ? "#0A84C6" : "#C9D3DE"}
                        />
                        <Text style={styles.checkboxText}>{subCategory}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : (
                <View style={styles.emptyFilterState}>
                  <Text style={styles.emptyFilterText}>
                    No sub categories found
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.applyFilterBar}>
            {selectedSubCategories.length > 0 && (
              <Text style={styles.applySelectionSummary}>
                {selectedSubCategories.length} sub-categor
                {selectedSubCategories.length === 1 ? "y" : "ies"} selected
              </Text>
            )}
            <TouchableOpacity
              style={[
                styles.applyButton,
                selectedSubCategories.length === 0 &&
                  styles.applyButtonDisabled,
              ]}
              onPress={
                selectedSubCategories.length > 0 ? applyFilters : undefined
              }
              activeOpacity={selectedSubCategories.length > 0 ? 0.85 : 1}
            >
              <Text style={styles.applyButtonText}>APPLY FILTERS</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Sync settings modal — inline JSX to avoid remount-on-rerender crash */}
      <Modal
        visible={syncSettingsVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSyncSettingsVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSyncSettingsVisible(false)}
        >
          <View style={styles.syncSheet}>
            <Text style={styles.syncSheetTitle}>Sync Interval</Text>
            <Text style={styles.syncSheetSub}>
              Last synced: {formatSyncTime(lastSyncAt)}
            </Text>

            {syncIntervals.map((mins) => (
              <TouchableOpacity
                key={mins}
                style={[
                  styles.syncOption,
                  syncIntervalMinutes === mins && styles.syncOptionActive,
                ]}
                onPress={() => {
                  setSyncIntervalMinutes(mins as SyncIntervalMinutes);
                  setSyncSettingsVisible(false);
                }}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.syncOptionText,
                    syncIntervalMinutes === mins && styles.syncOptionTextActive,
                  ]}
                >
                  {mins} minutes
                </Text>
                {syncIntervalMinutes === mins && (
                  <Ionicons name="checkmark" size={20} color="#0A84C6" />
                )}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.syncNowButton}
              onPress={() => {
                setSyncSettingsVisible(false);
                refresh();
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={16} color="#fff" />
              <Text style={styles.syncNowText}>Sync Now</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 0,
  },

  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  errorHeading: {
    marginTop: 12,
    fontSize: 17,
    fontWeight: "700",
    color: "#111",
  },

  errorText: {
    marginTop: 6,
    color: "#E94B55",
    fontSize: 13,
    textAlign: "center",
  },

  retryButton: {
    marginTop: 20,
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: "#0A84C6",
    borderRadius: 10,
  },

  retryText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },

  emptyHeading: {
    marginTop: 12,
    fontSize: 17,
    fontWeight: "700",
    color: "#111",
  },

  emptyText: {
    marginTop: 6,
    fontSize: 13,
    color: "#8a8a8a",
    textAlign: "center",
  },

  // ── Sync bar ──
  syncBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: "#EAF6FF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#C6DFF0",
  },

  syncBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },

  syncBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: 8,
  },

  syncBarText: {
    fontSize: 11,
    color: "#0A84C6",
    fontWeight: "500",
    flexShrink: 1,
  },

  syncNowBtn: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: "#0A84C6",
    borderRadius: 10,
  },

  syncNowBtnDisabled: {
    opacity: 0.45,
  },

  syncNowBtnText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },

  syncGearBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Cards / grid ──
  row: {
    justifyContent: "space-between",
    paddingHorizontal: 0,
  },

  card: {
    width: "48.5%",
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e7e7e7",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },

  imageFrame: {
    width: "100%",
    height: 84,
    marginBottom: 10,
    overflow: "hidden",
    position: "relative",
  },

  image: {
    width: "100%",
    height: "100%",
  },

  // ── Skeleton ──
  skeletonBlock: {
    backgroundColor: "#ececec",
    borderRadius: 6,
  },

  skeletonImage: {
    width: "100%",
    height: 84,
    marginBottom: 10,
  },

  imageLoadingSkeleton: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1,
  },

  skeletonCode: {
    width: "54%",
    height: 10,
  },

  skeletonName: {
    width: "88%",
    height: 12,
    marginTop: 5,
  },

  skeletonCategory: {
    width: "62%",
    height: 10,
    marginTop: 5,
  },

  skeletonPrice: {
    width: "38%",
    height: 16,
    marginTop: 8,
  },

  // ── Item text ──
  itemName: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
    color: "#111",
    marginTop: 3,
  },

  itemCode: {
    fontSize: 10,
    lineHeight: 13,
    color: "#666",
  },

  category: {
    flex: 1,
    fontSize: 10,
    lineHeight: 13,
    color: "#8a8a8a",
    marginRight: 8,
  },

  price: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "700",
    color: "#000",
    textAlign: "right",
  },

  metaRow: {
    marginTop: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  footerLoader: {
    paddingVertical: 20,
    alignItems: "center",
  },

  // ── Filter modal ──
  filterScreen: {
    flex: 1,
    backgroundColor: "#fff",
  },

  filterHeader: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E8EDF3",
    paddingHorizontal: 12,
  },

  filterHeaderButton: {
    minWidth: 56,
    height: 40,
    justifyContent: "center",
  },

  resetText: {
    color: "#E94B55",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
  },

  filterTitle: {
    color: "#111",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 1,
  },

  filterContent: {
    flex: 1,
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ECEFF3",
  },

  categoryRail: {
    width: "25%",
    backgroundColor: "#F8FAFC",
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: "#E8EDF3",
  } as any,

  categoryFilterItem: {
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 6,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E8EDF3",
  },

  categoryFilterItemActive: {
    backgroundColor: "#EAF6FF",
  },

  categoryImageOuter: {
    position: "relative",
  },

  categoryImageWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#E9EEF4",
  },

  categoryImageWrapActive: {
    borderWidth: 2,
    borderColor: "#0A84C6",
  },

  categoryFilterImage: {
    width: "100%",
    height: "100%",
  } as any,

  selectionBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#0A84C6",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },

  selectionBadgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
    lineHeight: 11,
  },

  categoryFilterText: {
    color: "#718093",
    fontSize: 10,
    fontWeight: "500",
    lineHeight: 13,
    textAlign: "center",
  },

  categoryFilterTextActive: {
    color: "#0A84C6",
    fontWeight: "700",
  },

  categoryFilterTextSelected: {
    color: "#0A84C6",
  },

  subCategoryPanel: {
    width: "75%",
    backgroundColor: "#fff",
    paddingLeft: 12,
  } as any,

  sectionTitle: {
    color: "#9EAABB",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    paddingTop: 12,
    paddingBottom: 8,
    paddingRight: 12,
  },

  checkboxRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EFF2F5",
    paddingRight: 12,
  },

  checkboxText: {
    flex: 1,
    color: "#344253",
    fontSize: 13,
    fontWeight: "500",
  },

  emptyFilterState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },

  emptyFilterText: {
    color: "#8794A6",
    fontSize: 12,
    textAlign: "center",
  },

  applyFilterBar: {
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#EEF1F4",
    gap: 8,
  },

  applySelectionSummary: {
    fontSize: 11,
    color: "#0A84C6",
    fontWeight: "600",
    textAlign: "center",
  },

  applyButton: {
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0A84C6",
  },

  applyButtonDisabled: {
    opacity: 0.4,
  },

  applyButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  // ── Sync settings sheet ──
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  syncSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 4,
  },

  syncSheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0d0d0d",
    marginBottom: 2,
  },

  syncSheetSub: {
    fontSize: 12,
    color: "#9EAABB",
    marginBottom: 16,
  },

  syncOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EFF2F5",
  },

  syncOptionActive: {
    // intentionally minimal — the checkmark is the indicator
  },

  syncOptionText: {
    fontSize: 16,
    color: "#344253",
    fontWeight: "500",
  },

  syncOptionTextActive: {
    color: "#0A84C6",
    fontWeight: "700",
  },

  syncNowButton: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#0A84C6",
    borderRadius: 12,
    paddingVertical: 14,
  },

  syncNowText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
