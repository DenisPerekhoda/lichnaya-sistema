import { useState } from 'react'
import { useTable } from '../useTable'
import { useSettings } from '../useSettings'
import { rub, STAGES } from '../supabase'
import { Edit, Progress, Err, pct, RemoveButton, Skeleton } from '../ui'

const COLORS = Array.from({ length: 7 }, (_, i) => `var(--color-src-${i + 1})`)
const STATUS = ['старт', 'в работе', 'ожидание', 'временно', 'пауза', 'закрыт']

export default function Cabinet({ userId }) {
  const [s] = useSettings(userId)
  const projects = useTable('projects', { order: 'sort' })
  const deals = useTable('deals')

  const income = projects.rows.map((p) => ({ ...p, total: (+p.fixed_income || 0) + (+p.variable_income || 0) }))
  const total = income.reduce((a, p) => a + p.total, 0)
  const fixed = projects.rows.reduce((a, p) => a + (+p.fixed_income || 0), 0)
  const biggest = income.reduce((m, p) => Math.max(m, p.total), 0)
  const withIncome = income.filter((p) => p.total > 0)

  return (
    <>
      <div className="page-head">
        <h1>Кабинет</h1>
        <span className="muted small">{new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
      </div>

      <Err>{projects.error || deals.error}</Err>

      {/* Подпись экрана: весь доход как один баланс источников */}
      <section className="card" aria-labelledby="ledger-h">
        <div className="ledger">
          <div className="ledger-total">
            <h2 id="ledger-h">Структура дохода</h2>
            {projects.loading ? <Skeleton h={40} w="70%" /> : <span className="figure-xl">{rub(total)}</span>}
            <span className="muted small">в месяц</span>
            {s && (
              <>
                <Progress value={total} max={s.income_goal} label="Доход к цели" />
                <span className="small muted"><span className="pct">{pct(total, s.income_goal)}%</span> от цели {rub(s.income_goal)}</span>
              </>
            )}
          </div>
          <div className="section">
            {projects.loading ? (
              <><Skeleton h={14} /><Skeleton h={120} /></>
            ) : withIncome.length === 0 ? (
              <p className="empty">Доходов пока нет. Укажи фикс или переменную часть у юнита в таблице ниже.</p>
            ) : (
              <>
                <div className="stack" role="img" aria-label="Доход по источникам">
                  {withIncome.map((p, i) => <span key={p.id} style={{ flexGrow: p.total, background: COLORS[i % COLORS.length] }} title={p.name} />)}
                </div>
                <table className="src-table">
                  <caption className="visually-hidden">Доход по источникам</caption>
                  <tbody>
                    {withIncome.map((p, i) => (
                      <tr key={p.id}>
                        <td><span className="swatch" style={{ background: COLORS[i % COLORS.length] }} aria-hidden="true" />{p.name}</td>
                        <td className="num muted">{pct(p.total, total)}%</td>
                        <td className="num">{rub(p.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="small muted">
                  Фикс {rub(fixed)}, переменная часть {rub(total - fixed)}.
                  {total > 0 && <> Доля крупнейшего источника {pct(biggest, total)}%.</>}
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      {s && (
        <section className="card" aria-label="Цели">
          <div className="stats">
            <Stat title={`Цель цикла до ${new Date(s.cycle_end).toLocaleDateString('ru-RU')}`} value={rub(s.cycle_goal)} cur={total} max={s.cycle_goal}
              note={total >= s.cycle_goal ? 'цель достигнута' : `не хватает ${rub(s.cycle_goal - total)} в месяц`} />
            <Stat title="Сделка-цель" value={rub(s.deal_goal)} cur={0} max={1} warn note={s.deal_note} />
            <Stat title="Капитал" value={rub(s.capital)} cur={s.capital} max={s.capital_goal || s.capital}
              note={s.capital_goal ? `цель ${rub(s.capital_goal)}, откладывать ${rub(s.monthly_saving_goal)} в месяц` : `цель не задана, откладывать ${rub(s.monthly_saving_goal)} в месяц`} />
          </div>
        </section>
      )}

      <Units projects={projects} />
      <Pipeline deals={deals} projects={projects.rows} />
    </>
  )
}

function Stat({ title, value, cur, max, note, warn }) {
  return (
    <div className="stat">
      <span className="stat-label" title={title}>{title}</span>
      <span className="figure">{value}</span>
      <Progress value={cur} max={max} warn={warn} label={title} />
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
    <section className="section" aria-labelledby="units-h">
      <div className="section-head">
        <h2 id="units-h">Бизнес-юниты</h2>
        <span className="muted small">правки сохраняются сами</span>
      </div>
      <div className="scroll">
        <table className="table" style={{ minWidth: 1040 }}>
          <colgroup>
            <col style={{ width: '17%' }} /><col style={{ width: '15%' }} /><col style={{ width: '10%' }} /><col style={{ width: '10%' }} />
            <col style={{ width: '18%' }} /><col style={{ width: '17%' }} /><col style={{ width: '140px' }} /><col style={{ width: '48px' }} />
          </colgroup>
          <thead>
            <tr><th>Юнит</th><th>Модель</th><th>Фикс, ₽</th><th>Переменная, ₽</th><th>Цель</th><th>Следующий шаг</th><th>Статус</th><th><span className="visually-hidden">Действия</span></th></tr>
          </thead>
          <tbody>
            {projects.loading && [0, 1, 2].map((i) => (
              <tr key={i}><td colSpan={8}><Skeleton h={28} /></td></tr>
            ))}
            {!projects.loading && projects.rows.length === 0 && (
              <tr><td colSpan={8} className="empty">Юнитов пока нет. Добавь первый ниже или загрузи стартовые данные в разделе «Витрина и данные».</td></tr>
            )}
            {projects.rows.map((p) => (
              <tr key={p.id}>
                <td><Edit className="title-input" label="Юнит" value={p.name} onSave={(v) => projects.update(p.id, { name: v })} /></td>
                <td><Edit label="Модель" value={p.model} onSave={(v) => projects.update(p.id, { model: v })} /></td>
                <td><Edit label="Фикс" type="number" value={+p.fixed_income} onSave={(v) => projects.update(p.id, { fixed_income: v })} /></td>
                <td><Edit label="Переменная" type="number" value={+p.variable_income} onSave={(v) => projects.update(p.id, { variable_income: v })} /></td>
                <td><Edit label="Цель" value={p.goal} onSave={(v) => projects.update(p.id, { goal: v })} /></td>
                <td><Edit label="Следующий шаг" value={p.next_step} onSave={(v) => projects.update(p.id, { next_step: v })} /></td>
                <td>
                  <select aria-label="Статус" value={p.status} onChange={(e) => projects.update(p.id, { status: e.target.value })}>
                    {STATUS.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </td>
                <td><RemoveButton label={`Удалить ${p.name}`} onClick={() => window.confirm(`Удалить «${p.name}»?`) && projects.remove(p.id)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form className="row" onSubmit={add}>
        <input style={{ flex: '1 1 240px', width: 'auto', maxWidth: 360 }} name="unit" value={name} onChange={(e) => setName(e.target.value)} placeholder="Новый юнит" aria-label="Название нового юнита" />
        <button className="btn" type="submit">Добавить юнит</button>
      </form>
    </section>
  )
}

function Pipeline({ deals, projects }) {
  const [title, setTitle] = useState('')
  const [pid, setPid] = useState('')
  const pname = (id) => projects.find((p) => p.id === id)?.name || 'Без юнита'

  const add = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    await deals.insert({ title: title.trim(), project_id: pid || null, stage: 'contact' })
    setTitle('')
  }
  return (
    <section className="section" aria-labelledby="pipe-h">
      <div className="section-head">
        <h2 id="pipe-h">Общая воронка по всем юнитам</h2>
      </div>
      <form className="row" onSubmit={add}>
        <input style={{ flex: '2 1 240px', width: 'auto' }} name="deal" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Новая сделка" aria-label="Название сделки" />
        <select style={{ flex: '1 1 180px', width: 'auto' }} name="unit" value={pid} onChange={(e) => setPid(e.target.value)} aria-label="Юнит">
          <option value="">Без юнита</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className="btn primary" type="submit">Добавить сделку</button>
      </form>
      <div className="kanban">
        {STAGES.map((st) => {
          const list = deals.rows.filter((d) => d.stage === st.id)
          return (
            <div className="col" key={st.id}>
              <div className="col-head"><span>{st.label}</span><span className="count" aria-label={`${list.length} сделок`}>{list.length}</span></div>
              {deals.loading && <Skeleton h={96} />}
              {!deals.loading && list.length === 0 && <div className="col-empty">Пусто</div>}
              {list.map((d) => (
                <article className="deal" key={d.id}>
                  <Edit className="title-input" label="Сделка" value={d.title} onSave={(v) => deals.update(d.id, { title: v })} />
                  <span className="muted small" style={{ paddingInline: 6 }}>{pname(d.project_id)}</span>
                  <Edit label="Следующий шаг" value={d.next_step} placeholder="следующий шаг" onSave={(v) => deals.update(d.id, { next_step: v })} />
                  <div className="row between" style={{ flexWrap: 'nowrap' }}>
                    <select value={d.stage} onChange={(e) => deals.update(d.id, { stage: e.target.value })} aria-label="Этап" style={{ width: 'auto' }}>
                      {STAGES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                      <option value="lost">Отказ</option>
                    </select>
                    <RemoveButton label="Удалить сделку" onClick={() => deals.remove(d.id)} />
                  </div>
                </article>
              ))}
            </div>
          )
        })}
      </div>
    </section>
  )
}
