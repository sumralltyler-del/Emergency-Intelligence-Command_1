import { cache } from '../cache.js';
import { getFacilities, settings } from '../config.js';
import { fetchJson } from '../utils/http.js';

function normalize(feature) {
  const properties = feature.properties || {};
  return {
    id: feature.id || properties.id,
    event: properties.event || 'Weather Alert',
    severity: properties.severity || 'Unknown',
    certainty: properties.certainty || 'Unknown',
    urgency: properties.urgency || 'Unknown',
    headline: properties.headline || properties.event || 'Weather alert',
    description: properties.description || '',
    instruction: properties.instruction || '',
    effectiveAt: properties.effective || properties.onset || null,
    expiresAt: properties.expires || properties.ends || null,
    areaDescription: properties.areaDesc || '',
    geometry: feature.geometry || null,
    sourceUrl: properties['@id'] || feature.id || null,
    source: 'National Weather Service',
    label: 'OFFICIAL NWS ALERT'
  };
}

export function getAlerts(region) {
  return cache.resolve(`alerts:${region.id}`, settings.cacheTtl.alerts, async () => {
    const facilities = getFacilities(region.id);
    const points = [
      ...(region.samplingPoints || []).map(({ latitude, longitude }) => [latitude, longitude]),
      ...facilities.map(({ latitude, longitude }) => [latitude, longitude])
    ];
    const uniquePoints = [...new Map(points.map((point) => [point.map((value) => value.toFixed(3)).join(','), point])).values()];
    const responses = await Promise.all(uniquePoints.map(([latitude, longitude]) => fetchJson(
      `https://api.weather.gov/alerts/active?point=${latitude},${longitude}`,
      { headers: { 'User-Agent': settings.nwsUserAgent } }
    )));
    const alerts = responses.flatMap((raw) => raw.features || []).map(normalize);
    return [...new Map(alerts.map((alert) => [alert.id, alert])).values()];
  });
}
