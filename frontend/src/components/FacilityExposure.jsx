import { Activity, Flame, MapPin, X } from 'lucide-react';
import { relativeTime, round } from '../utils/format.js';

const reasonLabels = { nwsAlerts: 'Official alert polygon', weather: 'Current storm conditions', wildfire: 'Nearby wildfire', wind: 'Forecast wind gust', earthquake: 'Nearby earthquake', 'Stable conditions': 'Stable conditions' };

export default function FacilityExposure({ facilities, selected, onClose }) {
  const visible = facilities.filter((facility) => facility.riskScore >= 20).slice(0, 4);
  return (
    <section className="intel-section facility-section">
      <div className="section-title"><span>FACILITY EXPOSURE</span><b>HIGHEST RISK</b></div>
      {visible.length === 0 ? <div className="clear-state"><Activity /><span>ALL SYNTHETIC FACILITIES NORMAL</span></div> : <div className="facility-list">{visible.map((facility) => <article key={facility.code} className={`facility-row ${facility.riskLevel}`}><i /><div><b>{facility.code}</b><strong>{facility.shortName}</strong><small>{reasonLabels[facility.primaryReason] || facility.primaryReason}</small></div><span>{facility.riskScore}</span></article>)}</div>}
      {selected && <div className="facility-detail" role="dialog" aria-label={`${selected.name} intelligence detail`}>
        <button type="button" onClick={onClose} aria-label="Close facility detail"><X /></button>
        <small>SELECTED SYNTHETIC FACILITY</small><h3>{selected.name}</h3><b>{selected.code} · {selected.city}, {selected.state}</b>
        <div className="detail-grid"><span><small>STATE</small><strong>{selected.riskLevel.toUpperCase()} · {selected.riskScore}</strong></span><span><small>CONDITIONS</small><strong>{round(selected.conditions.temperatureF)}° · {selected.conditions.condition}</strong></span><span><small>PEAK GUST</small><strong>{round(selected.forecastPeakGustMph)} mph</strong></span><span><small>OFFICIAL ALERTS</small><strong>{selected.exposure.activeAlerts.length}</strong></span></div>
        <p><Flame />{selected.exposure.insideFirePerimeter ? `Inside ${selected.exposure.nearestFirePerimeter.name} mapped perimeter` : selected.exposure.nearestFirePerimeter ? `${selected.exposure.nearestFirePerimeter.name} perimeter · ${selected.exposure.nearestFirePerimeter.distanceMiles.toFixed(1)} mi` : selected.exposure.nearestFire ? `${selected.exposure.nearestFire.name} · ${selected.exposure.nearestFire.distanceMiles.toFixed(1)} mi` : 'No wildfire within 50 miles'}</p>
        <p><MapPin />{selected.exposure.nearestEarthquake ? `M${selected.exposure.nearestEarthquake.magnitude.toFixed(1)} · ${selected.exposure.nearestEarthquake.distanceMiles.toFixed(0)} mi` : 'No relevant nearby earthquake'}</p>
        <p><Activity />{selected.exposure.gridAreaImpact ? `${selected.exposure.outageAreas.length} power-outage reporting area match${selected.exposure.outageAreas.length === 1 ? '' : 'es'} · site service not confirmed` : 'No power-outage reporting-area match'}</p>
        <div className="detail-breakdown">{Object.entries(selected.scoreBreakdown).map(([key, value]) => <span key={key}>{key}<b>{value}</b></span>)}</div>
        <small>Weather feed {selected.feedFreshness.weather?.status || 'unknown'} · {relativeTime(selected.feedFreshness.weather?.lastSuccess)}</small>
      </div>}
    </section>
  );
}
