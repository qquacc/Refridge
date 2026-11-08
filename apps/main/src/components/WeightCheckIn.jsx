import React, { useState, useEffect, useRef, useCallback } from 'react';
import Icon from './Icon.jsx';
import { createPortal } from 'react-dom';
import { today } from '../data/food.mjs';
import { saveWeight, weightReminder, shiftDate } from '../lib/insights.mjs';
export default function WeightCheckIn({ state, setState, always = false }) {
  const [open, setOpen] = useState(false), [kg, setKg] = useState(''), [date, setDate] = useState(today()), [error, setError] = useState('');
  const dialog = useRef(null), launcher = useRef(null);
  useEffect(() => {
    if (!open) return;
    const previous = launcher.current;
    const trap = (e) => {
      if (e.key !== 'Tab') return;
      const items = [...dialog.current.querySelectorAll('button, input')].filter((el) => !el.disabled);
      const first = items[0], last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    const el = dialog.current; el.addEventListener('keydown', trap);
    return () => { el.removeEventListener('keydown', trap); previous?.focus(); };
  }, [open]);
  const reminder = weightReminder(state, today()), family = state.profile.accountFor === 'family';
  const dismiss = useCallback(() => setState((s) => ({ ...s, weightTracking: { ...s.weightTracking, dismissedUntil: shiftDate(today(), 1) } })), [setState]);
  useEffect(() => {
    if (always || !reminder.due || open) return;
    const timer = setTimeout(dismiss, 15000);
    return () => clearTimeout(timer);
  }, [always, reminder.due, open, dismiss]);
  function launch() { launcher.current = document.activeElement; setKg(''); setDate(today()); setError(''); setOpen(true); }
  function save(e) { e.preventDefault(); try { const next = saveWeight(state, { kg, date }, today()); setState(next); setOpen(false); } catch (e) { setError(e.message); } }
  return <>
    {(always || reminder.due) && <div className={`weight-checkin-banner${!always ? ' weight-notification' : ''}`}>
      {!always && <Icon name="bell" size={21} className="weight-notification-bell" />}
      <span className="weight-notification-copy">{reminder.streak > 0 && <strong>{reminder.streak}-day food-log streak · </strong>}{reminder.due ? (family ? 'Time for their optional weight check-in?' : 'Time for an optional weight check-in?') : 'Your weight history'}<small>{reminder.latest ? ` Last recorded: ${reminder.latest.kg} kg · ${reminder.latest.date}` : ' Record a starting point for your trends.'}</small></span>
      <div className="button-row"><button className="btn outline" onClick={launch}>Record weight</button>{reminder.due && <button className="text-btn" onClick={() => setState((s) => ({ ...s, weightTracking: { ...s.weightTracking, snoozedUntil: shiftDate(today(), 3) } }))}>In 3 days</button>}</div>
      {!always && <><button type="button" className="weight-notification-close" aria-label="Dismiss weigh-in reminder for today" onClick={dismiss}><Icon name="close" size={17} /></button><span key={String(open)} className={`weight-notification-timer${open ? ' paused' : ''}`} aria-hidden="true" /></>}
    </div>}
    {always && <label className="inline-toggle"><input type="checkbox" checked={state.weightTracking?.enabled !== false} onChange={(e) => setState((s) => ({ ...s, weightTracking: { ...s.weightTracking, enabled: e.target.checked } }))} />Optional weigh-in reminder every 3 days · skipping never affects your streak</label>}
    {always && (state.weightTracking?.entries || []).length > 0 && <details className="weight-history"><summary>Weight history · record the same date again to correct it</summary>{[...(state.weightTracking.entries)].sort((a, b) => b.date.localeCompare(a.date)).map((entry) => <div className="log-row" key={entry.date}><span>{entry.date}</span><strong>{entry.kg} kg</strong><button className="text-btn" onClick={() => setState((s) => { const entries = s.weightTracking.entries.filter((e) => e.date !== entry.date); return { ...s, weightTracking: { ...s.weightTracking, entries }, profile: { ...s.profile, weightKg: [...entries].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.kg ?? s.profile.weightKg } }; })}>Delete</button></div>)}</details>}
    {open && createPortal(<div className="weight-modal-scrim" onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}><section ref={dialog} className="weight-modal" role="dialog" aria-modal="true" aria-labelledby="weight-title"><h2 id="weight-title">{family ? 'Record their weight' : 'A small check-in'}</h2><p>Optional, private, and never scored. Use similar conditions each time for a more comparable record.</p><form onSubmit={save}><label className="field"><span>Weight (kg)</span><input autoFocus type="number" min="1" max="700" step="0.1" required value={kg} onChange={(e) => setKg(e.target.value)} /></label><label className="field"><span>Date</span><input type="date" required max={today()} value={date} onChange={(e) => setDate(e.target.value)} /></label>{error && <p role="alert" className="error">{error}</p>}<div className="button-row"><button type="submit" className="btn primary">Save weight</button><button type="button" className="btn outline" onClick={() => setOpen(false)}>Cancel</button></div></form></section></div>, document.body)}
  </>;
}
