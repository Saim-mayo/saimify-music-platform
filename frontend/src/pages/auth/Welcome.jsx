import { Link } from 'react-router-dom'
import SaimifyLogo from '@/components/SaimifyLogo'
import { runtime } from '@/config/runtime'

const creatorName = 'Saim Khan'
const creatorProfileUrl = runtime.creatorProfileUrl

export default function Welcome() {
  return (
    <div className="auth-welcome">
      <div className="auth-welcome-card">
        <div className="auth-welcome-mark" aria-hidden="true">
          <SaimifyLogo size={72} />
        </div>

        <div className="auth-welcome-brand">
          <p className="auth-welcome-eyebrow">Premium listening experience</p>
          <h1>
            Start listening
            <span>to your next favorite mood.</span>
          </h1>
          <p>Curated for every mood, every commute, and every late-night rewind.</p>
        </div>

        <div className="auth-welcome-trust" aria-label="Highlights">
          <span>Fresh releases</span>
          <span>Smart playlists</span>
          <span>Offline-ready</span>
        </div>

        <div className="creator-signature">
          <span className="creator-signature-label">Crafted and developed by</span>
          <a
            className="creator-signature-name"
            href={creatorProfileUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Open Saim Khan's profile"
            title="Open Saim Khan's profile"
          >
            {creatorName}
          </a>
          <span className="creator-signature-meta">Click the name to know more about the creator behind this build.</span>
        </div>

        <div className="auth-welcome-actions">
          <Link className="btn auth-welcome-primary" to="/register">Get Started</Link>
          <Link className="btn btn-ghost auth-welcome-secondary" to="/login">Log in</Link>
        </div>
      </div>
    </div>
  )
}
