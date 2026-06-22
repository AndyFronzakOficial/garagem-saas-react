import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useProfile } from '../lib/useProfile'

const links = [
  {to:'/', label:'Dashboard', roles:['Administrador','Financeiro','Produção','Vendas','Funcionário']},
  {to:'/clientes', label:'Clientes', roles:['Administrador','Vendas','Financeiro','Orçamento']},
  {to:'/leads', label:'Novos Leads', roles:['Administrador','Vendas','Orçamento']},
  {to:'/orcamentos', label:'Orçamentos', roles:['Administrador','Vendas','Orçamento','Financeiro']},
  {to:'/ordens', label:'Ordens de Serviço', roles:['Administrador','Produção','Vendas','Funcionário','Orçamento']},
  {to:'/kanban', label:'Kanban', roles:['Administrador','Produção','Funcionário']},
  {to:'/precos', label:'Preços por m²', roles:['Administrador','Financeiro']},
  {to:'/financeiro', label:'Financeiro', roles:['Administrador','Financeiro']},
  {to:'/estoque', label:'Estoque', roles:['Administrador','Produção','Funcionário']},
  {to:'/entregas', label:'Entrega/Instalação', roles:['Administrador','Produção','Funcionário']},
  {to:'/usuarios', label:'Usuários', roles:['Administrador']},
  {to:'/configuracoes', label:'Configurações', roles:['Administrador']},
]

export default function Layout() {
  const nav = useNavigate()
  const { profile } = useProfile()
  const role = profile?.role || 'Administrador'

  async function sair() {
    await supabase.auth.signOut()
    nav('/login')
  }

  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-white/10 bg-black/55 p-4 lg:fixed lg:inset-y-0 lg:w-72 lg:border-r lg:p-6 lg:overflow-y-auto">
        <div className="sticky top-0 z-20 -mx-4 -mt-4 bg-black/90 px-4 pb-4 pt-4 backdrop-blur lg:-mx-6 lg:-mt-6 lg:px-6 lg:pt-6">
          <img src="/logo.png" alt="Garagem Comunicação Visual" className="logo-img mb-3 max-h-20 w-full object-contain" onError={e => { e.currentTarget.style.display = 'none' }} />
          <div className="text-3xl font-black text-gold">Garagem</div>
          <div className="text-sm text-zinc-400">Comunicação Visual</div>
          <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-zinc-400">Perfil: <strong className="text-zinc-200">{role}</strong></div>
        </div>

        <nav className="mt-4 flex gap-2 overflow-x-auto pb-2 lg:grid lg:overflow-x-visible lg:pb-0">
          {links.filter(l=>l.roles.includes(role)).map(({to,label}) => (
            <NavLink key={to} to={to} className={({ isActive }) => `whitespace-nowrap rounded-xl px-3 py-3 font-semibold transition ${isActive ? 'bg-gold/10 text-gold' : 'text-zinc-300 hover:bg-white/5'}`}>
              {label}
            </NavLink>
          ))}
          <a className="whitespace-nowrap rounded-xl px-3 py-3 text-zinc-300 hover:bg-white/5" href="/portal-terceiro" target="_blank">↗ Portal Terceiro</a>
          <a className="whitespace-nowrap rounded-xl px-3 py-3 text-zinc-300 hover:bg-white/5" href="/orcamento-rapido" target="_blank">↗ Orçamento Público</a>
        </nav>

        <button onClick={sair} className="btn-dark mt-4 w-full lg:mt-8">Sair</button>
      </aside>
      <main className="p-4 lg:ml-72 lg:w-[calc(100%-18rem)] lg:p-8"><Outlet /></main>
    </div>
  )
}
