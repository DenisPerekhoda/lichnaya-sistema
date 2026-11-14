import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Одна строка настроек на пользователя; создаётся при первом заходе.
export function useSettings(userId) {
  const [s, setS] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      let { data } = await supabase.from('settings').select('*').maybeSingle()
      if (!data) {
        const res = await supabase.from('settings').insert({ user_id: userId }).select().single()
        data = res.data
      }
      if (alive) setS(data)
    })()
    return () => { alive = false }
  }, [userId])

  const save = async (patch) => {
    setS((x) => ({ ...x, ...patch }))
    await supabase.from('settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('user_id', userId)
  }
  return [s, save]
}
