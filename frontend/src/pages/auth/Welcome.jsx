import { Link } from 'react-router-dom'
import SaimifyLogo from '@/components/SaimifyLogo'
import { runtime } from '@/config/runtime'

const creatorName = 'Saim Khan'
const creatorCvUrl = runtime.creatorCvUrl

export default function Welcome() {
  return (
    <div className="auth-welcome">
      <div className="auth-welcome-card">
        <div className="auth-welcome-mark" aria-hidden="true">
          <SaimifyLogo size={72} />
        </div>
        <div className="auth-welcome-brand">
          <p className="auth-welcome-eyebrow">Premium listening experience</p>
          <h1>Saimify</h1>
          <p>Discover your next favorite track, build your library, and keep your listening life in one place.</p>
        </div>

        <div className="creator-signature">
          <span className="creator-signature-label">Crafted and developed by</span>
          <a className="creator-signature-name" href={creatorCvUrl} target="_blank" rel="noreferrer">
            {creatorName}
          </a>
          <span className="creator-signature-meta">Brand, product design, full-stack build, and deployment</span>
        </div>

        <div className="auth-welcome-actions">
          <Link className="btn" to="/register">Get Started</Link>
          <Link className="auth-welcome-link" to="/login">Log in</Link>
        </div>
      </div>
    </div>
  )
}
