import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3, Boxes, BriefcaseBusiness, ChevronDown, ClipboardList,
  FileChartColumnIncreasing, FileText, History, LayoutDashboard, LogOut, Menu,
  Moon, PackageCheck, PanelLeftClose, PanelLeftOpen, ReceiptText, Settings,
  Sun, Tags, Truck, UserRoundCog, Users, WalletCards, X
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useProfile } from '../lib/useProfile'

const sideLinks = [
  {to:'/', label:'Dashboard', icon:LayoutDashboard, roles:['Administrador']},
  {to:'/clientes', label:'Clientes', icon:Users, roles:['Administrador','Vendas','Financeiro','Orçamento']},
  {to:'/historico-clientes', label:'Histórico do Cliente', icon:History, roles:['Administrador','Vendas','Financeiro']},
  {to:'/leads', label:'Novos Leads', icon:BriefcaseBusiness, roles:['Administrador','Vendas','Orçamento']},
  {to:'/orcamentos', label:'Orçamentos', icon:ReceiptText, roles:['Administrador','Vendas','Orçamento','Financeiro']},
  {to:'/ordens', label:'Ordens de Serviço', icon:ClipboardList, roles:['Administrador','Produção','Vendas','Funcionário','Orçamento']},
  {to:'/kanban', label:'Kanban', icon:Boxes, roles:['Administrador','Produção','Funcionário']},
  {to:'/precos', label:'Precificação', icon:Tags, roles:['Administrador','Financeiro']},
  {to:'/financeiro', label:'Financeiro', icon:WalletCards, roles:['Administrador']},
  {to:'/relatorios', label:'Relatórios', icon:FileChartColumnIncreasing, roles:['Administrador']},
  {to:'/estoque', label:'Estoque', icon:PackageCheck, roles:['Administrador','Produção','Funcionário']},
  {to:'/entregas', label:'Entrega/Instalação', icon:Truck, roles:['Administrador','Produção','Funcionário']},
]

const pageTitles: Record<string,string> = {
  '/':'Dashboard', '/clientes':'Clientes', '/historico-clientes':'Histórico do Cliente',
  '/leads':'Leads', '/orcamentos':'Orçamentos', '/ordens':'Ordens de Serviço',
  '/kanban':'Kanban de Produção', '/precos':'Precificação', '/financeiro':'Financeiro',
  '/relatorios':'Relatórios Avançados', '/estoque':'Estoque', '/entregas':'Entrega',
  '/usuarios':'Usuários', '/backup':'Backup', '/configuracoes':'Configurações',
}

