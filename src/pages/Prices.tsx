import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { brNumber, money } from '../lib/utils'

export default function Prices() {
  const [rows, setRows] = useState<any[]>([])
  const [editing, setEditing] = useState<any | null>(null)
  const [f, setF] = useState({ name: '', price_m2_partner: '', price_m2_final: '', active: true })

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('service_prices').select('*').order('name')
    setRows(data || [])
  }
  function reset() { setEditing(null); setF({ name: '', price_m2_partner: '', price_m2_final: '', active: true }) }
  function edit(r: any) { setEditing(r); setF({ name: r.name || '', price_m2_partner: String(r.price_m2_partner || ''), price_m2_final: String(r.price_m2_final || ''), active: r.active !== false }) }
  async function save(e: React.FormEvent) {
    e.preventDefault()
    const payload = { name: f.name, price_m2_partner: brNumber(f.price_m2_partner), price_m2_final: brNumber(f.price_m2_final), active: f.active }
    if (editing) await supabase.from('service_prices').update(payload).eq('id', editing.id)
    else await supabase.from('service_prices').insert(payload)
    reset(); load()
  }
  async function remove(id: string) { if (!confirm('Remover este serviço/preço?')) return; await supabase.from('service_prices').delete().eq('id', id); load() }
  async function toggle(r: any) { await supabase.from('service_prices').update({ active: !r.active }).eq('id', r.id); load() }

  return <div>
    <h1 className="text-4xl font-black">Preços por m²</h1>
    <p className="mb-6 text-zinc-400">Cadastre serviços e valores por m² para terceiro e cliente final.</p>
    <form onSubmit={save} className="card mb-6 grid gap-3 md:grid-cols-5">
      <input className="input md:col-span-2" placeholder="Serviço: ACM, Lona, Banner..." value={f.name} onChange={e => setF({ ...f, name: e.target.value })} required />
      <input className="input" placeholder="Valor terceiro" value={f.price_m2_partner} onChange={e => setF({ ...f, price_m2_partner: e.target.value })} required />
      <input className="input" placeholder="Valor cliente final" value={f.price_m2_final} onChange={e => setF({ ...f, price_m2_final: e.target.value })} required />
      <button className="btn-gold">{editing ? 'Salvar' : 'Adicionar'}</button>
      {editing && <button type="button" className="btn-dark md:col-span-5" onClick={reset}>Cancelar edição</button>}
    </form>
    <div className="card table-wrap">
      <table>
        <thead>
          <tr>
            <th>Serviço</th>

            <th>Terceiro</th>
            <th>Cliente final</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>{rows.map(r => <tr key={r.id}><td><strong>{r.name}</strong></td>

          <td>{money(r.price_m2_partner)}</td>
          <td>{money(r.price_m2_final)}</td>
          <td>
            <span className={`badge ${r.active ? 'success' : 'danger'}`}>{r.active ? 'Ativo' : 'Inativo'}</span></td>
          <td>
            <div className="flex flex-wrap gap-2"><button className="btn-gold" onClick={() => edit(r)}>Alterar</button>
            <button className="btn-dark" onClick={() => toggle(r)}>{r.active ? 'Desativar' : 'Ativar'}</button>
            <button className="btn-red" onClick={() => remove(r.id)}>Remover</button>
            </div></td>
        </tr>)}{rows.length === 0 && <tr><td colSpan={5} className="text-zinc-400">Nenhum preço cadastrado.</td>
        </tr>}</tbody></table></div>
  </div>
}
