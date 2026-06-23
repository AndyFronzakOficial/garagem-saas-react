import { useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import { supabase } from '../lib/supabase'
import { money } from '../lib/utils'

function brDate(v?:string|null){
  if(!v)return '-'
  const d = new Date(v)
  if(!isNaN(d.getTime())) return d.toLocaleDateString('pt-BR')
  const [y,m,day]=String(v).slice(0,10).split('-')
  return day&&m&&y?`${day}/${m}/${y}`:'-'
}
function brDateTime(v?:string|null){
  if(!v)return '-'
  const d = new Date(v)
  return isNaN(d.getTime()) ? brDate(v) : d.toLocaleString('pt-BR')
}
function getItems(o:any){
  if(Array.isArray(o.quote_items) && o.quote_items.length) return o.quote_items
  return [{
    service_name:o.service || o.service_type || 'Serviço',
    width_cm:Number(o.width_cm || 0) || Number(o.width_m || 0) * 100,
    height_cm:Number(o.height_cm || 0) || Number(o.height_m || 0) * 100,
    quantity:o.quantity || 1,
    estimated_price:o.estimated_price || 0,
    observation:o.description || 'Sem observação',
    finishing:o.finishing || 'Sem acabamento'
  }]
}
function formatCm(v:any){ return `${Number(v || 0).toFixed(0)}cm` }

export default function CustomerHistory(){
  const [clients,setClients]=useState<any[]>([])
  const [orders,setOrders]=useState<any[]>([])
  const [company,setCompany]=useState<any>(null)
  const [selected,setSelected]=useState('')
  const [search,setSearch]=useState('')
  const [signatureOrder,setSignatureOrder]=useState<any>(null)

  useEffect(()=>{ load() },[])
  async function load(){
    const [c,o,cfg]=await Promise.all([
      supabase.from('clients').select('*').order('name'),
      supabase.from('service_orders').select('*,clients(*)').order('created_at',{ascending:false}),
      supabase.from('company_settings').select('*').eq('id',1).maybeSingle()
    ])
    setClients(c.data||[])
    setOrders((o.data||[]).filter((x:any)=>!x.is_deleted))
    if(!cfg.error) setCompany(cfg.data)
  }

  function downloadContract(order:any){
    const client = order.clients || selectedClient || {}
    const pdf=new jsPDF('p','mm','a4')
    pdf.setFontSize(16); pdf.text('TERMO DE APROVAÇÃO DE ARTE E ORDEM DE SERVIÇO',12,18)
    pdf.setFontSize(10)
    pdf.text(`Empresa: ${company?.name || 'Garagem ERP'}`,12,30)
    pdf.text(`Cliente: ${client?.name || client?.company || '-'}`,12,40)
    pdf.text(`Empresa do cliente: ${client?.company || '-'}`,12,48)
    pdf.text(`OS: ${order.os_number || '-'}`,12,56)
    pdf.text(`Valor: ${money(order.estimated_price)}`,12,64)
    const text='Ao aprovar este documento, o cliente declara que conferiu a arte, medidas, textos, cores, informações, serviços e condições da ordem de serviço. Após a aprovação, alterações podem gerar novo prazo e custo adicional conforme análise da empresa.'
    pdf.text(pdf.splitTextToSize(text,180),12,80)
    pdf.text(`Status da aprovação: ${order.art_approval_status || 'Pendente'}`,12,112)
    pdf.text(`Data/hora da assinatura: ${brDateTime(order.art_approved_at)}`,12,120)
    if(order.art_approval_signature){
      try{ pdf.addImage(order.art_approval_signature,'PNG',20,138,75,32) }catch{}
    }
    pdf.line(20,174,100,174); pdf.text('Assinatura do Cliente',38,182)
    pdf.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`,12,198)
    pdf.save(`contrato-${order.os_number || 'cliente'}.pdf`)
  }

  function downloadServiceOrder(order:any){
    const client = order.clients || selectedClient || {}
    const items = getItems(order)
    const pdf=new jsPDF('p','mm','a4')
    pdf.setFontSize(18); pdf.text('ORDEM DE SERVIÇO',12,18)
    pdf.setFontSize(10)
    pdf.text(`Empresa: ${company?.name || 'Garagem ERP'}`,12,30)
    pdf.text(`Cliente: ${client?.name || client?.company || '-'}`,12,38)
    pdf.text(`Telefone: ${client?.phone || '-'}`,12,46)
    pdf.text(`OS: ${order.os_number || '-'}`,118,38)
    pdf.text(`Data: ${brDate(order.created_at)}`,118,46)
    pdf.text(`Status: ${order.status || '-'}`,118,54)
    let y=70
    pdf.setFontSize(12); pdf.text('Serviços',12,y); y+=8
    pdf.setFontSize(9)
    items.forEach((item:any,idx:number)=>{
      if(y>258){ pdf.addPage(); y=18 }
      const serviceName = item.service_name || item.name || order.service || 'Serviço'
      const line = `${idx+1}. ${serviceName} · ${formatCm(item.width_cm)} x ${formatCm(item.height_cm)} · Qtd: ${item.quantity || 1} · ${money(item.estimated_price || item.value || 0)}`
      pdf.text(pdf.splitTextToSize(line,185),12,y); y+=8
      const obs = `Obs: ${item.observation || item.obs || 'Sem observação'} · Acabamento: ${item.finishing || item.finish || order.finishing || 'Sem acabamento'}`
      pdf.text(pdf.splitTextToSize(obs,185),16,y); y+=10
    })
    pdf.setFontSize(12); pdf.text(`Total: ${money(order.estimated_price)}`,12,y+4)
    if(order.art_approval_signature){
      pdf.setFontSize(10)
      pdf.text(`Assinado pelo cliente em: ${brDateTime(order.art_approved_at)}`,12,262)
      try{ pdf.addImage(order.art_approval_signature,'PNG',118,246,60,25) }catch{}
    }
    pdf.save(`ordem-servico-${order.os_number || 'cliente'}.pdf`)
  }

  const list = clients.filter(c=>[c.name,c.company,c.phone,c.email].join(' ').toLowerCase().includes(search.toLowerCase()))
  const selectedClient = clients.find(c=>c.id===selected) || list[0]
  const clientOrders = useMemo(()=> selectedClient ? orders.filter(o=>o.client_id===selectedClient.id) : [],[orders,selectedClient])
  const total = clientOrders.reduce((a,b)=>a+Number(b.estimated_price||0),0)
  const avg = clientOrders.length ? total / clientOrders.length : 0
  const last = clientOrders[0]
  const topServices = Object.entries(clientOrders.reduce((acc:any,o:any)=>{ const items=getItems(o); if(items.length){items.forEach((i:any)=>acc[i.service_name || i.name || o.service || 'Serviço']=(acc[i.service_name || i.name || o.service || 'Serviço']||0)+1)} return acc },{})).sort((a:any,b:any)=>b[1]-a[1]).slice(0,5)

  return <div>
    <h1 className="text-4xl font-black">Histórico do Cliente</h1>
    <p className="mb-6 text-zinc-400">Total gasto, pedidos, ticket médio, último pedido, serviços mais comprados e documentos assinados.</p>
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
            <div className="card"><h3 className="mb-4 text-xl font-black">Serviços mais comprados</h3>{topServices.map(([name,count]:any)=><div key={name} className="mb-3 flex justify-between rounded-xl bg-black/20 p-3"><span>{name}</span><strong>{count}x</strong></div>)}{topServices.length===0&&<p className="text-zinc-400">Sem serviços.</p>}</div>
            <div className="card table-wrap"><table><thead><tr><th>OS</th><th>Serviço</th><th>Data</th><th>Valor</th></tr></thead><tbody>{clientOrders.map(o=><tr key={o.id}><td>{o.os_number}</td><td>{o.service}</td><td>{brDate(o.created_at)}</td><td>{money(o.estimated_price)}</td></tr>)}</tbody></table></div>
          </section>
          <section className="card mt-5 table-wrap">
            <h3 className="mb-4 text-xl font-black">Documentos, contrato e assinatura</h3>
            <table>
              <thead><tr><th>OS</th><th>Data</th><th>Status</th><th>Assinatura</th><th>Documentos</th></tr></thead>
              <tbody>{clientOrders.map(o=><tr key={o.id}>
                <td>{o.os_number}</td>
                <td>{brDate(o.created_at)}</td>
                <td><span className="badge info">{o.art_approval_status || 'Pendente'}</span></td>
                <td>{o.art_approval_signature ? <button className="btn-dark" onClick={()=>setSignatureOrder(o)}>Ver assinatura</button> : <span className="text-zinc-400">Sem assinatura</span>}<br/><small className="text-zinc-400">{o.art_approved_at ? brDateTime(o.art_approved_at) : '-'}</small></td>
                <td><div className="flex flex-wrap gap-2"><button className="btn-gold" onClick={()=>downloadContract(o)}>Baixar contrato</button><button className="btn-dark" onClick={()=>downloadServiceOrder(o)}>Baixar OS</button>{o.invoice_file_url&&<a className="btn-dark" href={o.invoice_file_url} target="_blank" rel="noreferrer" download>Baixar NF</a>}</div></td>
              </tr>)}</tbody>
            </table>
          </section>
        </> : <div className="card text-zinc-400">Nenhum cliente cadastrado.</div>}
      </div>
    </section>
    {signatureOrder&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"><div className="card w-full max-w-xl"><h2 className="text-2xl font-black">Assinatura · {signatureOrder.os_number}</h2><p className="mb-4 text-zinc-400">Assinado em: {brDateTime(signatureOrder.art_approved_at)}</p>{signatureOrder.art_approval_signature?<img src={signatureOrder.art_approval_signature} className="w-full rounded-xl bg-white p-4"/>:<p className="text-zinc-400">Sem assinatura registrada.</p>}<button className="btn-dark mt-4" onClick={()=>setSignatureOrder(null)}>Fechar</button></div></div>}
  </div>
}
