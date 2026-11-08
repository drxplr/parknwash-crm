import { Children, isValidElement, useEffect, useId, useRef, useState } from 'react'
import type { ReactNode, SelectHTMLAttributes, CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> & {
  onChange: (event: { target: { value: string } }) => void
}
const text = (node: ReactNode): string =>
  Children.toArray(node)
    .map((n) => (isValidElement<{ children?: ReactNode }>(n) ? text(n.props.children) : String(n)))
    .join('')

export function Select({ value, children, onChange, id, disabled, name, ...props }: Props) {
  const options = Children.toArray(children)
    .filter(isValidElement<{ value?: string; children?: ReactNode; disabled?: boolean }>)
    .map((o) => ({
      value: String(o.props.value ?? text(o.props.children)),
      label: text(o.props.children),
      disabled: o.props.disabled,
    }))
  const selected = Math.max(
    0,
    options.findIndex((o) => o.value === String(value)),
  )
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(selected),
    [position, setPosition] = useState<CSSProperties>({})
  const button = useRef<HTMLButtonElement>(null),
    menu = useRef<HTMLDivElement>(null),
    listId = useId()
  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => {
      if (!button.current?.contains(e.target as Node) && !menu.current?.contains(e.target as Node))
        setOpen(false)
    }
    const scroll = (e: Event) => {
      if (!menu.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    window.addEventListener('scroll', scroll, true)
    window.addEventListener('resize', scroll)
    return () => {
      document.removeEventListener('pointerdown', outside)
      window.removeEventListener('scroll', scroll, true)
      window.removeEventListener('resize', scroll)
    }
  }, [open])
  useEffect(() => {
    if (open)
      menu.current?.querySelector('[data-active=true]')?.scrollIntoView({ block: 'nearest' })
  }, [active, open])
  function show() {
    const rect = button.current!.getBoundingClientRect(),
      height = Math.min(options.length * 40 + 12, 280),
      below = window.innerHeight - rect.bottom - 12
    const width = Math.min(Math.max(rect.width, 190), window.innerWidth - 24)
    setPosition({
      position: 'fixed',
      left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      width,
      maxHeight: Math.min(280, Math.max(below, rect.top - 12)),
      ...(below < height && rect.top > below
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }),
    })
    setActive(selected)
    setOpen(true)
  }
  function choose(index: number) {
    if (!options[index] || options[index].disabled) return
    onChange({ target: { value: options[index].value } })
    setOpen(false)
    button.current?.focus()
  }
  return (
    <>
      {name && <input type="hidden" name={name} value={String(value ?? '')} />}
      <button
        ref={button}
        id={id}
        type="button"
        role="combobox"
        aria-label={props['aria-label']}
        aria-labelledby={props['aria-labelledby']}
        aria-required={props.required}
        aria-invalid={props['aria-invalid']}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-haspopup="listbox"
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        disabled={disabled}
        className={`select-trigger ${props.className ?? ''}`}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => {
          if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
            e.preventDefault()
            if (!open) {
              show()
              return
            }
            const direction = e.key === 'ArrowUp' ? -1 : 1
            let next =
              e.key === 'Home'
                ? 0
                : e.key === 'End'
                  ? options.length - 1
                  : (active + direction + options.length) % options.length
            for (let i = 0; i < options.length && options[next]?.disabled; i++)
              next = (next + direction + options.length) % options.length
            setActive(next)
          } else if (e.key === 'Escape' && open) {
            e.preventDefault()
            e.stopPropagation()
            setOpen(false)
          } else if (e.key === 'Tab') setOpen(false)
          else if (open && ['Enter', ' '].includes(e.key)) {
            e.preventDefault()
            choose(active)
          } else if (open && e.key.length === 1) {
            const next = options.findIndex(
              (o, i) =>
                i > active && !o.disabled && o.label.toLowerCase().startsWith(e.key.toLowerCase()),
            )
            const fallback = options.findIndex(
              (o) => !o.disabled && o.label.toLowerCase().startsWith(e.key.toLowerCase()),
            )
            if (next >= 0 || fallback >= 0) {
              e.preventDefault()
              setActive(next >= 0 ? next : fallback)
            }
          }
        }}
      >
        <span>{options[selected]?.label}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            id={listId}
            role="listbox"
            aria-label={props['aria-label'] ?? 'Options'}
            className="select-menu"
            data-select-menu
            style={position}
            onMouseDown={(e) => e.preventDefault()}
          >
            {options.map((o, i) => (
              <div
                key={o.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === selected}
                aria-disabled={o.disabled}
                data-active={i === active}
                className="select-option"
                onMouseMove={() => !o.disabled && setActive(i)}
                onClick={() => choose(i)}
              >
                <span>{o.label}</span>
                {i === selected && <Check size={15} aria-hidden="true" />}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
