import { useId } from 'react'

const DEFAULT_SIZE = 40

// PulsewaveLogo: Concept 3 implementation (curved dot equalizer forming an S).
// Props: size, className, variant: 'icon' | 'lockup', tone: 'color' | 'mono-black' | 'mono-white'
export default function PulsewaveLogo({ size = DEFAULT_SIZE, className = '', variant = 'icon', tone = 'color', ...props }) {
  const id = useId()
  const gradientId = `pulsewave-pwgrad-${id}`
  const titleId = `pulsewave-title-${id}`
  const svgSize = typeof size === 'number' ? `${size}` : size

  // Dot radii and positions (curved S). Positions tuned to read at small sizes.
  const dots = [
    { cx: 6,  cy: 6,  r: 2.5 }, // small
    { cx: 16, cy: 18, r: 5   }, // large
    { cx: 28, cy: 30, r: 3.5 }, // medium
    { cx: 40, cy: 18, r: 5   }, // large
    { cx: 52, cy: 6,  r: 2.5 }  // small
  ]

  const isMono = tone === 'mono-black' || tone === 'mono-white'
  const bgFill = isMono ? (tone === 'mono-black' ? '#000' : '#fff') : `url(#${gradientId})`
  const dotFill = isMono ? (tone === 'mono-black' ? '#fff' : '#000') : '#fff'

  return (
    <svg
      className={`pulsewave-logo pulsewave-logo--${variant} ${className}`.trim()}
      role="img"
      aria-label="Saimify"
      aria-labelledby={titleId}
      viewBox="0 0 64 64"
      width={svgSize}
      height={svgSize}
      {...props}
    >
      <title id={titleId}>Saimify</title>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--pulsewave-gradient-start,#6a5cff)" />
          <stop offset="50%" stopColor="var(--pulsewave-gradient-mid,#8fc1ff)" />
          <stop offset="100%" stopColor="var(--pulsewave-gradient-end,#3b6bff)" />
        </linearGradient>
      </defs>

      {/* Background tile */}
      <rect x="4" y="4" width="56" height="56" rx="10" fill={bgFill} />

      {/* Dots forming the S-curve */}
      <g transform="translate(0,0)" fill={dotFill}>
        {dots.map((d, i) => (
          <circle key={i} cx={d.cx} cy={d.cy} r={d.r} />
        ))}
      </g>

      {/* Wordmark lockup */}
      {variant === 'lockup' ? (
        <g transform="translate(76,40)">
          <text x="0" y="0" fontFamily="Inter, system-ui, -apple-system, sans-serif" fontSize="24" fontWeight="600" fill="currentColor">Saimify</text>
        </g>
      ) : null}
    </svg>
  )
}
