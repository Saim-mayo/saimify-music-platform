export default function SaimifyLogo({ size = 40, className = '', variant = 'icon', ...props }) {
  const svgSize = typeof size === 'number' ? `${size}` : size
  const isLockup = variant === 'lockup'

  return (
    <svg
      className={`saimify-logo ${className}`.trim()}
      role="img"
      aria-label="Saimify"
      viewBox="0 0 64 64"
      width={svgSize}
      height={svgSize}
      {...props}
    >
      <defs>
        <linearGradient id="saimify-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#14b8a6" />
          <stop offset="55%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="52" height="52" rx="16" fill="url(#saimify-gradient)" />
      <rect x="20" y="20" width="7" height="24" rx="3.5" fill="#fff" />
      <rect x="29" y="15" width="7" height="30" rx="3.5" fill="#fff" />
      <rect x="38" y="24" width="7" height="20" rx="3.5" fill="#fff" />
      {isLockup ? (
        <text x="76" y="40" fontFamily="DM Sans, Inter, sans-serif" fontSize="24" fontWeight="700" fill="currentColor">
          Saimify
        </text>
      ) : null}
    </svg>
  )
}
