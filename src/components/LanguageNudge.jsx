import { useEffect, useState } from 'react'

/**
 * LanguageNudge — small floating pill for non-English browsers.
 *
 * Detects Chinese browsers (zh, zh-CN, zh-TW, zh-HK) on mount and
 * offers a one-click Google-Translate view of cuedesign.space in
 * Simplified Chinese. Cheapest possible localisation while a real
 * /zh landing page doesn't exist yet — buys the friction-free option
 * for users who genuinely can't read English fluently.
 *
 * Extendable to other languages later (add cases in `detectTargetLang`).
 *
 * UX:
 *   • Shows a bottom-right pill "查看中文版 ↗" for zh-* browsers
 *   • Persists dismiss in localStorage so it doesn't re-appear on
 *     every page reload
 *   • Click routes through translate.google.com so the user sees
 *     the current live site in their language — no build step, no
 *     stale translations
 */
const STORAGE_KEY = 'cue.language-nudge.dismissed'

function detectTargetLang() {
  if (typeof navigator === 'undefined') return null
  const langs = [
    navigator.language,
    ...(navigator.languages || []),
  ].filter(Boolean).map((l) => l.toLowerCase())
  if (langs.some((l) => l.startsWith('zh'))) {
    return { code: 'zh-CN', label: '查看中文版', tooltip: 'View this page in Simplified Chinese (via Google Translate)' }
  }
  return null
}

function translateUrl(langCode) {
  const src = encodeURIComponent(window.location.href)
  return `https://translate.google.com/translate?sl=en&tl=${langCode}&u=${src}`
}

export default function LanguageNudge() {
  const [target, setTarget] = useState(null)
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return true
    try { return localStorage.getItem(STORAGE_KEY) === '1' } catch { return false }
  })

  useEffect(() => {
    if (dismissed) return
    setTarget(detectTargetLang())
  }, [dismissed])

  if (dismissed || !target) return null

  return (
    <div
      className="cue-lang-nudge"
      style={{
        position: 'fixed',
        bottom: 20,
        left: 20,
        zIndex: 90,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px 8px 14px',
        background: 'rgba(6,6,6,0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 999,
        boxShadow: '0 12px 32px rgba(0,0,0,0.55)',
        fontFamily: 'var(--font-sans)',
        fontSize: 12,
        color: 'var(--text)',
        letterSpacing: '0.01em',
        animation: 'cueLangNudgeIn 320ms cubic-bezier(0.19, 1, 0.22, 1)',
      }}
    >
      <a
        href={translateUrl(target.code)}
        target="_blank"
        rel="noopener noreferrer"
        title={target.tooltip}
        onClick={() => {
          try { window.posthog?.capture?.('language_nudge_click', { target: target.code }) } catch {}
        }}
        style={{
          color: 'var(--text)', textDecoration: 'none',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}
      >
        <span aria-hidden="true" style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 18, height: 18, borderRadius: 999,
          background: 'var(--electric)', color: '#fff',
          fontSize: 10, fontWeight: 700,
        }}>文</span>
        <span>{target.label}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7 17L17 7M9 7h8v8" />
        </svg>
      </a>
      <button
        type="button"
        onClick={() => {
          setDismissed(true)
          try { localStorage.setItem(STORAGE_KEY, '1') } catch {}
        }}
        aria-label="Dismiss language nudge"
        style={{
          background: 'transparent', border: 'none',
          color: 'rgba(255,255,255,0.5)',
          cursor: 'pointer',
          width: 20, height: 20, borderRadius: 999,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          padding: 0,
          marginLeft: 2,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.9)' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
      <style>{`
        @keyframes cueLangNudgeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 520px) {
          .cue-lang-nudge { left: 12px; bottom: 12px; font-size: 11.5px; }
        }
      `}</style>
    </div>
  )
}
