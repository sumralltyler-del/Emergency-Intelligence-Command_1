import { cache } from '../cache.js';
import { settings } from '../config.js';
import { fetchJson } from '../utils/http.js';

export function getRadar() {
  return cache.resolve('radar', settings.cacheTtl.radar, async () => {
    const raw = await fetchJson('https://api.rainviewer.com/public/weather-maps.json');
    const frames = [...(raw.radar?.past || []), ...(raw.radar?.nowcast || [])];
    const latest = frames.at(-1);
    return {
      generatedAt: raw.generated ? new Date(raw.generated * 1000).toISOString() : new Date().toISOString(),
      host: raw.host || 'https://tilecache.rainviewer.com',
      frames: frames.map((frame) => ({ time: new Date(frame.time * 1000).toISOString(), path: frame.path })),
      latestTileUrl: latest ? `${raw.host || 'https://tilecache.rainviewer.com'}${latest.path}/256/{z}/{x}/{y}/2/1_1.png` : null,
      attribution: 'Radar © RainViewer'
    };
  });
}

