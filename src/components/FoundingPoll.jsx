import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { supabase } from '../lib/supabase.js'

/**
 * Founding-blocker 3-step notch survey — v3.
 *
 * Drops in immediately (locked for 20s so the visitor gets to
 * browse first), then unlocks and gently wiggles every ~4s to draw
 * attention. When the user hovers, the survey runs three steps:
 *
 *   Q1 — pick your blocker at $99 lifetime  (6 fixed options)
 *   Q2 — branches based on Q1 (different follow-ups per blocker)
 *   Q3 — final commitment gate (Yes / Maybe / No)
 *
 * After Q3, a soft email step invites the user to leave their
 * address — if their requested component is genuine, Alok promises
 * to ship it within 24 hours and personally reply.
 *
 * Progress is persisted to localStorage after every step, so if
 * the user closes the tab or navigates away, they resume on their
 * next visit exactly where they left off. Once submitted, the poll
 * never fires again on that browser.
 */

const STORAGE_KEY = 'cue.poll.founding-v3'
const PROGRESS_KEY = 'cue.poll.founding-v3.progress'
const TRIGGER_SECONDS = 20
const POLL_BASE_ID = 'founding-signal-v3'
const WIGGLE_INTERVAL_MS = 22_000 // downward nudge every 22s

const BLOCKERS = [
  { key: 'conditional_yes',      label: "I'll join once the component I want is added" },
  { key: 'need_more_components', label: 'Not enough components yet' },
  { key: 'need_more_proof',      label: 'I need to see more value first' },
  { key: 'price_high',           label: '$99 feels expensive' },
  { key: 'no_need_now',          label: "I don't need it right now" },
  { key: 'other',                label: 'Something else' },
]

const Q2_MAP = {
  conditional_yes: {
    title: 'Which one component would seal the deal?',
    type: 'text',
    placeholder: 'Paste an Awwwards / X link, or describe it. I ship genuine requests in 24 hrs.',
  },
  need_more_components: {
    title: 'Which category do you need most?',
    options: [
      { key: 'text',    label: 'Text animations' },
      { key: 'hero',    label: 'Hero sections' },
      { key: 'webgl',   label: '3D & WebGL' },
      { key: 'cards',   label: 'Cards & grids' },
      { key: 'buttons', label: 'Buttons & micro' },
      { key: 'pages',   label: 'Full page flows' },
    ],
  },
  need_more_proof: {
    title: 'What proof would tip you in?',
    options: [
      { key: 'testimonials', label: 'Testimonials from real users' },
      { key: 'demo',         label: 'See it working in a real project' },
      { key: 'trial',        label: 'A short free trial before I decide' },
      { key: 'preview',      label: 'A free preview of premium items' },
    ],
  },
  price_high: {
    title: 'What price would feel fair?',
    options: [
      { key: '49',       label: '$49 lifetime' },
      { key: '69',       label: '$69 lifetime' },
      { key: '79',       label: '$79 lifetime' },
      { key: 'monthly',  label: 'Monthly subscription (already live)' },
      { key: 'trial',    label: 'Free trial first (all free components already open)' },
      { key: 'other',    label: 'Something else — I\'ll write it in', prompt: true },
    ],
  },
  no_need_now: {
    title: 'When might Cue matter to you?',
    options: [
      { key: 'next_month',     label: 'Within a month' },
      { key: 'next_quarter',   label: 'Within a quarter' },
      { key: 'project_starts', label: 'When my next project kicks off' },
      { key: 'not_sure',       label: 'Honestly, not sure' },
    ],
  },
  missing_feature: {
    title: 'Which component is missing? Send me a link or a name.',
    type: 'text',
    placeholder: 'Awwwards / X link, or just describe it…',
  },
  other: {
    title: 'One line — what would make Cue a yes for you?',
    type: 'text',
    placeholder: 'Say it however feels natural…',
  },
}

const COMMITS = [
  { key: 'yes',   label: 'Yes — I would join' },
  { key: 'maybe', label: 'Maybe — depends' },
  { key: 'no',    label: 'No — still not for me' },
]

// Human-readable name for the category the user picked in Q2
// (need_more_components branch). Used to render the Q2b title so
// it reads "how many more Text components..." rather than a
// vague "how many more".
const CATEGORY_LABEL = {
  text:    'text-animation',
  hero:    'hero',
  webgl:   'WebGL / 3D',
  cards:   'card & grid',
  buttons: 'button & micro-interaction',
  pages:   'full-page-flow',
}

