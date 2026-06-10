import axios from "axios";

export interface ItemCatalogItem {
  id?: string | number;
  itemId?: string | number;
  identity?: {
    itemName?: string | null;
    itemCode?: string | number | null;
    brandName?: string | null;
    vendorName?: string | null;
    departmentName?: string | null;
  };
  categoryTax?: {
    primaryCategoryName?: string | null;
    secondaryCategoryName?: string | null;
  };
  image?: {
    imageURL?: string | null;
    imagePath?: string | null;
  };
  pricing?: {
    sellingPrice?: number | null;
  };
  statusControl?: {
    isActive?: boolean;
    isDeleted?: boolean;
    isDeal?: boolean;
    isCashAndCarry?: boolean;
    itemLimit?: boolean;
    maxQuantityLimit?: number | null;
  };
  [key: string]: unknown;
}

export interface ItemFilters {
  category: string;
  subCategories: string[];
}

export interface FilterCategory {
  name: string;
  imageUrl: string | null;
  subCategories: string[];
}

export interface PaginatedItems {
  data: ItemCatalogItem[];
  totalRecords: number;
}

interface ApiCatalogResponse {
  data?: ItemCatalogItem[];
  Paging?: string;
}

const API_BASE_URL = "http://45.77.221.159:49";
const HIDDEN_ITEM_CODES = new Set(["201838"]);
const CATALOG_FETCH_PAGE_SIZE = 1000;
const MAX_CATALOG_FETCH_PAGES = 9;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Forwarded-For": "45.77.221.159",
  },
});

export const emptyFilters: ItemFilters = {
  category: "",
  subCategories: [],
};

export const isVisibleItem = (item: ItemCatalogItem) =>
  item.statusControl?.isActive === true &&
  item.statusControl?.isDeleted === false &&
  !HIDDEN_ITEM_CODES.has(String(item.identity?.itemCode ?? "").trim());

export const normalizeFilterValue = (value: unknown) =>
  String(value || "").trim();

export const getItemSearchText = (item: ItemCatalogItem) =>
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

export const matchesSearch = (item: ItemCatalogItem, searchQuery: string) => {
  const query = searchQuery.trim().toLowerCase();

  if (!query) return true;

  return getItemSearchText(item).includes(query);
};

export const matchesFilters = (
  item: ItemCatalogItem,
  filters: ItemFilters = emptyFilters,
) => {
  const subCategories = Array.isArray(filters.subCategories)
    ? filters.subCategories.map(normalizeFilterValue).filter(Boolean)
    : [];

  // Filter by sub-category only (supports selections across multiple categories)
  if (
    subCategories.length &&
    !subCategories.includes(
      normalizeFilterValue(item.categoryTax?.secondaryCategoryName),
    )
  ) {
    return false;
  }

  return true;
};

export const filterItems = (
  items: ItemCatalogItem[],
  searchQuery = "",
  filters: ItemFilters = emptyFilters,
) =>
  items.filter(
    (item) => matchesSearch(item, searchQuery) && matchesFilters(item, filters),
  );

export const paginateItems = (
  items: ItemCatalogItem[],
  pageSize: number,
  pageNumber: number,
): PaginatedItems => {
  const start = (pageNumber - 1) * pageSize;

  return {
    data: items.slice(start, start + pageSize),
    totalRecords: items.length,
  };
};

export const getItemImageUrl = (item: ItemCatalogItem) => {
  if (item.image?.imageURL) return item.image.imageURL;

  if (item.image?.imagePath) {
    return item.image.imagePath.startsWith("http")
      ? item.image.imagePath
      : `${API_BASE_URL}${item.image.imagePath}`;
  }

  return null;
};

