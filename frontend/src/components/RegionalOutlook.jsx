import { round } from '../utils/format.js';

export default function RegionalOutlook({ outlook }) {
  return <section className="intel-section outlook-section"><div className="section-title"><span>24-HOUR REGIONAL OUTLOOK</span><b>MODEL FORECAST</b></div><div className="outlook-strip"><span><small>HIGH / LOW</small><b>{round(outlook?.highF)}° / {round(outlook?.lowF)}°</b></span><span><small>PEAK GUST</small><b>{round(outlook?.maximumWindGustMph)} mph</b></span><span><small>MAX PRECIP</small><b>{round(outlook?.maximumPrecipitationProbability)}%</b></span><span><small>EXPECTED</small><b>{Number(outlook?.totalPrecipitationIn || 0).toFixed(2)} in</b></span><span className="concern"><small>PRIMARY FORECAST CONCERN</small><b>{outlook?.primaryConcern || 'Unavailable'}</b></span></div></section>;
}
