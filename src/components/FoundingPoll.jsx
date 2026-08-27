import React, { useEffect, useState, useRef } from 'react'
import { useUser } from '@clerk/clerk-react'
import { supabase } from '../lib/supabase.js'

/**
 * Founding-blocker micro-poll.
 *
 * Triggers only for engaged anonymous visitors — after they've
 * scrolled past the hero AND spent ~45s on the site. Waits until
 * the Welcome card is off screen so it never stacks. Once shown,
 * users can Skip / dismiss (locks it out forever), or minimize it
 * to a small floating pill they can reopen any time this session.
 * A single response inserts into `poll_responses` (anon-friendly
 * RLS) and PostHog captures the same event.
 */

const STORAGE_KEY = 'cue.poll.founding-v1'
const MINIMIZED_KEY = 'cue.poll.founding-minimized'
const TRIGGER_SECONDS = 45
const SCROLL_TRIGGER_PX = 800
const POLL_ID = 'founding-blocker-v1'

const OPTIONS = [
  { key: 'more_text',     label: 'Text animation components' },
  { key: 'more_hero',     label: 'Hero variations' },
  { key: 'more_webgl',    label: 'WebGL / 3D' },
  { key: 'more_buttons',  label: 'Buttons / micro-interactions' },
  { key: 'more_code',     label: 'Full React code coverage' },
  { key: 'lower_price',   label: 'Different price' },
  { key: 'other',         label: 'Something else' },
]

