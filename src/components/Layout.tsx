import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useProfile } from '../lib/useProfile'

const links = [
  {to:'/', label:'Dashboard', roles:['Administrador','Financeiro','Produção','Vendas','Funcionário']},
  {to:'/clientes', label:'Clientes', roles:['Administrador','Vendas','Financeiro','Orçamento']},
  {to:'/historico-clientes', label:'Histórico do Cliente', roles:['Administrador','Vendas','Financeiro']},
  {to:'/leads', label:'Novos Leads', roles:['Administrador','Vendas','Orçamento']},
  {to:'/orcamentos', label:'Orçamentos', roles:['Administrador','Vendas','Orçamento','Financeiro']},
  {to:'/ordens', label:'Ordens de Serviço', roles:['Administrador','Produção','Vendas','Funcionário','Orçamento']},
  {to:'/kanban', label:'Kanban', roles:['Administrador','Produção','Funcionário']},
  {to:'/precos', label:'Preços por m²', roles:['Administrador','Financeiro']},
  {to:'/financeiro', label:'Financeiro', roles:['Administrador','Financeiro']},
  {to:'/estoque', label:'Estoque', roles:['Administrador','Produção','Funcionário']},
  {to:'/entregas', label:'Entrega/Instalação', roles:['Administrador','Produção','Funcionário']},
  {to:'/usuarios', label:'Usuários', roles:['Administrador']},
  {to:'/backup', label:'Backup', roles:['Administrador']},
  {to:'/configuracoes', label:'Configurações', roles:['Administrador']},
]

export default function Layout() {
  const nav = useNavigate()
  const { profile } = useProfile()
  const role = profile?.role || 'Administrador'
  const [menuOpen,setMenuOpen] = useState(()=>localStorage.getItem('garagem_menu_open') !== 'false')
  const [showSplash,setShowSplash] = useState(()=>sessionStorage.getItem('garagem_splash_done') !== 'true')

  useEffect(()=>{
    localStorage.setItem('garagem_menu_open', String(menuOpen))
  },[menuOpen])

  useEffect(()=>{
    if(!showSplash) return
    const timer = window.setTimeout(()=>{
      sessionStorage.setItem('garagem_splash_done','true')
      setShowSplash(false)
    },5000)
    return () => window.clearTimeout(timer)
  },[showSplash])

  async function sair() {
    sessionStorage.removeItem('garagem_splash_done')
    await supabase.auth.signOut()
    nav('/login')
  }

  return (
    <div className="min-h-screen bg-app lg:flex">
      {showSplash && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black">
          <div className="text-center">
            <img src="/logo.png" alt="Garagem Comunicação Visual" className="mx-auto max-h-44 max-w-[82vw] object-contain" />
            <div className="mt-8 h-2 w-64 overflow-hidden rounded-full bg-white/10">
              <div className="h-full animate-[splashBar_5s_linear_forwards] rounded-full bg-gold"></div>
            </div>
          </div>
        </div>
      )}

      {!menuOpen && (
        <button onClick={()=>setMenuOpen(true)} className="fixed left-3 top-3 z-50 rounded-2xl border border-gold/30 bg-black/85 px-4 py-3 font-black text-gold shadow-[0_18px_50px_rgba(0,0,0,.55)] backdrop-blur">
          ☰ Menu
        </button>
      )}

      {menuOpen && (
        <aside className="sidebar-shell border-white/10 p-4 lg:fixed lg:inset-y-0 lg:w-72 lg:border-r lg:p-6 lg:overflow-y-auto">
          <div className="sticky top-0 z-20 -mx-4 -mt-4 bg-[#080908]/95 px-4 pb-4 pt-4 backdrop-blur lg:-mx-6 lg:-mt-6 lg:px-6 lg:pt-6">
            <div className="mb-3 flex items-start justify-between gap-2">
              <img src="/logo.png" alt="Garagem Comunicação Visual" className="logo-img max-h-24 w-full object-contain" onError={e => { e.currentTarget.style.display = 'none' }} />
              <button onClick={()=>setMenuOpen(false)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-zinc-200 hover:bg-white/10" title="Ocultar menu">×</button>
            </div>
            <div className="mt-3 rounded-xl border border-gold/20 bg-black/30 p-3 text-xs text-zinc-400">Perfil: <strong className="text-zinc-100">{role}</strong></div>
          </div>

          <nav className="mt-4 flex gap-2 overflow-x-auto pb-2 lg:grid lg:overflow-x-visible lg:pb-0">
            {links.filter(l=>l.roles.includes(role)).map(({to,label}) => (
              <NavLink key={to} to={to} className={({ isActive }) => `nav-item whitespace-nowrap rounded-xl px-3 py-3 font-semibold transition ${isActive ? 'nav-active' : 'text-zinc-300 hover:bg-white/5 hover:text-white'}`}>
                {label}
              </NavLink>
            ))}
            <a className="nav-item whitespace-nowrap rounded-xl px-3 py-3 text-zinc-300 hover:bg-white/5 hover:text-white" href="/portal-terceiro" target="_blank">↗ Portal Terceiro</a>
            <a className="nav-item whitespace-nowrap rounded-xl px-3 py-3 text-zinc-300 hover:bg-white/5 hover:text-white" href="/orcamento-rapido" target="_blank">↗ PDV Público</a>
          </nav>

          <button onClick={sair} className="btn-dark mt-4 w-full lg:mt-8">Sair</button>
        </aside>
      )}
      <main className={`p-4 transition-all lg:p-8 ${menuOpen ? 'lg:ml-72 lg:w-[calc(100%-18rem)]' : 'lg:ml-0 lg:w-full pt-20 lg:pt-8'}`}><Outlet /></main>
    </div>
  )
}
