import { Cloud, CloudLightning, CloudRain, CloudSnow, Sun } from 'lucide-react';
import { gustClass, round, timeLabel } from '../utils/format.js';

function WeatherGlyph({ code }) {
  if (code >= 95) return <CloudLightning />;
  if (code >= 71 && code <= 86) return <CloudSnow />;
  if (code >= 51) return <CloudRain />;
  if (code >= 2) return <Cloud />;
  return <Sun />;
}

export default function ForecastTimeline({ forecast }) {
  const intervals = (forecast || []).filter((_, index) => index % 2 === 0).slice(0, 6);
  return (
    <section className="intel-section forecast-section">
      <div className="section-title"><span>12 HOUR MODEL FORECAST</span><b>OPEN-METEO</b></div>
      <div className="forecast-grid">
        {intervals.map((hour) => (
          <div className="forecast-hour" key={hour.time}>
            <time>{timeLabel(hour.time)}</time><WeatherGlyph code={hour.weatherCode} /><strong>{round(hour.temperatureF)}°</strong>
            <span className="rain">{round(hour.precipitationProbability)}%</span>
            <small>{hour.windDirection} {round(hour.windSpeedMph)}</small>
            <i className={gustClass(hour.windGustMph)} style={{ height: `${Math.min(32, 4 + hour.windGustMph / 2)}px` }} title={`Gust ${round(hour.windGustMph)} mph`} />
          </div>
        ))}
      </div>
      <div className="wind-legend"><span>GUST MPH</span><i className="gust-blue" />0–15<i className="gust-green" />15–25<i className="gust-yellow" />25–35<i className="gust-orange" />35–50<i className="gust-red" />50+</div>
    </section>
  );
}
