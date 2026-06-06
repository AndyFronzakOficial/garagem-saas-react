import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BarChart3, Boxes, CalendarCheck, ClipboardList, DollarSign, Flag, Settings, Tags, UserCog, UserPlus, Users } from 'lucide-react'
import { useProfile } from '../lib/useProfile'

const allLinks = [
  {to:'/', label:'Dashboard', icon:BarChart3, roles:['Administrador','Financeiro','Produção','Vendas','Funcionário']},
  {to:'/clientes', label:'Clientes', icon:Users, roles:['Administrador','Vendas','Financeiro']},
  {to:'/leads', label:'Novos Leads', icon:UserPlus, roles:['Administrador','Vendas']},
  {to:'/ordens', label:'Ordens de Serviço', icon:ClipboardList, roles:['Administrador','Produção','Vendas','Funcionário']},
  {to:'/kanban', label:'Kanban Produção', icon:ClipboardList, roles:['Administrador','Produção','Funcionário']},
  {to:'/precos', label:'Preços por m²', icon:Tags, roles:['Administrador','Financeiro']},
  {to:'/metas', label:'Metas', icon:Flag, roles:['Administrador','Financeiro']},
  {to:'/financeiro', label:'Financeiro', icon:DollarSign, roles:['Administrador','Financeiro']},
  {to:'/estoque', label:'Estoque', icon:Boxes, roles:['Administrador','Produção','Funcionário']},
  {to:'/entregas', label:'Entrega/Instalação', icon:CalendarCheck, roles:['Administrador','Produção','Funcionário']},
  {to:'/usuarios', label:'Usuários', icon:UserCog, roles:['Administrador']},
  {to:'/configuracoes', label:'Configurações', icon:Settings, roles:['Administrador']},
]

export default function Layout(){
  const nav = useNavigate()
  const { profile } = useProfile()
  const role = profile?.role || 'Administrador'
  async function sair(){ await supabase.auth.signOut(); nav('/login') }

  const links = allLinks.filter(l=>l.roles.includes(role))

  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-white/10 bg-black/40 p-5 lg:fixed lg:inset-y-0 lg:w-72 lg:border-r lg:overflow-y-auto">
        <div className="sticky top-0 z-10 -mx-5 -mt-5 bg-black/85 px-5 pb-4 pt-5 backdrop-blur">
          <img src="/logo.png" alt="Garagem Comunicação Visual" className="logo-img mx-auto max-h-24 w-full max-w-[230px]" />
          <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-zinc-400">
            <strong className="text-zinc-200">{profile?.name || 'Usuário'}</strong><br/>
            Perfil: {role}
          </div>
        </div>

        <nav className="mt-4 grid gap-2 pb-8">
          {links.map(({to,label,icon:Icon}) => (
            <NavLink key={to} to={to} className={({isActive})=>`flex items-center gap-3 rounded-xl px-3 py-3 font-semibold ${isActive?'bg-gold/10 text-gold':'text-zinc-300 hover:bg-white/5'}`}>
              <Icon size={18}/>{label}
            </NavLink>
          ))}
          <a className="rounded-xl px-3 py-3 text-zinc-300 hover:bg-white/5" href="/portal-terceiro" target="_blank">↗ Portal Terceiro</a>
          <a className="rounded-xl px-3 py-3 text-zinc-300 hover:bg-white/5" href="/orcamento-rapido" target="_blank">↗ Orçamento Público</a>
        </nav>

        <button onClick={sair} className="btn-dark mb-4 w-full">Sair</button>
      </aside>

      <main className="p-4 md:p-6 lg:ml-72 lg:w-[calc(100%-18rem)] lg:p-8">
        <Outlet/>
      </main>
    </div>
  )
}
