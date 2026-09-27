import { useEffect, useRef } from 'react';
import { AlertTriangle, CloudRain, Flame, Gauge, PlugZap, Radio, ShieldCheck, Wind } from 'lucide-react';
import ForecastTimeline from './ForecastTimeline.jsx';
import FeedHealth from './FeedHealth.jsx';
import FacilityExposure from './FacilityExposure.jsx';
import RegionalOutlook from './RegionalOutlook.jsx';
import RadioIntelligence from './RadioIntelligence.jsx';
import PowerOutagePanel from './PowerOutagePanel.jsx';
import { round, timeLabel } from '../utils/format.js';

const componentLabels = { weather: 'WEATHER', nwsAlerts: 'NWS ALERTS', wildfire: 'WILDFIRE', wind: 'WIND', earthquake: 'EARTHQUAKE', powerOutage: 'POWER OUTAGE', facilityExposure: 'FACILITY' };

function AlertsSection({ alerts }) {
  return <section className="intel-section alerts-section"><div className="section-title"><span>OFFICIAL NWS ALERTS</span><b>{alerts.length} ACTIVE</b></div>{alerts.length === 0 ? <div className="clear-state"><ShieldCheck /><span>LIVE, NO ACTIVE ALERTS</span></div> : alerts.slice(0, 3).map((alert) => <article className={`alert-item severity-${alert.severity.toLowerCase()}`} key={alert.id}><b>OFFICIAL NWS ALERT · {alert.event}</b><p>{alert.headline}</p><small>{alert.certainty} · {alert.urgency} · Expires {timeLabel(alert.expiresAt)}</small>{alert.instruction && <details><summary>Instructions</summary><p>{alert.instruction}</p></details>}</article>)}</section>;
}

export default function IntelligencePanel({ picture, selectedFacility, onCloseFacility }) {
  const panelRef = useRef(null);
  const { weather, threat, alerts, alertSummary, feedHealth, forecast, outlook, facilities, wildfireSummary, perimeterSummary, powerOutages = [], powerOutageSummary, powerOutageProvider, prescribedBurns = [], radioIntelligence } = picture;
  const exposed = facilities.filter((facility) => facility.riskScore >= 20).length;
  const primaryIcon = threat.primary.key === 'wildfire' ? <Flame /> : threat.primary.key === 'wind' ? <Wind /> : threat.primary.key === 'powerOutage' ? <PlugZap /> : threat.primary.key === 'stable' ? <ShieldCheck /> : <AlertTriangle />;
  useEffect(() => {
    if (panelRef.current) panelRef.current.scrollTop = 0;
  }, [picture.region.id]);
  return (
    <aside className="intelligence-panel" ref={panelRef}>
      <section className="conditions">
        <div className="condition-main"><span>NOW</span><strong>{round(weather.temperatureF)}°</strong><div><b>{weather.condition || 'Unavailable'}</b><small>Feels like {round(weather.apparentTemperatureF)}°</small></div></div>
        <div className="condition-metrics"><span><Wind />WIND<b>{weather.windDirection || '—'} {round(weather.windSpeedMph)} mph</b></span><span><Gauge />GUST<b>{round(weather.windGustMph)} mph</b></span><span><CloudRain />RAIN<b>{round(weather.rainProbability)}%</b></span><span><Radio />HUMIDITY<b>{round(weather.relativeHumidity)}%</b></span><span><Radio />CLOUD<b>{round(weather.cloudCover)}%</b></span></div>
      </section>

      <section className={`primary-posture level-${threat.level.toLowerCase()}`}>
        <div className="posture-icon">{primaryIcon}</div>
        <div><span>{threat.primary.label}</span><h2>{threat.primary.title}</h2><p>{threat.primary.detail}</p><small>{exposed ? `${exposed} facilities at monitoring or above` : 'No facilities currently above normal'}</small></div>
        <div className="threat-dial"><strong>{threat.score}</strong><span>/100</span><b>{threat.level}</b></div>
      </section>

      <div className="operational-summary"><span><b>{wildfireSummary?.regionalCount || 0}</b> regional wildfire points</span><span><b>{wildfireSummary?.within50Miles || 0}</b> fire points within 50 mi</span><span><b>{perimeterSummary?.regionalCount || 0}</b> current fire perimeters</span><span><b>{perimeterSummary?.facilitiesWithin50Miles || 0}</b> facilities within 50 mi of perimeter</span></div>

      <section className="prescribed-summary"><div><b>WATCH DUTY PRESCRIBED BURNS</b><span>{prescribedBurns.length} informational records in monitored extent</span></div><small>Excluded from wildfire exposure and threat scoring</small></section>

      {alerts.length > 0 && <AlertsSection alerts={alerts} />}

      <section className="intel-section score-section">
        <div className="section-title"><span>THREAT SCORE BREAKDOWN</span><b>TRANSPARENT MODEL</b></div>
        <div className="score-bars">{Object.entries(componentLabels).map(([key, label]) => <div key={key}><span>{label}</span><i><b style={{ width: `${Math.min(100, threat.components[key] * 4)}%` }} /></i><strong>{threat.components[key]}</strong></div>)}</div>
      </section>

      <FacilityExposure facilities={facilities} selected={selectedFacility} onClose={onCloseFacility} />
      <PowerOutagePanel areas={powerOutages} summary={powerOutageSummary} provider={powerOutageProvider} health={feedHealth.powerOutages} />
      <RegionalOutlook outlook={outlook} />
      <ForecastTimeline forecast={forecast} />

      <RadioIntelligence radio={radioIntelligence} />

      {alerts.length === 0 && <AlertsSection alerts={alerts} />}

      <FeedHealth feeds={feedHealth} eventCounts={{ alerts: alerts.length, fires: picture.fires.length, firePerimeters: picture.firePerimeters.length, powerOutages: powerOutages.length, earthquakes: picture.earthquakes.length, prescribedBurns: prescribedBurns.length }} />
      <footer className="source-strip">PUBLIC DATA · OPEN-METEO · NWS · RAINVIEWER · NIFC WFIGS · WATCH DUTY RX · USGS · ESRI · LICENSED OUTAGE CONNECTOR</footer>
    </aside>
  );
}
