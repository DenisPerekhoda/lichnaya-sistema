import { useEffect, useState } from 'react'

// Поле, которое сохраняет значение при уходе фокуса или Enter
export function Edit({ value, onSave, type = 'text', placeholder = '', className = '' }) {
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
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  )
}

export function Progress({ value, max, warn }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div className="bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: pct + '%', background: warn && pct < 30 ? 'var(--amber)' : undefined }} />
    </div>
  )
}

export const pct = (v, m) => (m > 0 ? Math.round((v / m) * 100) : 0)

export function Err({ children }) {
  return children ? <div className="err">{children}</div> : null
}
