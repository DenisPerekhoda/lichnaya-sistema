import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useTable } from '../useTable'
import { useSettings } from '../useSettings'
import { seed } from '../seed'
import { Edit, Err } from '../ui'

export default function Settings({ userId }) {
  const [s, saveS] = useSettings(userId)
  const cases = useTable('showcase_cases', { order: 'sort' })
  const [profile, setProfile] = useState(null)
  const [seeding, setSeeding] = useState('')

  useEffect(() => {
    supabase.from('profile').select('*').eq('user_id', userId).maybeSingle()
      .then(({ data }) => setProfile(data || { user_id: userId, name: '', headline: '', about: '', contact: '', is_public: false }))
  }, [userId])

  const saveP = async (patch) => {
    const next = { ...profile, ...patch }
    setProfile(next)
    await supabase.from('profile').upsert(next)
  }

  const runSeed = async () => {
    if (!window.confirm('Добавить стартовые данные: проекты, сделки, цели, задачи и витрину?')) return
    setSeeding('Заполняю…')
    try { await seed(userId); setSeeding('Готово — обнови страницу'); }
    catch (e) { setSeeding('Ошибка: ' + e.message) }
  }

  const showcaseUrl = window.location.origin + window.location.pathname + '#/showcase'

  return (
    <div className="cols">
      <div className="main">
        <Err>{cases.error}</Err>
        {profile && (
          <section className="card">
            <div className="row between">
              <h2>Витрина для клиентов</h2>
              <label style={{ flexDirection: 'row', alignItems: 'center', color: 'var(--text)' }}>
                <input type="checkbox" checked={profile.is_public} onChange={(e) => saveP({ is_public: e.target.checked })} />
                Опубликована
              </label>
            </div>
            <span className="muted small">Ссылка: <a href={showcaseUrl} target="_blank" rel="noreferrer">{showcaseUrl}</a>{!profile.is_public && ' — пока скрыта'}</span>
            <label>Имя<Edit value={profile.name} onSave={(v) => saveP({ name: v })} /></label>
            <label>Заголовок<Edit value={profile.headline} onSave={(v) => saveP({ headline: v })} /></label>
            <label>О себе<Edit value={profile.about} onSave={(v) => saveP({ about: v })} /></label>
            <label>Контакт (Telegram, почта или телефон)<Edit value={profile.contact} onSave={(v) => saveP({ contact: v })} /></label>
            <h3 style={{ marginTop: 8 }}>Цифры и кейсы</h3>
            {cases.rows.map((c) => (
              <div className="row" key={c.id} style={{ flexWrap: 'nowrap' }}>
                <Edit value={c.value} onSave={(v) => cases.update(c.id, { value: v })} />
                <Edit value={c.label} onSave={(v) => cases.update(c.id, { label: v })} />
                <input type="checkbox" checked={c.is_public} onChange={() => cases.update(c.id, { is_public: !c.is_public })} aria-label="Показывать на витрине" />
                <button className="btn link" aria-label="Удалить" onClick={() => cases.remove(c.id)}>✕</button>
              </div>
            ))}
            <button className="btn" onClick={() => cases.insert({ value: 'Цифра', label: 'что за ней стоит', sort: cases.rows.length + 1 })}>Добавить кейс</button>
          </section>
        )}
      </div>
      <div className="side">
        {s && (
          <section className="card">
            <h2>Цели верхнего уровня</h2>
            <label>Цель дохода в месяц, ₽<Edit type="number" value={+s.income_goal} onSave={(v) => saveS({ income_goal: v })} /></label>
            <label>Цель цикла, ₽ в месяц<Edit type="number" value={+s.cycle_goal} onSave={(v) => saveS({ cycle_goal: v })} /></label>
            <label>Конец цикла<Edit type="date" value={s.cycle_end} onSave={(v) => saveS({ cycle_end: v })} /></label>
            <label>Сделка-цель, ₽<Edit type="number" value={+s.deal_goal} onSave={(v) => saveS({ deal_goal: v })} /></label>
            <label>Что за сделка и к какой дате<Edit value={s.deal_note} onSave={(v) => saveS({ deal_note: v })} /></label>
            <label>Капитал сейчас, ₽<Edit type="number" value={+s.capital} onSave={(v) => saveS({ capital: v })} /></label>
            <label>Цель капитала, ₽<Edit type="number" value={+s.capital_goal} onSave={(v) => saveS({ capital_goal: v })} /></label>
            <label>Откладывать в месяц, ₽<Edit type="number" value={+s.monthly_saving_goal} onSave={(v) => saveS({ monthly_saving_goal: v })} /></label>
          </section>
        )}
        <section className="card">
          <h2>Стартовые данные</h2>
          <span className="muted small">Один раз заполнит систему твоими проектами, сделками, целями цикла и витриной. Всё можно поправить.</span>
          <button className="btn primary" onClick={runSeed}>Заполнить</button>
          <span className="muted small">{seeding}</span>
        </section>
      </div>
    </div>
  )
}
