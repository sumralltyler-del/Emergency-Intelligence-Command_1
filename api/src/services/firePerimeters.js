import { cache } from '../cache.js';
import { settings } from '../config.js';
import { fetchJson } from '../utils/http.js';

const WFIGS_PERIMETERS_URL = 'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query';

function first(properties, names, fallback = null) {
  for (const name of names) if (properties?.[name] !== undefined && properties[name] !== null && properties[name] !== '') return properties[name];
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

function normalize(feature) {
  const properties = feature.properties || {};
  const globalId = first(properties, ['GlobalID', 'poly_IRWINID', 'attr_IRWINID', 'OBJECTID']);
  return {
    id: String(globalId || crypto.randomUUID()),
    irwinId: first(properties, ['poly_IRWINID', 'attr_IRWINID']),
    name: first(properties, ['poly_IncidentName', 'attr_IncidentName'], 'Unnamed wildfire perimeter'),
    acres: numberOrNull(first(properties, ['poly_GISAcres', 'poly_Acres_AutoCalc', 'attr_IncidentSize'])),
    containmentPercent: numberOrNull(first(properties, ['attr_PercentContained'])),
    incidentType: first(properties, ['attr_IncidentTypeCategory'], 'WF'),
    updatedAt: dateOrNull(first(properties, ['poly_DateCurrent', 'poly_PolygonDateTime', 'attr_ModifiedOnDateTime_dt'])),
    geometry: feature.geometry,
    source: 'NIFC WFIGS Current Interagency Fire Perimeters'
  };
}

export function getFirePerimeters(region) {
  return cache.resolve(`firePerimeters:${region.id}`, settings.cacheTtl.firePerimeters, async () => {
    const [west, south, east, north] = region.bbox;
    const params = new URLSearchParams({
      f: 'geojson',
      where: settings.includePrescribedFires ? '1=1' : "attr_IncidentTypeCategory = 'WF'",
      outFields: 'OBJECTID,GlobalID,poly_IRWINID,poly_IncidentName,poly_GISAcres,poly_Acres_AutoCalc,poly_DateCurrent,poly_PolygonDateTime,attr_IncidentName,attr_IncidentTypeCategory,attr_PercentContained',
      returnGeometry: 'true',
      inSR: '4326',
      outSR: '4326',
      geometry: `${west},${south},${east},${north}`,
      geometryType: 'esriGeometryEnvelope',
      spatialRel: 'esriSpatialRelIntersects'
    });
    const raw = await fetchJson(`${WFIGS_PERIMETERS_URL}?${params}`);
    if (raw.error) throw new Error(`WFIGS perimeters: ${raw.error.message || 'query failed'}`);
    return (raw.features || [])
      .filter((feature) => feature.geometry && ['Polygon', 'MultiPolygon'].includes(feature.geometry.type))
      .map(normalize);
  });
}
