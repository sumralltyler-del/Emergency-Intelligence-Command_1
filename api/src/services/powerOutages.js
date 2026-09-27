import { cache } from '../cache.js';
import { settings } from '../config.js';
import { fetchJson } from '../utils/http.js';

function first(object, names, fallback = null) {
  for (const name of names) if (object?.[name] !== undefined && object[name] !== null && object[name] !== '') return object[name];
  return fallback;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function dateOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function recordsFrom(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.features)) return raw.features;
  if (Array.isArray(raw?.data?.features)) return raw.data.features;
  for (const key of ['outages', 'areas', 'results', 'data']) if (Array.isArray(raw?.[key])) return raw[key];
  throw new Error('Power outage endpoint returned an unsupported response model');
}

function normalize(record, index) {
  const properties = record.properties || record.attributes || record;
  const geometry = record.geometry?.type ? record.geometry : null;
  const customersOut = numberOrNull(first(properties, ['customersOut', 'customers_out', 'CustomersOut', 'out', 'affectedCustomers'], 0));
  const customersTracked = numberOrNull(first(properties, ['customersTracked', 'customers_tracked', 'CustomersTracked', 'totalCustomers', 'served']));
  const reportedPercent = numberOrNull(first(properties, ['percentOut', 'percent_out', 'PercentOut', 'percentageOut']));
  const percentOut = reportedPercent ?? (customersTracked > 0 ? (customersOut / customersTracked) * 100 : null);
  const latitude = numberOrNull(first(properties, ['latitude', 'lat', 'Latitude'], record.geometry?.y));
  const longitude = numberOrNull(first(properties, ['longitude', 'lon', 'lng', 'Longitude'], record.geometry?.x));
  return {
    id: String(first(properties, ['id', 'outageId', 'areaId', 'OBJECTID', 'GlobalID'], `outage-${index}`)),
    name: first(properties, ['name', 'areaName', 'county', 'County', 'location'], 'Reported outage area'),
    utility: first(properties, ['utility', 'utilityName', 'provider', 'company'], 'Utility unavailable'),
    state: first(properties, ['state', 'stateCode', 'State']),
    customersOut: Math.max(0, customersOut || 0),
    customersTracked: customersTracked === null ? null : Math.max(0, customersTracked),
    percentOut: percentOut === null ? null : Math.max(0, Math.min(100, percentOut)),
    updatedAt: dateOrNull(first(properties, ['updatedAt', 'updated_at', 'lastUpdated', 'timestamp', 'ModifiedOnDateTime_dt'])),
    estimatedRestoration: dateOrNull(first(properties, ['estimatedRestoration', 'estimated_restore_time', 'etr'])),
    cause: first(properties, ['cause', 'outageCause']),
    geometry,
    latitude,
    longitude,
    sourceUrl: /^https:\/\//i.test(first(properties, ['sourceUrl', 'url'], '') || '') ? first(properties, ['sourceUrl', 'url']) : null,
    source: 'Licensed power-outage data'
  };
}

export function getPowerOutages(region) {
  if (!settings.powerOutageEnabled || !settings.powerOutageApiUrl) {
    return Promise.resolve({
      data: [],
      health: { status: 'not-configured', lastAttempt: null, lastSuccess: null, stale: false, ageSeconds: null, cacheStatus: 'disabled', error: null },
      metadata: { configured: false, provider: 'PowerOutage.us', licenseRequired: true, coverageClaimed: false }
    });
  }

  return cache.resolve(`powerOutages:${region.id}`, settings.cacheTtl.powerOutages, async () => {
    const [west, south, east, north] = region.bbox;
    const url = new URL(settings.powerOutageApiUrl);
    if (url.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('Power outage API endpoint must use HTTPS');
    url.searchParams.set('region', region.id);
    url.searchParams.set('bbox', `${west},${south},${east},${north}`);
    const headers = {};
    if (settings.powerOutageApiKey) {
      const value = settings.powerOutageAuthScheme ? `${settings.powerOutageAuthScheme} ${settings.powerOutageApiKey}` : settings.powerOutageApiKey;
      headers[settings.powerOutageAuthHeader] = value;
    }
    const raw = await fetchJson(url, { headers });
    return recordsFrom(raw).map(normalize).filter((area) => area.geometry || (Number.isFinite(area.latitude) && Number.isFinite(area.longitude)));
  }).then((result) => ({ ...result, metadata: { configured: true, provider: 'PowerOutage.us', licenseRequired: true, coverageClaimed: true } }));
}
