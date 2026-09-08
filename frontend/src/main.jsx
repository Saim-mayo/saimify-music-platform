import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const savedTheme = window.localStorage.getItem('theme') === 'light' ? 'light' : 'dark'
document.documentElement.setAttribute('data-theme', savedTheme)

// Global image error fallback: replace broken images with an inline SVG placeholder.
// Runs in capture phase to catch <img> load errors across the app.
window.addEventListener(
  'error',
  (e) => {
    const el = e.target
    if (el && el.tagName === 'IMG') {
      // Small gray SVG placeholder data URI
      const placeholder =
        'data:image/svg+xml;utf8,' +
        encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none"><rect width="100%" height="100%" fill="#e6e6e6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="10" fill="#9b9b9b">No image</text></svg>`,
        )

      try {
        if (el.src !== placeholder) el.src = placeholder
      } catch {
        // ignore
      }
    }
  },
  true,
)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
