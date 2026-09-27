import { cache } from '../cache.js';
import { settings } from '../config.js';
import { fetchJson } from '../utils/http.js';
import { inBbox } from '../utils/geo.js';

const WFIGS_URL = 'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Incident_Locations_Current/FeatureServer/0/query';

function value(attributes, names, fallback = null) {
  for (const name of names) if (attributes?.[name] !== undefined && attributes[name] !== null) return attributes[name];
  return fallback;
}

function normalize(feature) {
  const a = feature.attributes || {};
  return {
    id: String(value(a, ['GlobalID', 'IncidentID', 'OBJECTID'], crypto.randomUUID())),
    name: value(a, ['IncidentName', 'IncidentShortDescription'], 'Unnamed wildfire'),
    latitude: Number(feature.geometry?.y ?? value(a, ['InitialLatitude', 'POO_Latitude'])),
    longitude: Number(feature.geometry?.x ?? value(a, ['InitialLongitude', 'POO_Longitude'])),
    acres: numericOrNull(value(a, ['IncidentSize', 'DailyAcres', 'CalculatedAcres'])),
    containmentPercent: numericOrNull(value(a, ['PercentContained'])),
    fireType: value(a, ['IncidentTypeCategory', 'FireCause'], 'WF'),
    updatedAt: epochToIso(value(a, ['ModifiedOnDateTime_dt', 'FireDiscoveryDateTime'])),
    source: 'NIFC WFIGS'
  };
}

function numericOrNull(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const number = Number(raw);
  return Number.isFinite(number) ? number : null;
}

function epochToIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function getFires(region) {
  return cache.resolve(`fires:${region.id}`, settings.cacheTtl.fires, async () => {
    const [west, south, east, north] = region.bbox;
    const params = new URLSearchParams({
      f: 'json', where: '1=1', outFields: '*', returnGeometry: 'true', inSR: '4326', outSR: '4326',
      geometry: `${west},${south},${east},${north}`, geometryType: 'esriGeometryEnvelope',
      spatialRel: 'esriSpatialRelIntersects'
    });
    const raw = await fetchJson(`${WFIGS_URL}?${params}`);
    if (raw.error) throw new Error(`WFIGS: ${raw.error.message || 'query failed'}`);
    return (raw.features || []).map(normalize).filter((fire) => {
      const prescribed = String(fire.fireType).toLowerCase().includes('rx') || String(fire.fireType).toLowerCase().includes('prescribed');
      return Number.isFinite(fire.latitude) && Number.isFinite(fire.longitude) && inBbox(fire.longitude, fire.latitude, region.bbox) && (settings.includePrescribedFires || !prescribed);
    });
  });
}
