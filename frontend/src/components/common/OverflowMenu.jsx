import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Icon } from '@/components/ui'

export default function OverflowMenu({ label = 'Open actions', children, onOpenChange }) {
  const [open, setOpen] = useState(false)
  const [panelPosition, setPanelPosition] = useState({ top: 0, left: 0 })
  const shellRef = useRef(null)
  const buttonRef = useRef(null)
  const idRef = useRef(`overflow-menu-${useId()}`)

  useEffect(() => {
    if (!open) return

    const onDocClick = (event) => {
      if (shellRef.current && !shellRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    const onOtherMenuOpen = (event) => {
      if (event.detail !== idRef.current) {
        setOpen(false)
      }
    }

    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('overflow-menu-open', onOtherMenuOpen)
    return () => {
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('overflow-menu-open', onOtherMenuOpen)
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return

    // For absolute positioning, we only need to offset from the button
    // The menu will be positioned relative to its parent (.overflow-menu-shell)
    setPanelPosition({
      right: 0,
      top: 'calc(100% + 8px)',
    })
  }, [open, children])

  useEffect(() => {
    onOpenChange?.(open)
    if (open) {
      window.dispatchEvent(new CustomEvent('overflow-menu-open', { detail: idRef.current }))
    }
  }, [open, onOpenChange])

  return (
    <div className="overflow-menu-shell" ref={shellRef}>
      <button
        ref={buttonRef}
        type="button"
        className="icon-button overflow-menu-button"
        onClick={(event) => {
          event.stopPropagation()
          setOpen((value) => !value)
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
      >
        <Icon name="more" size={18} />
      </button>
      {open ? (
        <div
          className="overflow-menu-panel"
          role="menu"
          style={{ top: panelPosition.top, right: panelPosition.right }}
          onClick={(event) => event.stopPropagation()}
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}
