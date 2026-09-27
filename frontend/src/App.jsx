import { useCallback, useEffect, useMemo, useState } from 'react';
import CommandMap from './components/CommandMap.jsx';
import HeaderBar from './components/HeaderBar.jsx';
import IntelligencePanel from './components/IntelligencePanel.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';
import RotationControls from './components/RotationControls.jsx';
import { useOperatingPicture } from './hooks/useOperatingPicture.js';
import { useRotation } from './hooks/useRotation.js';
import { api } from './services/api.js';

export default function App() {
  const [regions, setRegions] = useState([]);
  const [regionError, setRegionError] = useState(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [selectedFacilityCode, setSelectedFacilityCode] = useState(null);
  const [selectedPerimeterId, setSelectedPerimeterId] = useState(null);
  const region = regions[index];
  const { data, loading, error, refresh } = useOperatingPicture(region?.id);

  useEffect(() => {
    const controller = new AbortController();
    api.regions(controller.signal).then((response) => setRegions(response.data)).catch((reason) => setRegionError(reason.message));
    return () => controller.abort();
  }, []);

  const selectedPerimeter = data?.firePerimeters?.find((perimeter) => perimeter.id === selectedPerimeterId) || null;
  const autoHold = Boolean(selectedPerimeter || data?.threat?.score >= 70 || data?.alerts?.some((alert) => alert.severity === 'Extreme'));
  const rotationDuration = useMemo(() => {
    if (!data) return region?.rotation?.normalSeconds || region?.rotationDuration || 15;
    if (data.alerts.some((alert) => ['Severe', 'Extreme'].includes(alert.severity))) return region?.rotation?.severeSeconds || 60;
    if (data.alerts.length > 0) return region?.rotation?.alertSeconds || 30;
    return region?.rotation?.normalSeconds || region?.rotationDuration || 15;
  }, [data, region]);
  const next = useCallback(() => setIndex((value) => regions.length ? (value + 1) % regions.length : 0), [regions.length]);
  const previous = useCallback(() => setIndex((value) => regions.length ? (value - 1 + regions.length) % regions.length : 0), [regions.length]);
  const pictureReady = Boolean(data && data.region.id === region?.id);
  const selectedFacility = data?.facilities?.find((facility) => facility.code === selectedFacilityCode) || null;
  useEffect(() => { setSelectedFacilityCode(null); setSelectedPerimeterId(null); }, [region?.id]);
  const progress = useRotation({ enabled: !paused && !autoHold && pictureReady, durationSeconds: rotationDuration, resetKey: region?.id, onComplete: next });

  if (regionError) return <div className="fatal-error"><strong>CONFIGURATION UNAVAILABLE</strong><span>{regionError}</span><button onClick={() => window.location.reload()}>Retry</button></div>;
  if (!region || !data) return <LoadingScreen message={error ? 'OPERATING PICTURE UNAVAILABLE' : 'ASSEMBLING OPERATING PICTURE'} />;

  return (
    <main className="app-shell">
      <div className="prototype-banner"><b>PERSONAL PROTOTYPE</b><span>SYNTHETIC FACILITY DATA</span><strong>NOT FOR OPERATIONAL USE</strong></div>
      <HeaderBar region={data.region} generatedAt={data.generatedAt} />
      <div className="workspace">
        <div className="map-column">
          <CommandMap picture={data} selectedPerimeter={selectedPerimeter} onSelectPerimeter={(perimeter) => setSelectedPerimeterId(perimeter?.id || null)} onSelectFacility={(facility) => setSelectedFacilityCode(facility.code)} />
          {!pictureReady && <div className="sync-overlay">SYNCING {region.name.toUpperCase()}</div>}
          <RotationControls index={index} total={regions.length} paused={paused} autoHold={autoHold} progress={progress} loading={loading} onPrevious={previous} onNext={next} onToggle={() => setPaused((value) => !value)} onRefresh={refresh} />
        </div>
        <IntelligencePanel picture={data} selectedFacility={selectedFacility} onCloseFacility={() => setSelectedFacilityCode(null)} />
      </div>
      {error && <div className="request-error">Refresh failed: {error}. Displaying the last complete operating picture.</div>}
    </main>
  );
}
