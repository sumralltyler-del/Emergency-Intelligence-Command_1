class ResilientCache {
  constructor() {
    this.entries = new Map();
    this.inFlight = new Map();
    this.attempts = new Map();
  }

  get(key) {
    return this.entries.get(key);
  }

  async resolve(key, ttlMs, loader) {
    const now = Date.now();
    const cached = this.entries.get(key);
    if (cached && now - cached.fetchedAt < ttlMs) {
      return this.envelope(key, cached, 'live', false, null, 'hit');
    }

    if (this.inFlight.has(key)) return this.inFlight.get(key);

    const pending = this.refresh(key, cached, loader);
    this.inFlight.set(key, pending);
    try { return await pending; } finally { this.inFlight.delete(key); }
  }

  async refresh(key, cached, loader) {
    const lastAttempt = new Date().toISOString();
    this.attempts.set(key, { lastAttempt, error: null });

    try {
      const data = await loader();
      const entry = { data, fetchedAt: Date.now(), lastAttempt, error: null };
      this.entries.set(key, entry);
      return this.envelope(key, entry, 'live', false, null, cached ? 'refresh' : 'miss');
    } catch (error) {
      this.attempts.set(key, { lastAttempt, error: error.message });
      if (cached) {
        cached.error = error.message;
        cached.lastAttempt = lastAttempt;
        return this.envelope(key, cached, 'stale', true, error.message, 'fallback');
      }
      return {
        data: null,
        health: {
          status: 'offline',
          lastAttempt,
          lastSuccess: null,
          stale: false,
          ageSeconds: null,
          cacheStatus: 'miss',
          error: error.message
        }
      };
    }
  }

  envelope(key, entry, status, stale, error = null, cacheStatus = 'hit') {
    return {
      data: entry.data,
      health: {
        status,
        lastAttempt: entry.lastAttempt || this.attempts.get(key)?.lastAttempt || new Date(entry.fetchedAt).toISOString(),
        lastSuccess: new Date(entry.fetchedAt).toISOString(),
        stale,
        ageSeconds: Math.max(0, Math.floor((Date.now() - entry.fetchedAt) / 1000)),
        cacheStatus,
        error
      }
    };
  }

  snapshot() {
    return {
      entries: this.entries.size,
      inFlight: this.inFlight.size,
      sources: [...new Set([...this.entries.keys(), ...this.attempts.keys()].map((key) => key.split(':')[0]))].reduce((result, source) => {
        const keys = [...new Set([...this.entries.keys(), ...this.attempts.keys()])].filter((key) => key.startsWith(`${source}:`) || key === source);
        const newest = keys.map((key) => this.entries.get(key)).filter(Boolean).sort((a, b) => b.fetchedAt - a.fetchedAt)[0];
        const latestAttempt = keys.map((key) => this.attempts.get(key)).filter(Boolean).sort((a, b) => String(b.lastAttempt).localeCompare(String(a.lastAttempt)))[0];
        result[source] = {
          status: newest ? (latestAttempt?.error ? 'degraded' : 'live') : latestAttempt?.error ? 'offline' : 'loading',
          lastAttempt: latestAttempt?.lastAttempt || null,
          lastSuccess: newest ? new Date(newest.fetchedAt).toISOString() : null,
          lastError: latestAttempt?.error || null
        };
        return result;
      }, {})
    };
  }
}

export const cache = new ResilientCache();
