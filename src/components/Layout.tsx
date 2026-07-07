import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useProfile } from '../lib/useProfile'

const sideLinks = [
  {to:'/', label:'Dashboard', roles:['Administrador','Financeiro']},
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


]

const pageTitles: Record<string,string> = {
  '/':'Dashboard',
  '/clientes':'Clientes',
  '/historico-clientes':'Histórico do Cliente',
  '/leads':'Leads',
  '/orcamentos':'Orçamentos',
  '/ordens':'Ordens de Serviço',
  '/kanban':'Kanban de Produção',
  '/precos':'Preço por m²',
  '/financeiro':'Financeiro',
  '/estoque':'Estoque',
  '/entregas':'Entrega',
  '/usuarios':'Usuários',
  '/backup':'Backup',
  '/configuracoes':'Configurações',
}

export default function Layout() {
  const nav = useNavigate()
  const location = useLocation()
  const { profile } = useProfile()
  const role = profile?.role || 'Administrador'
  const [menuOpen,setMenuOpen] = useState(()=>localStorage.getItem('garagem_menu_open') !== 'false')
  const [settingsOpen,setSettingsOpen] = useState(false)
  const [theme,setTheme] = useState(()=>localStorage.getItem('garagem_theme') || 'dark')
  const [showSplash,setShowSplash] = useState(()=>sessionStorage.getItem('garagem_splash_done') !== 'true')

  const pageTitle = useMemo(()=> pageTitles[location.pathname] || 'Garagem', [location.pathname])

  useEffect(()=>{
    localStorage.setItem('garagem_menu_open', String(menuOpen))
  },[menuOpen])

  useEffect(()=>{
    localStorage.setItem('garagem_theme', theme)
    document.documentElement.classList.toggle('theme-light', theme === 'light')
    document.documentElement.classList.toggle('theme-dark', theme !== 'light')
  },[theme])

  useEffect(()=>{
    if(!showSplash) return
    const timer = window.setTimeout(()=>{
      sessionStorage.setItem('garagem_splash_done','true')
      setShowSplash(false)
    },5000)
    return () => window.clearTimeout(timer)
  },[showSplash])

  useEffect(()=> setSettingsOpen(false), [location.pathname])

  async function sair() {
    sessionStorage.removeItem('garagem_splash_done')
    await supabase.auth.signOut()
    nav('/login')
  }

  return (
    <div className="min-h-screen bg-app text-app">
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

      <header className="topbar fixed inset-x-0 top-0 z-40 flex h-16 items-center gap-3 border-b px-3 shadow-sm backdrop-blur-xl md:px-5">
        <button onClick={()=>setMenuOpen(v=>!v)} className="icon-btn lg:hidden" title="Abrir menu">☰</button>
        <button onClick={()=>setMenuOpen(v=>!v)} className="icon-btn hidden lg:inline-flex" title={menuOpen ? 'Ocultar menu' : 'Mostrar menu'}>{menuOpen ? '‹' : '☰'}</button>

        <NavLink to="/" className="flex min-w-0 items-center gap-2">
          <img src="/logo.png" alt="Garagem" className="h-10 w-auto max-w-[150px] object-contain md:max-w-[190px]" />
        </NavLink>

        <div className="mx-auto hidden max-w-[40vw] truncate text-center text-sm font-extrabold tracking-wide md:block">{pageTitle}</div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={()=>setTheme(theme === 'dark' ? 'light' : 'dark')} className="top-action" title="Alterar tema">
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>

          <div className="relative">
            <button onClick={()=>setSettingsOpen(v=>!v)} className="top-action">Configuração ▾</button>
            {settingsOpen && (
              <div className="dropdown-menu absolute right-0 mt-2 w-60 overflow-hidden rounded-2xl border p-2 shadow-2xl">
                <NavLink to="/configuracoes" className="dropdown-item">Personalização</NavLink>
                <NavLink to="/backup" className="dropdown-item">Backup</NavLink>
                <NavLink to="/usuarios" className="dropdown-item">Usuários</NavLink>
                <div className="my-1 border-t border-current/10" />
                <a href="https://garagem-saas-react.vercel.app/configuracoes" className="dropdown-item text-xs" target="_blank">Link configurações</a>
                <a href="https://garagem-saas-react.vercel.app/backup" className="dropdown-item text-xs" target="_blank">Link backup</a>
                <a href="https://garagem-saas-react.vercel.app/usuarios" className="dropdown-item text-xs" target="_blank">Link usuários</a>
              </div>
            )}
          </div>

          <button onClick={sair} className="top-action danger-action">Sair</button>
        </div>
      </header>

      {menuOpen && <div onClick={()=>setMenuOpen(false)} className="fixed inset-0 z-20 bg-black/40 lg:hidden" />}

      <aside className={`sidebar-shell fixed bottom-0 left-0 top-16 z-30 w-72 border-r p-4 transition-transform duration-300 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
       
        <nav className="flex h-[calc(100vh-8.5rem)] flex-col gap-1 overflow-y-auto pr-1">
          {sideLinks.filter(l=>l.roles.includes(role)).map(({to,label}) => (
            <NavLink key={to} to={to} onClick={()=> window.innerWidth < 1024 && setMenuOpen(false)} className={({ isActive }) => `nav-item rounded-xl px-3 py-3 text-sm font-semibold transition ${isActive ? 'nav-active' : 'nav-idle'}`}>
              {label}
            </NavLink>
          ))}
          <div className="my-2 border-t border-current/10" />
          <a className="nav-item nav-idle rounded-xl px-3 py-3 text-sm font-semibold transition" href="/portal-terceiro" target="_blank">Portal Terceiro ↗</a>
          <a className="nav-item nav-idle rounded-xl px-3 py-3 text-sm font-semibold transition" href="/orcamento-rapido" target="_blank">PDV Público ↗</a>
        </nav>
      </aside>

      <main className={`min-h-screen pt-20 transition-all duration-300 ${menuOpen ? 'lg:pl-72' : 'lg:pl-0'}`}>
        <div className="mx-auto w-full max-w-[1600px] px-4 pb-8 md:px-6 lg:px-8">
          <div className="mb-4 block text-lg font-black md:hidden">{pageTitle}</div>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
