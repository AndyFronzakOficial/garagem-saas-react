import { useEffect,useMemo,useState } from 'react'
import { supabase } from '../lib/supabase'
import { money } from '../lib/utils'

function currentMonth(){ return new Date().toISOString().slice(0,7) }
function monthRange(ym:string){ const [y,m]=ym.split('-').map(Number); return {start:`${ym}-01`,end:new Date(y,m,0).toISOString().slice(0,10)} }
function createdInMonth(row:any,start:string,end:string){ const d=String(row.created_at||row.due_date||'').slice(0,10); return d>=start && d<=end }

export default function Dashboard(){
 const [period,setPeriod]=useState(currentMonth())
 const [data,setData]=useState<any>({receber:[],pagar:[],clientes:[],quotes:[],orders:[],deliveries:[]})
 useEffect(()=>{load()},[])
 async function load(){
  const [r,p,c,q,o,d]=await Promise.all([
   supabase.from('accounts_receivable').select('*,clients(*)'),
   supabase.from('accounts_payable').select('*'),
   supabase.from('clients').select('*'),
   supabase.from('public_quotes').select('*'),
   supabase.from('service_orders').select('*,clients(*)'),
   supabase.from('deliveries').select('*')
  ])
  setData({receber:r.data||[],pagar:p.data||[],clientes:c.data||[],quotes:q.data||[],orders:(o.data||[]).filter((x:any)=>!x.is_deleted),deliveries:d.data||[]})
 }
 const s=useMemo(()=>{
  const {start,end}=monthRange(period)
  const receber=data.receber.filter((x:any)=>String(x.due_date||'').slice(0,10)>=start && String(x.due_date||'').slice(0,10)<=end)
  const pagar=data.pagar.filter((x:any)=>String(x.due_date||'').slice(0,10)>=start && String(x.due_date||'').slice(0,10)<=end)
  const quotes=data.quotes.filter((x:any)=>createdInMonth(x,start,end))
  const orders=data.orders.filter((x:any)=>createdInMonth(x,start,end))
  const deliveries=data.deliveries.filter((x:any)=>createdInMonth(x,start,end))
  const faturamento=receber.reduce((a:number,b:any)=>a+Number(b.amount||0),0)
  const recebido=receber.filter((x:any)=>x.status==='Recebido').reduce((a:number,b:any)=>a+Number(b.amount||0),0)
  const despesas=pagar.reduce((a:number,b:any)=>a+Number(b.amount||0),0)
  const pago=pagar.filter((x:any)=>x.status==='Paga').reduce((a:number,b:any)=>a+Number(b.amount||0),0)
  const cost=orders.reduce((a:number,o:any)=>a+Number(o.material_cost||0)+Number(o.installation_cost||0)+Number(o.designer_cost||0)+Number(o.other_cost||0),0)
  const topClients=Object.entries(orders.reduce((acc:any,o:any)=>{ const name=o.clients?.company||o.clients?.name||'Sem cliente'; acc[name]=(acc[name]||0)+Number(o.estimated_price||0); return acc },{})).sort((a:any,b:any)=>b[1]-a[1]).slice(0,5)
  const topServices=Object.entries(orders.reduce((acc:any,o:any)=>{ const items=Array.isArray(o.quote_items)?o.quote_items:[]; if(items.length) items.forEach((i:any)=>acc[i.service_name||'Serviço']=(acc[i.service_name||'Serviço']||0)+1); else acc[o.service_type||o.service||'Serviço']=(acc[o.service_type||o.service||'Serviço']||0)+1; return acc },{})).sort((a:any,b:any)=>b[1]-a[1]).slice(0,5)
  return {faturamento,recebido,despesas,pago,lucro:faturamento-despesas-cost,saldo:recebido-pago,clientes:data.clientes.length,quotes:quotes.length,orders:orders.length,deliveries:deliveries.length,ticket:orders.length?orders.reduce((a:number,b:any)=>a+Number(b.estimated_price||0),0)/orders.length:0,topClients,topServices}
 },[data,period])
 return <div className="page-fade">
  <header className="hero-card mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="text-sm font-black uppercase tracking-[.35em] text-gold/80">Gestão inteligente</p><h1 className="mt-2 text-4xl font-black md:text-5xl">Dashboard</h1><p className="text-zinc-400">Sincronizado com financeiro, ordens de serviço, orçamentos, clientes e entregas.</p></div><input type="month" className="input max-w-xs" value={period} onChange={e=>setPeriod(e.target.value)}/></header>
  <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">{[['Faturamento',s.faturamento],['Recebido',s.recebido],['Despesas',s.despesas],['Saldo real',s.saldo],['Lucro estimado',s.lucro],['Ticket médio',s.ticket]].map(([n,v])=><article className="metric-card" key={String(n)}><small className="text-zinc-400">{n}</small><h2 className="mt-2 text-2xl font-black text-white">{money(Number(v))}</h2></article>)}</section>
  <section className="my-5 grid gap-4 md:grid-cols-4"><article className="metric-card"><small>Clientes</small><h2 className="text-3xl font-black">{s.clientes}</h2></article><article className="metric-card"><small>Orçamentos/PDV no mês</small><h2 className="text-3xl font-black">{s.quotes}</h2></article><article className="metric-card"><small>Ordens no mês</small><h2 className="text-3xl font-black">{s.orders}</h2></article><article className="metric-card"><small>Entregas no mês</small><h2 className="text-3xl font-black">{s.deliveries}</h2></article></section>
  <section className="grid gap-5 xl:grid-cols-2"><div className="dashboard-panel"><h2 className="mb-4 text-2xl font-black">Top Clientes</h2>{s.topClients.map(([name,value]:any)=><div className="mb-3 flex justify-between rounded-xl border border-white/10 bg-black/30 p-3"><span>{name}</span><strong>{money(value)}</strong></div>)}{s.topClients.length===0&&<p className="text-zinc-400">Sem dados no mês.</p>}</div><div className="dashboard-panel"><h2 className="mb-4 text-2xl font-black">Top Serviços</h2>{s.topServices.map(([name,count]:any)=><div className="mb-3 flex justify-between rounded-xl border border-white/10 bg-black/30 p-3"><span>{name}</span><strong>{count}x</strong></div>)}{s.topServices.length===0&&<p className="text-zinc-400">Sem dados no mês.</p>}</div></section>
 </div>
}
