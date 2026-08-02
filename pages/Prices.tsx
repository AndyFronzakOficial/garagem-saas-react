import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { brNumber, money } from '../lib/utils'

// Tipos de precificação aceitos no sistema.
// m2 = calcula por área; quantidade = calcula por unidade/quantidade.
const pricingTypes = [
  { value:'m2', label:'Por m²', unit:'m²' },
  { value:'quantity', label:'Por quantidade', unit:'un' }
]

function unitLabel(type?:string){
  return type === 'quantity' ? 'un' : 'm²'
}

export default function Prices() {
  const [rows, setRows] = useState<any[]>([])
  const [editing, setEditing] = useState<any | null>(null)
  const [f, setF] = useState({ name: '', pricing_type:'m2', price_m2_partner: '', price_m2_final: '', active: true })

  useEffect(() => { load() }, [])

  async function load() {
    // Carrega todos os serviços cadastrados para a tela de precificação.
    const { data } = await supabase.from('service_prices').select('*').order('name')
    setRows(data || [])
  }

  function reset() {
    setEditing(null)
    setF({ name: '', pricing_type:'m2', price_m2_partner: '', price_m2_final: '', active: true })
  }

  function edit(r: any) {
    // Preenche o formulário com o registro escolhido para edição.
    setEditing(r)
    setF({
      name: r.name || '',
      pricing_type: r.pricing_type || 'm2',
      price_m2_partner: String(r.price_m2_partner || ''),
      price_m2_final: String(r.price_m2_final || ''),
      active: r.active !== false
    })
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()

    // Mesmo mantendo os nomes antigos das colunas no banco, o campo pricing_type define se o valor é por m² ou por unidade.
    const payload = {
      name: f.name,
      pricing_type: f.pricing_type,
      price_m2_partner: brNumber(f.price_m2_partner),
      price_m2_final: brNumber(f.price_m2_final),
      active: f.active
    }

    if (editing) await supabase.from('service_prices').update(payload).eq('id', editing.id)
    else await supabase.from('service_prices').insert(payload)

    reset()
    load()
  }

  async function remove(id: string) {
    if (!confirm('Remover este serviço/preço?')) return
    await supabase.from('service_prices').delete().eq('id', id)
    load()
  }

  async function toggle(r: any) {
    await supabase.from('service_prices').update({ active: !r.active }).eq('id', r.id)
    load()
  }

  return <div>
    <h1 className="text-4xl font-black">Precificação</h1>
    <p className="mb-6 text-zinc-400">Cadastre serviços cobrados por m² ou por quantidade/unidade.</p>

    <form onSubmit={save} className="card mb-6 grid gap-3 md:grid-cols-6">
      <input className="input md:col-span-2" placeholder="Serviço: ACM, Lona, Banner, Adesivo, Instalação..." value={f.name} onChange={e => setF({ ...f, name: e.target.value })} required />

      <select className="input" value={f.pricing_type} onChange={e => setF({ ...f, pricing_type: e.target.value })}>
        {pricingTypes.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
      </select>

      <input className="input" placeholder={`Valor terceiro / ${unitLabel(f.pricing_type)}`} value={f.price_m2_partner} onChange={e => setF({ ...f, price_m2_partner: e.target.value })} required />
      <input className="input" placeholder={`Valor cliente final / ${unitLabel(f.pricing_type)}`} value={f.price_m2_final} onChange={e => setF({ ...f, price_m2_final: e.target.value })} required />
      <button className="btn-gold">{editing ? 'Salvar' : 'Adicionar'}</button>

      {editing && <button type="button" className="btn-dark md:col-span-6" onClick={reset}>Cancelar edição</button>}
    </form>

    <div className="card table-wrap">
      <table>
        <thead>
          <tr>
            <th>Serviço</th>
            <th>Tipo</th>
            <th>Terceiro</th>
            <th>Cliente final</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>{rows.map(r => <tr key={r.id}>
          <td><strong>{r.name}</strong></td>
          <td>{r.pricing_type === 'quantity' ? 'Por quantidade' : 'Por m²'}</td>
          <td>{money(r.price_m2_partner)} / {unitLabel(r.pricing_type)}</td>
          <td>{money(r.price_m2_final)} / {unitLabel(r.pricing_type)}</td>
          <td><span className={`badge ${r.active ? 'success' : 'danger'}`}>{r.active ? 'Ativo' : 'Inativo'}</span></td>
          <td>
            <div className="flex flex-wrap gap-2">
              <button className="btn-gold" onClick={() => edit(r)}>Alterar</button>
              <button className="btn-dark" onClick={() => toggle(r)}>{r.active ? 'Desativar' : 'Ativar'}</button>
              <button className="btn-red" onClick={() => remove(r.id)}>Remover</button>
            </div>
          </td>
        </tr>)}{rows.length === 0 && <tr><td colSpan={6} className="text-zinc-400">Nenhuma precificação cadastrada.</td></tr>}</tbody>
      </table>
    </div>
  </div>
}
