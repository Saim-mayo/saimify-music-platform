import { useEffect, useRef } from 'react'

export default function ConfirmAction({
  open = false,
  title = '',
  message,
  onConfirm,
  onCancel,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  className = '',
  confirmClassName = 'btn btn-danger btn-compact',
  cancelClassName = 'btn btn-ghost btn-compact',
}) {
  const cancelRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onCancel?.()
      }
    }

    const timer = window.setTimeout(() => {
      cancelRef.current?.focus()
    }, 0)

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onCancel])

  if (!open) return null

  const body = message || `Delete “${title || 'this item'}”?`

  return (
    <section className={`confirm-action ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby="confirm-action-title">
      <span id="confirm-action-title">{body}</span>
      <div className="row-actions">
        <button type="button" ref={cancelRef} className={cancelClassName} onClick={onCancel}>{cancelText}</button>
        <button type="button" className={confirmClassName} onClick={onConfirm}>{confirmText}</button>
      </div>
    </section>
  )
}
