import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import Icon from './Icon'

export default function MobileNavDrawer({ open, onClose, triggerRef, location, items = [] }) {
  const dialogRef = useRef(null)
  const previousPathRef = useRef(location.pathname)
  const [isMounted, setIsMounted] = useState(open)
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    if (open) {
      setIsMounted(true)
      setIsClosing(false)
      return undefined
    }

    setIsClosing(true)
    const timeoutId = window.setTimeout(() => {
      setIsMounted(false)
      setIsClosing(false)
    }, 220)

    return () => window.clearTimeout(timeoutId)
  }, [open])

  useEffect(() => {
    if (!open || !dialogRef.current) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab') return

      const focusable = dialogRef.current?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      const elements = Array.from(focusable || []).filter((element) => !element.hasAttribute('disabled'))
      if (!elements.length) {
        event.preventDefault()
        return
      }

      const first = elements[0]
      const last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    const previousFocus = document.activeElement
    const trigger = triggerRef?.current
    const firstFocusable = dialogRef.current.querySelector('button, a[href]')
    document.addEventListener('keydown', handleKeyDown)
    firstFocusable?.focus()

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (previousFocus && typeof previousFocus.focus === 'function') {
        previousFocus.focus()
      }
      if (trigger) {
        trigger.focus()
      }
    }
  }, [location.pathname, onClose, open, triggerRef])

  useEffect(() => {
    if (!open) return undefined

    if (previousPathRef.current !== location.pathname) {
      onClose()
    }

    previousPathRef.current = location.pathname
    return undefined
  }, [location.pathname, onClose, open])

  useEffect(() => {
    if (!open) return undefined

    const handleClick = (event) => {
      if (event.target === event.currentTarget) {
        onClose()
      }
    }

    const overlay = dialogRef.current?.parentElement
    overlay?.addEventListener('click', handleClick)

    return () => overlay?.removeEventListener('click', handleClick)
  }, [onClose, open])

  if (!isMounted) return null

  return (
    <div className={`mobile-nav-overlay${isClosing ? ' is-closing' : ' is-open'}`} role="presentation">
      <div className={`mobile-nav-sheet${isClosing ? ' is-closing' : ''}`} role="dialog" aria-modal="true" aria-label="More navigation options" tabIndex={-1} ref={dialogRef}>
        <div className="mobile-nav-sheet-header">
          <h2 className="mobile-nav-sheet-title">More</h2>
          <button type="button" className="icon-button mobile-nav-sheet-close" onClick={onClose} aria-label="Close more navigation options">×</button>
        </div>
        <div className="mobile-nav-sheet-list">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} className="mobile-nav-sheet-link" onClick={onClose}>
              <Icon name={item.icon} className="sidebar-icon" size={18} />
              <span>{item.label}</span>
              <span aria-hidden="true">↗</span>
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  )
}
