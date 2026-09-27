import { ChevronLeft, ChevronRight, Pause, Play, RefreshCw } from 'lucide-react';

export default function RotationControls({ index, total, paused, autoHold, progress, loading, onPrevious, onNext, onToggle, onRefresh }) {
  return (
    <div className="rotation-console" aria-label="Regional rotation controls">
      <button onClick={onPrevious} aria-label="Previous region"><ChevronLeft size={18} /></button>
      <div className="region-counter"><span>REGION</span><strong>{String(index + 1).padStart(2, '0')}</strong><i>/</i><em>{String(total).padStart(2, '0')}</em></div>
      <button onClick={onToggle} aria-label={paused ? 'Resume rotation' : 'Pause rotation'}>{paused ? <Play size={17} /> : <Pause size={17} />}</button>
      <button onClick={onNext} aria-label="Next region"><ChevronRight size={18} /></button>
      <button onClick={onRefresh} className={loading ? 'spinning' : ''} aria-label="Refresh data"><RefreshCw size={16} /></button>
      <div className="rotation-state"><span>{autoHold ? 'AUTO HOLD · CRITICAL' : paused ? 'ROTATION PAUSED' : 'NEXT REGION'}</span><div><i style={{ width: `${progress * 100}%` }} /></div></div>
    </div>
  );
}

