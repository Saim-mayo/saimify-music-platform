export default function Skeleton({ className = '', lines = 3, rounded = true }) {
  return (
    <div className={`skeleton ${className}`.trim()} aria-hidden="true">
      <div className={`skeleton-line skeleton-line--title${rounded ? ' skeleton-line--rounded' : ''}`} />
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className={`skeleton-line${index === lines - 1 ? ' skeleton-line--short' : ''}${rounded ? ' skeleton-line--rounded' : ''}`}
        />
      ))}
    </div>
  )
}
