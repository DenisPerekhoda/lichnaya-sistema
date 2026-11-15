import { useState } from 'react'
import { useTable } from '../useTable'
import { useSettings } from '../useSettings'
import { today } from '../supabase'
import { Err, RemoveButton, Skeleton } from '../ui'

export default function Today({ userId }) {
  const [s, saveS] = useSettings(userId)
  const tasks = useTable('tasks')
  const projects = useTable('projects', { order: 'sort' })
  const [title, setTitle] = useState('')
  const [due, setDue] = useState(today())
  const [pid, setPid] = useState('')

  const t = today()
  const open = tasks.rows.filter((x) => !x.done)
  const overdue = open.filter((x) => x.due && x.due < t)
  const now = open.filter((x) => x.due === t)
  const later = open.filter((x) => x.due && x.due > t).sort((a, b) => a.due.localeCompare(b.due))
  const nodate = open.filter((x) => !x.due)
  const done = tasks.rows.filter((x) => x.done).slice(-10).reverse()
  const pname = (id) => projects.rows.find((p) => p.id === id)?.name

  const add = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    await tasks.insert({ title: title.trim(), due: due || null, project_id: pid || null })
    setTitle('')
  }

  // Список — обычная функция, а не компонент: чекбоксы не пересоздаются при каждом рендере
  const list = (items, label, warn) =>
    items.length > 0 && (
      <div key={label}>
        <div className={'group-label' + (warn ? ' warn' : '')}>{label}, {items.length}</div>
        {items.map((x) => (
          <div className={'task' + (x.done ? ' done' : '')} key={x.id}>
            <input type="checkbox" checked={x.done} onChange={() => tasks.update(x.id, { done: !x.done })} aria-label={`Выполнено: ${x.title}`} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span className="t">{x.title}</span>
              <div className="muted small">
                {pname(x.project_id) || 'Без проекта'}
                {x.due && <>, {new Date(x.due).toLocaleDateString('ru-RU')}</>}
              </div>
            </div>
            <RemoveButton label="Удалить задачу" onClick={() => tasks.remove(x.id)} />
          </div>
        ))}
      </div>
    )

  return (
    <>
      <div className="page-head">
        <h1>Сегодня</h1>
        <span className="muted small">{new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
      </div>
      <Err>{tasks.error}</Err>
      <div className="cols">
        <div className="main">
          {s && (
            <div className="focus-card">
              <label htmlFor="main-action">Главное действие дня</label>
              <input id="main-action" name="main_action" defaultValue={s.main_action} key={s.main_action}
                placeholder="Одно действие, которое двигает к цели"
                onBlur={(e) => e.target.value !== s.main_action && saveS({ main_action: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
            </div>
          )}
          <section className="card" aria-label="Задачи">
            {tasks.loading ? (
              <><Skeleton h={24} /><Skeleton h={24} /><Skeleton h={24} /></>
            ) : (
              <>
                {list(overdue, 'Просрочено', true)}
                {list(now, 'На сегодня')}
                {list(nodate, 'Без срока')}
                {list(later, 'Дальше')}
                {open.length === 0 && <p className="empty">Открытых задач нет. Добавь первую справа.</p>}
              </>
            )}
          </section>
        </div>
        <div className="side">
          <form className="card" onSubmit={add}>
            <h2>Новая задача</h2>
            <label>Что сделать<input name="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: написать Ивану" /></label>
            <label>Срок<input type="date" name="due" value={due} onChange={(e) => setDue(e.target.value)} /></label>
            <label>Проект
              <select name="project" value={pid} onChange={(e) => setPid(e.target.value)}>
                <option value="">Без проекта</option>
                {projects.rows.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <button className="btn primary" type="submit">Добавить</button>
          </form>
          {done.length > 0 && (
            <section className="card">
              <h2>Сделано недавно</h2>
              {list(done, 'Выполнено')}
            </section>
          )}
        </div>
      </div>
    </>
  )
}