export default function Layout() {
  const nav = useNavigate()
  const location = useLocation()
  const { profile } = useProfile()
  const role = profile?.role || ''
  const [menuOpen,setMenuOpen] = useState(()=>localStorage.getItem('garagem_menu_open') !== 'false')
  const [settingsOpen,setSettingsOpen] = useState(false)
  const [theme,setTheme] = useState(()=>localStorage.getItem('garagem_theme') || 'dark')
  const [showSplash,setShowSplash] = useState(()=>sessionStorage.getItem('garagem_splash_done') !== 'true')
  const pageTitle = useMemo(()=> pageTitles[location.pathname] || 'Garagem', [location.pathname])

  useEffect(()=> localStorage.setItem('garagem_menu_open', String(menuOpen)),[menuOpen])
  useEffect(()=>{
    localStorage.setItem('garagem_theme', theme)
    document.documentElement.classList.toggle('theme-light', theme === 'light')
    document.documentElement.classList.toggle('theme-dark', theme !== 'light')
  },[theme])
  useEffect(()=>{
    if(!showSplash) return
    const timer = window.setTimeout(()=>{ sessionStorage.setItem('garagem_splash_done','true'); setShowSplash(false) },1800)
    return () => window.clearTimeout(timer)
  },[showSplash])
  useEffect(()=> setSettingsOpen(false), [location.pathname])

  async function sair(){ sessionStorage.removeItem('garagem_splash_done'); await supabase.auth.signOut(); nav('/login') }

  return (
    <div className="app-shell min-h-screen bg-app text-app">
      {showSplash && (
        <div className="fixed inset-0 z-[999] grid place-items-center bg-[#090b0e]">
          <div className="text-center">
            <img src="/logo.png" alt="Garagem Comunicação Visual" className="mx-auto max-h-36 max-w-[78vw] object-contain" />
            <div className="mx-auto mt-7 h-1.5 w-56 overflow-hidden rounded-full bg-white/10"><div className="h-full animate-[splashBar_1.8s_ease_forwards] rounded-full bg-gold" /></div>
            <p className="mt-4 text-xs font-bold uppercase tracking-[.28em] text-white/50">Carregando seu painel</p>
          </div>
        </div>
      )}

      <header className="topbar fixed inset-x-0 top-0 z-40 flex h-[72px] items-center gap-3 border-b px-3 backdrop-blur-xl md:px-5">
        <button onClick={()=>setMenuOpen(v=>!v)} className="icon-btn lg:hidden" aria-label="Abrir menu">{menuOpen?<X size={19}/>:<Menu size={20}/>}</button>
        <button onClick={()=>setMenuOpen(v=>!v)} className="icon-btn hidden lg:inline-flex" aria-label="Alternar menu">{menuOpen?<PanelLeftClose size={19}/>:<PanelLeftOpen size={19}/>}</button>
        <NavLink to="/" className="flex min-w-0 items-center gap-2"><img src="/logo.png" alt="Garagem" className="h-10 w-auto max-w-[145px] object-contain md:max-w-[185px]" /></NavLink>
        <div className="mx-auto hidden max-w-[42vw] truncate text-center md:block">
          <p className="text-[11px] font-bold uppercase tracking-[.18em] muted-text">Painel de gestão</p>
          <h1 className="text-sm font-black text-strong">{pageTitle}</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={()=>setTheme(theme === 'dark' ? 'light' : 'dark')} className="top-action" title="Alterar tema">
            {theme === 'dark' ? <Sun size={17}/> : <Moon size={17}/>}<span className="hidden sm:inline">{theme === 'dark' ? 'Claro' : 'Escuro'}</span>
          </button>
          {role === 'Administrador' && (
            <div className="relative">
              <button onClick={()=>setSettingsOpen(v=>!v)} className="top-action"><Settings size={17}/><span className="hidden md:inline">Configurações</span><ChevronDown size={14}/></button>
              {settingsOpen && (
                <div className="dropdown-menu absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border p-2 shadow-2xl">
                  <NavLink to="/configuracoes" className="dropdown-item flex items-center gap-2"><Settings size={16}/> Personalização</NavLink>
                  <NavLink to="/backup" className="dropdown-item flex items-center gap-2"><FileText size={16}/> Backup</NavLink>
                  <NavLink to="/usuarios" className="dropdown-item flex items-center gap-2"><UserRoundCog size={16}/> Usuários</NavLink>
                </div>
              )}
            </div>
          )}
          <button onClick={sair} className="top-action danger-action"><LogOut size={17}/><span className="hidden sm:inline">Sair</span></button>
        </div>
      </header>

      {menuOpen && <div onClick={()=>setMenuOpen(false)} className="fixed inset-0 z-20 bg-black/45 backdrop-blur-[2px] lg:hidden" />}

      <aside className={`sidebar-shell fixed bottom-0 left-0 top-[72px] z-30 w-[280px] border-r transition-transform duration-300 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-full flex-col p-3">
          <div className="mb-3 rounded-2xl border border-current/10 bg-current/[.025] p-3">
            <p className="text-[10px] font-black uppercase tracking-[.18em] muted-text">Usuário conectado</p>
            <p className="mt-1 truncate text-sm font-black text-strong">{profile?.name || profile?.email || 'Usuário'}</p>
            <span className="mt-2 inline-flex rounded-full bg-gold/15 px-2.5 py-1 text-[11px] font-black text-gold">{role || 'Acesso'}</span>
          </div>
          <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
            {sideLinks.filter(l=>l.roles.includes(role)).map(({to,label,icon:Icon}) => (
              <NavLink key={to} to={to} onClick={()=> window.innerWidth < 1024 && setMenuOpen(false)} className={({isActive})=>`nav-item flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${isActive?'nav-active':'nav-idle'}`}>
                <Icon size={18} strokeWidth={2.1}/><span>{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="mt-3 grid gap-1 border-t border-current/10 pt-3">
            <a className="nav-item nav-idle flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold" href="/portal-terceiro" target="_blank"><Users size={18}/>Portal Terceiro</a>
            <a className="nav-item nav-idle flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold" href="/orcamento-rapido" target="_blank"><ReceiptText size={18}/>PDV Público</a>
          </div>
        </div>
      </aside>

      <main className={`min-h-screen pt-[88px] transition-all duration-300 ${menuOpen?'lg:pl-[280px]':'lg:pl-0'}`}>
        <div className="mx-auto w-full max-w-[1680px] px-3 pb-8 sm:px-4 md:px-6 lg:px-8">
          <div className="mobile-page-title mb-4 flex items-center gap-2 md:hidden"><BarChart3 size={18}/><span>{pageTitle}</span></div>
          <div className="page-fade"><Outlet /></div>
        </div>
      </main>
    </div>
  )
}
