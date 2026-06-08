import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function today(){ return new Date().toISOString().slice(0,10) }
function badge(s:string){
  if(s==='Concluído') return 'success'
  if(s==='Cancelado') return 'danger'
  if(s==='Em rota' || s==='Reagendado') return 'info'
  return 'warning'
}

export default function Deliveries(){
  const [rows,setRows]=useState<any[]>([])
  const [orders,setOrders]=useState<any[]>([])
  const [form,setForm]=useState({service_order_id:'',team:'',vehicle:'',route:'',address:'',installation_date:today(),installation_time:'',status:'Agendado',notes:''})

  useEffect(()=>{load()},[])

  async function load(){
    const [i,o]=await Promise.all([
      supabase.from('installations').select('*,service_orders(os_number,service)').order('installation_date',{ascending:false}),
      supabase.from('service_orders').select('id,os_number,service').order('created_at',{ascending:false})
    ])
    setRows(i.data||[])
    setOrders(o.data||[])
  }

  async function save(e:React.FormEvent){
    e.preventDefault()
    await supabase.from('installations').insert({...form,service_order_id:form.service_order_id||null,installation_time:form.installation_time||null})
    setForm({service_order_id:'',team:'',vehicle:'',route:'',address:'',installation_date:today(),installation_time:'',status:'Agendado',notes:''})
    load()
  }

  async function updateStatus(id:string,status:string){
    await supabase.from('installations').update({status}).eq('id',id)
    load()
  }

  async function updateDate(id:string,date:string){
    await supabase.from('installations').update({installation_date:date,status:'Reagendado'}).eq('id',id)
    load()
  }

  async function remove(id:string){
    if(!confirm('Apagar entrega/instalação?')) return
    await supabase.from('installations').delete().eq('id',id)
    load()
  }

  return (
    <div>
      <h1 className="text-4xl font-black">Entrega / Instalação</h1>
      <p className="mb-6 text-zinc-400">Controle de equipe, veículo, rota, endereço, data e reagendamento.</p>

      <form onSubmit={save} className="card mb-6 grid gap-3 md:grid-cols-4">
        <select className="input" value={form.service_order_id} onChange={e=>setForm({...form,service_order_id:e.target.value})}>
          <option value="">Sem OS vinculada</option>
          {orders.map(o=><option key={o.id} value={o.id}>{o.os_number} - {o.service}</option>)}
        </select>
        <input className="input" placeholder="Equipe" value={form.team} onChange={e=>setForm({...form,team:e.target.value})}/>
        <input className="input" placeholder="Veículo" value={form.vehicle} onChange={e=>setForm({...form,vehicle:e.target.value})}/>
        <input className="input" placeholder="Rota" value={form.route} onChange={e=>setForm({...form,route:e.target.value})}/>
        <input className="input md:col-span-2" placeholder="Endereço" value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/>
        <input className="input" type="date" value={form.installation_date} onChange={e=>setForm({...form,installation_date:e.target.value})}/>
        <input className="input" type="time" value={form.installation_time} onChange={e=>setForm({...form,installation_time:e.target.value})}/>
        <select className="input" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
          <option>Agendado</option><option>Em rota</option><option>Concluído</option><option>Reagendado</option><option>Cancelado</option>
        </select>
        <input className="input md:col-span-2" placeholder="Observações" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/>
        <button className="btn-gold">Agendar</button>
      </form>

      <div className="card table-wrap">
        <table>
          <thead><tr><th>OS</th><th>Equipe</th><th>Veículo</th><th>Rota</th><th>Endereço</th><th>Data</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            {rows.map(r=><tr key={r.id}>
              <td>{r.service_orders?.os_number || '-'}<br/><small>{r.service_orders?.service}</small></td>
              <td>{r.team}</td>
              <td>{r.vehicle}</td>
              <td>{r.route}</td>
              <td>{r.address}</td>
              <td><input className="input" type="date" defaultValue={r.installation_date} onBlur={e=>updateDate(r.id,e.target.value)}/></td>
              <td><select className={`input ${badge(r.status)}`} value={r.status} onChange={e=>updateStatus(r.id,e.target.value)}>
                <option>Agendado</option><option>Em rota</option><option>Concluído</option><option>Reagendado</option><option>Cancelado</option>
              </select></td>
              <td><button className="btn-red" onClick={()=>remove(r.id)}>Apagar</button></td>
            </tr>)}
            {rows.length===0 && <tr><td colSpan={8} className="text-zinc-400">Nenhuma entrega cadastrada.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
