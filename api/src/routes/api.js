import { Router } from 'express';
import { configValidation, facilities, getFacilities, getRegion, regions, settings } from '../config.js';
import { cache } from '../cache.js';
import { ApiError } from '../utils/errors.js';
import { getWeather } from '../services/weather.js';
import { getAlerts } from '../services/alerts.js';
import { getFires } from '../services/fires.js';
import { getFirePerimeters } from '../services/firePerimeters.js';
import { getEvacuationZones } from '../services/evacuationZones.js';
import { getEarthquakes } from '../services/earthquakes.js';
import { getRadar } from '../services/radar.js';
import { getOperatingPicture } from '../services/operatingPicture.js';
import { getPrescribedBurns } from '../services/prescribedBurns.js';
import { getRadioIntelligence } from '../services/radioIntelligence.js';
import { getPowerOutages } from '../services/powerOutages.js';

export const apiRouter = Router();
const startedAt = Date.now();
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

function resolveRegion(req) {
  const id = req.query.region;
  if (!id) throw new ApiError(400, 'REGION_REQUIRED', 'Query parameter "region" is required.');
  const region = getRegion(id);
  if (!region) throw new ApiError(404, 'REGION_NOT_FOUND', `Unknown region: ${id}`);
  return region;
}

apiRouter.get('/health', (req, res) => res.status(configValidation.ok ? 200 : 503).json({
  status: configValidation.ok ? 'ok' : 'unhealthy',
  service: 'emergency-intelligence-command-api',
  version: settings.version,
  uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
  configuration: configValidation,
  cache: cache.snapshot(),
  connectors: {
    powerOutages: { configured: settings.powerOutageEnabled && Boolean(settings.powerOutageApiUrl), provider: 'PowerOutage.us', licenseRequired: true },
    radioIntelligence: { configured: settings.radioIntelligenceEnabled && Boolean(settings.radioIntelligenceUrl) }
  },
  regionCount: regions.length,
  facilityCount: facilities.length,
  timestamp: new Date().toISOString()
}));

apiRouter.get('/regions', (req, res) => res.json({ data: regions }));
apiRouter.get('/facilities', (req, res) => res.json({ data: getFacilities(resolveRegion(req).id) }));

apiRouter.get('/weather', asyncRoute(async (req, res) => res.json(await getWeather(resolveRegion(req)))));
apiRouter.get('/alerts', asyncRoute(async (req, res) => res.json(await getAlerts(resolveRegion(req)))));
apiRouter.get('/fires', asyncRoute(async (req, res) => res.json(await getFires(resolveRegion(req)))));
apiRouter.get('/fire-perimeters', asyncRoute(async (req, res) => res.json(await getFirePerimeters(resolveRegion(req)))));
apiRouter.get('/evacuation-zones', asyncRoute(async (req, res) => res.json(await getEvacuationZones(resolveRegion(req)))));
apiRouter.get('/earthquakes', asyncRoute(async (req, res) => res.json(await getEarthquakes(resolveRegion(req)))));
apiRouter.get('/radar', asyncRoute(async (req, res) => res.json(await getRadar())));
apiRouter.get('/prescribed-burns', asyncRoute(async (req, res) => res.json(await getPrescribedBurns(resolveRegion(req)))));
apiRouter.get('/radio-intelligence', asyncRoute(async (req, res) => res.json(await getRadioIntelligence(resolveRegion(req)))));
apiRouter.get('/power-outages', asyncRoute(async (req, res) => res.json(await getPowerOutages(resolveRegion(req)))));
apiRouter.get('/operating-picture', asyncRoute(async (req, res) => res.json(await getOperatingPicture(resolveRegion(req)))));
