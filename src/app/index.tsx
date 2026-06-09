import { Header } from "@/components/header";
import { ItemsContext } from "@/context/ItemsContext";
import { Ionicons } from "@expo/vector-icons";
import { useContext, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Platform,
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
import { getItems, searchItems, warmSearchCatalog } from "../app/services/api";
const ITEMS_PER_PAGE = 10;
const SEARCH_ITEMS_PER_PAGE = 20;
const SKELETON_ITEMS = Array.from({ length: 10 }, (_, index) => index);
const PLACEHOLDER_IMAGE = require("@/assets/images/no-image.png");

const getItemSearchText = (item: any) =>
  [
    item.identity?.itemName,
    item.identity?.itemCode,
    item.identity?.brandName,
    item.identity?.vendorName,
    item.identity?.departmentName,
    item.categoryTax?.primaryCategoryName,
    item.categoryTax?.secondaryCategoryName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const matchesSearchQuery = (item: any, query: string) =>
  getItemSearchText(item).includes(query.toLowerCase());

const getItemImageUrl = (item: any) => {
  if (item.image?.imageURL) {
    return item.image.imageURL;
  }

  if (item.image?.imagePath) {
    return item.image.imagePath.startsWith("http")
      ? item.image.imagePath
      : `http://45.77.221.159:49${item.image.imagePath}`;
  }

  return null;
};

function ItemCard({ item }: { item: any }) {
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

export default function Index() {
  const { setTotalItems } = useContext(ItemsContext);
  const insets = useSafeAreaInsets();
  const didRunSearchEffect = useRef(false);
  const latestRequestId = useRef(0);

  const [filterVisible, setFilterVisible] = useState(false);
  const [selectedPrice, setSelectedPrice] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubCategory, setSelectedSubCategory] = useState("");

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const containerStyle = Platform.select({
    native: { paddingTop: 0 },
    web: { paddingTop: 0 },
  });

  const handleFilterPress = () => {
    setFilterVisible(true);
  };

  useEffect(() => {
    fetchItems(1);
    warmSearchCatalog();
  }, []);

  // Handle search with debouncing
  useEffect(() => {
    if (!didRunSearchEffect.current) {
      didRunSearchEffect.current = true;
      return;
    }

    const delaySearch = setTimeout(() => {
      const query = searchQuery.trim();

      if (query) {
        performSearch(query, 1);
      } else {
        setCurrentPage(1);
        fetchItems(1, { showInitialLoader: false });
      }
    }, 500);

    return () => clearTimeout(delaySearch);
  }, [searchQuery]);

  const fetchItems = async (
    pageNum: number,
    options: { showInitialLoader?: boolean } = {},
  ) => {
    const requestId = ++latestRequestId.current;

    try {
      const isFirstPage = pageNum === 1;
      const showInitialLoader = options.showInitialLoader ?? true;

      setError(null);
      if (isFirstPage && showInitialLoader) setLoading(true);
      else if (isFirstPage) setIsSearching(true);
      else setLoadingMore(true);

      const response = await getItems(ITEMS_PER_PAGE, pageNum);

      if (requestId !== latestRequestId.current) return;

      const itemsData = response.data || [];

      let total = 0;

      try {
        const paging = JSON.parse(response.Paging || "{}");
        total = paging.TotalRecords || 0;
      } catch {
        const match = response.Paging?.match(/TotalRecords:(\d+)/);
        total = match ? parseInt(match[1], 10) : 0;
      }

      setTotalRecords(total);
      setTotalItems(total);
      setCurrentPage(pageNum);

      if (isFirstPage) {
        setItems(itemsData);
      } else {
        setItems((prev) => [...prev, ...itemsData]);
      }
    } catch (err) {
      if (requestId !== latestRequestId.current) return;

      const msg = err instanceof Error ? err.message : "Failed to load items";
      setError(msg);
    } finally {
      if (requestId !== latestRequestId.current) return;

      if (pageNum === 1) {
        setLoading(false);
        setIsSearching(false);
      } else setLoadingMore(false);
    }
  };

  const handleEndReached = () => {
    if (loadingMore || items.length >= totalRecords) return;

    fetchItems(currentPage + 1);
  };

  const handleMenuPress = () => {
    // Handle hamburger menu press
    console.log("Menu pressed");
  };

  const handleSearch = (text: string) => {
    console.log("Received Search:", text);
    setSearchQuery(text);
  };

  const performSearch = async (query: string, pageNum: number) => {
    const requestId = ++latestRequestId.current;

    try {
      const isFirstPage = pageNum === 1;

      setError(null);
      if (isFirstPage) {
        const visibleMatches = items.filter((item) =>
          matchesSearchQuery(item, query),
        );

        setIsSearching(true);
        setItems(visibleMatches);
        setTotalRecords(visibleMatches.length);
      } else setLoadingMore(true);

      const response = await searchItems(query, SEARCH_ITEMS_PER_PAGE, pageNum);

      if (requestId !== latestRequestId.current) return;

      console.log("Search Query:", query);
      console.log("API Response:", response);
      console.log("Items Found:", response.data?.length);

      const itemsData = response.data || [];

      setTotalRecords(response.totalRecords ?? itemsData.length);
      setCurrentPage(pageNum);

      if (isFirstPage) {
        setItems(itemsData);
      } else {
        setItems((prev) => [...prev, ...itemsData]);
      }
    } catch (err) {
      if (requestId !== latestRequestId.current) return;

      const msg = err instanceof Error ? err.message : "Search failed";
      setError(msg);
    } finally {
      if (requestId !== latestRequestId.current) return;

      if (pageNum === 1) setIsSearching(false);
      else setLoadingMore(false);
    }
  };

  const handleEndReachedWithSearch = () => {
    if (loadingMore || items.length >= totalRecords) return;

    if (searchQuery.trim()) {
      performSearch(searchQuery.trim(), currentPage + 1);
    } else {
      fetchItems(currentPage + 1);
    }
  };

  const renderItem = ({ item }: any) => {
    return <ItemCard item={item} />;
  };

  const renderSkeletonItem = ({ item }: { item: number }) => (
    <View style={styles.card}>
      <View style={[styles.skeletonBlock, styles.skeletonImage]} />
      <View style={[styles.skeletonBlock, styles.skeletonCode]} />
      <View style={[styles.skeletonBlock, styles.skeletonName]} />
      <View style={[styles.skeletonBlock, styles.skeletonCategory]} />
      <View style={[styles.skeletonBlock, styles.skeletonPrice]} />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={[styles.container, containerStyle]}>
          {Platform.OS !== "web" && (
            <Header onSearch={handleSearch} onFilterPress={handleFilterPress} />
          )}
          <FlatList
            style={{ marginTop: 8 }}
            data={SKELETON_ITEMS}
            renderItem={renderSkeletonItem}
            keyExtractor={(item) => `item-skeleton-${item}`}
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

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={[styles.container, containerStyle]}>
        {/* Header - Only show on native */}
        {Platform.OS !== "web" && (
          <Header onSearch={handleSearch} onFilterPress={handleFilterPress} />
        )}

        {/* Product Grid */}
        {items.length === 0 && searchQuery.trim() && !isSearching ? (
          <View style={styles.centerContainer}>
            <Ionicons name="search-outline" size={48} color="#ccc" />
            <Text style={styles.loadingText}>No items found</Text>
            <Text style={styles.errorText} numberOfLines={2}>
              Try searching for different keywords
            </Text>
          </View>
        ) : (
          <FlatList
            style={{ marginTop: 8 }}
            data={items}
            renderItem={renderItem}
            keyExtractor={(item, index) =>
              item.id?.toString() || item.itemId?.toString() || index.toString()
            }
            numColumns={2}
            columnWrapperStyle={styles.row}
            showsVerticalScrollIndicator={false}
            onEndReached={handleEndReachedWithSearch}
            onEndReachedThreshold={0.5}
            contentContainerStyle={{
              paddingHorizontal: 10,
              paddingBottom: insets.bottom + 8,
            }}
            ListHeaderComponent={
              isSearching ? (
                <View style={styles.searchLoader}>
                  <ActivityIndicator size="small" />
                </View>
              ) : null
            }
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="small" />
                </View>
              ) : null
            }
          />
        )}
      </View>

      <Modal
        visible={filterVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.filterSheet}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Filters</Text>

              <TouchableOpacity onPress={() => setFilterVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionTitle}>Price Range</Text>

              {["0-100", "100-500", "500-1000", "1000+"].map((item) => (
                <TouchableOpacity
                  key={item}
                  style={styles.optionRow}
                  onPress={() => setSelectedPrice(item)}
                >
                  <Ionicons
                    name={
                      selectedPrice === item
                        ? "radio-button-on"
                        : "radio-button-off"
                    }
                    size={20}
                    color="#0A66C2"
                  />
                  <Text style={styles.optionText}>{item}</Text>
                </TouchableOpacity>
              ))}

              <Text style={styles.sectionTitle}>Category</Text>

              {["Electronics", "Furniture", "Machinery"].map((item) => (
                <TouchableOpacity
                  key={item}
                  style={styles.optionRow}
                  onPress={() => setSelectedCategory(item)}
                >
                  <Ionicons
                    name={
                      selectedCategory === item
                        ? "radio-button-on"
                        : "radio-button-off"
                    }
                    size={20}
                    color="#0A66C2"
                  />
                  <Text style={styles.optionText}>{item}</Text>
                </TouchableOpacity>
              ))}

              <Text style={styles.sectionTitle}>Subcategory</Text>

              {["Mobile", "Laptop", "Table", "Chair"].map((item) => (
                <TouchableOpacity
                  key={item}
                  style={styles.optionRow}
                  onPress={() => setSelectedSubCategory(item)}
                >
                  <Ionicons
                    name={
                      selectedSubCategory === item
                        ? "radio-button-on"
                        : "radio-button-off"
                    }
                    size={20}
                    color="#0A66C2"
                  />
                  <Text style={styles.optionText}>{item}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.filterButtons}>
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => {
                  setSelectedPrice("");
                  setSelectedCategory("");
                  setSelectedSubCategory("");
                }}
              >
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.applyButton}
                onPress={() => {
                  console.log({
                    selectedPrice,
                    selectedCategory,
                    selectedSubCategory,
                  });

                  setFilterVisible(false);
                }}
              >
                <Text style={styles.applyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

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
  },

  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },

  errorText: {
    color: "red",
    fontSize: 16,
    textAlign: "center",
  },

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
  },

  searchLoader: {
    paddingVertical: 12,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },

  filterSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "80%",
  },

  filterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },

  filterTitle: {
    fontSize: 20,
    fontWeight: "700",
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 20,
    marginBottom: 10,
  },

  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },

  optionText: {
    marginLeft: 10,
    fontSize: 15,
  },

  filterButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },

  clearButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingVertical: 12,
    marginRight: 10,
    alignItems: "center",
  },

  applyButton: {
    flex: 1,
    backgroundColor: "#0A66C2",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },

  clearButtonText: {
    fontWeight: "600",
  },

  applyButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
});
