import { cache } from '../cache.js';
import { settings } from '../config.js';
import { fetchJson } from '../utils/http.js';

const DISCLAIMER = 'UNVERIFIED RADIO INTELLIGENCE — REQUIRES CORROBORATION';

function normalize(item, index) {
  const confidence = Number(item.confidence);
  return {
    id: String(item.id || item.transcriptId || `radio-${index}`),
    regionId: item.regionId || null,
    feedName: item.feedName || item.feed?.name || 'Authorized radio feed',
    transcript: String(item.transcript || item.text || '').trim(),
    occurredAt: item.occurredAt || item.timestamp || item.createdAt || null,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : null,
    tags: Array.isArray(item.tags) ? item.tags.map(String).slice(0, 8) : [],
    latitude: Number.isFinite(Number(item.latitude)) ? Number(item.latitude) : null,
    longitude: Number.isFinite(Number(item.longitude)) ? Number(item.longitude) : null,
    sourceUrl: /^https:\/\//i.test(item.sourceUrl || '') ? item.sourceUrl : null,
    verified: false
  };
}

export function getRadioIntelligence(region) {
  if (!settings.radioIntelligenceEnabled || !settings.radioIntelligenceUrl) {
    return Promise.resolve({
      data: [],
      health: { status: 'not-configured', lastAttempt: null, lastSuccess: null, stale: false, ageSeconds: null, cacheStatus: 'disabled', error: null },
      metadata: { enabled: false, affectsThreatScore: false, disclaimer: DISCLAIMER }
    });
  }

  return cache.resolve(`radioIntelligence:${region.id}`, settings.cacheTtl.radioIntelligence, async () => {
    const url = new URL(settings.radioIntelligenceUrl);
    url.searchParams.set('region', region.id);
    const headers = settings.radioIntelligenceToken ? { Authorization: `Bearer ${settings.radioIntelligenceToken}` } : {};
    const raw = await fetchJson(url, { headers });
    const records = Array.isArray(raw) ? raw : raw.transcripts || raw.data || [];
    if (!Array.isArray(records)) throw new Error('Radio intelligence endpoint returned an invalid response');
    return records.map(normalize).filter((item) => item.transcript).slice(0, 25);
  }).then((result) => ({ ...result, metadata: { enabled: true, affectsThreatScore: false, disclaimer: DISCLAIMER } }));
}
