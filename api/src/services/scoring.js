import { scoring } from '../config.js';
import { distanceToGeometryMiles, geometryProximityMiles, haversineMiles, pointInGeometry } from '../utils/geo.js';

const severityPoints = scoring.components.nwsAlerts.severity;

export function buildIntelligence(weather, alerts, fires, firePerimeters, powerOutages, earthquakes, facilities, feedHealth) {
  const forecast = weather?.forecast || [];
  const current = weather?.current || {};
  const maxPrecip = Math.max(0, ...forecast.map((hour) => hour.precipitationProbability || 0));
  const maxGust = Math.max(current.windGustMph || 0, ...forecast.map((hour) => hour.windGustMph || 0));
  const scoredFacilities = facilities.map((facility) => scoreFacility(facility, current, maxGust, alerts, fires, firePerimeters, powerOutages, earthquakes, feedHealth));
  const relevantFires = relevantFireSummary(scoredFacilities, fires);
  const perimeterAnalysis = analyzeFirePerimeters(firePerimeters, scoredFacilities);
  const relevantQuake = strongestRelevantQuake(scoredFacilities);
  const outageAnalysis = analyzePowerOutages(powerOutages, scoredFacilities);
  const components = {
    weather: Math.min(scoring.components.weather.maximum, Math.round(maxPrecip * scoring.components.weather.precipitationFactor + (isStormCode(current.weatherCode) ? scoring.components.weather.stormBonus : 0))),
    nwsAlerts: Math.min(scoring.components.nwsAlerts.maximum, Math.max(0, ...alerts.map((alert) => severityPoints[alert.severity] || severityPoints.Unknown))),
    wildfire: fireScore(Math.min(relevantFires.nearest?.distanceMiles ?? Infinity, perimeterAnalysis.summary.nearest?.distanceMiles ?? Infinity)),
    wind: windScore(maxGust),
    earthquake: quakeScore(relevantQuake),
    powerOutage: Math.max(0, ...scoredFacilities.map((facility) => facility.scoreBreakdown.powerOutage || 0)),
    facilityExposure: Math.min(scoring.components.facilityExposure.maximum, scoredFacilities.filter((facility) => facility.riskScore >= 40).length * scoring.components.facilityExposure.pointsPerElevatedFacility)
  };
  const total = Math.min(scoring.maximumScore, Object.values(components).reduce((sum, value) => sum + value, 0));
  return {
    threat: { score: total, level: levelFor(total), components, primary: dominantHazard(components, alerts, relevantFires.nearest, relevantQuake, outageAnalysis.summary, maxGust, maxPrecip) },
    facilities: scoredFacilities.sort((a, b) => b.riskScore - a.riskScore),
    wildfireSummary: relevantFires,
    firePerimeters: perimeterAnalysis.perimeters,
    perimeterSummary: perimeterAnalysis.summary,
    powerOutages: outageAnalysis.areas,
    powerOutageSummary: outageAnalysis.summary,
    alertSummary: {
      uniqueRegionalAlerts: alerts.length,
      facilitiesInsidePolygons: scoredFacilities.filter((facility) => facility.exposure.insideNwsPolygon).length,
      facilitiesWithAlertMatches: scoredFacilities.filter((facility) => facility.exposure.activeAlerts.length > 0).length,
      nextExpiration: alerts.map((alert) => alert.expiresAt).filter(Boolean).sort()[0] || null
    }
  };
}

