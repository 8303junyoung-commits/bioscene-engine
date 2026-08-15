import { useEffect, useRef, useState } from 'react'

interface HelpState {
  text: string
  x: number
  y: number
  placement: 'top' | 'bottom'
}

export function ContextHelp() {
  const [help, setHelp] = useState<HelpState>()
  const activeHost = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const show = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return
      const host = target.closest<HTMLElement>('[data-help]')
      const text = host?.dataset.help?.trim()
      if (!host || !text) return
      activeHost.current = host
      const rect = host.getBoundingClientRect()
      const placement = rect.bottom + 150 > window.innerHeight ? 'top' : 'bottom'
      setHelp({
        text,
        x: Math.min(window.innerWidth - 190, Math.max(190, rect.left + rect.width / 2)),
        y: placement === 'bottom' ? rect.bottom + 10 : rect.top - 10,
        placement,
      })
    }
    const hide = (event?: Event) => {
      const related = event instanceof MouseEvent || event instanceof FocusEvent ? event.relatedTarget : null
      if (related instanceof Node && activeHost.current?.contains(related)) return
      activeHost.current = null
      setHelp(undefined)
    }
    const onPointerOver = (event: PointerEvent) => show(event.target)
    const onPointerOut = (event: PointerEvent) => hide(event)
    const onFocusIn = (event: FocusEvent) => show(event.target)
    const onFocusOut = (event: FocusEvent) => hide(event)
    document.addEventListener('pointerover', onPointerOver)
    document.addEventListener('pointerout', onPointerOut)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => {
      document.removeEventListener('pointerover', onPointerOver)
      document.removeEventListener('pointerout', onPointerOut)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [])

  if (!help) return null
  return <div className={`context-help context-help-${help.placement}`} role="tooltip" style={{ left: help.x, top: help.y }}>{help.text}</div>
}
