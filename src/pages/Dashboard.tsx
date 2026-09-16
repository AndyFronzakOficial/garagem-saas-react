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

function MonthlyResultChart({data}:{data:{month:string,result:number}[]}){
 const width=1000
 const height=320
 const left=58
 const right=22
 const top=24
 const bottom=54
 const plotW=width-left-right
 const plotH=height-top-bottom
 const values=data.map(x=>x.result)
 const rawMin=Math.min(0,...values)
 const rawMax=Math.max(0,...values)
 const range=Math.max(rawMax-rawMin,1)
 const pad=range*0.12
 const minY=rawMin-pad
 const maxY=rawMax+pad
 const x=(i:number)=>left+(i/(data.length-1))*plotW
 const y=(v:number)=>top+((maxY-v)/(maxY-minY))*plotH
 const points=data.map((item,i)=>`${x(i)},${y(item.result)}`).join(' ')
 const zeroY=y(0)
 const monthNames=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
 const format=(v:number)=>money(v)
 const ticks=[maxY,(maxY+minY)/2,minY]

 return <div className="dashboard-panel">
   <div className="mb-5 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
     <div>
       <h2 className="text-lg font-black">Resultado por mês</h2>
       <p className="text-sm text-zinc-400">Resultado financeiro de cada mês do ano, considerando entradas, saídas e custos das operações.</p>
     </div>
     <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Ano: {periodYear(data)}</span>
   </div>
   <div className="w-full overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-2 md:p-4">
     <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label="Gráfico de linha do resultado financeiro de cada mês do ano">
       {ticks.map((tick,i)=><g key={i}>
         <line x1={left} x2={width-right} y1={y(tick)} y2={y(tick)} stroke="currentColor" className="text-white/10" strokeWidth="1" strokeDasharray="4 5" />
         <text x={left-10} y={y(tick)+4} textAnchor="end" className="fill-zinc-500" fontSize="11">{format(tick)}</text>
       </g>)}
       <line x1={left} x2={width-right} y1={zeroY} y2={zeroY} stroke="currentColor" className="text-white/20" strokeWidth="1" />
       <polyline fill="none" stroke="currentColor" className="text-gold" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={points} />
       {data.map((item,i)=><g key={item.month}>
         <circle cx={x(i)} cy={y(item.result)} r="6" fill="currentColor" className="text-gold">
           <title>{`${monthNames[i]}: ${format(item.result)}`}</title>
         </circle>
         <text x={x(i)} y={height-22} textAnchor="middle" className="fill-zinc-400" fontSize="11">{monthNames[i]}</text>
       </g>)}
     </svg>
   </div>
 </div>
}

function periodYear(month:string){ return month.slice(0,4) }

