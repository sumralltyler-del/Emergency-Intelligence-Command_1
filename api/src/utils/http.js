import { settings } from '../config.js';

const TEMPORARY_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

export async function fetchJson(url, options = {}) {
  const attempts = options.retries === undefined ? 1 : options.retries;
  let lastError;

  for (let attempt = 0; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs || settings.timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json', ...options.headers },
        signal: controller.signal
      });
      if (!response.ok) {
        const error = new Error(`Upstream returned HTTP ${response.status}`);
        error.status = response.status;
        if (!TEMPORARY_CODES.has(response.status) || attempt === attempts) throw error;
        lastError = error;
      } else {
        return await response.json();
      }
    } catch (error) {
      const normalized = error.name === 'AbortError' ? new Error('Upstream request timed out') : error;
      lastError = normalized;
      const is4xx = normalized.status >= 400 && normalized.status < 500 && !TEMPORARY_CODES.has(normalized.status);
      if (is4xx || attempt === attempts) throw normalized;
    } finally {
      clearTimeout(timer);
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw lastError;
}