// Concrete supply-side follow-up — only fires when Q1 = "not
// enough components yet". Gives us the ideal-count target for
// the picked category so the roadmap has a number attached.
const IDEAL_COUNTS = [
  { key: 'sub_10',  label: 'Under 10 more' },
  { key: '10_25',   label: '10–25 more' },
  { key: '25_50',   label: '25–50 more' },
  { key: '50_100',  label: '50–100 more' },
  { key: '100_up',  label: 'More than 100' },
  { key: 'no_clue', label: 'Not sure, honestly' },
]

export default function FoundingPoll() {
  const { isSignedIn, isLoaded } = useUser()
  // 'hidden' | 'countdown' | 'ready' | 'q1' | 'q2' | 'q3' | 'email' | 'thanks' | 'gone'
  const [state, setState] = useState('hidden')
  const [secondsLeft, setSecondsLeft] = useState(TRIGGER_SECONDS)
  const [answers, setAnswers] = useState({ blocker: null, q2: null, q2Text: '', q2b: null, commit: null, email: '' })
  const [q2Text, setQ2Text] = useState('')
  const [emailText, setEmailText] = useState('')
  // When an option row is "prompt" (like the "Something else" row
  // on the price question), clicking it reveals a small inline
  // text input instead of advancing immediately.
  const [showOptionPrompt, setShowOptionPrompt] = useState(null)
  const [optionPromptText, setOptionPromptText] = useState('')
  // When the user clicks outside a mid-survey step, we collapse
  // to the chip but remember the exact step so re-hover resumes
  // right there instead of restarting from Q1.
  const [resumeStep, setResumeStep] = useState(null)
  // Measured height of whichever survey view is currently rendered.
  // The outer notch animates to this value so it hugs the content
  // instead of leaving empty space below short steps like Q3.
  const [contentHeight, setContentHeight] = useState(null)
  const sessionStartRef = useRef(Date.now())
  const notchRef = useRef(null)
  const contentRef = useRef(null)
  const wiggleTimerRef = useRef(null)

  // Load persisted progress. If the user picked a blocker earlier
  // but closed the tab before committing, they land right back on
  // the same step on next visit.
  useEffect(() => {
    if (!isLoaded) return
    // Show the poll to BOTH anon visitors and signed-in free-tier
    // users. Cue+ paying members are unlikely to see it — anyone
    // who submitted it once has the STORAGE_KEY flag set — but the
    // copy still reads sensibly for them ("would you join?") since
    // a Cue+ user would just tap "already joined" via the yes lane
    // or dismiss. Keeping this open to signed-in visitors triples
    // the sample size on the signal.
    let seen = false
    try { seen = localStorage.getItem(STORAGE_KEY) === '1' } catch {}
    if (seen) return
    try {
      const raw = localStorage.getItem(PROGRESS_KEY)
      if (raw) {
        const saved = JSON.parse(raw)
        if (saved?.answers) {
          setAnswers({
            blocker: saved.answers.blocker || null,
            q2: saved.answers.q2 || null,
            q2Text: saved.answers.q2Text || '',
            commit: saved.answers.commit || null,
            email: saved.answers.email || '',
          })
          setQ2Text(saved.answers.q2Text || '')
          setEmailText(saved.answers.email || '')
        }
        // Restore the last survey step so the next hover resumes
        // there. If they were mid-survey when the tab closed we
        // bring them back to the chip (collapsed) but remember the
        // exact step — they can pick up on hover.
        if (saved?.state && saved.state !== 'thanks' && saved.state !== 'gone') {
          setResumeStep(inSurveyRef(saved.state) ? saved.state : null)
        }
        setState('ready')
        setSecondsLeft(0)
        return
      }
    } catch {}
    setState('countdown')
    setSecondsLeft(TRIGGER_SECONDS)
  }, [isLoaded, isSignedIn])

  // Countdown ticker.
  useEffect(() => {
    if (state !== 'countdown') return
    if (secondsLeft <= 0) { setState('ready'); return }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [state, secondsLeft])

  // Persist progress on every meaningful change so the resume path
  // works even if the tab is closed mid-flow. When the user is
  // parked on the chip ('ready'), we still record `resumeStep` so
  // the next hover lands them exactly where they were.
  useEffect(() => {
    if (state === 'hidden' || state === 'gone' || state === 'countdown') return
    try {
      const persistState = inSurveyRef(state) ? state : (resumeStep || 'ready')
      localStorage.setItem(PROGRESS_KEY, JSON.stringify({
        state: persistState,
        answers: { ...answers, q2Text, email: emailText },
      }))
    } catch {}
  }, [state, resumeStep, answers, q2Text, emailText])

  // Measure the currently rendered survey view so the outer notch
  // can hug the content. useLayoutEffect fires before browser paint
  // so the initial height applies with the very first expand frame
  // — no two-step "expand-then-shrink" jump. ResizeObserver keeps
  // it honest when the textarea grows or the user switches Q2 mode.
  useLayoutEffect(() => {
    if (!inSurveyRef(state)) { setContentHeight(null); return }
    const node = contentRef.current
    if (!node) return
    const measure = () => setContentHeight(node.offsetHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(node)
    return () => ro.disconnect()
  }, [state])

  // Measure the chip text so the ready/locked notch snaps to hug
  // the current message instead of leaving big empty margins on
  // either side.
  const chipTextRef = useRef(null)
  const [chipWidth, setChipWidth] = useState(null)
  useLayoutEffect(() => {
    if (state !== 'countdown' && state !== 'ready') { setChipWidth(null); return }
    const node = chipTextRef.current
    if (!node) return
    const measure = () => {
      // 40px = 20px padding each side + 10px gap between dot and text
      // + 8px dot itself = ~46 buffer; keep 44 to be tight but readable.
      setChipWidth(node.scrollWidth + 60)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(node)
    return () => ro.disconnect()
  }, [state, secondsLeft])

  // Click-outside collapses the expanded survey back to the chip
  // without dismissing forever — so the user is never stuck. The
  // step is remembered in `resumeStep` (and mirrored to localStorage
  // via the progress effect) so that the next hover resumes exactly
  // where they left off instead of starting from Q1.
  useEffect(() => {
    if (!inSurveyRef(state)) return
    const onDocDown = (e) => {
      if (notchRef.current && !notchRef.current.contains(e.target)) {
        setResumeStep(state)
        setState('ready')
      }
    }
    document.addEventListener('pointerdown', onDocDown)
    return () => document.removeEventListener('pointerdown', onDocDown)
  }, [state])

  // Periodic wiggle to remind the user the notch is ready. Runs
  // only while state === 'ready' and the notch isn't hovered.
  useEffect(() => {
    if (state !== 'ready') return
    const trigger = () => {
      if (!notchRef.current) return
      notchRef.current.classList.remove('do-wiggle')
      // reflow so the class re-applies
      void notchRef.current.offsetWidth
      notchRef.current.classList.add('do-wiggle')
    }
    wiggleTimerRef.current = setInterval(trigger, WIGGLE_INTERVAL_MS)
    return () => { if (wiggleTimerRef.current) clearInterval(wiggleTimerRef.current) }
  }, [state])

  const dismissForever = () => {
    try { localStorage.setItem(STORAGE_KEY, '1') } catch {}
    try { localStorage.removeItem(PROGRESS_KEY) } catch {}
    setState('gone')
  }

  const recordStep = async (step, choice, freeText) => {
    const payload = {
      poll_id: `${POLL_BASE_ID}:${step}`,
      choice: choice || null,
      free_text: freeText || null,
      page_path: typeof window !== 'undefined' ? window.location.hash || '/' : null,
      seconds_on_site: Math.round((Date.now() - sessionStartRef.current) / 1000),
      session_id: getSessionId(),
    }
    try {
      if (supabase) await supabase.from('poll_responses').insert(payload)
    } catch (err) {
      console.warn('Poll insert failed', err)
    }
    try { window.posthog?.capture?.('poll_step_submitted', payload) } catch {}
  }

  // ---- Handlers ----
  const answerQ1 = (opt) => {
    setAnswers((a) => ({ ...a, blocker: opt.key }))
    recordStep('blocker', opt.key)
    setState('q2')
  }

  const answerQ2 = (opt) => {
    // Prompt option — reveal inline text field, don't advance yet.
    if (opt.prompt) {
      setShowOptionPrompt(opt.key)
      setOptionPromptText('')
      return
    }
    setAnswers((a) => ({ ...a, q2: opt.key }))
    recordStep(`q2:${answers.blocker}`, opt.key)
    // Extra follow-up for "need more components" — ask how many
    // would be ideal so we have a concrete supply-side target,
    // not just "more".
    if (answers.blocker === 'need_more_components') {
      setState('q2b')
      return
    }
    setState('q3')
  }

  const submitOptionPrompt = () => {
    const trimmed = optionPromptText.trim().slice(0, 200)
    setAnswers((a) => ({ ...a, q2: showOptionPrompt, q2Text: trimmed }))
    recordStep(`q2:${answers.blocker}`, showOptionPrompt, trimmed || null)
    setShowOptionPrompt(null)
    setState('q3')
  }

  const submitQ2Text = () => {
    const trimmed = q2Text.trim().slice(0, 500)
    setAnswers((a) => ({ ...a, q2Text: trimmed }))
    recordStep(`q2:${answers.blocker}`, null, trimmed || null)
    setState('q3')
  }

  const answerQ2b = (opt) => {
    setAnswers((a) => ({ ...a, q2b: opt.key }))
    recordStep('q2b:ideal_count', opt.key)
    setState('q3')
  }

  const answerQ3 = (opt) => {
    setAnswers((a) => ({ ...a, commit: opt.key }))
    recordStep('commit', opt.key)
    // Every commit answer routes through the contact step first.
    // Yes-buyers still land on the pricing page — but only AFTER
    // they leave a way for Alok to reach them, so a hot lead is
    // never lost to a redirect.
    setState('email')
  }

  const submitEmail = () => {
    // Compulsory contact step — poll answers are more useful when
    // Alok can actually reach back with a shipped component or a
    // follow-up question. Accepts a real email or an X handle only;
    // anything else (LinkedIn URLs, phone numbers, "nope") is
    // rejected so the data column stays clean.
    const clean = emailText.trim().slice(0, 120)
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)
    const isXHandle = /^@?[a-z0-9_]{1,15}$/i.test(clean)
    if (!isEmail && !isXHandle) return
    setAnswers((a) => ({ ...a, email: clean }))
    recordStep('contact', null, clean || null)
    try { localStorage.setItem(STORAGE_KEY, '1') } catch {}
    try { localStorage.removeItem(PROGRESS_KEY) } catch {}
    if (answers.commit === 'yes') {
      setState('gone')
      window.location.hash = '#/pricing'
      return
    }
    setState('thanks')
    setTimeout(() => setState('gone'), 2000)
  }


  // Back navigation
  const goBack = () => {
    if (state === 'q2') setState('q1')
    else if (state === 'q2b') setState('q2')
    else if (state === 'q3') {
      // If they came from the ideal-count follow-up, drop them
      // back there — not one step further to the category picker.
      setState(answers.blocker === 'need_more_components' ? 'q2b' : 'q2')
    }
    else if (state === 'email') setState('q3')
  }

  // Hover on desktop / tap on mobile both call the same handler.
  // Once the user is in the survey, hover-off no longer collapses
  // — only a click outside does.
  const openSurvey = () => {
    if (state !== 'ready') return
    setState(resumeStep || 'q1')
  }
  const onEnter = openSurvey
  const onLeave = () => { /* stay open once user has entered survey */ }
  const onChipClick = (e) => {
    // Only capture taps on the chip itself, not on things inside
    // the expanded survey (buttons handle their own clicks).
    if (state !== 'ready') return
    e.stopPropagation()
    openSurvey()
  }

  if (state === 'hidden' || state === 'gone') return null

  const isCountdown = state === 'countdown'
  const isReady = state === 'ready'
  const inSurvey = state === 'q1' || state === 'q2' || state === 'q2b' || state === 'q3' || state === 'email'
  const thanks = state === 'thanks'

  // Pips: 4 slots for q1, q2, q3, email
  // q2b (the "ideal count" follow-up for need_more_components) shares
  // the second pip with q2 so the progress bar doesn't visually
  // regress when the extra step fires.
  const stepIndex = state === 'q1' ? 0
    : state === 'q2' || state === 'q2b' ? 1
    : state === 'q3' ? 2
    : state === 'email' ? 3 : -1

  const q2Config = answers.blocker ? Q2_MAP[answers.blocker] : null
  const q2IsText = q2Config?.type === 'text'

  return (
    <div className="cue-notch-container">
      <div
        ref={notchRef}
        className={[
          'cue-notch',
          'is-active',
          isCountdown ? 'is-locked' : '',
          isReady ? 'is-ready' : '',
          inSurvey ? 'is-expanded' : '',
          thanks ? 'is-thanks' : '',
        ].filter(Boolean).join(' ')}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onClick={onChipClick}
        style={
          inSurvey && contentHeight
            ? { height: contentHeight }
            : (isCountdown || isReady) && chipWidth
              ? { width: chipWidth }
              : undefined
        }
      >
        {/* Countdown */}
        <div className={`cue-notch-view cue-notch-locked ${isCountdown ? 'is-on' : ''}`}>
          <span ref={isCountdown ? chipTextRef : null}>
            <span className="cue-notch-long-text">Explore Cue · </span>
            <span className="cue-notch-short-text">Cue · </span>
            {secondsLeft}s
          </span>
        </div>

        {/* Ready — non-intrusive prompt. User can keep exploring
            and come back when they feel like answering. Whatever
            they've already filled is preserved in localStorage. */}
        <div className={`cue-notch-view cue-notch-compact ${isReady ? 'is-on' : ''}`}>
          <span className="cue-notch-dot" />
          <span ref={isReady ? chipTextRef : null} className="cue-notch-compact-text">
            <span className="cue-notch-long-text">Take your time — tap here to answer</span>
            <span className="cue-notch-short-text">Quick question</span>
          </span>
        </div>

        {/* Expanded survey */}
        {inSurvey && (
          <div className="cue-notch-view cue-notch-poll is-on" ref={contentRef}>
            <div className="cue-notch-topbar">
              {(state === 'q2' || state === 'q2b' || state === 'q3' || state === 'email') ? (
                <button type="button" className="cue-notch-back" aria-label="Back" onClick={goBack}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  Back
                </button>
              ) : <span />}
              <button type="button" className="cue-notch-close" aria-label="Close for now" onClick={() => { setResumeStep(state); setState('ready') }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="cue-notch-progress">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={`cue-notch-pip ${i <= stepIndex ? 'is-on' : ''}`} />
              ))}
            </div>
            <div className="cue-notch-eyebrow">Alok, founder of Cue</div>

            {state === 'q1' && (
              <>
                <div className="cue-notch-title">
                  What&apos;s stopping you at <strong>$99 lifetime</strong>?
                </div>
                <div className="cue-notch-options">
                  {BLOCKERS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      className="cue-notch-option"
                      onClick={() => answerQ1(opt)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="cue-notch-foot">1 of 3 · one click per step</div>
              </>
            )}

            {state === 'q2' && q2Config && (
              <>
                <div className="cue-notch-title">{q2Config.title}</div>
                {q2IsText ? (
                  <>
                    <textarea
                      className="cue-notch-textarea"
                      placeholder={q2Config.placeholder || 'Tell me…'}
                      value={q2Text}
                      onChange={(e) => setQ2Text(e.target.value.slice(0, 500))}
                      rows={3}
                      autoFocus
                    />
                    <div className="cue-notch-actions">
                      <button type="button" onClick={submitQ2Text} className="cue-notch-submit">
                        Next →
                      </button>
                      <button type="button" onClick={submitQ2Text} className="cue-notch-skip">Skip</button>
                    </div>
                  </>
                ) : (
                  <div className="cue-notch-options">
                    {q2Config.options.map((opt) => (
                      <React.Fragment key={opt.key}>
                        <button
                          type="button"
                          className={`cue-notch-option ${showOptionPrompt === opt.key ? 'is-active' : ''}`}
                          onClick={() => answerQ2(opt)}
                        >
                          {opt.label}
                        </button>
                        {showOptionPrompt === opt.key && (
                          <div className="cue-notch-inline-input">
                            <input
                              type="text"
                              className="cue-notch-input"
                              placeholder="Type your answer…"
                              value={optionPromptText}
                              onChange={(e) => setOptionPromptText(e.target.value.slice(0, 200))}
                              autoFocus
                              onKeyDown={(e) => { if (e.key === 'Enter') submitOptionPrompt() }}
                            />
                            <button
                              type="button"
                              className="cue-notch-submit"
                              onClick={submitOptionPrompt}
                              disabled={!optionPromptText.trim()}
                            >
                              Next →
                            </button>
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                )}
                <div className="cue-notch-foot">2 of 3</div>
              </>
            )}

            {state === 'q2b' && (
              <>
                <div className="cue-notch-title">
                  How many more components would tip you in?
                </div>
                <div className="cue-notch-options">
                  {IDEAL_COUNTS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      className="cue-notch-option"
                      onClick={() => answerQ2b(opt)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="cue-notch-foot">Almost there · one tap for the number</div>
              </>
            )}

            {state === 'q3' && (
              <>
                <div className="cue-notch-title">
                  If Cue added that, would you join at <strong>$99</strong>?
                </div>
                <div className="cue-notch-options">
                  {COMMITS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      className="cue-notch-option"
                      onClick={() => answerQ3(opt)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="cue-notch-foot">3 of 3 · thanks for the signal</div>
              </>
            )}

            {state === 'email' && (() => {
              const raw = emailText.trim()
              const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)
              const isXHandle = /^@?[a-z0-9_]{1,15}$/i.test(raw)
              const valid = isEmail || isXHandle
              return (
                <>
                  <div className="cue-notch-title">How can I reach you?</div>
                  <div className="cue-notch-subtitle">
                    Email or X handle — required. If what you asked for is genuinely useful, I ship it within 24 hours and ping you when it&apos;s live on Cue.
                  </div>
                  <input
                    type="text"
                    className="cue-notch-input"
                    placeholder="you@email.com  or  @yourhandle"
                    value={emailText}
                    onChange={(e) => setEmailText(e.target.value.slice(0, 120))}
                    autoFocus
                  />
                  <div className="cue-notch-actions">
                    <button
                      type="button"
                      onClick={submitEmail}
                      disabled={!valid}
                      className="cue-notch-submit"
                    >
                      Send to Alok →
                    </button>
                  </div>
                  <div className="cue-notch-foot">
                    {raw && !valid
                      ? 'Use a real email or an X handle (@username).'
                      : 'One reply. No newsletter spam.'}
                  </div>
                </>
              )
            })()}
          </div>
        )}

        <div className={`cue-notch-view cue-notch-thanks ${thanks ? 'is-on' : ''}`}>
          <span>Noted. You&apos;ll hear from Alok.</span>
        </div>

        <span className="cue-notch-curve cue-notch-curve-left" aria-hidden="true" />
        <span className="cue-notch-curve cue-notch-curve-right" aria-hidden="true" />
      </div>

      <style>{`
        .cue-notch-container {
          position: fixed; top: 0; left: 50%; transform: translateX(-50%);
          z-index: 200; pointer-events: none;
          font-family: var(--font-sans, system-ui);
        }
        .cue-notch {
          background: #FFFFFF;
          border: 1px solid rgba(20,17,14,0.05);
          border-top: none;
          box-shadow: 0 12px 28px -8px rgba(20,17,14,0.18),
                      0 2px 6px rgba(20,17,14,0.06);
          height: 0; width: 340px;
          border-bottom-left-radius: 20px;
          border-bottom-right-radius: 20px;
          position: relative;
          overflow: hidden;
          pointer-events: auto;
          /* Slow, buttery expansion — a light spring on height so
             the notch feels alive, quicker on width/box-shadow so
             the overall motion still lands under a second. */
          transition: height 0.66s cubic-bezier(0.22, 1.02, 0.36, 1),
                      width 0.5s cubic-bezier(0.22, 1, 0.36, 1),
                      border-radius 0.5s cubic-bezier(0.22, 1, 0.36, 1),
                      box-shadow 0.5s ease,
                      opacity 0.4s ease;
        }
        .cue-notch.is-active { height: 46px; }
        .cue-notch.is-locked { background: #FDFCFA; }
        /* Chip widths are set inline from the measured text width so
           the notch always hugs its content — no empty margins, no
           clipping. min-width prevents an awkward tiny bubble. */
        .cue-notch.is-active { min-width: 260px; }
        .cue-notch.is-expanded {
          /* height is set inline from React based on the measured
             inner content — falls back to a sensible max in case
             the measurement hasn't run yet on first paint. */
          height: 520px; width: 400px;
          max-height: 620px;
          border-bottom-left-radius: 24px;
          border-bottom-right-radius: 24px;
          box-shadow: 0 32px 68px -18px rgba(20,17,14,0.35),
                      0 6px 14px rgba(20,17,14,0.10);
          /* Longer, softer easing — the notch glides into the
             expanded card instead of snapping. */
          transition: height 0.66s cubic-bezier(0.22, 1.02, 0.36, 1),
                      width 0.5s cubic-bezier(0.22, 1, 0.36, 1),
                      border-radius 0.5s cubic-bezier(0.22, 1, 0.36, 1),
                      box-shadow 0.5s ease;
        }
        .cue-notch.is-thanks { height: 58px; }

        /* Wiggle triggers via .do-wiggle class flipped from JS.
           Bias the motion downward so it feels like the notch is
           trying to drop into view — signals "hover to open" to
           anyone glancing at the top of the screen. */
        .cue-notch.do-wiggle {
          animation: cue-notch-wiggle 1s cubic-bezier(0.34, 1.4, 0.64, 1);
        }
        .cue-notch.is-ready:hover, .cue-notch.is-expanded { animation: none !important; }
        @keyframes cue-notch-wiggle {
          0%   { transform: translateY(0); }
          25%  { transform: translateY(11px); }
          40%  { transform: translateY(3px); }
          60%  { transform: translateY(9px); }
          75%  { transform: translateY(2px); }
          90%  { transform: translateY(6px); }
          100% { transform: translateY(0); }
        }

        .cue-notch-view {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          opacity: 0; pointer-events: none;
          transition: opacity 0.28s ease;
        }
        .cue-notch-view.is-on { opacity: 1; pointer-events: auto; transition-delay: 0.22s; }

        .cue-notch-locked {
          gap: 8px; color: rgba(20,17,14,0.55);
          font-size: 13px; font-weight: 500; letter-spacing: -0.005em;
          cursor: not-allowed;
          padding: 0 14px;
        }
        .cue-notch-timer {
          display: inline-flex; align-items: center;
          color: rgba(20,17,14,0.42);
          font-size: 12px; font-weight: 600;
          font-variant-numeric: tabular-nums;
          margin-left: auto;
        }
        .cue-notch-compact {
          gap: 10px; color: #14110E;
          font-size: 13px; font-weight: 500;
          padding: 0 20px;
          white-space: nowrap;
          cursor: pointer;
        }
        .cue-notch-dot {
          width: 7px; height: 7px; border-radius: 999px;
          background: var(--electric, #3B82F6);
          box-shadow: 0 0 0 3px rgba(59,130,246,0.16);
          animation: cue-notch-pulse 2.4s ease-in-out infinite;
        }
        @keyframes cue-notch-pulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(59,130,246,0.16); }
          50%      { box-shadow: 0 0 0 6px rgba(59,130,246,0.04); }
        }

        .cue-notch-curve {
          position: absolute; top: 0; width: 14px; height: 14px;
          opacity: 0; transition: opacity 0.3s ease; pointer-events: none;
        }
        .cue-notch.is-active .cue-notch-curve { opacity: 1; }
        .cue-notch-curve-left  { left: -14px;  background: radial-gradient(circle at 0 100%, transparent 14px, #FFFFFF 14px); }
        .cue-notch-curve-right { right: -14px; background: radial-gradient(circle at 100% 100%, transparent 14px, #FFFFFF 14px); }

        .cue-notch-poll {
          /* Take the poll out of absolute-fill so it self-sizes and
             the outer notch height animates to its measured height. */
          position: relative !important;
          inset: auto !important;
          flex-direction: column;
          justify-content: flex-start;
          padding: 12px 20px 14px;
          gap: 4px;
          color: #14110E;
          width: 100%;
          box-sizing: border-box;
        }
        .cue-notch-topbar {
          width: 100%; display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 8px;
        }
        .cue-notch-back {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 11.5px; font-weight: 500;
          color: rgba(20,17,14,0.55);
          background: transparent; border: none; padding: 4px 8px 4px 4px;
          border-radius: 999px; cursor: pointer;
        }
        .cue-notch-back:hover { color: #14110E; background: rgba(20,17,14,0.05); }
        .cue-notch-close {
          width: 22px; height: 22px; border-radius: 999px;
          border: 1px solid rgba(20,17,14,0.10);
          background: rgba(255,255,255,0.6); color: rgba(20,17,14,0.55);
          cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
        }
        .cue-notch-close:hover { color: #14110E; background: #fff; }
        .cue-notch-progress {
          display: flex; gap: 5px; justify-content: center; margin-bottom: 10px;
        }
        .cue-notch-pip {
          width: 22px; height: 3px; border-radius: 2px;
          background: rgba(20,17,14,0.10);
          transition: background 0.3s ease;
        }
        .cue-notch-pip.is-on { background: var(--electric, #3B82F6); }
        .cue-notch-eyebrow {
          font-size: 10.5px; letter-spacing: 0.06em;
          color: rgba(20,17,14,0.45); font-weight: 500;
          margin-bottom: 4px; text-align: center;
        }
        .cue-notch-title {
          font-weight: 600; font-size: 16px;
          color: #14110E; letter-spacing: -0.015em;
          line-height: 1.35; text-align: center;
          margin-bottom: 10px;
        }
        .cue-notch-subtitle {
          font-size: 12.5px; color: rgba(20,17,14,0.55);
          line-height: 1.5; text-align: center;
          margin-bottom: 12px;
        }
        .cue-notch-options {
          display: flex; flex-direction: column;
          gap: 8px; width: 100%;
        }
        .cue-notch-option {
          background: #fff;
          border: 1px solid rgba(20,17,14,0.10);
          color: #14110E;
          padding: 11px 12px;
          border-radius: 10px;
          font-size: 13px; font-weight: 500;
          font-family: inherit;
          cursor: pointer; text-align: left;
          transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .cue-notch-option:hover {
          background: #14110E; color: #fff;
          border-color: #14110E;
          transform: translateY(-1px);
          box-shadow: 0 8px 16px -6px rgba(20,17,14,0.28);
        }
        .cue-notch-option.is-cta {
          background: var(--electric, #3B82F6);
          color: #fff; border-color: var(--electric, #3B82F6);
          font-weight: 600;
        }
        .cue-notch-option.is-cta:hover {
          background: #2255dd; border-color: #2255dd;
          box-shadow: 0 10px 20px -6px rgba(59,130,246,0.55);
        }
        .cue-notch-option.is-hot {
          background: rgba(204,255,0,0.14);
          border-color: rgba(204,255,0,0.55);
          color: #14110E; font-weight: 600;
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
        }
        .cue-notch-option.is-hot:hover {
          background: #ccff00;
          border-color: #ccff00;
          color: #14110E;
          transform: translateY(-1px);
          box-shadow: 0 10px 20px -6px rgba(204,255,0,0.55);
        }
        .cue-notch-hot-tag {
          font-size: 9.5px; font-weight: 700;
          letter-spacing: 0.10em;
          padding: 3px 8px; border-radius: 999px;
          background: #14110E; color: #ccff00;
          flex-shrink: 0;
        }
        .cue-notch-textarea, .cue-notch-input {
          width: 100%; padding: 10px 12px; border-radius: 10px;
          background: #fff;
          border: 1px solid rgba(20,17,14,0.14);
          color: #14110E; font-family: inherit; font-size: 13px;
          outline: none; box-sizing: border-box; resize: none;
        }
        .cue-notch-textarea:focus, .cue-notch-input:focus { border-color: var(--electric, #3B82F6); }
        .cue-notch-textarea::placeholder, .cue-notch-input::placeholder { color: rgba(20,17,14,0.35); }
        .cue-notch-actions { display: flex; justify-content: space-between; gap: 10px; margin-top: 10px; }
        .cue-notch-option.is-active { background: #14110E; color: #fff; border-color: #14110E; }
        .cue-notch-inline-input {
          display: flex; gap: 8px; margin: 2px 0 4px;
        }
        .cue-notch-inline-input .cue-notch-input { flex: 1; }
        .cue-notch-inline-input .cue-notch-submit { flex: 0 0 auto; padding: 8px 14px; }
        .cue-notch-submit {
          flex: 1; padding: 10px 14px; border-radius: 999px;
          background: #14110E; color: #fff; border: none;
          font-weight: 600; font-size: 13px;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
        }
        .cue-notch-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 18px -6px rgba(20,17,14,0.4);
        }
        .cue-notch-submit:disabled { opacity: 0.4; cursor: not-allowed; }
        .cue-notch-skip {
          padding: 10px 14px; border: none; background: transparent;
          color: rgba(20,17,14,0.5); font-size: 13px; cursor: pointer;
        }
        .cue-notch-skip:hover { color: #14110E; }
        .cue-notch-foot {
          font-size: 10.5px; color: rgba(20,17,14,0.4);
          text-align: center; margin-top: 8px;
        }
        .cue-notch-thanks {
          color: #14110E;
          font-weight: 600; font-size: 14px;
          letter-spacing: -0.01em;
        }

        /* Desktop shows the full-sentence chip. Mobile swaps to a
           tighter two-word version so it can't hide the Pricing /
           Login pills in the top nav. */
        .cue-notch-short-text { display: none; }

        @media (max-width: 720px) {
          .cue-notch-long-text { display: none; }
          .cue-notch-short-text { display: inline; }

          .cue-notch.is-active { min-width: 0; }
          .cue-notch-compact,
          .cue-notch-locked {
            font-size: 10.5px;
            padding: 0 10px;
            gap: 5px;
          }
          .cue-notch-dot { width: 5px; height: 5px; box-shadow: 0 0 0 2px rgba(59,130,246,0.16); }
          .cue-notch.is-active { height: 28px; }
          .cue-notch { border-bottom-left-radius: 12px; border-bottom-right-radius: 12px; }
          .cue-notch-curve { display: none; }
          .cue-notch.is-expanded {
            width: calc(100vw - 24px); max-width: 400px; height: 540px;
            border-bottom-left-radius: 20px;
            border-bottom-right-radius: 20px;
          }
        }
      `}</style>
    </div>
  )
}

function inSurveyRef(state) {
  return state === 'q1' || state === 'q2' || state === 'q2b' || state === 'q3' || state === 'email'
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
