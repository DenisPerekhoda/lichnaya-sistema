import { useState } from 'react'
import { useTable } from '../useTable'
import { useSettings } from '../useSettings'
import { rub, STAGES } from '../supabase'
import { Edit, Progress, Err, pct } from '../ui'

const COLORS = ['var(--accent)', 'var(--blue)', 'var(--amber)', '#9fb5aa', '#c9e86b', '#d79be0', '#e88a6b']

export default function Cabinet({ userId }) {
  const [s, saveS] = useSettings(userId)
  const projects = useTable('projects', { order: 'sort' })
  const deals = useTable('deals')

  const income = projects.rows.map((p) => ({ ...p, total: (+p.fixed_income || 0) + (+p.variable_income || 0) }))
  const total = income.reduce((a, p) => a + p.total, 0)
  const fixed = projects.rows.reduce((a, p) => a + (+p.fixed_income || 0), 0)
  const biggest = income.reduce((m, p) => Math.max(m, p.total), 0)
  const withIncome = income.filter((p) => p.total > 0)

  return (
    <>
      <Err>{projects.error || deals.error}</Err>

      {s && (
        <section className="grid g4" aria-label="Цели">
          <Tile title="Доход в месяц" value={rub(total)} cur={total} max={s.income_goal} note={`${pct(total, s.income_goal)}% от цели ${rub(s.income_goal)}`} />
          <Tile title={`Цель цикла · до ${new Date(s.cycle_end).toLocaleDateString('ru-RU')}`} value={rub(s.cycle_goal)} cur={total} max={s.cycle_goal}
            note={total >= s.cycle_goal ? 'цель достигнута' : `не хватает ${rub(s.cycle_goal - total)} в месяц`} />
          <Tile title="Сделка-цель" value={rub(s.deal_goal)} cur={0} max={1} warn note={s.deal_note} />
          <Tile title="Капитал" value={rub(s.capital)} cur={s.capital} max={s.capital_goal || s.capital}
            note={`цель ${s.capital_goal ? rub(s.capital_goal) : '[задай в настройках]'} · +${rub(s.monthly_saving_goal)} в месяц`} />
        </section>
      )}

      <section className="card" aria-label="Структура дохода">
        <div className="row between">
          <h2>Структура дохода</h2>
          <span className="big">{rub(total)} / мес</span>
        </div>
        {withIncome.length > 0 && (
          <>
            <div className="stack" role="img" aria-label="Доход по источникам">
              {withIncome.map((p, i) => <div key={p.id} style={{ flex: p.total, background: COLORS[i % COLORS.length] }} title={p.name} />)}
            </div>
            <div className="legend">
              {withIncome.map((p, i) => (
                <span key={p.id}><span className="dot" style={{ background: COLORS[i % COLORS.length] }} />{p.name} {rub(p.total)}</span>
              ))}
            </div>
          </>
        )}
        <span className="muted small">
          Фикс {rub(fixed)} · переменная часть {rub(total - fixed)}
          {total > 0 && <> · доля крупнейшего источника {pct(biggest, total)}%</>}
        </span>
      </section>

      <Units projects={projects} />
      <Pipeline deals={deals} projects={projects.rows} />
    </>
  )
}

function Tile({ title, value, cur, max, note, warn }) {
  return (
    <div className="card">
      <span className="muted small">{title}</span>
      <span className="big">{value}</span>
      <Progress value={cur} max={max} warn={warn} />
      <span className="muted small">{note}</span>
    </div>
  )
}

function Units({ projects }) {
  const [name, setName] = useState('')
  const add = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    await projects.insert({ name: name.trim(), sort: projects.rows.length + 1 })
    setName('')
  }
  return (
    <section className="card" aria-label="Бизнес-юниты">
      <h2>Бизнес-юниты</h2>
      <div className="scroll">
        <table style={{ minWidth: 900 }}>
          <thead>
            <tr><th>Юнит</th><th>Модель</th><th>Фикс, ₽</th><th>Переменная, ₽</th><th>Цель</th><th>Следующий шаг</th><th>Статус</th><th></th></tr>
          </thead>
          <tbody>
            {projects.rows.map((p) => (
              <tr key={p.id}>
                <td><Edit value={p.name} onSave={(v) => projects.update(p.id, { name: v })} /></td>
                <td><Edit value={p.model} onSave={(v) => projects.update(p.id, { model: v })} /></td>
                <td><Edit type="number" value={+p.fixed_income} onSave={(v) => projects.update(p.id, { fixed_income: v })} /></td>
                <td><Edit type="number" value={+p.variable_income} onSave={(v) => projects.update(p.id, { variable_income: v })} /></td>
                <td><Edit value={p.goal} onSave={(v) => projects.update(p.id, { goal: v })} /></td>
                <td><Edit value={p.next_step} onSave={(v) => projects.update(p.id, { next_step: v })} /></td>
                <td>
                  <select value={p.status} onChange={(e) => projects.update(p.id, { status: e.target.value })}>
                    {['старт', 'в работе', 'ожидание', 'временно', 'пауза', 'закрыт'].map((x) => <option key={x}>{x}</option>)}
                  </select>
                </td>
                <td><button className="btn link" aria-label={`Удалить ${p.name}`} onClick={() => window.confirm(`Удалить «${p.name}»?`) && projects.remove(p.id)}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="row" onSubmit={add}>
        <input style={{ flex: '1 1 240px', width: 'auto' }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Новый юнит" aria-label="Название нового юнита" />
        <button className="btn" type="submit">Добавить</button>
      </form>
    </section>
  )
}

function Pipeline({ deals, projects }) {
  const [title, setTitle] = useState('')
  const [pid, setPid] = useState('')
  const pname = (id) => projects.find((p) => p.id === id)?.name || '—'

  const add = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    await deals.insert({ title: title.trim(), project_id: pid || null, stage: 'contact' })
    setTitle('')
  }
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }} aria-label="Воронка">
      <h2>Общая воронка по всем юнитам</h2>
      <div className="kanban">
        {STAGES.map((st) => (
          <div className="col" key={st.id}>
            <span className="muted small" style={{ fontWeight: 600, textTransform: 'uppercase' }}>
              {st.label} · {deals.rows.filter((d) => d.stage === st.id).length}
            </span>
            {deals.rows.filter((d) => d.stage === st.id).map((d) => (
              <div className="deal" key={d.id}>
                <Edit value={d.title} onSave={(v) => deals.update(d.id, { title: v })} />
                <span className="muted small">{pname(d.project_id)}</span>
                <Edit value={d.next_step} placeholder="следующий шаг" onSave={(v) => deals.update(d.id, { next_step: v })} />
                <div className="row between">
                  <select value={d.stage} onChange={(e) => deals.update(d.id, { stage: e.target.value })} aria-label="Этап" style={{ width: 'auto' }}>
                    {STAGES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                    <option value="lost">Отказ</option>
                  </select>
                  <button className="btn link" aria-label="Удалить сделку" onClick={() => deals.remove(d.id)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <form className="row card" onSubmit={add} style={{ flexDirection: 'row' }}>
        <input style={{ flex: '2 1 240px', width: 'auto' }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Новая сделка" aria-label="Название сделки" />
        <select style={{ flex: '1 1 180px', width: 'auto' }} value={pid} onChange={(e) => setPid(e.target.value)} aria-label="Юнит">
          <option value="">Без юнита</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className="btn primary" type="submit">Добавить сделку</button>
      </form>
    </section>
  )
}
