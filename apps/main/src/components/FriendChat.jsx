import React, { useEffect, useRef, useState } from "react";
import { Panel } from "./FeatureUI.jsx";
import { socialAction } from "../hooks/useFriendFridges.jsx";
const prompts = { meal: 'Meal collab · What should we cook together?', competition: 'Friendly competition · Ready for a food-saving challenge?' };
export default function FriendChat({ state, setState, navigate, onMealCollab }) {
  const demo = !!state.sampleAccount;
  const friends = (demo || state.socialSettings?.enabled ? state.members : []).filter((m) => demo ? m.demo && ['allen', 'ava'].includes(m.id) : m.remote);
  const [selected, setSelected] = useState(''), [draft, setDraft] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const friend = friends.find((m) => m.id === selected) || friends[0];
  const me = demo ? 'me' : state.ownSessionId;
  const recipient = demo ? friend?.id : friend?.id.replace(/^friend-/, '');
  const messages = (demo ? state.demoMessages || [] : state.friendMessages || []).filter((m) => (m.fromId === me && m.toId === recipient) || (m.toId === me && m.fromId === recipient));
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [friend?.id, messages.length]);
  async function send(prompt = null) {
    if (!friend || busy || (!prompt && !draft.trim())) return;
    const text = draft.trim(), toId = recipient;
    setBusy(true); setError('');
    try {
      if (demo) {
        const message = { id: crypto.randomUUID(), fromId: me, toId, text: prompt ? prompts[prompt] : text, kind: prompt ? 'system' : 'text', prompt, createdAt: new Date().toISOString() };
        setState((s) => ({ ...s, demoMessages: [...(s.demoMessages || []), message] }));
      } else {
        const message = await socialAction('/messages', { toId, text, prompt, clientId: crypto.randomUUID() });
        setState((s) => ({ ...s, friendMessages: [...(s.friendMessages || []).filter((m) => m.id !== message.id), message] }));
      }
      if (!prompt) setDraft('');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <Panel title="Messages" subtitle={demo ? 'Sample conversations · messages stay in this demo account.' : 'Private conversations with your accepted, sharing connections.'}>
    {!friend ? <div className="empty">Accept a connection in Kitchens to start chatting.</div> : <>
      <label className="field"><span>Conversation</span><select value={friend.id} onChange={(e) => { setSelected(e.target.value); setDraft(''); setError(''); }}>{friends.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <div className="friend-chat-history" role="log" aria-label={`Conversation with ${friend.name}`} aria-live="polite">
        {!messages.length && <p className="chat-system">Start a meal collab or a friendly competition</p>}
        {messages.map((m) => m.kind === 'system' ? <div className="chat-system" key={m.id}><span>{m.fromId === me ? 'You' : friend.name} · {m.text}</span><time dateTime={m.createdAt}>{new Date(m.createdAt).toLocaleString()}</time><button className="text-btn" onClick={() => m.prompt === 'meal' ? onMealCollab() : navigate('challenges')}>{m.prompt === 'meal' ? 'Plan a meal together' : 'View competition'} ↗</button></div> : <div key={m.id} className={`chat-message ${m.fromId === me ? 'mine' : ''}`}><small>{m.fromId === me ? 'You' : friend.name}</small><p>{m.text}</p><time dateTime={m.createdAt}>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div>)}
        <div ref={end} />
      </div>
      <div className="button-row chat-prompts"><button className="btn outline" disabled={busy} onClick={() => send('meal')}>Meal Collab</button><button className="btn outline" disabled={busy} onClick={() => send('competition')}>Friendly Competition</button></div>
      <form className="chat-composer" onSubmit={(e) => { e.preventDefault(); send(); }}><label className="field"><span>Message {friend.name}</span><textarea maxLength={2000} rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Plan a meal, share an idea…" required /></label><button className="btn primary" disabled={busy || !draft.trim()}>{busy ? 'Sending…' : 'Send message'}</button></form>
      {error && <p className="error" role="alert">{error}</p>}
    </>}
  </Panel>;
}
