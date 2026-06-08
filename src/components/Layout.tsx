import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
const links=[['/','Dashboard'],['/clientes','Clientes'],['/leads','Novos Leads'],['/ordens','Ordens de Serviço'],['/precos','Preços por m²'],['/financeiro','Financeiro'],['/estoque','Estoque'],['/entregas','Entrega/Instalação']]
export default function Layout(){
 const nav=useNavigate()
 async function sair(){ await supabase.auth.signOut(); nav('/login') }
 return <div className="min-h-screen lg:flex"><aside className="border-white/10 bg-black/40 p-6 lg:fixed lg:inset-y-0 lg:w-72 lg:border-r"><div className="text-4xl font-black text-gold">Garagem</div><div className="text-sm text-zinc-400">Comunicação Visual</div><nav className="mt-8 grid gap-2">{links.map(([to,l])=><NavLink key={to} to={to} className={({isActive})=>`rounded-xl px-3 py-3 font-semibold ${isActive?'bg-gold/10 text-gold':'text-zinc-300 hover:bg-white/5'}`}>{l}</NavLink>)}<a className="rounded-xl px-3 py-3 text-zinc-300 hover:bg-white/5" href="/portal-terceiro" target="_blank">↗ Portal Terceiro</a><a className="rounded-xl px-3 py-3 text-zinc-300 hover:bg-white/5" href="/orcamento-rapido" target="_blank">↗ Orçamento Público</a></nav><button onClick={sair} className="btn-dark mt-8 w-full">Sair</button></aside><main className="p-5 lg:ml-72 lg:w-[calc(100%-18rem)] lg:p-8"><Outlet /></main></div>
}
