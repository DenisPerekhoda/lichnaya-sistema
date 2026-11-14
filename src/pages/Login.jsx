import { useState } from 'react'
import { supabase } from '../supabase'

// Вход по ссылке на почту — без паролей.
export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    const redirect = window.location.origin + window.location.pathname
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } })
    if (error) setErr(error.message)
    else setSent(true)
  }

  return (
    <div className="center">
      <form className="card narrow" onSubmit={submit}>
        <div className="eyebrow">Личная система</div>
        <h1>Вход</h1>
        {sent ? (
          <p>Ссылка для входа отправлена на <b>{email}</b>. Открой письмо на этом устройстве.</p>
        ) : (
          <>
            <label>
              Почта
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </label>
            <button className="btn primary" type="submit">Получить ссылку</button>
          </>
        )}
        {err && <div className="err">{err}</div>}
      </form>
    </div>
  )
}
