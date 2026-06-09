import axios from "axios";

const api = axios.create({
  baseURL: "http://45.77.221.159:49",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Forwarded-For": "45.77.221.159",
  },
});

const HIDDEN_ITEM_CODES = new Set(["201838"]);
const SEARCH_FETCH_PAGE_SIZE = 1000;
const MAX_SEARCH_FETCH_PAGES = 20;
let searchCatalogPromise = null;

const isVisibleItem = (item) =>
  item.statusControl?.isActive === true &&
  item.statusControl?.isDeleted === false &&
  !HIDDEN_ITEM_CODES.has(String(item.identity?.itemCode ?? "").trim());

const getSearchText = (item) =>
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

const matchesSearch = (item, searchQuery) => {
  const query = searchQuery.trim().toLowerCase();

  if (!query) return true;

  return getSearchText(item).includes(query);
};

const getTotalPages = (paging) => {
  if (!paging) return 1;

  try {
    const parsed = JSON.parse(paging);

    return parsed.TotalPages || 1;
  } catch {
    const match = paging.match(/TotalPages:(\d+)/);

    return match ? parseInt(match[1], 10) : 1;
  }
};

const fetchCatalogPage = (pageNumber) =>
  api.post("/api/ShopifyItem/Item/external/get", {
    pageNumber,
    pageSize: SEARCH_FETCH_PAGE_SIZE,
  });

const getSearchCatalog = async () => {
  if (!searchCatalogPromise) {
    searchCatalogPromise = (async () => {
      const firstResponse = await fetchCatalogPage(1);
      const totalPages = Math.min(
        getTotalPages(firstResponse.data.Paging),
        MAX_SEARCH_FETCH_PAGES,
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
    })().catch((error) => {
      searchCatalogPromise = null;
      throw error;
    });
  }

  return searchCatalogPromise;
};

export const warmSearchCatalog = () => {
  getSearchCatalog().catch((error) => {
    console.log("Search catalog warmup failed:", error.message);
  });
};

export const getItems = async (pageSize = 100, pageNumber = 1) => {
  try {
    const response = await api.post("/api/ShopifyItem/Item/external/get", {
      pageNumber,
      pageSize,
    });

    const filteredResponse = {
      ...response.data,
      data: (response.data.data || []).filter(isVisibleItem),
    };

    return filteredResponse;
  } catch (error) {
    console.log("Status:", error.response?.status);
    console.log("Response:", error.response?.data);
    throw error;
  }
};

export const searchItems = async (
  searchQuery = "",
  pageSize = 100,
  pageNumber = 1,
) => {
  try {
    const query = searchQuery.trim();
    const catalog = await getSearchCatalog();
    const filteredItems = catalog.filter((item) => matchesSearch(item, query));
    const start = (pageNumber - 1) * pageSize;

    return {
      data: filteredItems.slice(start, start + pageSize),
      totalRecords: filteredItems.length,
    };
  } catch (error) {
    console.log("Status:", error.response?.status);
    console.log("Response:", error.response?.data);
    throw error;
  }
};

/* export const getItems = async (pageSize = 100, pageNumber = 1) => {
  try {
    const response = await api.post("/api/ShopifyItem/Item/external/get", {
      pageNumber,
      pageSize,
    });

    return response.data;
  } catch (error) {
    console.log("Status:", error.response?.status);
    console.log("Response:", error.response?.data);
    throw error;
  }
}; */
