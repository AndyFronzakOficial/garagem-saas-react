import { useEffect,useMemo,useState } from 'react'
import { supabase } from '../lib/supabase'
import { currentMonth, money, monthRange, today } from '../lib/utils'

export default function Finance(){
  const [tab,setTab]=useState<'receber'|'pagar'|'fluxo'>('receber')
  const [period,setPeriod]=useState(currentMonth())
  const [receber,setReceber]=useState<any[]>([])
  const [pagar,setPagar]=useState<any[]>([])
  const [f,setF]=useState({title:'',name:'',amount:'',due_date:today(),recurring:false})

  useEffect(()=>{load()},[period])

  async function load(){
    const {start,end}=monthRange(period)
    const [r,p]=await Promise.all([
      supabase.from('accounts_receivable').select('*,clients(*)').gte('due_date',start).lte('due_date',end).order('due_date',{ascending:false}),
      supabase.from('accounts_payable').select('*').gte('due_date',start).lte('due_date',end).order('due_date',{ascending:false})
    ])
    setReceber(r.data||[])
    setPagar(p.data||[])
  }

  async function create(e:React.FormEvent){
    e.preventDefault()
    const amount = Number(f.amount.replace(',','.'))
    if(tab==='receber'){
      await supabase.from('accounts_receivable').insert({title:f.title,due_date:f.due_date,amount,reference:period,status:'Aberto',is_recurring:f.recurring})
    }else{
      await supabase.from('accounts_payable').insert({title:f.title,supplier:f.name,due_date:f.due_date,amount,reference:period,status:'A pagar',is_recurring:f.recurring})
    }
    setF({title:'',name:'',amount:'',due_date:today(),recurring:false})
    load()
  }

  async function st(table:string,id:string,status:string){
    await supabase.from(table).update({status}).eq('id',id)
    load()
  }

  const entradas = receber.reduce((a,b)=>a+Number(b.amount||0),0)
  const saidas = pagar.reduce((a,b)=>a+Number(b.amount||0),0)
  const vencidasReceber = receber.filter(r=>r.status!=='Recebido' && r.due_date < today())
  const vencidasPagar = pagar.filter(r=>r.status!=='Paga' && r.due_date < today())

  const dailyFlow = useMemo(()=>{
    const map:Record<string,{in:number,out:number}>={}
    receber.forEach(r=>{map[r.due_date]=map[r.due_date]||{in:0,out:0};map[r.due_date].in+=Number(r.amount||0)})
    pagar.forEach(r=>{map[r.due_date]=map[r.due_date]||{in:0,out:0};map[r.due_date].out+=Number(r.amount||0)})
    return Object.entries(map).sort(([a],[b])=>a.localeCompare(b))
  },[receber,pagar])

  const rows=tab==='receber'?receber:pagar

  return <div>
    <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div><h1 className="text-4xl font-black">Financeiro</h1><p className="text-zinc-400">Contas, vencimentos, fluxo diário e mensal.</p></div>
      <input type="month" className="input max-w-xs" value={period} onChange={e=>setPeriod(e.target.value)}/>
    </header>

    <section className="mb-5 grid gap-4 md:grid-cols-4">
      <article className="card"><small>Entradas</small><h2 className="text-2xl font-black">{money(entradas)}</h2></article>
      <article className="card"><small>Saídas</small><h2 className="text-2xl font-black">{money(saidas)}</h2></article>
      <article className="card"><small>Saldo</small><h2 className="text-2xl font-black">{money(entradas-saidas)}</h2></article>
      <article className="card"><small>Vencidas</small><h2 className="text-2xl font-black">{vencidasReceber.length + vencidasPagar.length}</h2></article>
    </section>

    <div className="mb-5 flex flex-wrap gap-3">
      <button onClick={()=>setTab('receber')} className={tab==='receber'?'btn-gold':'btn-dark'}>Contas a receber</button>
      <button onClick={()=>setTab('pagar')} className={tab==='pagar'?'btn-gold':'btn-dark'}>Contas a pagar</button>
      <button onClick={()=>setTab('fluxo')} className={tab==='fluxo'?'btn-gold':'btn-dark'}>Fluxo de caixa</button>
    </div>

    {tab!=='fluxo' && <form onSubmit={create} className="card mb-6 grid gap-3 md:grid-cols-5">
      <input className="input" placeholder="Título" value={f.title} onChange={e=>setF({...f,title:e.target.value})}/>
      {tab==='pagar'&&<input className="input" placeholder="Fornecedor" value={f.name} onChange={e=>setF({...f,name:e.target.value})}/>}
      <input className="input" type="date" value={f.due_date} onChange={e=>setF({...f,due_date:e.target.value})}/>
      <input className="input" placeholder="Valor" value={f.amount} onChange={e=>setF({...f,amount:e.target.value})}/>
      <label className="flex items-center gap-2 rounded-xl border border-white/10 px-4"><input type="checkbox" checked={f.recurring} onChange={e=>setF({...f,recurring:e.target.checked})}/> Recorrente</label>
      <button className="btn-gold">Adicionar</button>
    </form>}

    {tab==='fluxo' ? <div className="card table-wrap">
      <table><thead><tr><th>Dia</th><th>Entradas</th><th>Saídas</th><th>Saldo</th></tr></thead><tbody>
        {dailyFlow.map(([day,v])=><tr key={day}><td>{day}</td><td>{money(v.in)}</td><td>{money(v.out)}</td><td>{money(v.in-v.out)}</td></tr>)}
      </tbody></table>
    </div> : <div className="card table-wrap">
      <table><thead><tr><th>Título</th><th>Vencimento</th><th>Valor</th><th>Recorrente</th><th>Status</th></tr></thead><tbody>
        {rows.map(r=><tr key={r.id}><td>{r.title}<br/><small>{r.supplier||r.clients?.name}</small></td><td>{r.due_date}</td><td>{money(r.amount)}</td><td>{r.is_recurring?'Sim':'Não'}</td><td><select className="input" value={r.status} onChange={e=>st(tab==='receber'?'accounts_receivable':'accounts_payable',r.id,e.target.value)}>{tab==='receber'?<><option>Aberto</option><option>Recebido</option><option>Vencido</option></>:<><option>A pagar</option><option>Paga</option><option>Vencida</option></>}</select></td></tr>)}
      </tbody></table>
    </div>}
  </div>
}
