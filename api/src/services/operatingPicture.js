import { getFacilities } from '../config.js';
import { getWeather } from './weather.js';
import { getAlerts } from './alerts.js';
import { getFires } from './fires.js';
import { getFirePerimeters } from './firePerimeters.js';
import { getEvacuationZones } from './evacuationZones.js';
import { getEarthquakes } from './earthquakes.js';
import { getRadar } from './radar.js';
import { getPrescribedBurns } from './prescribedBurns.js';
import { getRadioIntelligence } from './radioIntelligence.js';
import { getPowerOutages } from './powerOutages.js';
import { buildIntelligence } from './scoring.js';

export async function getOperatingPicture(region) {
  const [weatherResult, alertResult, fireResult, perimeterResult, evacuationResult, outageResult, earthquakeResult, radarResult, prescribedBurnResult, radioResult] = await Promise.all([
    getWeather(region), getAlerts(region), getFires(region), getFirePerimeters(region), getEvacuationZones(region), getPowerOutages(region), getEarthquakes(region), getRadar(), getPrescribedBurns(region), getRadioIntelligence(region)
  ]);
  const feedHealth = { weather: weatherResult.health, alerts: alertResult.health, fires: fireResult.health, firePerimeters: perimeterResult.health, powerOutages: outageResult.health, earthquakes: earthquakeResult.health, radar: radarResult.health, prescribedBurns: prescribedBurnResult.health };
  const weather = weatherResult.data || { current: {}, forecast: [], outlook: {}, windSamples: [], source: 'Open-Meteo' };
  const alerts = alertResult.data || [];
  const fires = fireResult.data || [];
  const firePerimeters = perimeterResult.data || [];
  const powerOutages = outageResult.data || [];
  const earthquakes = earthquakeResult.data || [];
  const intelligence = buildIntelligence(weather, alerts, fires, firePerimeters, powerOutages, earthquakes, getFacilities(region.id), feedHealth);
  return {
    region, generatedAt: new Date().toISOString(), weather: weather.current, forecast: weather.forecast, outlook: weather.outlook,
    forecastWindPoints: weather.windSamples || [], alerts, alertSummary: intelligence.alertSummary, fires, wildfireSummary: intelligence.wildfireSummary,
    firePerimeters: intelligence.firePerimeters, perimeterSummary: intelligence.perimeterSummary, evacuationZones: evacuationResult.data, evacuationLayer: evacuationResult.metadata, powerOutages: intelligence.powerOutages, powerOutageSummary: intelligence.powerOutageSummary, powerOutageProvider: outageResult.metadata, prescribedBurns: prescribedBurnResult.data || [], radioIntelligence: { transcripts: radioResult.data || [], health: radioResult.health, ...radioResult.metadata }, earthquakes, facilities: intelligence.facilities,
    radar: radarResult.data || { frames: [], latestTileUrl: null, attribution: 'Radar © RainViewer' }, threat: intelligence.threat, feedHealth,
    attribution: { basemap: 'Tiles © Esri — Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community', labels: 'Labels © Esri', weather: 'Weather data by Open-Meteo.com', alerts: 'Alerts from the U.S. National Weather Service', radar: 'Radar © RainViewer', fires: 'Wildfire incidents and current interagency fire perimeters from NIFC WFIGS', powerOutages: outageResult.metadata.configured ? 'Licensed outage intelligence from PowerOutage.us' : 'PowerOutage.us connector not configured', prescribedBurns: 'Prescribed-burn data © Watch Duty and contributing sources; educational/research use only', earthquakes: 'Earthquake data from USGS' },
    disclaimer: 'PERSONAL PROTOTYPE · SYNTHETIC FACILITY DATA · NOT FOR OPERATIONAL USE'
  };
}
