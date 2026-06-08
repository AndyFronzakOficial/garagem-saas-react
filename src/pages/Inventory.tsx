import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function brNumber(v:string){ return Number(String(v||'').replace(/\./g,'').replace(',','.')) || 0 }

export default function Inventory(){
  const [rows,setRows]=useState<any[]>([])
  const [form,setForm]=useState({material:'',quantity:'',unit:'m²',min_quantity:'',notes:''})

  useEffect(()=>{load()},[])

  async function load(){
    const {data}=await supabase.from('inventory').select('*').order('material')
    setRows(data||[])
  }

  async function save(e:React.FormEvent){
    e.preventDefault()
    await supabase.from('inventory').insert({
      material:form.material,
      quantity:brNumber(form.quantity),
      unit:form.unit,
      min_quantity:brNumber(form.min_quantity),
      notes:form.notes||null
    })
    setForm({material:'',quantity:'',unit:'m²',min_quantity:'',notes:''})
    load()
  }

  async function updateQty(id:string, quantity:string){
    await supabase.from('inventory').update({quantity:brNumber(quantity)}).eq('id',id)
    load()
  }

  async function remove(id:string){
    if(!confirm('Apagar este material?')) return
    await supabase.from('inventory').delete().eq('id',id)
    load()
  }

  return (
    <div>
      <h1 className="text-4xl font-black">Estoque</h1>
      <p className="mb-6 text-zinc-400">Controle de material, quantidade e estoque mínimo.</p>

      <form onSubmit={save} className="card mb-6 grid gap-3 md:grid-cols-5">
        <input className="input" placeholder="Material" value={form.material} onChange={e=>setForm({...form,material:e.target.value})} required/>
        <input className="input" placeholder="Quantidade" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})} required/>
        <input className="input" placeholder="Unidade" value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}/>
        <input className="input" placeholder="Mínimo" value={form.min_quantity} onChange={e=>setForm({...form,min_quantity:e.target.value})}/>
        <button className="btn-gold">Adicionar</button>
        <input className="input md:col-span-5" placeholder="Observações" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/>
      </form>

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Material</th><th>Qtd</th><th>Unidade</th><th>Mínimo</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            {rows.map(r=>{
              const low=Number(r.quantity)<=Number(r.min_quantity)
              return (
                <tr key={r.id}>
                  <td>{r.material}<br/><small>{r.notes}</small></td>
                  <td><input className="input max-w-32" defaultValue={r.quantity} onBlur={e=>updateQty(r.id,e.target.value)}/></td>
                  <td>{r.unit}</td>
                  <td>{r.min_quantity}</td>
                  <td><span className={`badge ${low?'danger':'success'}`}>{low?'Baixo':'OK'}</span></td>
                  <td><button className="btn-red" onClick={()=>remove(r.id)}>Apagar</button></td>
                </tr>
              )
            })}
            {rows.length===0 && <tr><td colSpan={6} className="text-zinc-400">Nenhum material cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
