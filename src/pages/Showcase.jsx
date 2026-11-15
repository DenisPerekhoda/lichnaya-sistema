import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

// Публичная страница. Видна всем, если в разделе «Витрина и данные» включено «Опубликована».
export default function Showcase() {
  const [p, setP] = useState(undefined)
  const [cases, setCases] = useState([])

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('profile').select('*').eq('is_public', true).limit(1).maybeSingle()
      setP(data || null)
      if (data) {
        const res = await supabase.from('showcase_cases').select('*').eq('user_id', data.user_id).eq('is_public', true).order('sort')
        setCases(res.data || [])
      }
    })()
  }, [])

  if (p === undefined) return <div className="show"><div className="inner muted" role="status">Загрузка…</div></div>
  if (!p) return <div className="show"><div className="inner"><h1>Страница скоро появится</h1></div></div>

  const contact = p.contact?.trim()
  const href = !contact ? null
    : contact.startsWith('@') ? 'https://t.me/' + contact.slice(1)
    : contact.includes('@') ? 'mailto:' + contact
    : contact.startsWith('http') ? contact
    : 'tel:' + contact.replace(/[^\d+]/g, '')

  return (
    <div className="show">
      <div className="inner">
        <h1>{p.name}</h1>
        {p.headline && <p className="lead" style={{ fontWeight: 500, color: 'var(--color-ink)' }}>{p.headline}</p>}
        {p.about && <p className="lead">{p.about}</p>}
        {cases.length > 0 && (
          <div className="grid g3">
            {cases.map((c) => (
              <div className="case" key={c.id}>
                <div className="figure">{c.value}</div>
                <div className="muted">{c.label}</div>
              </div>
            ))}
          </div>
        )}
        {href && (
          <div className="row">
            <a className="btn primary" href={href} target="_blank" rel="noreferrer">Обсудить проект</a>
            <span className="muted">{contact}</span>
          </div>
        )}
      </div>
    </div>
  )
}
