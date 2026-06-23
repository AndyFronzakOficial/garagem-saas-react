import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { money } from '../lib/utils'

function brDate(v?:string|null){ if(!v)return '-'; const [y,m,d]=String(v).slice(0,10).split('-'); return d&&m&&y?`${d}/${m}/${y}`:'-' }

export default function CustomerHistory(){
  const [clients,setClients]=useState<any[]>([])
  const [orders,setOrders]=useState<any[]>([])
  const [selected,setSelected]=useState('')
  const [search,setSearch]=useState('')

  useEffect(()=>{ load() },[])
  async function load(){
    const [c,o]=await Promise.all([
      supabase.from('clients').select('*').order('name'),
      supabase.from('service_orders').select('*,clients(*)').order('created_at',{ascending:false})
    ])
    setClients(c.data||[]); setOrders((o.data||[]).filter((x:any)=>!x.is_deleted))
  }

  const list = clients.filter(c=>[c.name,c.company,c.phone,c.email].join(' ').toLowerCase().includes(search.toLowerCase()))
  const selectedClient = clients.find(c=>c.id===selected) || list[0]
  const clientOrders = useMemo(()=> selectedClient ? orders.filter(o=>o.client_id===selectedClient.id) : [],[orders,selectedClient])
  const total = clientOrders.reduce((a,b)=>a+Number(b.estimated_price||0),0)
  const avg = clientOrders.length ? total / clientOrders.length : 0
  const last = clientOrders[0]
  const topServices = Object.entries(clientOrders.reduce((acc:any,o:any)=>{ const items=Array.isArray(o.quote_items)?o.quote_items:[]; if(items.length){items.forEach((i:any)=>acc[i.service_name || 'Serviço']=(acc[i.service_name || 'Serviço']||0)+1)} else acc[o.service_type||o.service||'Serviço']=(acc[o.service_type||o.service||'Serviço']||0)+1; return acc },{})).sort((a:any,b:any)=>b[1]-a[1]).slice(0,5)

  return <div>
    <h1 className="text-4xl font-black">Histórico do Cliente</h1>
    <p className="mb-6 text-zinc-400">Total gasto, quantidade de pedidos, ticket médio, último pedido e serviços mais comprados.</p>
    <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
      <div className="card">
        <input className="input mb-4" placeholder="Buscar cliente..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <div className="max-h-[650px] space-y-2 overflow-y-auto pr-1">
          {list.map(c=><button key={c.id} onClick={()=>setSelected(c.id)} className={`w-full rounded-xl border p-3 text-left ${selectedClient?.id===c.id?'border-gold/50 bg-gold/10':'border-white/10 bg-black/20 hover:bg-white/5'}`}>
            <strong>{c.name || c.company}</strong><br/><small className="text-zinc-400">{c.company} · {c.phone}</small>
          </button>)}
        </div>
      </div>
      <div>
        {selectedClient ? <>
          <div className="card mb-5"><h2 className="text-2xl font-black text-gold">{selectedClient.name}</h2><p className="text-zinc-400">{selectedClient.company} · {selectedClient.phone} · {selectedClient.email}</p></div>
          <section className="mb-5 grid gap-4 md:grid-cols-4">
            <article className="card"><small>Total gasto</small><h2 className="text-2xl font-black">{money(total)}</h2></article>
            <article className="card"><small>Quantidade de pedidos</small><h2 className="text-2xl font-black">{clientOrders.length}</h2></article>
            <article className="card"><small>Ticket médio</small><h2 className="text-2xl font-black">{money(avg)}</h2></article>
            <article className="card"><small>Último pedido</small><h2 className="text-xl font-black">{last?.os_number || '-'}</h2><small>{brDate(last?.created_at)}</small></article>
          </section>
          <section className="grid gap-5 xl:grid-cols-2">
            <div className="card"><h3 className="mb-4 text-xl font-black">Serviços mais comprados</h3>{topServices.map(([name,count]:any)=><div className="mb-3 flex justify-between rounded-xl bg-black/20 p-3"><span>{name}</span><strong>{count}x</strong></div>)}{topServices.length===0&&<p className="text-zinc-400">Sem serviços.</p>}</div>
            <div className="card table-wrap"><table><thead><tr><th>OS</th><th>Serviço</th><th>Data</th><th>Valor</th></tr></thead><tbody>{clientOrders.map(o=><tr key={o.id}><td>{o.os_number}</td><td>{o.service}</td><td>{brDate(o.created_at)}</td><td>{money(o.estimated_price)}</td></tr>)}</tbody></table></div>
          </section>
        </> : <div className="card text-zinc-400">Nenhum cliente cadastrado.</div>}
      </div>
    </section>
  </div>
}
