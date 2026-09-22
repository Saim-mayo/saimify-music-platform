export default function LoadingSpinner({ label = 'Please wait…' }) {
  return (
    <div className="page-state" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}
