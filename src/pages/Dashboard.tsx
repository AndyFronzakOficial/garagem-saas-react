import { useEffect,useState } from 'react'
import { supabase } from '../lib/supabase'
import { currentMonth, money, monthRange, weekOfMonth } from '../lib/utils'

export default function Dashboard(){
  const [period,setPeriod]=useState(currentMonth())
  const [stats,setStats]=useState({fat:0,rec:0,desp:0,pago:0,clientes:0,leads:0,os:0,meta:0})
  const [weekly,setWeekly]=useState([0,0,0,0,0])
  const [loading,setLoading]=useState(false)

  useEffect(()=>{load()},[period])

  async function load(){
    setLoading(true)
    const {start,end}=monthRange(period)

    const [receber,pagar,clientes,leads,orders,goal] = await Promise.all([
      supabase.from('accounts_receivable').select('*').gte('due_date',start).lte('due_date',end),
      supabase.from('accounts_payable').select('*').gte('due_date',start).lte('due_date',end),
      supabase.from('clients').select('*',{count:'exact',head:true}).gte('created_at',start).lte('created_at',end+'T23:59:59'),
      supabase.from('public_quotes').select('*',{count:'exact',head:true}).eq('status','Novo'),
      supabase.from('service_orders').select('*').gte('created_at',start).lte('created_at',end+'T23:59:59'),
      supabase.from('monthly_goals').select('*').eq('month',period).maybeSingle()
    ])

    const r=receber.data||[], p=pagar.data||[], o=orders.data||[]
    const w=[0,0,0,0,0]
    o.forEach((x:any)=>{ const i=weekOfMonth(x.created_at)-1; w[i]+=1 })

    setWeekly(w)
    setStats({
      fat:r.reduce((a:any,b:any)=>a+Number(b.amount||0),0),
      rec:r.filter((x:any)=>x.status==='Recebido').reduce((a:any,b:any)=>a+Number(b.amount||0),0),
      desp:p.reduce((a:any,b:any)=>a+Number(b.amount||0),0),
      pago:p.filter((x:any)=>x.status==='Paga').reduce((a:any,b:any)=>a+Number(b.amount||0),0),
      clientes:clientes.count||0,
      leads:leads.count||0,
      os:o.filter((x:any)=>['Produção','Impressão','Acabamento','Designer'].includes(x.status)).length,
      meta:Number(goal.data?.goal_amount||0)
    })
    setLoading(false)
  }

  const percent = stats.meta ? Math.min(100, Math.round((stats.fat/stats.meta)*100)) : 0
  const maxWeek = Math.max(1,...weekly)

  return <div>
    <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-4xl font-black">Dashboard</h1>
        <p className="text-zinc-400">Indicadores reais filtrados por mês.</p>
      </div>
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        {loading&&<span className="text-sm text-zinc-400">Atualizando...</span>}
        <input type="month" className="input max-w-xs" value={period} onChange={e=>setPeriod(e.target.value)} />
      </div>
    </header>

    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {[['Faturamento previsto',stats.fat],['Recebido real',stats.rec],['Despesas previstas',stats.desp],['Pago real',stats.pago],['Lucro previsto',stats.fat-stats.desp],['Saldo real',stats.rec-stats.pago]].map(([n,v])=>
        <article className="card" key={String(n)}>
          <small className="text-zinc-400">{n}</small>
          <h2 className="mt-2 text-3xl font-black">{money(Number(v))}</h2>
        </article>
      )}
      <article className="card"><small>Clientes novos</small><h2 className="text-4xl font-black">{stats.clientes}</h2></article>
      <article className="card"><small>Leads novos</small><h2 className="text-4xl font-black">{stats.leads}</h2></article>
    </section>

    <section className="mt-4 grid gap-4 lg:grid-cols-2">
      <article className="card">
        <h2 className="text-xl font-black">Meta de vendas do mês</h2>
        <p className="mt-2 text-zinc-400">Meta: {money(stats.meta)}</p>
        <div className="mt-4 h-4 overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-gold" style={{width:`${percent}%`}}/>
        </div>
        <p className="mt-2 text-zinc-300">{percent}% alcançado · Falta {money(Math.max(0,stats.meta-stats.fat))}</p>
      </article>

      <article className="card">
        <h2 className="text-xl font-black">Gráfico de produção semanal</h2>
        <div className="mt-5 grid grid-cols-5 gap-3">
          {weekly.map((v,i)=>
            <div key={i} className="text-center">
              <div className="mx-auto flex h-40 items-end rounded-xl bg-black/30 p-2">
                <div className="w-full rounded-lg bg-gold" style={{height:`${(v/maxWeek)*100}%`}}/>
              </div>
              <small>Sem {i+1}</small>
              <div className="font-black">{v}</div>
            </div>
          )}
        </div>
      </article>
    </section>
  </div>
}
