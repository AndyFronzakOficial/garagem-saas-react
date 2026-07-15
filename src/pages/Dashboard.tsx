import { useEffect,useMemo,useState } from 'react'
import { supabase } from '../lib/supabase'
import { brNumber, money } from '../lib/utils'

// Retorna o mês atual para iniciar o filtro do dashboard.
function currentMonth(){ return new Date().toISOString().slice(0,7) }

// Gera o intervalo inicial/final do mês selecionado.
function monthRange(ym:string){
  const [y,m]=ym.split('-').map(Number)
  return {start:`${ym}-01`,end:new Date(y,m,0).toISOString().slice(0,10)}
}

// Verifica se um registro foi criado dentro do período filtrado.
function createdInMonth(row:any,start:string,end:string){
  const d=String(row.created_at||row.due_date||'').slice(0,10)
  return d>=start && d<=end
}

// Soma segura para valores monetários em formato brasileiro ou número puro.
function amount(v:any){ return brNumber(v) }

// Valor pago/recebido real: usa paid_amount e cai para amount quando status já está finalizado.
function paidReal(row:any,finalStatuses:string[]){
  const paid = amount(row.paid_amount)
  if(paid > 0) return paid
  return finalStatuses.includes(row.status) ? amount(row.amount) : 0
}

export default function Dashboard(){
 const [period,setPeriod]=useState(currentMonth())
 const [data,setData]=useState<any>({receber:[],pagar:[],clientes:[],quotes:[],orders:[],deliveries:[],settings:null,goals:[]})

 useEffect(()=>{load()},[])

 async function load(){
  // O dashboard busca os módulos principais e calcula tudo em memória conforme o mês escolhido.
  const [r,p,c,q,o,d,cfg,goals]=await Promise.all([
   supabase.from('accounts_receivable').select('*,clients(*)'),
   supabase.from('accounts_payable').select('*,clients(*),service_orders(*,clients(*))'),
   supabase.from('clients').select('*'),
   supabase.from('public_quotes').select('*'),
   supabase.from('service_orders').select('*,clients(*)'),
   supabase.from('installations').select('*'),
   supabase.from('company_settings').select('*').eq('id',1).maybeSingle(),
   supabase.from('monthly_goals').select('*')
  ])

  setData({
   receber:(r.data||[]).filter((x:any)=>!x.is_deleted),
   pagar:(p.data||[]).filter((x:any)=>!x.is_deleted),
   clientes:c.data||[],
   quotes:q.data||[],
   orders:(o.data||[]).filter((x:any)=>!x.is_deleted),
   deliveries:d.data||[],
   settings:cfg.data||null,
   goals:goals.data||[]
  })
 }

 const s=useMemo<any>(()=>{
  const {start,end}=monthRange(period)

  // Filtra lançamentos por vencimento e módulos operacionais por criação no mês.
  const receber=data.receber.filter((x:any)=>String(x.due_date||'').slice(0,10)>=start && String(x.due_date||'').slice(0,10)<=end)
  const pagar=data.pagar.filter((x:any)=>String(x.due_date||'').slice(0,10)>=start && String(x.due_date||'').slice(0,10)<=end)
  const quotes=data.quotes.filter((x:any)=>createdInMonth(x,start,end))
  const orders=data.orders.filter((x:any)=>createdInMonth(x,start,end))
  const deliveries=data.deliveries.filter((x:any)=>createdInMonth(x,start,end))

  // Faturamento/despesas previstos representam o total lançado no mês.
  const faturamento=receber.reduce((a:number,b:any)=>a+amount(b.amount),0)
  const despesas=pagar.reduce((a:number,b:any)=>a+amount(b.amount),0)

  // Recebido/pago representam dinheiro que realmente entrou ou saiu do caixa.
  const recebido=receber.reduce((a:number,b:any)=>a+paidReal(b,['Recebido']),0)
  const pago=pagar.reduce((a:number,b:any)=>a+paidReal(b,['Paga']),0)

  // Pendências mostram o que ainda falta receber e pagar.
  const faltaReceber=receber.reduce((a:number,b:any)=>a+Math.max(amount(b.amount)-paidReal(b,['Recebido']),0),0)
  const faltaPagar=pagar.reduce((a:number,b:any)=>a+Math.max(amount(b.amount)-paidReal(b,['Paga']),0),0)

  // Custos lançados diretamente dentro das ordens de serviço.
  const cost=orders.reduce((a:number,o:any)=>
   a+amount(o.material_cost)+amount(o.installation_cost)+amount(o.designer_cost)+amount(o.other_cost)
  ,0)

  // Meta mensal: primeiro busca configurações, depois tabela mensal e depois localStorage.
  const goalRow = (data.goals||[]).find((g:any)=>g.month===period)
  const metaConfig = amount(data.settings?.monthly_goal)
  const metaMensal = amount(goalRow?.goal_amount)
  const metaLocal = typeof window !== 'undefined' ? amount(localStorage.getItem('garagem_monthly_goal')) : 0
  const meta = metaConfig > 0 ? metaConfig : (metaMensal > 0 ? metaMensal : metaLocal)
  const faltaMeta=Math.max(meta-recebido,0)
  const percentMeta=meta>0?Math.min(100,Math.round((recebido/meta)*100)):0

  // Clientes que mais movimentaram valores em OS no mês.
  const topClients=Object.entries(orders.reduce((acc:any,o:any)=>{
   const name=o.clients?.company||o.clients?.name||'Sem cliente'
   acc[name]=(acc[name]||0)+amount(o.estimated_price)
   return acc
  },{})).sort((a:any,b:any)=>b[1]-a[1]).slice(0,5)

  // Serviços mais vendidos/produzidos no mês.
  const topServices=Object.entries(orders.reduce((acc:any,o:any)=>{
   const items=Array.isArray(o.quote_items)?o.quote_items:[]
   if(items.length) items.forEach((i:any)=>acc[i.service_name||'Serviço']=(acc[i.service_name||'Serviço']||0)+1)
   else acc[o.service_type||o.service||'Serviço']=(acc[o.service_type||o.service||'Serviço']||0)+1
   return acc
  },{})).sort((a:any,b:any)=>b[1]-a[1]).slice(0,5)

  return {
   faturamento,
   recebido,
   despesas,
   pago,
   faltaReceber,
   faltaPagar,
   lucro:faturamento-despesas-cost,
   saldo:recebido-pago,
   clientes:data.clientes.length,
   quotes:quotes.length,
   orders:orders.length,
   deliveries:deliveries.length,
   ticket:orders.length?orders.reduce((a:number,b:any)=>a+amount(b.estimated_price),0)/orders.length:0,
   meta,
   faltaMeta,
   percentMeta,
   topClients,
   topServices
  }
 },[data,period])

 return <div className="page-fade">
  <header className="hero-card mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="text-sm font-black uppercase tracking-[.35em] text-gold/80">Gestão inteligente</p><h1 className="mt-2 text-4xl font-black md:text-5xl">Dashboard</h1><p className="text-zinc-400">Sincronizado com financeiro, ordens de serviço, orçamentos, clientes e entregas/instalações.</p></div><input type="month" className="input max-w-xs" value={period} onChange={e=>setPeriod(e.target.value)}/></header>

  <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-8">
   {[
    ['Faturamento previsto',s.faturamento],
    ['Recebido real',s.recebido],
    ['Despesas previstas',s.despesas],
    ['Pago real',s.pago],
    ['Saldo real',s.saldo],
    ['Falta receber',s.faltaReceber],
    ['Falta pagar',s.faltaPagar],
    ['Ticket médio',s.ticket]
   ].map(([n,v])=><article className="metric-card" key={String(n)}><small className="text-zinc-400">{n}</small><h2 className="mt-2 text-2xl font-black text-white">{money(Number(v))}</h2></article>)}
  </section>

  <section className="dashboard-panel my-5">
    <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div><h2 className="text-2xl font-black">Meta mensal</h2><p className="text-zinc-400">Meta configurada: {money(s.meta)} • Recebido real: {money(s.recebido)}</p></div>
      <strong className="text-gold">{s.percentMeta}% atingido</strong>
    </div>
    <div className="h-8 overflow-hidden rounded-full border border-white/10 bg-black/40">
      <div className="h-full rounded-full bg-gold transition-all" style={{width:`${s.percentMeta}%`}} />
    </div>
    <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm text-zinc-300"><span>Recebido real: {money(s.recebido)}</span><span>Falta para meta: {money(s.faltaMeta)}</span></div>
  </section>

  <section className="my-5 grid gap-4 md:grid-cols-4"><article className="metric-card"><small>Clientes</small><h2 className="text-3xl font-black">{s.clientes}</h2></article><article className="metric-card"><small>Orçamentos/PDV no mês</small><h2 className="text-3xl font-black">{s.quotes}</h2></article><article className="metric-card"><small>Ordens no mês</small><h2 className="text-3xl font-black">{s.orders}</h2></article><article className="metric-card"><small>Agenda no mês</small><h2 className="text-3xl font-black">{s.deliveries}</h2></article></section>

  <section className="grid gap-5 xl:grid-cols-2"><div className="dashboard-panel"><h2 className="mb-4 text-2xl font-black">Top Clientes</h2>{s.topClients.map(([name,value]:any)=><div className="mb-3 flex justify-between rounded-xl border border-white/10 bg-black/30 p-3" key={name}><span>{name}</span><strong>{money(Number(value))}</strong></div>)}{s.topClients.length===0&&<p className="text-zinc-400">Sem dados no mês.</p>}</div><div className="dashboard-panel"><h2 className="mb-4 text-2xl font-black">Top Serviços</h2>{s.topServices.map(([name,count]:any)=><div className="mb-3 flex justify-between rounded-xl border border-white/10 bg-black/30 p-3" key={name}><span>{name}</span><strong>{Number(count)}x</strong></div>)}{s.topServices.length===0&&<p className="text-zinc-400">Sem dados no mês.</p>}</div></section>
 </div>
}
