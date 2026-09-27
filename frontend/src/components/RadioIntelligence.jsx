import { Radio, ShieldAlert } from 'lucide-react';
import { relativeTime } from '../utils/format.js';

export default function RadioIntelligence({ radio }) {
  if (!radio?.enabled) return null;
  const transcripts = radio.transcripts || [];
  return (
    <section className="intel-section radio-intelligence-section">
      <div className="section-title"><span>RADIO INTELLIGENCE</span><b>UNVERIFIED</b></div>
      <div className="radio-warning"><ShieldAlert /><span>{radio.disclaimer}</span></div>
      {transcripts.length === 0 ? <div className="radio-empty"><Radio /><span>No recent transcript signals for this region</span></div> : transcripts.slice(0, 4).map((item) => (
        <article className="radio-transcript" key={item.id}>
          <div><b>{item.feedName}</b><time>{relativeTime(item.occurredAt)}</time></div>
          <p>{item.transcript}</p>
          <footer>{item.tags.map((tag) => <span key={tag}>{tag}</span>)}{item.confidence !== null && <em>{Math.round(item.confidence * 100)}% ASR confidence</em>}</footer>
        </article>
      ))}
      <small className="radio-score-note">Radio signals are excluded from the threat score until corroborated.</small>
    </section>
  );
}
