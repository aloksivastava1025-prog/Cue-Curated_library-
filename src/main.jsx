import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { dark } from '@clerk/themes'
import App from './App.jsx'
import { initSentry } from './lib/sentry.js'
import { initAnalytics } from './lib/analytics.js'
import 'lenis/dist/lenis.css'
import './index.css'
import './styles/mobile.css'

// Initialise error reporting before any component renders so we catch
// setup-time crashes too. No-op when VITE_SENTRY_DSN isn't set.
initSentry()
initAnalytics()

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key")
}

// CUE-branded Clerk theme. Applied globally so every SignIn / SignUp /
// UserButton modal picks it up — no per-component appearance overrides.
const clerkAppearance = {
  baseTheme: dark,
  variables: {
    colorPrimary:         '#0000FF',            // CUE electric blue
    colorBackground:      '#0e0e10',            // Card bg
    colorInputBackground: '#0b0b0d',
    colorText:            '#f2f2ef',
    colorTextSecondary:   '#8a8a82',
    colorInputText:       '#f2f2ef',
    colorDanger:          '#ff4d4d',
    colorSuccess:         '#ccff00',
    borderRadius:         '10px',
    fontFamily:           "'Geist', 'Inter', -apple-system, sans-serif",
    fontSize:             '14px',
  },
  elements: {
    // Rounded modal card, subtle border matching CUE
    rootBox: { fontFamily: "'Geist', 'Inter', -apple-system, sans-serif" },
    card: {
      backgroundColor: '#0e0e10',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 40px 100px rgba(0,0,0,0.8)',
    },
    headerTitle: {
      fontFamily: "'Fraunces', 'Instrument Serif', Georgia, serif",
      fontStyle: 'italic',
      fontWeight: 400,
      fontSize: '24px',
      letterSpacing: '-0.01em',
    },
    headerSubtitle: {
      color: '#8a8a82',
      fontSize: '13px',
    },
    // Buttons — primary is electric, socials + secondary have subtle bg
    formButtonPrimary: {
      backgroundColor: '#0000FF',
      color: '#fff',
      fontWeight: 500,
      borderRadius: '8px',
      textTransform: 'none',
      letterSpacing: '0.01em',
      '&:hover': { backgroundColor: '#1a1aff' },
      '&:focus':  { boxShadow: '0 0 0 3px rgba(0,0,255,0.35)' },
    },
    socialButtonsBlockButton: {
      backgroundColor: 'transparent',
      border: '1px solid rgba(255,255,255,0.08)',
      color: '#f2f2ef',
      '&:hover': { backgroundColor: 'rgba(255,255,255,0.04)' },
    },
    formFieldInput: {
      backgroundColor: '#0b0b0d',
      border: '1px solid rgba(255,255,255,0.08)',
      color: '#f2f2ef',
      '&:focus': { borderColor: '#0000FF', boxShadow: '0 0 0 2px rgba(0,0,255,0.25)' },
    },
    formFieldLabel: {
      color: '#f2f2ef',
      fontWeight: 500,
      fontSize: '12px',
    },
    dividerLine: { backgroundColor: 'rgba(255,255,255,0.08)' },
    dividerText: { color: '#8a8a82', fontSize: '11px' },
    footer: {
      backgroundColor: '#0a0a0c',
      borderTop: '1px solid rgba(255,255,255,0.06)',
    },
    footerActionText: { color: '#8a8a82', fontSize: '12px' },
    footerActionLink: {
      color: '#0000FF',
      fontWeight: 500,
      '&:hover': { color: '#3333ff' },
    },
    // "Development mode" banner from Clerk — hide it in the modal so the
    // preview does not look like a dev sandbox to visitors.
    footerPagesLink: { color: '#8a8a82' },
    identityPreviewText:     { color: '#f2f2ef' },
    identityPreviewEditButton: { color: '#0000FF' },
    userButtonPopoverCard: {
      backgroundColor: '#0e0e10',
      border: '1px solid rgba(255,255,255,0.08)',
    },
    userButtonPopoverActionButton: {
      color: '#f2f2ef',
      '&:hover': { backgroundColor: 'rgba(255,255,255,0.04)' },
    },
  },
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} appearance={clerkAppearance}>
      <App />
    </ClerkProvider>
  </React.StrictMode>
)
