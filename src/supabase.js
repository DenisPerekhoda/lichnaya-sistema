import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const configured = Boolean(url && key)
// pkce: ссылка из письма приходит с ?code=..., а не с #токеном — не конфликтует с адресами вида /#/today
export const supabase = configured ? createClient(url, key, { auth: { flowType: 'pkce' } }) : null

export const rub = (n) =>
  (Number(n) || 0).toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽'

export const STAGES = [
  { id: 'contact', label: 'Контакт' },
  { id: 'talks', label: 'Переговоры' },
  { id: 'pilot', label: 'Пилот / образцы' },
  { id: 'contract', label: 'Контракт' },
]

// Понедельник текущей недели в формате YYYY-MM-DD
export function weekStart(d = new Date()) {
  const x = new Date(d)
  const day = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - day)
  return x.toISOString().slice(0, 10)
}
export const today = () => new Date().toISOString().slice(0, 10)
