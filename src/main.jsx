import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import App from './App.jsx'
import { initSentry } from './lib/sentry.js'
import 'lenis/dist/lenis.css'
import './index.css'
import './styles/mobile.css'

// Initialise error reporting before any component renders so we catch
// setup-time crashes too. No-op when VITE_SENTRY_DSN isn't set.
initSentry()

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key")
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <App />
    </ClerkProvider>
  </React.StrictMode>
)
