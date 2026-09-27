import { cache } from '../cache.js';
import { settings } from '../config.js';
import { fetchJson } from '../utils/http.js';

const weatherLabels = {
  0: 'Clear', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Rime fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Rain showers', 81: 'Rain showers', 82: 'Heavy showers',
  85: 'Snow showers', 86: 'Heavy snow showers', 95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Severe thunderstorm'
};

function directionLabel(degrees = 0) {
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(degrees / 45) % 8];
}

function normalizeCurrent(raw) {
  const current = raw.current || {};
  return {
    observedAt: current.time || null,
    temperatureF: current.temperature_2m ?? null,
    apparentTemperatureF: current.apparent_temperature ?? null,
    relativeHumidity: current.relative_humidity_2m ?? null,
    cloudCover: current.cloud_cover ?? null,
    precipitationIn: current.precipitation ?? null,
    windSpeedMph: current.wind_speed_10m ?? null,
    windDirectionDegrees: current.wind_direction_10m ?? null,
    windDirection: directionLabel(current.wind_direction_10m),
    windGustMph: current.wind_gusts_10m ?? null,
    weatherCode: current.weather_code ?? null,
    condition: weatherLabels[current.weather_code] || 'Unknown'
  };
}

function normalizeForecast(raw) {
  const hourly = raw.hourly || {};
  const daily = raw.daily || {};
  const now = new Date().toISOString().slice(0, 13);
  const foundIndex = hourly.time?.findIndex((time) => time.slice(0, 13) >= now) ?? 0;
  const nowIndex = Math.max(0, foundIndex);
  const forecast = (hourly.time || []).slice(nowIndex, nowIndex + 24).map((time, index) => {
    const i = nowIndex + index;
    return {
      time,
      temperatureF: hourly.temperature_2m?.[i] ?? null,
      weatherCode: hourly.weather_code?.[i] ?? null,
      condition: weatherLabels[hourly.weather_code?.[i]] || 'Unknown',
      precipitationProbability: hourly.precipitation_probability?.[i] ?? 0,
      precipitationIn: hourly.precipitation?.[i] ?? 0,
      windSpeedMph: hourly.wind_speed_10m?.[i] ?? 0,
      windGustMph: hourly.wind_gusts_10m?.[i] ?? 0,
      windDirectionDegrees: hourly.wind_direction_10m?.[i] ?? 0,
      windDirection: directionLabel(hourly.wind_direction_10m?.[i])
    };
  });
  return {
    forecast,
    outlook: {
      date: daily.time?.[0] || null,
      highF: daily.temperature_2m_max?.[0] ?? null,
      lowF: daily.temperature_2m_min?.[0] ?? null,
      maximumWindGustMph: daily.wind_gusts_10m_max?.[0] ?? 0,
      maximumPrecipitationProbability: daily.precipitation_probability_max?.[0] ?? 0,
      totalPrecipitationIn: daily.precipitation_sum?.[0] ?? 0,
      primaryConcern: outlookConcern(daily)
    }
  };
}

function outlookConcern(daily) {
  const gust = daily.wind_gusts_10m_max?.[0] ?? 0;
  const precipitation = daily.precipitation_probability_max?.[0] ?? 0;
  const total = daily.precipitation_sum?.[0] ?? 0;
  if (gust > 50) return 'High wind potential';
  if (gust >= 35) return 'Strong wind potential';
  if (precipitation >= 70 && total >= 0.5) return 'Periods of heavy precipitation';
  if (precipitation >= 50) return 'Precipitation possible';
  return 'No significant model signal';
}

