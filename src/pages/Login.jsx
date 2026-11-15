import { useState } from 'react'
import { supabase } from '../supabase'

// Вход по почте и паролю. Регистрация — один раз, затем её отключают в Supabase.
export default function Login() {
  const [mode, setMode] = useState('in') // in | up
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    const fn = mode === 'in' ? supabase.auth.signInWithPassword : supabase.auth.signUp
    const { data, error } = await fn.call(supabase.auth, { email, password })
    setBusy(false)
    if (error) {
      const m = error.message
      setErr(
        /Invalid login/i.test(m) ? 'Неверная почта или пароль'
        : /already registered/i.test(m) ? 'Такой пользователь уже есть, войди'
        : /Signups not allowed/i.test(m) ? 'Регистрация закрыта'
        : /at least/i.test(m) ? 'Пароль слишком короткий: нужно минимум 6 символов'
        : m
      )
    } else if (mode === 'up' && !data.session) {
      setErr('Аккаунт создан, но требуется подтверждение почты. Отключи «Confirm email» в Supabase и войди.')
    }
  }

  const pick = (m) => { setMode(m); setErr('') }

  return (
    <div className="auth">
      <div className="auth-intro">
        <span className="wordmark">Личная <span>система</span></span>
        <h1>Проекты, доход и цели в одном кабинете</h1>
      </div>
      <form className="card" onSubmit={submit} noValidate={false}>
        <h2>{mode === 'in' ? 'Вход' : 'Создать аккаунт'}</h2>
        <div className="seg auth-seg" role="group" aria-label="Режим">
          <button type="button" aria-pressed={mode === 'in'} onClick={() => pick('in')}>Вход</button>
          <button type="button" aria-pressed={mode === 'up'} onClick={() => pick('up')}>Регистрация</button>
        </div>
        <label>Почта
          <input type="email" name="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </label>
        <label>Пароль
          <input type="password" name="password" required minLength={6} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button className="btn primary" type="submit" disabled={busy} aria-busy={busy}>
          {busy ? 'Подождите…' : mode === 'in' ? 'Войти' : 'Создать аккаунт'}
        </button>
        {err && <div className="err" role="alert">{err}</div>}
      </form>
    </div>
  )
}
