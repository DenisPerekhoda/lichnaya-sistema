import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, Navigate } from 'react-router-dom'
import { supabase, configured } from './supabase'
import Login from './pages/Login'
import Cabinet from './pages/Cabinet'
import Today from './pages/Today'
import Goals from './pages/Goals'
import Showcase from './pages/Showcase'
import Settings from './pages/Settings'

function NotConfigured() {
  return (
    <div className="center">
      <div className="card narrow">
        <h1>Почти готово</h1>
        <p className="muted">
          Не заданы ключи Supabase. Добавь переменные <code>VITE_SUPABASE_URL</code> и{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> — инструкция в README.
        </p>
      </div>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    if (!configured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!configured) return <NotConfigured />

  return (
    <Routes>
      {/* Витрина открыта всем — её можно давать клиентам */}
      <Route path="/showcase" element={<Showcase />} />
      <Route
        path="*"
        element={
          session === undefined ? (
            <div className="center muted">Загрузка…</div>
          ) : !session ? (
            <Login />
          ) : (
            <Shell session={session} />
          )
        }
      />
    </Routes>
  )
}

function Shell({ session }) {
  const links = [
    ['/', 'Кабинет'],
    ['/today', 'Сегодня'],
    ['/goals', 'Цели и чек-ин'],
    ['/settings', 'Витрина и данные'],
  ]
  return (
    <div className="wrap">
      <header className="top">
        <div>
          <div className="eyebrow">Личная система</div>
          <div className="brand">Холдинг «Перехода»</div>
        </div>
        <nav className="nav">
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} end className={({ isActive }) => (isActive ? 'pill on' : 'pill')}>
              {label}
            </NavLink>
          ))}
          <a className="pill" href="#/showcase" target="_blank" rel="noreferrer">Открыть витрину ↗</a>
          <button className="pill ghost" onClick={() => supabase.auth.signOut()}>Выйти</button>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<Cabinet userId={session.user.id} />} />
        <Route path="/today" element={<Today userId={session.user.id} />} />
        <Route path="/goals" element={<Goals userId={session.user.id} />} />
        <Route path="/settings" element={<Settings userId={session.user.id} />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  )
}
