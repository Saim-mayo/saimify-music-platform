export default function Toast({ message, tone = 'info', onClose, actionLabel, onAction }) {
  if (!message) return null

  return (
    <div className={`toast toast-${tone}`} role="status" aria-live="polite">
      <span>{message}</span>
      {actionLabel && onAction ? (
        <button type="button" className="toast-action" onClick={onAction} aria-label={actionLabel}>
          {actionLabel}
        </button>
      ) : null}
      {onClose ? (
        <button type="button" className="toast-close" onClick={onClose} aria-label="Dismiss notification">
          ×
        </button>
      ) : null}
    </div>
  )
}