function scoreFacility(facility, current, maxGust, alerts, fires, firePerimeters, powerOutages, earthquakes, feedHealth) {
  const relevantFires = fires.map((fire) => ({ ...fire, distanceMiles: haversineMiles(facility.latitude, facility.longitude, fire.latitude, fire.longitude) })).filter((fire) => fire.distanceMiles <= 50).sort((a, b) => a.distanceMiles - b.distanceMiles);
  const relevantPerimeters = firePerimeters.map((perimeter) => ({ ...perimeter, distanceMiles: distanceToGeometryMiles(facility.latitude, facility.longitude, perimeter.geometry) })).filter((perimeter) => perimeter.distanceMiles <= 50).sort((a, b) => a.distanceMiles - b.distanceMiles);
  const activeAlerts = alerts.filter((alert) => pointInGeometry(facility.longitude, facility.latitude, alert.geometry));
  const matchedOutageAreas = powerOutages.filter((area) => area.geometry && pointInGeometry(facility.longitude, facility.latitude, area.geometry)).sort((a, b) => outageScore(b) - outageScore(a));
  const outageAreas = matchedOutageAreas.map(({ geometry, ...area }) => area);
  const nearestQuake = earthquakes.map((item) => ({ ...item, distanceMiles: haversineMiles(facility.latitude, facility.longitude, item.latitude, item.longitude) })).filter(isRelevantQuake).sort((a, b) => a.distanceMiles - b.distanceMiles)[0] || null;
  const unavailable = ['weather', 'alerts', 'fires', 'firePerimeters', 'earthquakes'].filter((key) => feedHealth[key]?.status === 'offline').length;
  const nearestWildfireDistance = Math.min(relevantFires[0]?.distanceMiles ?? Infinity, relevantPerimeters[0]?.distanceMiles ?? Infinity);
  const breakdown = {
    nwsAlerts: Math.min(25, Math.max(0, ...activeAlerts.map((alert) => severityPoints[alert.severity] || severityPoints.Unknown))),
    weather: isStormCode(current.weatherCode) ? 8 : 0,
    wildfire: fireScore(nearestWildfireDistance),
    wind: windScore(maxGust),
    earthquake: quakeScore(nearestQuake),
    powerOutage: Math.max(0, ...matchedOutageAreas.map(outageScore))
  };
  const riskScore = Math.min(100, Object.values(breakdown).reduce((sum, value) => sum + value, 0));
  const primaryReason = Object.entries(breakdown).sort((a, b) => b[1] - a[1])[0];
  return {
    ...facility, riskScore, riskLevel: unavailable >= 3 ? 'unavailable' : facilityLevelFor(riskScore),
    primaryReason: primaryReason?.[1] > 0 ? primaryReason[0] : 'Stable conditions',
    scoreBreakdown: breakdown,
    conditions: current,
    forecastPeakGustMph: maxGust,
    feedFreshness: feedHealth,
    exposure: {
      firesWithin10Miles: relevantFires.filter((fire) => fire.distanceMiles <= 10).length,
      firesWithin25Miles: relevantFires.filter((fire) => fire.distanceMiles <= 25).length,
      firesWithin50Miles: relevantFires.length,
      nearestFire: relevantFires[0] || null,
      nearestFirePerimeter: relevantPerimeters[0] || null,
      insideFirePerimeter: relevantPerimeters[0]?.distanceMiles === 0,
      insideNwsPolygon: activeAlerts.length > 0,
      nwsEvent: activeAlerts[0]?.event || null,
      activeAlerts,
      nearestEarthquake: nearestQuake,
      outageAreas,
      gridAreaImpact: outageAreas.length > 0
    }
  };
}

function analyzePowerOutages(areas, facilities) {
  const enriched = areas.map((area) => {
    const facilityMatches = facilities.filter((facility) => area.geometry && pointInGeometry(facility.longitude, facility.latitude, area.geometry)).map((facility) => ({ code: facility.code, shortName: facility.shortName, riskScore: facility.riskScore, riskLevel: facility.riskLevel }));
    return { ...area, facilityMatches };
  });
  const matched = enriched.filter((area) => area.facilityMatches.length > 0);
  const reportedCustomersOut = enriched.reduce((sum, area) => sum + (area.customersOut || 0), 0);
  const reportedCustomersTracked = enriched.reduce((sum, area) => sum + (area.customersTracked || 0), 0);
  return {
    areas: enriched,
    summary: {
      regionalAreaCount: enriched.length,
      reportedCustomersOut,
      reportedCustomersTracked: reportedCustomersTracked || null,
      percentOut: reportedCustomersTracked > 0 ? (reportedCustomersOut / reportedCustomersTracked) * 100 : null,
      facilitiesInReportingAreas: new Set(matched.flatMap((area) => area.facilityMatches.map((facility) => facility.code))).size,
      matchedAreaCount: matched.length,
      highestImpactArea: [...enriched].sort((a, b) => outageScore(b) - outageScore(a) || b.customersOut - a.customersOut)[0] || null
    }
  };
}

