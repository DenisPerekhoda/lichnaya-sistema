import { useEffect, useState } from 'react'

// Поле, которое сохраняет значение при уходе фокуса или Enter
export function Edit({ value, onSave, type = 'text', placeholder = '', className = '', label }) {
  const [v, setV] = useState(value ?? '')
  useEffect(() => setV(value ?? ''), [value])
  const commit = () => {
    const out = type === 'number' ? Number(v) || 0 : v
    if (out !== value) onSave(out)
  }
  return (
    <input
      className={className}
      type={type}
      inputMode={type === 'number' ? 'decimal' : undefined}
      value={v}
      placeholder={placeholder}
      aria-label={label}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  )
}

// Полоса прогресса: ширина задаётся через transform, а не через width
export function Progress({ value, max, warn, label }) {
  const p = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div className={'bar' + (warn && p < 30 ? ' warn' : '')} role="progressbar" aria-label={label}
      aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ transform: `scaleX(${p / 100})` }} />
    </div>
  )
}

export const pct = (v, m) => (m > 0 ? Math.round((v / m) * 100) : 0)

export function Err({ children }) {
  return children ? <div className="err" role="alert">{children}</div> : null
}

export function RemoveButton({ label, onClick }) {
  return (
    <button type="button" className="icon-btn" aria-label={label} title={label} onClick={onClick}>
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
        <path d="M4 4l8 8M12 4l-8 8" />
      </svg>
    </button>
  )
}

export function Skeleton({ h = 20, w = '100%' }) {
  return <div className="skeleton" style={{ height: h, width: w }} aria-hidden="true" />
}
