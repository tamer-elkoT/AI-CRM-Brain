/**
 * SplashScreen.tsx — Rabih CRM Premium Loading Screen
 *
 * Renders a full-screen overlay that:
 *  1. Plays a logo zoom-in + pulsing ring animation on mount / re-trigger
 *  2. Shows a smooth progress bar animation
 *  3. Fades out over 500ms when `isVisible` becomes false
 *  4. Calls `onDone()` after fade completes → parent unmounts the component
 *
 * Props:
 *   isVisible   — false triggers the 500ms CSS fade-out
 *   onDone      — called after fade; use to set isMounted=false in parent
 *   message     — optional status line (defaults to "Initializing AI…")
 *
 * No framer-motion — pure CSS keyframes in index.css "SPLASH SCREEN ANIMATIONS"
 */

import { useEffect, useState } from 'react';

interface SplashScreenProps {
  isVisible: boolean;
  onDone: () => void;
  /** Optional status text shown below the progress bar */
  message?: string;
}

export default function SplashScreen({
  isVisible,
  onDone,
  message = 'Initializing AI Intelligence Engine…',
}: SplashScreenProps) {
  const [fadingOut, setFadingOut] = useState(false);
  /**
   * animKey forces the logo/progress animations to restart when
   * the splash is re-triggered (e.g. after a successful login).
   * Incrementing the key unmounts+remounts the animated children.
   */
  const [animKey, setAnimKey] = useState(0);

  // When isVisible flips back to true (re-trigger), reset anim key
  useEffect(() => {
    if (isVisible) {
      setFadingOut(false);
      setAnimKey((k) => k + 1);
    }
  }, [isVisible]);

  // When isVisible becomes false, begin fade-out then call onDone
  useEffect(() => {
    if (!isVisible) {
      setFadingOut(true);
      const timer = setTimeout(() => onDone(), 520);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onDone]);

  return (
    <div
      className={[
        'fixed inset-0 z-[200] flex items-center justify-center',
        'bg-[#0a0f1a]',
        fadingOut ? 'splash-fade-out pointer-events-none' : '',
      ].join(' ')}
      aria-hidden={fadingOut}
      role="status"
      aria-label="Loading Rabih CRM"
    >
      {/* ── Ambient teal radial glow ── */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(0,106,97,0.18) 0%, transparent 70%)',
        }}
      />

      {/* ── Pulsing decorative rings ── */}
      <div className="absolute flex items-center justify-center">
        <div
          className="splash-ring absolute rounded-full border border-[#006a61]/30"
          style={{ width: 320, height: 320 }}
        />
        <div
          className="splash-ring-delay absolute rounded-full border border-[#006a61]/20"
          style={{ width: 240, height: 240 }}
        />
      </div>

      {/* ── Animated central content — keyed so re-triggers restart animations ── */}
      <div key={animKey} className="relative z-10 flex flex-col items-center gap-8">

        {/* Logo + wordmark */}
        <div className="splash-logo-in flex flex-col items-center gap-5">
          <div
            className="relative flex items-center justify-center rounded-2xl overflow-hidden"
            style={{
              width: 120,
              height: 120,
              boxShadow: '0 0 0 1px rgba(0,106,97,0.3), 0 24px 64px rgba(0,0,0,0.6)',
            }}
          >
            {/*
             * Logo — served from /public/Rabih_Logo.jpeg
             * If you rename or relocate the file, update `src` here.
             */}
            <img
              src="/Rabih_Logo.jpeg"
              alt="Rabih CRM Logo"
              className="w-full h-full object-cover"
              draggable={false}
            />
            {/* Inner shine overlay */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 60%)',
              }}
            />
          </div>

          {/* Wordmark */}
          <div className="text-center">
            <h1
              className="font-black tracking-tight text-white"
              style={{ fontSize: 36, letterSpacing: '-0.02em', lineHeight: 1 }}
            >
              Rabih{' '}
              <span
                style={{
                  background: 'linear-gradient(90deg, #006a61, #2dd4bf)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                CRM
              </span>
            </h1>
            <p className="text-[#94a3b8] text-sm font-medium tracking-widest uppercase mt-2">
              رابح • Enterprise Intelligence
            </p>
          </div>
        </div>

        {/* Progress bar + dots + status message */}
        <div className="splash-tag-in flex flex-col items-center gap-4 w-64">
          {/* Thin progress bar */}
          <div className="w-full h-0.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="splash-bar-fill h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #006a61, #2dd4bf)' }}
            />
          </div>

          {/* Three staggered bounce dots */}
          <div className="flex items-center gap-2">
            <span className="splash-dot-1 block w-1.5 h-1.5 rounded-full bg-[#006a61]" />
            <span className="splash-dot-2 block w-1.5 h-1.5 rounded-full bg-[#006a61]" />
            <span className="splash-dot-3 block w-1.5 h-1.5 rounded-full bg-[#006a61]" />
          </div>

          {/* Dynamic status message */}
          <p className="text-[#475569] text-xs font-medium tracking-wide text-center">
            {message}
          </p>
        </div>
      </div>

      {/* ── Bottom brand strip ── */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center">
        <p className="text-[#1e293b] text-xs font-medium tracking-widest uppercase">
          Powered by Rabih AI · v2.0
        </p>
      </div>
    </div>
  );
}