function analyzeFirePerimeters(perimeters, facilities) {
  const enriched = perimeters.map((perimeter) => {
    const facilityImpacts = facilities.map((facility) => {
      const proximity = geometryProximityMiles(facility.latitude, facility.longitude, perimeter.geometry);
      const distanceMiles = proximity.distanceMiles;
      return {
        code: facility.code,
        shortName: facility.shortName,
        name: facility.name,
        latitude: facility.latitude,
        longitude: facility.longitude,
        riskScore: facility.riskScore,
        riskLevel: facility.riskLevel,
        distanceMiles,
        nearestPerimeterLatitude: proximity.nearestCoordinate?.[1] ?? null,
        nearestPerimeterLongitude: proximity.nearestCoordinate?.[0] ?? null,
        insidePerimeter: distanceMiles === 0
      };
    }).filter((facility) => facility.distanceMiles <= 50).sort((a, b) => a.distanceMiles - b.distanceMiles);
    return { ...perimeter, facilityImpacts };
  });
  const allImpacts = enriched.flatMap((perimeter) => perimeter.facilityImpacts.map((facility) => ({ ...facility, perimeterId: perimeter.id, perimeterName: perimeter.name })));
  const nearest = allImpacts.sort((a, b) => a.distanceMiles - b.distanceMiles)[0] || null;
  return {
    perimeters: enriched,
    summary: {
      regionalCount: enriched.length,
      facilitiesInside: new Set(allImpacts.filter((item) => item.insidePerimeter).map((item) => item.code)).size,
      facilitiesWithin10Miles: new Set(allImpacts.filter((item) => item.distanceMiles <= 10).map((item) => item.code)).size,
      facilitiesWithin25Miles: new Set(allImpacts.filter((item) => item.distanceMiles <= 25).map((item) => item.code)).size,
      facilitiesWithin50Miles: new Set(allImpacts.map((item) => item.code)).size,
      nearest
    }
  };
}

function relevantFireSummary(facilities, fires) {
  const nearestByFire = fires.map((fire) => {
    const nearestFacility = facilities.map((facility) => ({ facility, distanceMiles: haversineMiles(facility.latitude, facility.longitude, fire.latitude, fire.longitude) })).sort((a, b) => a.distanceMiles - b.distanceMiles)[0];
    return { ...fire, distanceMiles: nearestFacility?.distanceMiles ?? Infinity, facilityCode: nearestFacility?.facility.code || null, facilityLatitude: nearestFacility?.facility.latitude, facilityLongitude: nearestFacility?.facility.longitude };
  });
  const within50 = nearestByFire.filter((fire) => fire.distanceMiles <= 50).sort((a, b) => a.distanceMiles - b.distanceMiles);
  return { regionalCount: fires.length, within50Miles: within50.length, within25Miles: within50.filter((fire) => fire.distanceMiles <= 25).length, within10Miles: within50.filter((fire) => fire.distanceMiles <= 10).length, nearest: within50[0] || null, relevantIncidents: within50 };
}

