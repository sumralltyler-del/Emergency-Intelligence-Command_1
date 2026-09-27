import { Radar } from 'lucide-react';

export default function LoadingScreen({ message = 'ASSEMBLING OPERATING PICTURE' }) {
  return <div className="loading-screen"><div><Radar /><i /></div><strong>{message}</strong><span>Connecting to public hazard intelligence feeds</span></div>;
}
