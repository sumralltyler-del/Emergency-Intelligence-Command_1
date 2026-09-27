import { cache } from '../cache.js';
import { settings } from '../config.js';
import { fetchJson } from '../utils/http.js';
import { inBbox } from '../utils/geo.js';

const WATCH_DUTY_URL = 'https://services5.arcgis.com/VNhSlpl1umSknM3q/arcgis/rest/services/Watch_Duty_Prescribed_Fires/FeatureServer/0/query';

function isoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalize(feature) {
  const attributes = feature.attributes || {};
  const latitude = Number(feature.geometry?.y);
  const longitude = Number(feature.geometry?.x);
  const acreage = Number(attributes.acreage);
  return {
    id: `watch-duty-rx-${attributes.OBJECTID}`,
    name: attributes.name || 'Unnamed prescribed burn',
    latitude,
    longitude,
    acreage: Number.isFinite(acreage) ? acreage : null,
    scheduledStart: isoDate(attributes.prescribed_date_start),
    createdAt: isoDate(attributes.date_created),
    updatedAt: isoDate(attributes.date_modified),
    sourceUrl: /^https:\/\//i.test(attributes.watchduty_url || '') ? attributes.watchduty_url : null,
    category: 'prescribed-burn',
    operationalStatus: 'INFORMATIONAL',
    source: 'Watch Duty Prescribed Burn Aggregation Service'
  };
}

export function getPrescribedBurns(region) {
  if (!settings.watchDutyPrescribedBurnsEnabled) {
    return Promise.resolve({
      data: [],
      health: { status: 'offline', lastAttempt: null, lastSuccess: null, stale: false, ageSeconds: null, cacheStatus: 'disabled', error: 'Source disabled by configuration' }
    });
  }

  return cache.resolve(`prescribedBurns:${region.id}`, settings.cacheTtl.prescribedBurns, async () => {
    const [west, south, east, north] = region.bbox;
    const params = new URLSearchParams({
      f: 'json',
      where: '1=1',
      outFields: 'OBJECTID,name,prescribed_date_start,watchduty_url,acreage,date_created,date_modified',
      returnGeometry: 'true',
      inSR: '4326',
      outSR: '4326',
      geometry: `${west},${south},${east},${north}`,
      geometryType: 'esriGeometryEnvelope',
      spatialRel: 'esriSpatialRelIntersects'
    });
    const raw = await fetchJson(`${WATCH_DUTY_URL}?${params}`);
    if (raw.error) throw new Error(`Watch Duty prescribed-burn service: ${raw.error.message || 'query failed'}`);
    return (raw.features || [])
      .map(normalize)
      .filter((burn) => Number.isFinite(burn.latitude) && Number.isFinite(burn.longitude) && inBbox(burn.longitude, burn.latitude, region.bbox));
  });
}