function strongestRelevantQuake(facilities) {
  return facilities.map((facility) => facility.exposure.nearestEarthquake).filter(Boolean).sort((a, b) => b.magnitude - a.magnitude)[0] || null;
}
function isRelevantQuake(quake) { return (quake.magnitude >= 5 && quake.distanceMiles <= 100) || (quake.magnitude >= 4 && quake.distanceMiles <= 50) || (quake.magnitude >= 2.5 && quake.distanceMiles <= 25); }
function fireScore(distance) { const c = scoring.components.wildfire; return !Number.isFinite(distance) ? 0 : distance <= 10 ? c.within10Miles : distance <= 25 ? c.within25Miles : distance <= 50 ? c.within50Miles : 0; }
function windScore(gust = 0) { const c = scoring.components.wind; return gust > 50 ? c.above50Mph : gust >= 35 ? c.at35Mph : gust >= 25 ? c.at25Mph : gust >= 15 ? c.at15Mph : 0; }
function quakeScore(quake) { if (!quake) return 0; const c = scoring.components.earthquake; return quake.magnitude >= 5 && quake.distanceMiles <= 100 ? c.magnitude5Within100 : quake.magnitude >= 4 && quake.distanceMiles <= 50 ? c.magnitude4Within50 : quake.magnitude >= 2.5 && quake.distanceMiles <= 25 ? c.magnitude2_5Within25 : 0; }
function outageScore(area) { if (!area) return 0; const c = scoring.components.powerOutage; const percent = area.percentOut ?? 0; const customers = area.customersOut ?? 0; return percent >= c.majorPercent || customers >= c.majorCustomers ? c.majorPoints : percent >= c.moderatePercent || customers >= c.moderateCustomers ? c.moderatePoints : customers > 0 || percent > 0 ? c.minorPoints : 0; }
function isStormCode(code) { return code >= scoring.components.weather.stormCodeMinimum; }
function levelFor(score) { const levels = scoring.levels; return score <= levels.lowMaximum ? 'LOW' : score <= levels.monitoringMaximum ? 'MONITORING' : score <= levels.elevatedMaximum ? 'ELEVATED' : 'HIGH'; }
function facilityLevelFor(score) { return score >= 70 ? 'high' : score >= 40 ? 'elevated' : score >= 20 ? 'monitoring' : 'normal'; }

function dominantHazard(components, alerts, fire, quake, outageSummary, maxGust, maxPrecip) {
  const candidates = [
    { key: 'nwsAlerts', title: alerts[0]?.event || 'Official weather alert', detail: alerts[0]?.headline || '', label: 'OFFICIAL NWS ALERT' },
    { key: 'wildfire', title: 'Wildfire proximity', detail: fire ? `${fire.name} · ${fire.distanceMiles.toFixed(1)} mi from ${fire.facilityCode}` : '', label: 'FACILITY EXPOSURE' },
    { key: 'wind', title: 'Forecast wind', detail: `Peak model gust ${Math.round(maxGust)} mph`, label: 'MODEL FORECAST' },
    { key: 'earthquake', title: 'Earthquake activity', detail: quake ? `M${quake.magnitude.toFixed(1)} · ${quake.distanceMiles.toFixed(0)} mi from a facility` : '', label: 'USGS ACTIVITY' },
    { key: 'powerOutage', title: 'Grid-area disruption', detail: outageSummary?.facilitiesInReportingAreas ? `${outageSummary.reportedCustomersOut.toLocaleString()} customers reported out · ${outageSummary.facilitiesInReportingAreas} synthetic facilities in reporting areas` : '', label: 'POWER OUTAGE INTELLIGENCE' },
    { key: 'weather', title: 'Storm potential', detail: `Peak precipitation probability ${Math.round(maxPrecip)}%`, label: 'MODEL FORECAST' }
  ].sort((a, b) => components[b.key] - components[a.key]);
  return components[candidates[0].key] > 4 ? { ...candidates[0], score: components[candidates[0].key] } : { key: 'stable', title: 'NO IMMEDIATE HAZARDS', detail: 'Regional conditions are currently stable', label: 'REGIONAL POSTURE', score: 0 };
}
