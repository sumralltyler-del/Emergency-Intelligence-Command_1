export function round(value, fallback = '—') {
  return Number.isFinite(value) ? Math.round(value) : fallback;
}

export function relativeTime(iso) {
  if (!iso) return 'Never';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export function timeLabel(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

export function gustClass(value = 0) {
  if (value > 50) return 'gust-red';
  if (value >= 35) return 'gust-orange';
  if (value >= 25) return 'gust-yellow';
  if (value >= 15) return 'gust-green';
  return 'gust-blue';
}

