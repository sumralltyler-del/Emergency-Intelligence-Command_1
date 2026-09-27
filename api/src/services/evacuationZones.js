import { cache } from '../cache.js';
import { evacuationSources, settings } from '../config.js';
import { fetchJson } from '../utils/http.js';

function normalize(feature, source) {
  const properties = feature.properties || {};
  const fields = source.fields || {};
  const rawUpdated = fields.updatedAt ? properties[fields.updatedAt] : null;
  const updated = rawUpdated ? new Date(rawUpdated) : null;
  return {
    id: String(properties[fields.id] ?? properties.OBJECTID ?? crypto.randomUUID()),
    name: properties[fields.name] || 'Evacuation zone',
    status: String(properties[fields.status] || 'UNKNOWN').toUpperCase(),
    updatedAt: updated && !Number.isNaN(updated.getTime()) ? updated.toISOString() : null,
    geometry: feature.geometry,
    source: source.name,
    sourceUrl: source.publicUrl || null
  };
}

async function loadSource(source, region) {
  return cache.resolve(`evacuationZones:${source.id}:${region.id}`, settings.cacheTtl.evacuationZones, async () => {
    const [west, south, east, north] = region.bbox;
    const params = new URLSearchParams({
      f: 'geojson',
      where: source.where || '1=1',
      outFields: '*',
      returnGeometry: 'true',
      inSR: '4326',
      outSR: '4326',
      geometry: `${west},${south},${east},${north}`,
      geometryType: 'esriGeometryEnvelope',
      spatialRel: 'esriSpatialRelIntersects'
    });
    const raw = await fetchJson(`${source.queryUrl}?${params}`);
    if (raw.error) throw new Error(`${source.name}: ${raw.error.message || 'query failed'}`);
    return (raw.features || []).filter((feature) => ['Polygon', 'MultiPolygon'].includes(feature.geometry?.type)).map((feature) => normalize(feature, source));
  });
}

export async function getEvacuationZones(region) {
  const sources = evacuationSources.filter((source) => source.regionIds?.includes(region.id));
  if (sources.length === 0) return { data: [], metadata: { configured: false, status: 'NOT CONFIGURED', sourceCount: 0 } };
  const results = await Promise.all(sources.map((source) => loadSource(source, region)));
  return {
    data: results.flatMap((result) => result.data || []),
    metadata: {
      configured: true,
      status: results.some((result) => result.health.status === 'offline') ? 'DEGRADED' : results.some((result) => result.health.stale) ? 'STALE' : 'LIVE',
      sourceCount: sources.length,
      sources: results.map((result, index) => ({ id: sources[index].id, name: sources[index].name, ...result.health }))
    }
  };
}