export async function getWeather(region) {
  const [latitude, longitude] = region.center;
  const common = { latitude: String(latitude), longitude: String(longitude), timezone: 'auto', temperature_unit: 'fahrenheit', wind_speed_unit: 'mph', precipitation_unit: 'inch' };
  const currentParams = new URLSearchParams({
    ...common,
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,cloud_cover,precipitation,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code'
  });
  const forecastParams = new URLSearchParams({
    ...common,
    forecast_days: '2',
    hourly: 'temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m',
    daily: 'temperature_2m_max,temperature_2m_min,wind_gusts_10m_max,precipitation_probability_max,precipitation_sum'
  });
  const [currentResult, forecastResult, samplesResult] = await Promise.all([
    cache.resolve(`weather:${region.id}`, settings.cacheTtl.weather, async () => normalizeCurrent(await fetchJson(`https://api.open-meteo.com/v1/forecast?${currentParams}`))),
    cache.resolve(`forecast:${region.id}`, settings.cacheTtl.forecast, async () => normalizeForecast(await fetchJson(`https://api.open-meteo.com/v1/forecast?${forecastParams}`))),
    cache.resolve(`weather-samples:${region.id}`, settings.cacheTtl.forecast, () => loadWindSamples(region))
  ]);
  const forecast = forecastResult.data || { forecast: [], outlook: {} };
  const statuses = [currentResult.health.status, forecastResult.health.status, samplesResult.health.status];
  const status = statuses.every((value) => value === 'live') ? 'live' : statuses.every((value) => value === 'offline') ? 'offline' : statuses.includes('stale') ? 'stale' : 'degraded';
  const successes = [currentResult.health.lastSuccess, forecastResult.health.lastSuccess, samplesResult.health.lastSuccess].filter(Boolean).sort();
  return {
    data: currentResult.data || forecastResult.data ? {
      current: { ...(currentResult.data || {}), rainProbability: forecast.forecast[0]?.precipitationProbability ?? 0 },
      forecast: forecast.forecast,
      outlook: forecast.outlook,
      windSamples: samplesResult.data || [],
      source: 'Open-Meteo',
      attribution: 'Weather data by Open-Meteo.com'
    } : null,
    health: {
      status,
      lastAttempt: [currentResult.health.lastAttempt, forecastResult.health.lastAttempt, samplesResult.health.lastAttempt].filter(Boolean).sort().at(-1) || null,
      lastSuccess: successes.at(-1) || null,
      stale: status === 'stale',
      ageSeconds: Math.max(currentResult.health.ageSeconds || 0, forecastResult.health.ageSeconds || 0),
      cacheStatus: statuses.includes('stale') ? 'fallback' : [currentResult.health.cacheStatus, forecastResult.health.cacheStatus, samplesResult.health.cacheStatus].includes('miss') ? 'miss' : 'hit',
      error: [currentResult.health.error, forecastResult.health.error, samplesResult.health.error].filter(Boolean).join('; ') || null
    }
  };
}

async function loadWindSamples(region) {
  const samples = region.samplingPoints || [];
  return Promise.all(samples.map(async (point) => {
    const params = new URLSearchParams({
      latitude: String(point.latitude), longitude: String(point.longitude), timezone: 'auto', wind_speed_unit: 'mph', forecast_days: '2',
      hourly: 'wind_gusts_10m,wind_direction_10m'
    });
    const raw = await fetchJson(`https://api.open-meteo.com/v1/forecast?${params}`);
    const times = raw.hourly?.time || [];
    const now = new Date().toISOString().slice(0, 13);
    const start = Math.max(0, times.findIndex((time) => time.slice(0, 13) >= now));
    const gusts = (raw.hourly?.wind_gusts_10m || []).slice(start, start + 24);
    const directions = (raw.hourly?.wind_direction_10m || []).slice(start, start + 24);
    const peakIndex = gusts.reduce((best, value, index) => value > (gusts[best] ?? -Infinity) ? index : best, 0);
    return { name: point.name, latitude: point.latitude, longitude: point.longitude, peakGustMph: gusts[peakIndex] ?? 0, windDirectionDegrees: directions[peakIndex] ?? 0, windDirection: directionLabel(directions[peakIndex] ?? 0), label: 'MODEL FORECAST WIND GUST' };
  }));
}
