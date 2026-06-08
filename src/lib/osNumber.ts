import { supabase } from './supabase'

export async function nextOSNumber() {
  const year = new Date().getFullYear()
  const prefix = `OS-${year}-`

  const { data, error } = await supabase
    .from('service_orders')
    .select('os_number')
    .like('os_number', `${prefix}%`)
    .order('os_number', { ascending: false })
    .limit(1)

  if (error || !data?.length) return `${prefix}000001`

  const last = data[0]?.os_number || ''
  const n = Number(String(last).replace(prefix,''))
  const next = Number.isNaN(n) ? 1 : n + 1
  return `${prefix}${String(next).padStart(6,'0')}`
}
