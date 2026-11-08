import React, { useEffect } from 'react';
export default function WelcomeSplash({ onDone, afterOnboarding = false }) {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(onDone, reduced ? 700 : 2600);
    return () => clearTimeout(timer);
  }, [onDone]);
  return <main className="welcome-splash" aria-label="Welcome to Refridge" onAnimationEnd={(e) => { if (e.target === e.currentTarget && e.animationName === 'welcome-splash-out') onDone(); }}>
    <div className="welcome-splash-content" role="status">
      {afterOnboarding && <p className="welcome-splash-intro">Welcome To</p>}
      <div className="welcome-splash-brand"><img src="/fridge-mark.svg" alt="" /><span>Refridge<span className="welcome-splash-dot">.</span></span></div>
      <p>A little more care for your kitchen.</p>
    </div>
  </main>;
}