export default function FoundingPoll() {
  const { isSignedIn, isLoaded } = useUser()
  const [visible, setVisible] = useState(false)
  const [minimized, setMinimized] = useState(() => {
    try { return sessionStorage.getItem(MINIMIZED_KEY) === '1' } catch { return false }
  })
  const [selected, setSelected] = useState(null)
  const [freeText, setFreeText] = useState('')
  const [priceText, setPriceText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const sessionStartRef = useRef(Date.now())
  const readyRef = useRef({ time: false, scroll: false })

  // Trigger — wait until (a) 45s elapsed, (b) user scrolled past
  // the hero, (c) Welcome card is off screen. Only then flip on.
  // Signed-in users are excluded. Once permanently dismissed the
  // localStorage flag stops the effect from ever running again.
  useEffect(() => {
    if (!isLoaded) return
    if (isSignedIn) return
    let seen = false
    try { seen = localStorage.getItem(STORAGE_KEY) === '1' } catch {}
    if (seen) return

    let poller = null

    const attemptShow = () => {
      // Sample the current scroll position on every tick — Cue uses
      // Lenis smooth scroll, which suppresses native `scroll` events,
      // so a plain listener never fires. Polling window.scrollY inside
      // the interval keeps us independent of the scroll library.
      if (!readyRef.current.scroll && window.scrollY > SCROLL_TRIGGER_PX) {
        readyRef.current.scroll = true
      }
      if (!readyRef.current.time) return
      if (!readyRef.current.scroll) return
      if (document.querySelector('.cue-welcome-backdrop')) return
      setVisible(true)
      if (poller) { clearInterval(poller); poller = null }
    }

    const timeTimer = setTimeout(() => {
      readyRef.current.time = true
      attemptShow()
    }, TRIGGER_SECONDS * 1000)

    // Runs every second — checks the time flag, samples current
    // scroll position, and verifies Welcome is off screen. Cheap
    // work, and once the poll shows the interval clears itself.
    poller = setInterval(attemptShow, 1000)

    return () => {
      clearTimeout(timeTimer)
      if (poller) clearInterval(poller)
    }
  }, [isLoaded, isSignedIn])

  // Esc dismisses the whole thing (persistent). No auto-close — the
  // minimize pill covers the "get it out of my way for now" case.
  useEffect(() => {
    if (!visible || minimized) return
    const onKey = (e) => { if (e.key === 'Escape') minimize() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, minimized])

  const minimize = () => {
    setMinimized(true)
    try { sessionStorage.setItem(MINIMIZED_KEY, '1') } catch {}
  }

  const expand = () => {
    setMinimized(false)
    try { sessionStorage.removeItem(MINIMIZED_KEY) } catch {}
  }

  const dismissPermanently = () => {
    try { localStorage.setItem(STORAGE_KEY, '1') } catch {}
    setVisible(false)
  }

  const submit = async () => {
    if (!selected || submitting) return
    if (selected === 'other' && !freeText.trim()) return
    if (selected === 'lower_price' && !priceText.trim()) return
    setSubmitting(true)

    let follow = null
    if (selected === 'other') follow = (freeText || '').slice(0, 500)
    else if (selected === 'lower_price') follow = `Fair price: ${priceText.trim().slice(0, 60)}`

    const payload = {
      poll_id: POLL_ID,
      choice: selected,
      free_text: follow,
      page_path: typeof window !== 'undefined' ? window.location.hash || '/' : null,
      seconds_on_site: Math.round((Date.now() - sessionStartRef.current) / 1000),
      session_id: getSessionId(),
    }

    try {
      if (supabase) {
        const { error } = await supabase.from('poll_responses').insert(payload)
        if (error) console.warn('Poll insert failed', error.message)
      }
    } catch (e) {
      console.warn('Poll submit exception', e)
    }

    try { window.posthog?.capture?.('poll_submitted', payload) } catch {}
    try { localStorage.setItem(STORAGE_KEY, '1') } catch {}

    setSubmitted(true)
    setTimeout(() => setVisible(false), 2200)
  }

  if (!visible) return null

  if (minimized && !submitted) {
    return (
      <button
        type="button"
        onClick={expand}
        className="cue-poll-mini"
        aria-label="Reopen founder feedback"
        title="Reopen feedback"
      >
        <span className="cue-poll-mini-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </span>
        <span className="cue-poll-mini-label">Feedback — click to open</span>
        <span className="cue-poll-mini-arrow">↗</span>
      </button>
    )
  }

  return (
    <div className="cue-poll" role="dialog" aria-label="Founding member poll">
      <div className="cue-poll-topbar">
        <button
          type="button"
          aria-label="Minimize"
          onClick={minimize}
          className="cue-poll-mini-btn"
          title="Minimize"
        >
          <svg width="12" height="2" viewBox="0 0 12 2" fill="none"><rect width="12" height="2" fill="currentColor"/></svg>
        </button>
        <button
          type="button"
          aria-label="Dismiss forever"
          onClick={dismissPermanently}
          className="cue-poll-close"
          title="Dismiss"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>

      {submitted ? (
        <div className="cue-poll-thankyou">
          <div className="cue-poll-thankyou-title">Got it — thank you.</div>
          <div className="cue-poll-thankyou-sub">
            If it's a genuine component request, give me 24 hours — I usually ship it right here. Come back and check.
            <br /><br />
            — Alok
          </div>
        </div>
      ) : (
        <>
          <div className="cue-poll-eyebrow">Hey — Alok, founder of Cue</div>
          <div className="cue-poll-title">
            What would make you a founding member?
          </div>
          <div className="cue-poll-sub">
            Cue is 2 weeks old and I ship every week. Tell me the one thing that would make you say yes.
          </div>

          <div className="cue-poll-options">
            {OPTIONS.map((opt) => (
              <label key={opt.key} className={`cue-poll-option ${selected === opt.key ? 'is-selected' : ''}`}>
                <input
                  type="radio"
                  name="poll-choice"
                  value={opt.key}
                  checked={selected === opt.key}
                  onChange={() => setSelected(opt.key)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>

          {selected === 'other' && (
            <textarea
              className="cue-poll-textarea"
              placeholder="Which component do you want? I'll ship it if it's genuine…"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value.slice(0, 500))}
              rows={2}
              autoFocus
            />
          )}

          {selected === 'lower_price' && (
            <input
              className="cue-poll-input"
              type="text"
              inputMode="numeric"
              placeholder="What price would feel fair? ($)"
              value={priceText}
              onChange={(e) => setPriceText(e.target.value.slice(0, 60))}
              autoFocus
            />
          )}

          <div className="cue-poll-promise">
            Genuine component requests ship here within ~24 hours. Come back and check — that's my promise.
          </div>

          <div className="cue-poll-actions">
            <button
              type="button"
              onClick={submit}
              disabled={!selected || submitting || (selected === 'other' && !freeText.trim()) || (selected === 'lower_price' && !priceText.trim())}
              className="cue-poll-submit"
            >
              {submitting ? 'Sending…' : 'Send →'}
            </button>
            <button
              type="button"
              onClick={minimize}
              className="cue-poll-skip"
            >
              Later
            </button>
          </div>
        </>
      )}

      <style>{`
        .cue-poll {
          position: fixed; bottom: 24px; left: 24px; z-index: 130;
          width: 320px; max-width: calc(100vw - 32px);
          box-sizing: border-box;
          background: #141416;
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 16px;
          box-shadow: 0 24px 60px -20px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06);
          color: var(--text, #f2f2ef);
          font-family: var(--font-sans, system-ui, sans-serif);
          padding: 20px 20px 18px;
          overflow: hidden;
          animation: cue-poll-in 380ms cubic-bezier(0.34, 1.05, 0.64, 1) both;
        }
        @keyframes cue-poll-in {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .cue-poll-topbar {
          position: absolute; top: 10px; right: 10px;
          display: inline-flex; gap: 6px;
        }
        .cue-poll-mini-btn, .cue-poll-close {
          width: 26px; height: 26px; border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.08);
          background: transparent; color: rgba(255,255,255,0.55);
          cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
        }
        .cue-poll-mini-btn:hover, .cue-poll-close:hover { color: #fff; background: rgba(255,255,255,0.06); }
        .cue-poll-eyebrow {
          font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase;
          color: var(--electric, #3B82F6); font-weight: 700; margin-bottom: 6px;
        }
        .cue-poll-title {
          font-family: var(--font-serif, 'Fraunces', Georgia, serif);
          font-style: italic; font-weight: 400; font-size: 20px; line-height: 1.15;
          color: var(--text, #f2f2ef); letter-spacing: -0.01em; margin-bottom: 4px;
        }
        .cue-poll-sub {
          font-size: 12px; color: var(--text-dim, #8a8a82);
          line-height: 1.45; margin-bottom: 14px;
        }
        .cue-poll-options { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
        .cue-poll-option {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 10px; border-radius: 8px; cursor: pointer;
          font-size: 12.5px; color: var(--text, #f2f2ef);
          transition: background 120ms ease, color 120ms ease;
        }
        .cue-poll-option:hover { background: rgba(255,255,255,0.04); }
        .cue-poll-option.is-selected { background: rgba(59,130,246,0.10); color: #fff; }
        .cue-poll-option input {
          appearance: none;
          width: 14px; height: 14px; border-radius: 999px;
          border: 1.5px solid rgba(255,255,255,0.30);
          margin: 0; flex-shrink: 0;
          transition: border-color 120ms ease, background 120ms ease;
        }
        .cue-poll-option input:checked {
          border-color: var(--electric, #3B82F6);
          background: radial-gradient(circle, var(--electric, #3B82F6) 0 5px, transparent 6px);
        }
        .cue-poll-textarea {
          width: 100%; margin-bottom: 12px;
          padding: 10px; border-radius: 8px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.10);
          color: var(--text, #f2f2ef); font-family: inherit; font-size: 13px;
          resize: none; outline: none;
        }
        .cue-poll-textarea:focus { border-color: var(--electric, #3B82F6); }
        .cue-poll-textarea::placeholder { color: rgba(255,255,255,0.34); }
        .cue-poll-input {
          width: 100%; margin-bottom: 12px;
          padding: 10px 12px; border-radius: 8px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.10);
          color: var(--text, #f2f2ef); font-family: inherit; font-size: 13px;
          outline: none; box-sizing: border-box;
        }
        .cue-poll-input:focus { border-color: var(--electric, #3B82F6); }
        .cue-poll-input::placeholder { color: rgba(255,255,255,0.34); }
        .cue-poll-promise {
          font-size: 11px; color: rgba(255,255,255,0.42);
          line-height: 1.4; margin-bottom: 12px;
          padding: 8px 10px; border-radius: 8px;
          background: rgba(59,130,246,0.06);
          border: 1px solid rgba(59,130,246,0.14);
        }
        .cue-poll-actions {
          display: flex; align-items: center; justify-content: space-between;
          gap: 10px; margin-top: 2px;
        }
        .cue-poll-submit {
          flex: 1; padding: 10px 16px; border-radius: 999px;
          background: var(--electric, #3B82F6); color: #fff;
          border: none; font-weight: 600; font-size: 13px;
          cursor: pointer; letter-spacing: 0.01em;
          transition: transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease;
        }
        .cue-poll-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 10px 24px -10px rgba(59,130,246,0.55);
        }
        .cue-poll-submit:disabled { opacity: 0.45; cursor: not-allowed; }
        .cue-poll-skip {
          padding: 10px 12px; border: none; background: transparent;
          color: rgba(255,255,255,0.55); font-size: 12.5px; cursor: pointer;
        }
        .cue-poll-skip:hover { color: #fff; }
        .cue-poll-thankyou { text-align: center; padding: 16px 4px 6px; }
        .cue-poll-thankyou-title {
          font-family: var(--font-serif, 'Fraunces', Georgia, serif);
          font-style: italic; font-size: 22px; margin-bottom: 8px;
        }
        .cue-poll-thankyou-sub { font-size: 12.5px; color: var(--text-dim, #8a8a82); line-height: 1.5; }

        .cue-poll-mini {
          position: fixed; bottom: 24px; left: 24px; z-index: 130;
          display: inline-flex; align-items: center; gap: 8px;
          padding: 12px 16px 12px 14px; border-radius: 999px;
          background: linear-gradient(135deg, var(--electric, #3B82F6) 0%, #2255dd 100%);
          color: #fff;
          border: 1px solid rgba(255,255,255,0.16);
          box-shadow: 0 12px 32px -8px rgba(59,130,246,0.55), 0 0 0 4px rgba(59,130,246,0.08);
          font-family: var(--font-sans, system-ui, sans-serif);
          font-size: 13px; font-weight: 600; letter-spacing: 0.01em;
          cursor: pointer;
          animation: cue-poll-mini-in 420ms cubic-bezier(0.34, 1.4, 0.64, 1) both,
                     cue-poll-mini-bob 3.6s ease-in-out 500ms infinite;
          transition: transform 200ms ease, box-shadow 200ms ease;
        }
        .cue-poll-mini:hover {
          transform: translateY(-2px) scale(1.03);
          box-shadow: 0 20px 44px -10px rgba(59,130,246,0.65), 0 0 0 6px rgba(59,130,246,0.12);
        }
        .cue-poll-mini-icon {
          display: inline-flex; align-items: center; justify-content: center;
          width: 22px; height: 22px; border-radius: 999px;
          background: rgba(255,255,255,0.18);
        }
        .cue-poll-mini-label { line-height: 1; }
        .cue-poll-mini-arrow {
          font-size: 14px; margin-left: 2px; opacity: 0.85;
        }
        @keyframes cue-poll-mini-in {
          from { opacity: 0; transform: translateY(20px) scale(0.9); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes cue-poll-mini-bob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-4px); }
        }
        @media (max-width: 480px) {
          .cue-poll { bottom: 12px; left: 12px; right: 12px; width: auto; }
          .cue-poll-mini { bottom: 84px; left: 12px; right: auto; }
        }
      `}</style>
    </div>
  )
}

function getSessionId() {
  try {
    let id = sessionStorage.getItem('cue.session_id')
    if (!id) {
      id = 'sess_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
      sessionStorage.setItem('cue.session_id', id)
    }
    return id
  } catch {
    return null
  }
}
