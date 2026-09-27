import fs from 'node:fs';
import path from 'node:path';

const configDir = process.env.CONFIG_DIR || path.resolve(process.cwd(), '../config');

function readJson(name) {
  const file = path.join(configDir, name);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export const settings = Object.freeze({
  version: process.env.APP_VERSION || '2.3.0',
  port: Number(process.env.API_PORT || 3000),
  timeoutMs: Number(process.env.REQUEST_TIMEOUT_MS || 10000),
  nwsUserAgent: process.env.NWS_USER_AGENT || 'EmergencyIntelligencePrototype/2.0 example@example.com',
  includePrescribedFires: String(process.env.INCLUDE_PRESCRIBED_FIRES).toLowerCase() === 'true',
  watchDutyPrescribedBurnsEnabled: String(process.env.WATCH_DUTY_PRESCRIBED_BURNS_ENABLED ?? 'true').toLowerCase() === 'true',
  radioIntelligenceEnabled: String(process.env.RADIO_INTELLIGENCE_ENABLED ?? 'false').toLowerCase() === 'true',
  radioIntelligenceUrl: process.env.RADIO_INTELLIGENCE_URL || '',
  radioIntelligenceToken: process.env.RADIO_INTELLIGENCE_TOKEN || '',
  powerOutageEnabled: String(process.env.POWEROUTAGE_ENABLED ?? 'false').toLowerCase() === 'true',
  powerOutageApiUrl: process.env.POWEROUTAGE_API_URL || '',
  powerOutageApiKey: process.env.POWEROUTAGE_API_KEY || '',
  powerOutageAuthHeader: process.env.POWEROUTAGE_AUTH_HEADER || 'Authorization',
  powerOutageAuthScheme: process.env.POWEROUTAGE_AUTH_SCHEME ?? 'Bearer',
  cacheTtl: {
    weather: 5 * 60_000,
    forecast: 15 * 60_000,
    alerts: 60_000,
    radar: 5 * 60_000,
    fires: 5 * 60_000,
    firePerimeters: 5 * 60_000,
    evacuationZones: 60_000,
    earthquakes: 5 * 60_000,
    prescribedBurns: 30 * 60_000,
    radioIntelligence: 30_000,
    powerOutages: 10 * 60_000
  }
});

export const regions = Object.freeze(readJson('regions.json'));
export const facilities = Object.freeze(readJson('facilities.json'));
export const scoring = Object.freeze(readJson('scoring.json'));
export const evacuationSources = Object.freeze(readJson('evacuation-sources.json').sources || []);

function validateConfiguration() {
  const errors = [];
  const codes = new Set();
  for (const facility of facilities) {
    if (codes.has(facility.code)) errors.push(`Duplicate synthetic facility code: ${facility.code}`);
    codes.add(facility.code);
    if (!regions.some((region) => region.id === facility.regionId)) errors.push(`Unknown region ${facility.regionId} for ${facility.code}`);
    const region = regions.find((item) => item.id === facility.regionId);
    if (region) {
      const [west, south, east, north] = region.bbox;
      if (facility.longitude < west || facility.longitude > east || facility.latitude < south || facility.latitude > north) errors.push(`Facility ${facility.code} falls outside ${region.id} bounds`);
    }
  }
  for (const region of regions) {
    if (!Array.isArray(region.bounds) || region.bounds.length !== 2) errors.push(`Invalid bounds for region ${region.id}`);
    const expected = new Set(region.facilityIds || []);
    const actual = facilities.filter((facility) => facility.regionId === region.id).map((facility) => facility.code);
    for (const code of actual) if (!expected.has(code)) errors.push(`Region ${region.id} is missing facilityIds entry ${code}`);
  }
  for (const source of evacuationSources) {
    if (!source.id || !source.name || !source.queryUrl) errors.push('Every evacuation source requires id, name, and queryUrl');
    if (source.queryUrl && !source.queryUrl.startsWith('https://')) errors.push(`Evacuation source ${source.id || 'unknown'} must use HTTPS`);
    for (const regionId of source.regionIds || []) if (!regions.some((region) => region.id === regionId)) errors.push(`Evacuation source ${source.id} references unknown region ${regionId}`);
  }
  return Object.freeze({ ok: errors.length === 0, errors });
}

export const configValidation = validateConfiguration();

export function getRegion(id) {
  return regions.find((region) => region.id === id);
}

export function getFacilities(regionId) {
  return facilities.filter((facility) => facility.regionId === regionId);
}
