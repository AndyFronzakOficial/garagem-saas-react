import { useEffect,useState } from 'react'
import { supabase } from '../lib/supabase'
import { money, osNumber, statusClass, today } from '../lib/utils'

export default function Leads(){
  const [rows,setRows]=useState<any[]>([])
  const [msg,setMsg]=useState('')
  useEffect(()=>{load()},[])

  async function load(){
    const{data}=await supabase.from('public_quotes').select('*').order('created_at',{ascending:false})
    setRows(data||[])
  }

  async function st(id:string,status:string){
    await supabase.from('public_quotes').update({status}).eq('id',id)
    load()
  }

  async function convert(r:any){
    const ok = confirm('Converter este lead em cliente e ordem de serviço?')
    if(!ok)return

    let clientId:string|null = null
    const existing = await supabase.from('clients').select('*').eq('phone',r.phone).maybeSingle()
    if(existing.data){
      clientId = existing.data.id
    }else{
      const created = await supabase.from('clients').insert({
        name:r.client_name,
        company:r.company || r.client_name,
        phone:r.phone,
        email:r.email,
        address:r.address
      }).select('*').single()
      clientId = created.data?.id
    }

    if(!clientId)return

    const num = osNumber()
    await supabase.from('service_orders').insert({
      os_number:num,
      client_id:clientId,
      service:r.service_name,
      service_price_id:r.service_price_id,
      service_type:r.service_name,
      width_m:r.width_m,
      height_m:r.height_m,
      area_m2:r.area_m2,
      price_m2:r.price_m2,
      estimated_price:r.estimated_price,
      measures:`${Number(r.width_m).toFixed(2)}m x ${Number(r.height_m).toFixed(2)}m`,
      finishing:r.finishing,
      description:r.description,
      source:'Interno',
      status:'Entrada',
      priority:'Média'
    })

    await supabase.from('accounts_receivable').insert({
      client_id:clientId,
      title:`${num} - ${r.service_name}`,
      due_date:today(),
      amount:r.estimated_price,
      reference:new Date().toLocaleDateString('pt-BR',{month:'2-digit',year:'numeric'}),
      status:'Aberto'
    })

    await supabase.from('public_quotes').update({status:'Convertido'}).eq('id',r.id)
    setMsg(`Lead convertido em ${num}.`)
    load()
  }

  return <div>
    <h1 className="text-4xl font-black">Novos Leads</h1>
    <p className="mb-6 text-zinc-400">Orçamentos públicos sem login.</p>
    {msg&&<div className="mb-4 rounded-xl border border-gold/30 bg-gold/10 p-4 text-gold">{msg}</div>}
    <div className="card table-wrap">
      <table>
        <thead><tr><th>Código</th><th>Cliente</th><th>Serviço</th><th>Medidas</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>{rows.map(r=><tr key={r.id}>
          <td>{r.quote_number}</td>
          <td>{r.client_name}<br/><small>{r.phone}</small></td>
          <td>{r.service_name}<br/><small>{r.finishing}</small></td>
          <td>{r.width_m}m x {r.height_m}m</td>
          <td>{money(r.estimated_price)}</td>
          <td><select className={`input ${statusClass(r.status)}`} value={r.status} onChange={e=>st(r.id,e.target.value)}><option>Novo</option><option>Em análise</option><option>Convertido</option><option>Recusado</option></select></td>
          <td><button className="btn-gold" onClick={()=>convert(r)}>Converter em OS</button></td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>
}
