const EARTH_RADIUS_MILES = 3958.8;

export function haversineMiles(aLat, aLon, bLat, bLon) {
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function inBbox(longitude, latitude, bbox) {
  const [west, south, east, north] = bbox;
  return longitude >= west && longitude <= east && latitude >= south && latitude <= north;
}

export function pointInGeometry(longitude, latitude, geometry) {
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) return false;
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some((polygon) => ringContains(longitude, latitude, polygon[0]) && !polygon.slice(1).some((hole) => ringContains(longitude, latitude, hole)));
}

export function distanceToGeometryMiles(latitude, longitude, geometry) {
  return geometryProximityMiles(latitude, longitude, geometry).distanceMiles;
}

export function geometryProximityMiles(latitude, longitude, geometry) {
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) return { distanceMiles: Infinity, nearestCoordinate: null };
  if (pointInGeometry(longitude, latitude, geometry)) return { distanceMiles: 0, nearestCoordinate: [longitude, latitude] };
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  let nearest = Infinity;
  let nearestCoordinate = null;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (let index = 1; index < ring.length; index += 1) {
        const candidate = proximityToSegmentMiles(latitude, longitude, ring[index - 1], ring[index]);
        if (candidate.distanceMiles < nearest) {
          nearest = candidate.distanceMiles;
          nearestCoordinate = candidate.nearestCoordinate;
        }
      }
    }
  }
  return { distanceMiles: nearest, nearestCoordinate };
}

function proximityToSegmentMiles(originLat, originLon, start, end) {
  const milesPerLatitudeDegree = 69.0;
  const milesPerLongitudeDegree = 69.172 * Math.cos((originLat * Math.PI) / 180);
  const ax = (start[0] - originLon) * milesPerLongitudeDegree;
  const ay = (start[1] - originLat) * milesPerLatitudeDegree;
  const bx = (end[0] - originLon) * milesPerLongitudeDegree;
  const by = (end[1] - originLat) * milesPerLatitudeDegree;
  const dx = bx - ax;
  const dy = by - ay;
  const denominator = dx * dx + dy * dy;
  const ratio = denominator === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / denominator));
  return {
    distanceMiles: Math.hypot(ax + ratio * dx, ay + ratio * dy),
    nearestCoordinate: [start[0] + ratio * (end[0] - start[0]), start[1] + ratio * (end[1] - start[1])]
  };
}

function ringContains(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