export default function Dashboard(){
 const [period,setPeriod]=useState(currentMonth())
 const [data,setData]=useState<any>({receber:[],pagar:[],clientes:[],quotes:[],orders:[],deliveries:[],settings:null,goals:[],retailSales:[]})

 useEffect(()=>{load()},[])

 async function load(){
  // O dashboard busca os módulos principais e calcula tudo em memória conforme o mês escolhido.
  const [r,p,c,q,o,d,cfg,goals,sales]=await Promise.all([
   supabase.from('accounts_receivable').select('*,clients(*)'),
   supabase.from('accounts_payable').select('*,clients(*),service_orders(*,clients(*))'),
   supabase.from('clients').select('*'),
   supabase.from('public_quotes').select('*'),
   supabase.from('service_orders').select('*,clients(*)'),
   supabase.from('installations').select('*'),
   supabase.from('company_settings').select('*').eq('id',1).maybeSingle(),
   supabase.from('monthly_goals').select('*'),
   supabase.from('retail_sales').select('total,profit,created_at').eq('status','finalizada')
  ])

  setData({
   receber:(r.data||[]).filter((x:any)=>!x.is_deleted),
   pagar:(p.data||[]).filter((x:any)=>!x.is_deleted),
   clientes:c.data||[],
   quotes:q.data||[],
   orders:(o.data||[]).filter((x:any)=>!x.is_deleted),
   deliveries:d.data||[],
   settings:cfg.data||null,
   goals:goals.data||[],
   retailSales:(sales.data||[])
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
  const retailSales=data.retailSales.filter((x:any)=>createdInMonth(x,start,end))

  // Faturamento/despesas previstos representam o total lançado no mês.
  const faturamento=receber.reduce((a:number,b:any)=>a+amount(b.amount),0) + retailSales.reduce((a:number,b:any)=>a+amount(b.total),0)
  const despesas=pagar.reduce((a:number,b:any)=>a+amount(b.amount),0)

  // Recebido/pago representam dinheiro que realmente entrou ou saiu do caixa.
  const recebido=receber.reduce((a:number,b:any)=>a+paidReal(b,['Recebido']),0) + retailSales.reduce((a:number,b:any)=>a+amount(b.total),0)
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
  const faltaMeta=Math.max(meta-faturamento,0)
  const percentMeta=meta>0?Math.min(100,Math.round((faturamento/meta)*100)):0

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

  const year=Number(period.slice(0,4))
  const monthlyResults=Array.from({length:12},(_,monthIndex)=>{
   const month=String(monthIndex+1).padStart(2,'0')
   const monthStart=`${year}-${month}-01`
   const nextMonth=monthIndex===11?`${year+1}-01-01`:`${year}-${String(monthIndex+2).padStart(2,'0')}-01`
   const inMonth=(dateValue:any)=>{
    const date=String(dateValue||'').slice(0,10)
    return date>=monthStart && date<nextMonth
   }
   const monthReceber=data.receber.filter((x:any)=>inMonth(x.due_date))
   const monthPagar=data.pagar.filter((x:any)=>inMonth(x.due_date))
   const monthOrders=data.orders.filter((x:any)=>inMonth(x.created_at))
   const monthRetail=data.retailSales.filter((x:any)=>inMonth(x.created_at))
   const monthReceived=monthReceber.reduce((a:number,b:any)=>a+paidReal(b,['Recebido']),0)+monthRetail.reduce((a:number,b:any)=>a+amount(b.total),0)
   const monthPaid=monthPagar.reduce((a:number,b:any)=>a+paidReal(b,['Paga']),0)
   const monthServiceCost=monthOrders.reduce((a:number,o:any)=>a+amount(o.material_cost)+amount(o.installation_cost)+amount(o.designer_cost)+amount(o.other_cost),0)
   const monthRetailCost=monthRetail.reduce((a:number,b:any)=>a+Math.max(amount(b.total)-amount(b.profit),0),0)
   return {month:`${year}-${month}`,result:monthReceived-monthPaid-monthServiceCost-monthRetailCost}
  })

  return {
   monthlyResults,
   faturamento,
   recebido,
   despesas,
   pago,
   faltaReceber,
   faltaPagar,
   lucro:faturamento-despesas-cost,
   saldo:recebido-pago,
   clientes:data.clientes.length,
   quotes:quotes.length + retailSales.length,
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
    ['Saldo do período',s.saldo],
    ['Falta receber',s.faltaReceber],
    ['Falta pagar',s.faltaPagar],
    ['Ticket médio',s.ticket]
   ].map(([n,v])=><article className="metric-card" key={String(n)}><small className="text-zinc-400">{n}</small><h2 className="mt-2 text-sm font-black text-white">{money(Number(v))}</h2></article>)}
  </section>

  <section className="dashboard-panel my-5">
    <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div><h2 className="text-sm font-black">Meta mensal</h2><p className="text-zinc-400">Meta configurada: {money(s.meta)} • Faturamento previsto: {money(s.faturamento)}</p></div>
      <strong className="text-gold">{s.percentMeta}% atingido</strong>
    </div>
    <div className="h-8 overflow-hidden rounded-full border border-white/10 bg-black/40">
      <div className="h-full rounded-full bg-gold transition-all" style={{width:`${s.percentMeta}%`}} />
    </div>
    <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm text-zinc-300"><span>Faturamento previsto: {money(s.faturamento)}</span><span>Falta para meta: {money(s.faltaMeta)}</span></div>
  </section>

  <MonthlyResultChart data={s.monthlyResults}/>

  <section className="my-5 grid gap-4 md:grid-cols-4"><article className="metric-card"><small>Clientes</small><h2 className="text-3xl font-black">{s.clientes}</h2></article><article className="metric-card"><small>Orçamentos/PDV no mês</small><h2 className="text-3xl font-black">{s.quotes}</h2></article><article className="metric-card"><small>Ordens no mês</small><h2 className="text-3xl font-black">{s.orders}</h2></article><article className="metric-card"><small>Agenda no mês</small><h2 className="text-3xl font-black">{s.deliveries}</h2></article></section>

  <section className="grid gap-5 xl:grid-cols-2"><div className="dashboard-panel"><h2 className="mb-4 text-sm font-black">Top Clientes</h2>{s.topClients.map(([name,value]:any)=><div className="mb-3 flex justify-between rounded-xl border border-white/10 bg-black/30 p-3" key={name}><span>{name}</span><strong>{money(Number(value))}</strong></div>)}{s.topClients.length===0&&<p className="text-zinc-400">Sem dados no mês.</p>}</div><div className="dashboard-panel"><h2 className="mb-4 text-sm font-black">Top Serviços</h2>{s.topServices.map(([name,count]:any)=><div className="mb-3 flex justify-between rounded-xl border border-white/10 bg-black/30 p-3" key={name}><span>{name}</span><strong>{Number(count)}x</strong></div>)}{s.topServices.length===0&&<p className="text-zinc-400">Sem dados no mês.</p>}</div></section>
 </div>
}
