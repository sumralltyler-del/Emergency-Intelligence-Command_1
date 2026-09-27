import { relativeTime } from '../utils/format.js';

const labels = { weather: 'WEATHER', alerts: 'ALERTS', radar: 'RADAR', fires: 'WILDFIRE', firePerimeters: 'FIRE PERIMETERS', powerOutages: 'POWER OUTAGES', prescribedBurns: 'PRESCRIBED FIRE', earthquakes: 'EARTHQUAKE' };

export default function FeedHealth({ feeds, eventCounts = {} }) {
  return (
    <section className="intel-section feed-section">
      <div className="section-title"><span>LIVE DATA-FEED HEALTH</span><b>STATUS</b></div>
      <div className="feed-list">
        {Object.entries(labels).map(([key, label]) => {
          const feed = feeds?.[key] || { status: 'loading' };
          const eventSource = ['alerts', 'fires', 'firePerimeters', 'powerOutages', 'prescribedBurns', 'earthquakes'].includes(key);
          const statusText = feed.status === 'not-configured' ? 'NOT CONFIGURED' : eventSource && feed.status === 'live' && eventCounts[key] === 0 ? 'LIVE, NO ACTIVE EVENTS' : feed.status.toUpperCase();
          return <div className={`feed-row ${feed.status}`} key={key} title={feed.error || ''}><i /><strong>{label}</strong><span>{statusText}</span><time>{relativeTime(feed.lastSuccess)}</time><small>attempt {relativeTime(feed.lastAttempt)} · cache {feed.cacheStatus || '—'} · age {feed.ageSeconds ?? '—'}s</small>{feed.error && <em>{feed.error}</em>}</div>;
        })}
      </div>
    </section>
  );
}
