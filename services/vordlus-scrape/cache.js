// In-memory LRU cache with TTL. Bounded size; evicts least-recently-used
// entries first. Thread-safe is not a concern — Node single-threaded.

class LruTtl {
  constructor({ max, ttlMs }) {
    this.max = max;
    this.ttlMs = ttlMs;
    this.map = new Map(); // key -> { value, expiresAt }
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    // Refresh recency for LRU
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key, value) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    // Evict oldest
    while (this.map.size > this.max) {
      const firstKey = this.map.keys().next().value;
      if (firstKey === undefined) break;
      this.map.delete(firstKey);
    }
  }

  size() {
    return this.map.size;
  }
}

module.exports = { LruTtl };
