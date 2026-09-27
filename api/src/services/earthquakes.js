import { cache } from '../cache.js';
import { getFacilities, settings } from '../config.js';
import { fetchJson } from '../utils/http.js';
import { haversineMiles, inBbox } from '../utils/geo.js';

const FEED = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';

export function getEarthquakes(region) {
  return cache.resolve(`earthquakes:${region.id}`, settings.cacheTtl.earthquakes, async () => {
    const facilities = getFacilities(region.id);
    const raw = await fetchJson(FEED);
    return (raw.features || []).filter((feature) => {
      const [longitude, latitude] = feature.geometry?.coordinates || [];
      return inBbox(longitude, latitude, region.bbox);
    }).map((feature) => {
      const [longitude, latitude, depthKm] = feature.geometry.coordinates;
      const nearestFacility = facilities.map((facility) => ({ code: facility.code, distanceMiles: haversineMiles(facility.latitude, facility.longitude, latitude, longitude) })).sort((a, b) => a.distanceMiles - b.distanceMiles)[0] || null;
      return {
        id: feature.id,
        magnitude: feature.properties.mag,
        place: feature.properties.place,
        time: new Date(feature.properties.time).toISOString(),
        latitude,
        longitude,
        depthKm,
        url: feature.properties.url,
        significance: feature.properties.sig,
        nearestFacility,
        source: 'USGS'
      };
    });
  });
}
