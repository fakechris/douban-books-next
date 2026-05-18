/* global window */

const normalizeApiBook = (book) => {
  const tags = (book.tags || []).map((tag) => ({
    id: tag.id || tag.name,
    name: tag.name,
    type: tag.type || "manual",
    c: tag.c || tag.color || "blue",
    src: tag.source,
  }));
  const markMap = {
    price_watch: "watch",
    purchase_watch: "purchase",
    priority_reading: "priority",
    metadata_incomplete: "bad",
    match_needs_review: "bad",
  };
  const marks = (book.marks || []).map((mark) => markMap[mark] || mark);
  const offers = book.offers || [];
  const lowestOffer = offers
    .filter((offer) => offer.salePrice != null)
    .sort((a, b) => Number(a.salePrice) - Number(b.salePrice))[0];
  return {
    ...book,
    author: book.author || book.authorText || "",
    translator: book.translator || "",
    publisher: book.publisher || "",
    coverUrl: book.coverUrl,
    cover: book.cover ?? 0,
    price: Number(book.price || 0),
    paid: Boolean(book.paid),
    payType: book.payType,
    soldout: Boolean(book.soldout),
    weReadRating: Number(book.weReadRating || 0),
    doubanRating: Number(book.doubanRating || 0),
    ratingCount: Number(book.ratingCount || 0),
    progress: Number(book.progress || 0),
    readState: book.readState || "unread",
    readUpdate: book.readUpdate || "—",
    shelfUpdate: book.shelfUpdate || "—",
    platforms: book.platforms || { w: true, d: Boolean(book.douban), j: false, z: false },
    tags,
    marks,
    markDetails: book.markDetails || [],
    offers,
    lowestOffer,
    collections: book.collections || [],
    qualityFlags: book.qualityFlags || [],
    conflicts: (book.qualityFlags || []).filter((flag) => flag.includes("conflict")),
  };
};

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || body.error || `HTTP ${response.status}`);
  }
  return response.json();
}

window.Api = {
  async shelf({ q = "", sort = "readUpdateTime", direction = "desc", limit = 200, ...filters } = {}) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("sort", sort);
    params.set("direction", direction);
    params.set("limit", String(limit));
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
    });
    const data = await request(`/api/shelf?${params.toString()}`);
    return {
      ...data,
      items: (data.items || []).map(normalizeApiBook),
    };
  },
  async detail(id) {
    const data = await request(`/api/shelf/${encodeURIComponent(id)}`);
    return normalizeApiBook(data);
  },
  async tags() {
    return request("/api/tags");
  },
  async addTags(bookIds, names) {
    return request("/api/items/tags", {
      method: "PATCH",
      body: JSON.stringify({ bookIds, add: names }),
    });
  },
  async addMark(bookIds, markType, note) {
    return request("/api/items/marks", {
      method: "PATCH",
      body: JSON.stringify({ bookIds, markType, note }),
    });
  },
  async saveView(name, definition) {
    return request("/api/saved-views", {
      method: "POST",
      body: JSON.stringify({ name, definition }),
    });
  },
  async collections() {
    return request("/api/collections");
  },
  async notes(q = "") {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    return request(`/api/notes?${params.toString()}`);
  },
  async quality(limit = 100) {
    const data = await request(`/api/quality?limit=${limit}`);
    return { ...data, items: (data.items || []).map(normalizeApiBook) };
  },
  async syncRuns() {
    return request("/api/sync-runs");
  },
};
