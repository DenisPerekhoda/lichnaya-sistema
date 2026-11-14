import { useEffect, useState } from 'react'
import { useTable } from '../useTable'
import { useSettings } from '../useSettings'
import { supabase, weekStart } from '../supabase'
import { Edit, Progress, Err, pct } from '../ui'

const QUESTIONS = [
  'Почему деньги стали приходить легче на этой неделе?',
  'Почему люди стали выше ценить то, что я делаю?',
  'Какую возможность я заметил?',
  'Какое решение я принял уверенно?',
]

export default function Goals({ userId }) {
  const [s, saveS] = useSettings(userId)
  const goals = useTable('goals', { order: 'sort' })
  const krs = useTable('key_results')
  const [newGoal, setNewGoal] = useState('')

  return (
    <div className="cols">
      <div className="main">
        <Err>{goals.error || krs.error}</Err>
        {s && (
          <section className="card">
            <div className="small" style={{ color: 'var(--accent)', fontWeight: 600, letterSpacing: '.08em' }}>ВИДЕНИЕ</div>
            <Edit value={s.vision} onSave={(v) => saveS({ vision: v })} />
          </section>
        )}
        <div className="grid g3">
          {goals.rows.map((g, i) => (
            <Goal key={g.id} n={i + 1} goal={g} goals={goals} krs={krs} />
          ))}
        </div>
        <form className="row" onSubmit={async (e) => {
          e.preventDefault()
          if (!newGoal.trim()) return
          await goals.insert({ title: newGoal.trim(), sort: goals.rows.length + 1 })
          setNewGoal('')
        }}>
          <input style={{ flex: '1 1 260px', width: 'auto' }} value={newGoal} onChange={(e) => setNewGoal(e.target.value)} placeholder="Новая цель цикла" aria-label="Новая цель" />
          <button className="btn" type="submit">Добавить цель</button>
        </form>
      </div>
      <div className="side">
        <Checkin />
      </div>
    </div>
  )
}

function Goal({ n, goal, goals, krs }) {
  const [t, setT] = useState('')
  const mine = krs.rows.filter((k) => k.goal_id === goal.id)
  const avg = mine.length ? Math.round(mine.reduce((a, k) => a + pct(+k.current, +k.target), 0) / mine.length) : 0
  return (
    <article className="card">
      <div className="row between">
        <span className="muted small" style={{ fontWeight: 600 }}>ЦЕЛЬ {n} · {avg}%</span>
        <button className="btn link" aria-label="Удалить цель" onClick={() => window.confirm('Удалить цель со всеми результатами?') && goals.remove(goal.id)}>✕</button>
      </div>
      <Edit value={goal.title} onSave={(v) => goals.update(goal.id, { title: v })} />
      {mine.map((k) => (
        <div key={k.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="row between small">
            <span style={{ flex: 1, minWidth: 0 }}>{k.title}</span>
            <button className="btn link" aria-label="Удалить результат" onClick={() => krs.remove(k.id)}>✕</button>
          </div>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <Edit type="number" value={+k.current} onSave={(v) => krs.update(k.id, { current: v })} />
            <span className="muted">из</span>
            <Edit type="number" value={+k.target} onSave={(v) => krs.update(k.id, { target: v })} />
          </div>
          <Progress value={+k.current} max={+k.target} warn />
        </div>
      ))}
      <form className="row" onSubmit={async (e) => {
        e.preventDefault()
        if (!t.trim()) return
        await krs.insert({ goal_id: goal.id, title: t.trim(), current: 0, target: 100 })
        setT('')
      }}>
        <input style={{ flex: 1, width: 'auto' }} value={t} onChange={(e) => setT(e.target.value)} placeholder="Ключевой результат" aria-label="Новый ключевой результат" />
        <button className="btn" type="submit">+</button>
      </form>
    </article>
  )
}

function Checkin() {
  const ws = weekStart()
  const [row, setRow] = useState(null)
  const [answers, setAnswers] = useState({})
  const [next, setNext] = useState('')
  const [saved, setSaved] = useState('')
  const [history, setHistory] = useState([])

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('checkins').select('*').order('week_start', { ascending: false }).limit(12)
      const cur = (data || []).find((x) => x.week_start === ws)
      if (cur) { setRow(cur); setAnswers(cur.answers || {}); setNext(cur.next_action || '') }
      setHistory((data || []).filter((x) => x.week_start !== ws))
    })()
  }, [ws])

  const save = async () => {
    const { data, error } = await supabase.from('checkins')
      .upsert({ ...(row ? { id: row.id } : {}), week_start: ws, answers, next_action: next }, { onConflict: 'user_id,week_start' })
      .select().single()
    if (error) setSaved('Ошибка: ' + error.message)
    else { setRow(data); setSaved('Сохранено') ; setTimeout(() => setSaved(''), 2000) }
  }

  return (
    <>
      <section className="card">
        <h2>Чек-ин недели</h2>
        <span className="muted small">Неделя с {new Date(ws).toLocaleDateString('ru-RU')}. Отвечай так, будто это уже правда, и опирайся на факты.</span>
        {QUESTIONS.map((q, i) => (
          <label key={i}>{q}
            <textarea rows={3} value={answers[i] || ''} onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })} />
          </label>
        ))}
        <label>Одно действие на понедельник
          <input value={next} onChange={(e) => setNext(e.target.value)} />
        </label>
        <div className="row">
          <button className="btn primary" onClick={save}>Сохранить неделю</button>
          <span className="muted small">{saved}</span>
        </div>
      </section>
      {history.length > 0 && (
        <section className="card">
          <h2>Прошлые недели</h2>
          {history.map((h) => (
            <details key={h.id}>
              <summary style={{ cursor: 'pointer' }}>Неделя с {new Date(h.week_start).toLocaleDateString('ru-RU')}{h.next_action && ` → ${h.next_action}`}</summary>
              {QUESTIONS.map((q, i) => h.answers?.[i] && (
                <p key={i} className="small"><b>{q}</b><br />{h.answers[i]}</p>
              ))}
            </details>
          ))}
        </section>
      )}
    </>
  )
}
