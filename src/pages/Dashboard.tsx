import { useEffect,useState } from 'react'
import { supabase } from '../lib/supabase'
import { money } from '../lib/utils'
export default function Dashboard(){
 const [s,setS]=useState({fat:0,rec:0,desp:0,pago:0,clientes:0,leads:0,os:0})
 useEffect(()=>{load()},[])
 async function load(){
  const [{data:r},{data:p},{count:c},{count:l},{count:o}]=await Promise.all([
   supabase.from('accounts_receivable').select('*'), supabase.from('accounts_payable').select('*'),
   supabase.from('clients').select('*',{count:'exact',head:true}), supabase.from('public_quotes').select('*',{count:'exact',head:true}).eq('status','Novo'),
   supabase.from('service_orders').select('*',{count:'exact',head:true}).in('status',['Produção','Impressão','Acabamento'])
  ])
  setS({fat:(r||[]).reduce((a,b)=>a+Number(b.amount||0),0),rec:(r||[]).filter(x=>x.status==='Recebido').reduce((a,b)=>a+Number(b.amount||0),0),desp:(p||[]).reduce((a,b)=>a+Number(b.amount||0),0),pago:(p||[]).filter(x=>x.status==='Paga').reduce((a,b)=>a+Number(b.amount||0),0),clientes:c||0,leads:l||0,os:o||0})
 }
 return <div><h1 className="text-4xl font-black">Dashboard</h1><p className="mb-6 text-zinc-400">Resumo do Garagem SaaS</p><section className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">{[['Faturamento',s.fat],['Recebido',s.rec],['Despesas',s.desp],['Pago',s.pago],['Lucro previsto',s.fat-s.desp],['Saldo real',s.rec-s.pago]].map(([n,v])=><article className="card" key={String(n)}><small className="text-zinc-400">{n}</small><h2 className="mt-2 text-3xl font-black">{money(Number(v))}</h2></article>)}<article className="card"><small>Clientes</small><h2 className="text-4xl">{s.clientes}</h2></article><article className="card"><small>Leads</small><h2 className="text-4xl">{s.leads}</h2></article></section></div>
}
