import { Activity, Clock3, Radio } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function HeaderBar({ region, generatedAt }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="topbar">
      <div className="brand-lockup">
        <div className="brand-mark"><Activity size={21} /></div>
        <div><p className="eyebrow">REGIONAL SITUATIONAL AWARENESS</p><h1>EMERGENCY INTELLIGENCE <span>COMMAND</span></h1></div>
      </div>
      <div className="region-heading">
        <p className="eyebrow">ACTIVE REGION</p>
        <strong>{region?.name || 'Initializing…'}</strong>
        <span>{region?.subtitle}</span>
      </div>
      <div className="system-clock">
        <div><Radio size={14} /><span>PUBLIC FEEDS</span><b>CONNECTED</b></div>
        <div><Clock3 size={14} /><time>{now.toLocaleTimeString([], { hour12: false })}</time><small>{generatedAt ? `Snapshot ${new Date(generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Awaiting snapshot'}</small></div>
      </div>
    </header>
  );
}

