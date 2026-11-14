import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

// Простой хук: загрузить таблицу, добавить, изменить, удалить строку.
// RLS в Supabase гарантирует, что видны только свои строки.
export function useTable(table, { order = 'created_at', ascending = true, filter } = {}) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    let q = supabase.from(table).select('*').order(order, { ascending })
    if (filter) q = filter(q)
    const { data, error } = await q
    if (error) setError(error.message)
    else { setRows(data || []); setError(null) }
    setLoading(false)
  }, [table, order, ascending, filter])

  useEffect(() => { load() }, [load])

  const insert = async (row) => {
    const { data, error } = await supabase.from(table).insert(row).select().single()
    if (error) { setError(error.message); return null }
    setRows((r) => [...r, data])
    return data
  }
  const update = async (id, patch) => {
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    const { error } = await supabase.from(table).update(patch).eq('id', id)
    if (error) { setError(error.message); load() }
  }
  const remove = async (id) => {
    setRows((r) => r.filter((x) => x.id !== id))
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) { setError(error.message); load() }
  }

  return { rows, loading, error, insert, update, remove, reload: load }
}
