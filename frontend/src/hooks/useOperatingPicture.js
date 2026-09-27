import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api.js';

export function useOperatingPicture(regionId) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const refresh = useCallback(() => setRefreshToken((value) => value + 1), []);

  useEffect(() => {
    if (!regionId) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api.operatingPicture(regionId, controller.signal)
      .then(setData)
      .catch((reason) => { if (reason.name !== 'AbortError') setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [regionId, refreshToken]);

  return { data, loading, error, refresh };
}

