import { PlugZap, ShieldCheck } from 'lucide-react';

function number(value) {
  return Number(value || 0).toLocaleString();
}

export default function PowerOutagePanel({ areas = [], summary = {}, provider = {}, health = {} }) {
  if (!provider.configured) return (
    <section className="intel-section outage-section outage-unconfigured">
      <div className="section-title"><span>POWER OUTAGE INTELLIGENCE</span><b>NOT CONFIGURED</b></div>
      <div className="outage-notice"><PlugZap /><div><b>LICENSED CONNECTOR READY</b><p>Add an authorized PowerOutage.us API endpoint and token to enable live outage areas. No public-site scraping is used.</p></div></div>
    </section>
  );

  if (areas.length === 0 && health.status === 'live') return (
    <section className="intel-section outage-section">
      <div className="section-title"><span>POWER OUTAGE INTELLIGENCE</span><b>LIVE</b></div>
      <div className="clear-state"><ShieldCheck /><span>LIVE, NO REPORTED OUTAGE AREAS</span></div>
    </section>
  );

  const highest = summary.highestImpactArea;
  return (
    <section className="intel-section outage-section">
      <div className="section-title"><span>POWER OUTAGE INTELLIGENCE</span><b>{String(health.status || 'loading').toUpperCase()}</b></div>
      <div className="outage-overview"><PlugZap /><div><strong>{number(summary.reportedCustomersOut)}</strong><span>REPORTED CUSTOMERS OUT</span></div><div><strong>{summary.facilitiesInReportingAreas || 0}</strong><span>SYNTHETIC FACILITIES IN REPORTING AREAS</span></div></div>
      {highest && <article className="outage-primary"><small>HIGHEST REPORTED IMPACT</small><b>{highest.name}</b><span>{highest.utility} · {number(highest.customersOut)} customers out{Number.isFinite(highest.percentOut) ? ` · ${highest.percentOut.toFixed(1)}%` : ''}</span></article>}
      <div className="outage-list">{areas.slice().sort((a, b) => b.customersOut - a.customersOut).slice(0, 3).map((area) => <div key={area.id}><i /><span><b>{area.name}</b><small>{area.utility}</small></span><strong>{number(area.customersOut)}</strong></div>)}</div>
      <p className="outage-caution">A facility inside a reporting polygon is an area-level exposure match. It does not confirm loss of utility service at the facility.</p>
    </section>
  );
}