export const getCategoryFiltersFromItems = (
  items: ItemCatalogItem[],
): FilterCategory[] => {
  const categoryMap = new Map<
    string,
    { name: string; imageUrl: string | null; subCategories: Set<string> }
  >();

  items.forEach((item) => {
    const categoryName = normalizeFilterValue(
      item.categoryTax?.primaryCategoryName,
    );
    const subCategoryName = normalizeFilterValue(
      item.categoryTax?.secondaryCategoryName,
    );

    if (!categoryName) return;

    if (!categoryMap.has(categoryName)) {
      categoryMap.set(categoryName, {
        name: categoryName,
        imageUrl: getItemImageUrl(item),
        subCategories: new Set(),
      });
    }

    const category = categoryMap.get(categoryName);

    if (!category) return;

    if (!category.imageUrl) {
      category.imageUrl = getItemImageUrl(item);
    }

    if (subCategoryName) {
      category.subCategories.add(subCategoryName);
    }
  });

  return Array.from(categoryMap.values())
    .map((category) => ({
      ...category,
      subCategories: Array.from(category.subCategories).sort((a, b) =>
        a.localeCompare(b),
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

const getTotalPages = (paging?: string) => {
  if (!paging) return 1;

  try {
    const parsed = JSON.parse(paging);

    return parsed.TotalPages || 1;
  } catch {
    const match = paging.match(/TotalPages:(\d+)/);

    return match ? parseInt(match[1], 10) : 1;
  }
};

/** Converts a timestamp (ms) or Date to YYYY-MM-DD string. */
export const toDateString = (date: Date | number): string => {
  const d = typeof date === "number" ? new Date(date) : date;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

/**
 * Fetches one page from the catalog API.
 *
 * @param updateDate - When provided, the API returns only items changed on/after
 *                     this date. When omitted entirely, the API returns all items
 *                     (full catalog). We use `...(spread)` to omit the key rather
 *                     than sending `updateDate: undefined`, which some APIs treat
 *                     differently from "key not present".
 */
const fetchCatalogPage = (pageNumber: number, updateDate?: string) =>
  api.post<ApiCatalogResponse>("/api/ShopifyItem/Item/external/get", {
    pageNumber,
    pageSize: CATALOG_FETCH_PAGE_SIZE,
    ...(updateDate !== undefined ? { updateDate } : {}),
  });

/**
 * Full catalog fetch — NO `updateDate` sent to the API.
 * The API returns every item; we filter to only visible ones.
 * Use this on first load or when the user forces a full refresh.
 */
export const fetchAllItemsFromApi = async (): Promise<ItemCatalogItem[]> => {
  const firstResponse = await fetchCatalogPage(1);
  const totalPages = Math.min(
    getTotalPages(firstResponse.data.Paging),
    MAX_CATALOG_FETCH_PAGES,
  );
  const remainingResponses = await Promise.all(
    Array.from({ length: Math.max(totalPages - 1, 0) }, (_, index) =>
      fetchCatalogPage(index + 2),
    ),
  );

  return [
    ...(firstResponse.data.data || []),
    ...remainingResponses.flatMap((response) => response.data.data || []),
  ].filter(isVisibleItem);
};

/**
 * Incremental fetch — sends `updateDate` so the API returns ONLY items
 * changed since that date (price changes, new items, deletions, etc.).
 *
 * NOTE: Does NOT filter by isVisibleItem here — the caller (syncService)
 * needs the raw list including deleted/inactive items so it can remove
 * them from the local cache correctly.
 *
 * @param lastSyncAt - Unix timestamp (ms) of the last successful sync.
 */
export const fetchIncrementalItemsFromApi = async (
  lastSyncAt: number,
): Promise<ItemCatalogItem[]> => {
  const updateDate = toDateString(lastSyncAt);

  const firstResponse = await fetchCatalogPage(1, updateDate);
  const totalPages = Math.min(
    getTotalPages(firstResponse.data.Paging),
    MAX_CATALOG_FETCH_PAGES,
  );
  const remainingResponses = await Promise.all(
    Array.from({ length: Math.max(totalPages - 1, 0) }, (_, index) =>
      fetchCatalogPage(index + 2, updateDate),
    ),
  );

  return [
    ...(firstResponse.data.data || []),
    ...remainingResponses.flatMap((response) => response.data.data || []),
  ];
};
