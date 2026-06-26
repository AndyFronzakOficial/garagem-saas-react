import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'
import {
  Banknote, BarChart3, CalendarCheck, Download, Home, LogOut, Menu, Package, PenLine,
  Receipt, Save, Search, Settings, ShoppingCart, Trash2, UserRound, Wrench, ClipboardList
} from 'lucide-react'
import { supabase } from './lib/supabase'
import ServiceOrdersPage from './ServiceOrdersPage'
import './styles.css'

type Page = 'dashboard' | 'caixa' | 'pdv' | 'ordens' | 'financeiro' | 'relatorios' | 'produtos' | 'clientes' | 'ordens_servico' | 'historico_cliente' | 'configuracoes'

type Product = {
  id?: string
  user_id?: string
  name: string
  product_code: string | null
  barcode: string | null
  brand: string | null
  cost_price: number
  sale_price: number
  stock: number
  min_stock: number
}

type Customer = {
  id?: string
  user_id?: string
  name: string
  document: string | null
  phone: string | null
  address: string | null
  notes: string | null
}

type CartItem = {
  product: Product
  quantity: number
  unit_price: number
  discount: number
}

const emptyProduct: Product = {
  name: '',
  product_code: '',
  barcode: '',
  brand: '',
  cost_price: 0,
  sale_price: 0,
  stock: 0,
  min_stock: 0
}

const emptyCustomer: Customer = {
  name: '',
  document: '',
  phone: '',
  address: '',
  notes: ''
}

function money(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function brDate(value: string) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('pt-BR')
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function firstDayOfMonth(month = currentMonth()) {
  return `${month}-01`
}

function lastDayOfMonth(month = currentMonth()) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).toISOString().slice(0, 10)
}

function dateDaysAgo(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

async function getUserId() {
  const { data } = await supabase.auth.getUser()
  return data.user?.id || ''
}

async function getUserEmail() {
  const { data } = await supabase.auth.getUser()
  return data.user?.email || ''
}

async function getStoreSettings() {
  const user_id = await getUserId()
  const { data } = await supabase.from('store_settings').select('*').eq('user_id', user_id).limit(1).maybeSingle()
  if (data) return data

  const { data: created } = await supabase.from('store_settings').insert({
    user_id,
    store_name: 'Bazar Eletrônicos',
    cnpj: '',
    phone: '',
    address: '',
    theme: 'dark'
  }).select().single()

  return created || { store_name: 'Bazar Eletrônicos', cnpj: '', phone: '', address: '' }
}


function gerarCupom80mm({ saleId, settings, items, subtotal, discount, addition, total, payment }: any) {
  const height = Math.max(120, 90 + items.length * 9)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [80, height] })
  let y = 7

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(settings.store_name || 'Bazar Eletrônicos', 40, y, { align: 'center' })
  y += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)

  if (settings.cnpj) {
    doc.text(`CNPJ: ${settings.cnpj}`, 40, y, { align: 'center' })
    y += 4
  }

  if (settings.address) {
    doc.text(String(settings.address).slice(0, 44), 40, y, { align: 'center' })
    y += 4
  }

  if (settings.phone) {
    doc.text(settings.phone, 40, y, { align: 'center' })
    y += 4
  }

  doc.text('----------------------------------------', 40, y, { align: 'center' })
  y += 4
  doc.setFont('helvetica', 'bold')
  doc.text('CUPOM NÃO FISCAL', 40, y, { align: 'center' })
  y += 4

  doc.setFont('helvetica', 'normal')
  doc.text(`Venda: ${String(saleId).slice(0, 8)}`, 4, y)
  y += 4
  doc.text(`Data: ${new Date().toLocaleString('pt-BR')}`, 4, y)
  y += 4
  doc.text('----------------------------------------', 40, y, { align: 'center' })
  y += 4

  items.forEach((item: CartItem) => {
    const totalItem = item.quantity * item.unit_price - item.discount
    doc.setFont('helvetica', 'bold')
    doc.text(item.product.name.slice(0, 32), 4, y)
    y += 4
    doc.setFont('helvetica', 'normal')
    doc.text(`${item.quantity} x ${money(item.unit_price)}`, 4, y)
    doc.text(money(totalItem), 76, y, { align: 'right' })
    y += 5
  })

  doc.text('----------------------------------------', 40, y, { align: 'center' })
  y += 4
  doc.text('Subtotal', 4, y)
  doc.text(money(subtotal), 76, y, { align: 'right' })
  y += 4
  doc.text('Desconto', 4, y)
  doc.text(money(discount), 76, y, { align: 'right' })
  y += 4
  doc.text('Acréscimo', 4, y)
  doc.text(money(addition), 76, y, { align: 'right' })
  y += 4
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('TOTAL', 4, y)
  doc.text(money(total), 76, y, { align: 'right' })
  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(`Pagamento: ${payment}`, 4, y)
  y += 5
  doc.text('Obrigado pela preferência!', 40, y, { align: 'center' })
  y += 4
  doc.text('Volte sempre.', 40, y, { align: 'center' })

  doc.save(`cupom-${String(saleId).slice(0, 8)}.pdf`)
}



function openWhatsappNumber(phone: string, message: string) {
  const raw = String(phone || '').replace(/\D/g, '')
  if (!raw) {
    alert('WhatsApp não informado.')
    return
  }
  const finalPhone = raw.startsWith('55') ? raw : `55${raw}`
  window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`, '_blank')
}

function formatOSNumber(value: number | string | null | undefined) {
  return `OS${String(value || 0).padStart(6, '0')}`
}


function Login() {
  const [email, setEmail] = useState('admin@loja.com')
  const [password, setPassword] = useState('123456')
  const [error, setError] = useState('')

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <form onSubmit={signIn} className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl">
        <div className="h-14 w-14 rounded-2xl bg-emerald-500 flex items-center justify-center font-black text-slate-950 text-2xl">B</div>
        <h1 className="mt-6 text-3xl font-bold">Bazar Eletrônicos</h1>
        <p className="text-slate-400 mt-2">Cada login acessa sua própria loja.</p>
        <label className="label mt-8">E-mail</label>
        <input className="input" value={email} onChange={e => setEmail(e.target.value)} />
        <label className="label mt-4">Senha</label>
        <input className="input" value={password} onChange={e => setPassword(e.target.value)} type="password" />
        {error && <p className="mt-4 rounded-xl bg-red-500/15 p-3 text-sm text-red-300">{error}</p>}
        <button className="btn mt-6 w-full">Entrar</button>
      </form>
    </main>
  )
}

function Sidebar({ page, setPage, collapsed, setCollapsed }: { page: Page, setPage: (p: Page) => void, collapsed: boolean, setCollapsed: (v: boolean) => void }) {
  const items = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'caixa', label: 'Caixa', icon: Banknote },
    { id: 'pdv', label: 'PDV', icon: ShoppingCart },
    { id: 'ordens', label: 'Ordens de Serviço', icon: ClipboardList },
    { id: 'financeiro', label: 'Financeiro', icon: CalendarCheck },
    { id: 'relatorios', label: 'Relatórios', icon: BarChart3 },
    { id: 'produtos', label: 'Produtos', icon: Package },
    { id: 'clientes', label: 'Clientes', icon: UserRound, Wrench },
    { id: 'historico_cliente', label: 'Histórico Cliente', icon: UserRound, Wrench },
    { id: 'configuracoes', label: 'Configurações', icon: Settings }
  ] as const

  async function logout() {
    await supabase.auth.signOut()
  }

  return (
    <aside className={`${collapsed ? 'w-20' : 'w-72'} bg-slate-950 border-r border-slate-800 p-4 hidden lg:flex flex-col transition-all duration-200`}>
      <div className="flex items-center justify-between gap-3 px-2 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-11 w-11 rounded-xl bg-emerald-500 text-slate-950 font-black flex items-center justify-center shrink-0">B</div>
          {!collapsed && <div><strong>Bazar ERP</strong><p className="text-xs text-slate-400">V19 ordens de serviço</p></div>}
        </div>

        <button type="button" onClick={() => setCollapsed(!collapsed)} className="rounded-xl border border-slate-700 p-2 text-slate-300 hover:bg-slate-900" title={collapsed ? 'Mostrar menu' : 'Ocultar menu'}>
          <Menu size={18} />
        </button>
      </div>

      <nav className="mt-4 space-y-1 flex-1 overflow-auto">
        {items.map(item => {
          const Icon = item.icon
          return (
            <button key={item.id} onClick={() => setPage(item.id as Page)} className={`nav ${collapsed ? 'justify-center px-2' : ''} ${page === item.id ? 'nav-active' : ''}`} title={item.label}>
              <Icon size={18}/>
              {!collapsed && item.label}
            </button>
          )
        })}
      </nav>

      <button onClick={logout} className={`nav text-red-300 ${collapsed ? 'justify-center px-2' : ''}`} title="Sair">
        <LogOut size={18}/>
        {!collapsed && 'Sair'}
      </button>
    </aside>
  )
}

function Header({ title }: { title: string }) {
  return <header className="border-b border-slate-800 bg-slate-900/60 px-6 py-4"><h2 className="text-xl font-bold">{title}</h2></header>
}

function Card({ title, value, icon: Icon }: { title: string, value: string, icon: any }) {
  return <div className="card flex justify-between items-center"><div><p className="text-slate-400 text-sm">{title}</p><strong className="text-2xl">{value}</strong></div><Icon className="text-emerald-400" /></div>
}

function aggregateProductsSold(saleItems: any[]) {
  const map: any = {}
  saleItems.forEach(item => {
    const id = item.product_id || item.products?.name || 'sem-id'
    if (!map[id]) {
      map[id] = {
        product: item.products?.name || 'Produto',
        code: item.products?.product_code || '',
        quantity: 0,
        total: 0,
        profit: 0
      }
    }
    map[id].quantity += Number(item.quantity || 0)
    map[id].total += Number(item.total || 0)
    map[id].profit += Number(item.profit || 0)
  })
  return Object.values(map) as any[]
}

function Dashboard() {
  const [data, setData] = useState<any>({
    todayRevenue: 0,
    weekRevenue: 0,
    monthRevenue: 0,
    ticket: 0,
    top: [],
    bottom: [],
    serviceOrders: 0,
    serviceOrdersPending: 0
  })

  async function load() {
    const user_id = await getUserId()
    const monthStart = firstDayOfMonth()
    const monthEnd = `${lastDayOfMonth()}T23:59:59`
    const { data: sales } = await supabase
      .from('sales')
      .select('*')
      .eq('user_id', user_id)
      .gte('created_at', `${monthStart}T00:00:00`)
      .lte('created_at', monthEnd)

    const validSales = (sales || []).filter(s => s.status !== 'cancelada')
    const saleIds = validSales.map(s => s.id)

    let items: any[] = []
    if (saleIds.length) {
      const { data: saleItems } = await supabase
        .from('sale_items')
        .select('*, products(name, product_code)')
        .eq('user_id', user_id)
        .in('sale_id', saleIds)
      items = saleItems || []
    }

    const { data: financeEntries } = await supabase
      .from('financial_entries')
      .select('amount, type, paid_at')
      .eq('user_id', user_id)
      .eq('type', 'entrada')
      .not('paid_at', 'is', null)

    const paidEntries = financeEntries || []
    const todayRevenue = paidEntries
      .filter(entry => String(entry.paid_at).slice(0, 10) === today())
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0)

    const weekRevenue = paidEntries
      .filter(entry => String(entry.paid_at).slice(0, 10) >= dateDaysAgo(6))
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0)

    const monthRevenue = paidEntries
      .filter(entry => String(entry.paid_at).slice(0, 7) === currentMonth())
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0)

    const { data: serviceOrdersData } = await supabase
      .from('service_orders')
      .select('id, total, payment_status, paid_at, order_date')
      .eq('user_id', user_id)
      .gte('order_date', monthStart)
      .lte('order_date', lastDayOfMonth())

    const paidServiceOrders = (serviceOrdersData || []).filter(order => order.payment_status === 'pago')
    const serviceOrdersPending = (serviceOrdersData || [])
      .filter(order => order.payment_status !== 'pago')
      .reduce((sum, order) => sum + Number(order.total || 0), 0)

    let orderItems: any[] = []
    if (paidServiceOrders.length) {
      const { data: orderItemsData } = await supabase
        .from('service_order_items')
        .select('product_id, quantity, total, products(name, product_code)')
        .eq('user_id', user_id)
        .in('service_order_id', paidServiceOrders.map(order => order.id))
      orderItems = (orderItemsData || []).map(item => ({ ...item, profit: 0 }))
    }

    const ticketCount = validSales.length + paidServiceOrders.length
    const ticket = ticketCount ? monthRevenue / ticketCount : 0

    const sold = aggregateProductsSold([...items, ...orderItems])
    const top = [...sold].sort((a, b) => b.quantity - a.quantity).slice(0, 3)
    const bottom = [...sold].sort((a, b) => a.quantity - b.quantity).slice(0, 3)

    setData({
      todayRevenue,
      weekRevenue,
      monthRevenue,
      ticket,
      top,
      bottom,
      serviceOrders: (serviceOrdersData || []).length,
      serviceOrdersPending
    })
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card title="Faturamento do dia" value={money(data.todayRevenue)} icon={Receipt} />
        <Card title="Últimos 7 dias" value={money(data.weekRevenue)} icon={BarChart3} />
        <Card title="Faturamento do mês" value={money(data.monthRevenue)} icon={Banknote} />
        <Card title="Ticket médio" value={money(data.ticket)} icon={ShoppingCart} />
        <Card title="Ordens no mês" value={String(data.serviceOrders)} icon={ClipboardList} />
        <Card title="Ordens a receber" value={money(data.serviceOrdersPending)} icon={CalendarCheck} />
      </div>

      <div className="grid xl:grid-cols-2 gap-4">
        <section className="panel">
          <h3>Top 3 produtos mais vendidos</h3>
          <table className="w-full text-sm">
            <thead><tr><th>Produto</th><th>Quantidade</th><th>Total</th></tr></thead>
            <tbody>
              {data.top.map((p: any) => <tr key={p.product}><td>{p.product}</td><td>{p.quantity}</td><td>{money(p.total)}</td></tr>)}
              {!data.top.length && <tr><td colSpan={3} className="text-slate-500">Sem vendas no mês.</td></tr>}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <h3>Top 3 produtos menos vendidos</h3>
          <table className="w-full text-sm">
            <thead><tr><th>Produto</th><th>Quantidade</th><th>Total</th></tr></thead>
            <tbody>
              {data.bottom.map((p: any) => <tr key={p.product}><td>{p.product}</td><td>{p.quantity}</td><td>{money(p.total)}</td></tr>)}
              {!data.bottom.length && <tr><td colSpan={3} className="text-slate-500">Sem vendas no mês.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  )
}


function CashPage() {
  const [session, setSession] = useState<any>(null)
  const [openingAmount, setOpeningAmount] = useState('')
  const [closingAmount, setClosingAmount] = useState('')
  const [entries, setEntries] = useState<any[]>([])
  const [month, setMonth] = useState(currentMonth())
  const [message, setMessage] = useState('')

  async function load() {
    const user_id = await getUserId()

    const { data: opened } = await supabase
      .from('cash_sessions')
      .select('*')
      .eq('user_id', user_id)
      .eq('status', 'aberto')
      .maybeSingle()

    setSession(opened)

    const start = `${month}-01`
    const endDate = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).toISOString().slice(0, 10)

    const { data } = await supabase
      .from('financial_entries')
      .select('*')
      .eq('user_id', user_id)
      .gte('created_at', `${start}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`)
      .order('created_at', { ascending: false })

    setEntries(data || [])
  }

  useEffect(() => { load() }, [month])

  const entradaTypes = ['entrada', 'suprimento', 'abertura']
  const saidaTypes = ['saida', 'sangria', 'pagar', 'cancelada']

  const entradas = entries
    .filter(e => entradaTypes.includes(e.type))
    .reduce((a, e) => a + Number(e.amount || 0), 0)

  const saidas = entries
    .filter(e => saidaTypes.includes(e.type))
    .reduce((a, e) => a + Number(e.amount || 0), 0)

  const expected = Number(session?.opening_amount || 0) + entradas - saidas
  const difference = closingAmount === '' ? 0 : Number(closingAmount || 0) - expected

  async function openCash() {
    const user_id = await getUserId()
    const value = Number(openingAmount || 0)

    const { data, error } = await supabase
      .from('cash_sessions')
      .insert({
        user_id,
        opened_at: new Date().toISOString(),
        opening_amount: value,
        status: 'aberto'
      })
      .select()
      .single()

    if (error || !data) {
      setMessage(error?.message || 'Erro ao abrir caixa.')
      return
    }

    await supabase.from('financial_entries').insert({
      user_id,
      description: 'Abertura de caixa',
      type: 'abertura',
      payment_method: 'Dinheiro',
      amount: value,
      paid_at: new Date().toISOString(),
      cash_session_id: data.id
    })

    setOpeningAmount('')
    setMessage('Caixa aberto com sucesso.')
    await load()
  }

  async function closeCash() {
    if (!session) return

    const user_id = await getUserId()
    const value = Number(closingAmount || 0)
    const diff = value - expected

    await supabase
      .from('cash_sessions')
      .update({
        closed_at: new Date().toISOString(),
        closing_amount: value,
        expected_amount: expected,
        difference: diff,
        status: 'fechado'
      })
      .eq('id', session.id)
      .eq('user_id', user_id)

    await supabase.from('financial_entries').insert({
      user_id,
      description: 'Fechamento de caixa',
      type: 'fechamento',
      payment_method: 'Dinheiro',
      amount: value,
      paid_at: new Date().toISOString(),
      cash_session_id: session.id
    })

    setClosingAmount('')
    setMessage('Caixa fechado com sucesso.')
    await load()
  }

  async function quickEntry(type: 'sangria' | 'suprimento') {
    if (!session) {
      setMessage('Abra o caixa antes.')
      return
    }

    const value = Number(prompt(type === 'sangria' ? 'Valor da sangria:' : 'Valor do suprimento:') || 0)
    if (!value) return

    const user_id = await getUserId()

    await supabase.from('financial_entries').insert({
      user_id,
      description: type === 'sangria' ? 'Sangria de caixa' : 'Suprimento de caixa',
      type,
      payment_method: 'Dinheiro',
      amount: value,
      paid_at: new Date().toISOString(),
      cash_session_id: session.id
    })

    setMessage(type === 'sangria' ? 'Sangria registrada.' : 'Suprimento registrado.')
    await load()
  }

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-5 gap-4">
        <Card title="Status" value={session ? 'Aberto' : 'Fechado'} icon={Banknote} />
        <Card title="Valor inicial" value={money(Number(session?.opening_amount || 0))} icon={Banknote} />
        <Card title="Entradas" value={money(entradas)} icon={Receipt} />
        <Card title="Saídas" value={money(saidas)} icon={CalendarCheck} />
        <Card title="Valor esperado" value={money(expected)} icon={BarChart3} />
      </div>

      <section className="panel">
        <h3>{session ? 'Fechamento de caixa' : 'Abertura de caixa'}</h3>

        {!session && (
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="label">Valor inicial em dinheiro</label>
              <input
                className="input"
                type="number"
                step="0.01"
                placeholder="Ex: 100.00"
                value={openingAmount}
                onChange={e => setOpeningAmount(e.target.value)}
              />
            </div>
            <button className="btn self-end" onClick={openCash}>Abrir caixa</button>
          </div>
        )}

        {session && (
          <div className="grid md:grid-cols-5 gap-3">
            <div>
              <label className="label">Valor contado no caixa</label>
              <input
                className="input"
                type="number"
                step="0.01"
                placeholder="Ex: 400.00"
                value={closingAmount}
                onChange={e => setClosingAmount(e.target.value)}
              />
            </div>

            <div className="mini">
              Diferença<br/>
              <b className={difference < 0 ? 'text-red-300' : 'text-emerald-300'}>
                {money(difference)}
              </b>
            </div>

            <button className="btn self-end" onClick={closeCash}>Fechar caixa</button>
            <button className="btn2 self-end" onClick={() => quickEntry('sangria')}>Sangria</button>
            <button className="btn2 self-end" onClick={() => quickEntry('suprimento')}>Suprimento</button>
          </div>
        )}

        {message && <p className="mt-4 mini">{message}</p>}
      </section>

      <section className="panel">
        <h3>Fluxo de caixa</h3>
        <div className="mb-4 w-64">
          <label className="label">Filtrar mês</label>
          <input className="input" type="month" value={month} onChange={e => setMonth(e.target.value)} />
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th>Tipo</th>
              <th>Forma</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.id}>
                <td>{new Date(e.created_at).toLocaleString('pt-BR')}</td>
                <td>{e.description}</td>
                <td>{e.type}</td>
                <td>{e.payment_method}</td>
                <td>{money(e.amount)}</td>
              </tr>
            ))}
            {!entries.length && <tr><td colSpan={5} className="text-slate-500">Nenhum lançamento no período.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  )
}


function FinancePage() {
  const [month, setMonth] = useState(currentMonth())
  const [entries, setEntries] = useState<any[]>([])

  async function load() {
    const user_id = await getUserId()
    const { data } = await supabase
      .from('financial_entries')
      .select('*, customers(name), suppliers(name)')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })

    setEntries(data || [])
  }

  useEffect(() => { load() }, [])

  const monthEntries = entries.filter(e => String(e.created_at || '').slice(0, 7) === month)

  const entradaTypes = ['entrada', 'suprimento', 'abertura']
  const saidaTypes = ['saida', 'sangria', 'pagar', 'cancelada']

  const saldoAtual =
    entries.filter(e => e.paid_at && entradaTypes.includes(e.type)).reduce((a, e) => a + Number(e.amount || 0), 0)
    - entries.filter(e => e.paid_at && saidaTypes.includes(e.type)).reduce((a, e) => a + Number(e.amount || 0), 0)

  const aReceber = entries.filter(e => e.type === 'receber' && !e.paid_at).reduce((a, e) => a + Number(e.amount || 0), 0)
  const aPagar = entries.filter(e => e.type === 'pagar' && !e.paid_at).reduce((a, e) => a + Number(e.amount || 0), 0)
  const saldoPrevisto = saldoAtual + aReceber - aPagar

  const days = Array.from({ length: new Date(Number(month.slice(0,4)), Number(month.slice(5,7)), 0).getDate() }, (_, i) => {
    const day = String(i + 1).padStart(2, '0')
    const date = `${month}-${day}`
    const entradas = monthEntries.filter(e => String(e.created_at).slice(0, 10) === date && entradaTypes.includes(e.type)).reduce((a, e) => a + Number(e.amount || 0), 0)
    const saidas = monthEntries.filter(e => String(e.created_at).slice(0, 10) === date && saidaTypes.includes(e.type)).reduce((a, e) => a + Number(e.amount || 0), 0)
    return { date, day, entradas, saidas }
  })

  const maxBar = Math.max(1, ...days.map(d => Math.max(d.entradas, d.saidas)))

  async function pay(entry: any) {
    await supabase.from('financial_entries').update({ paid_at: new Date().toISOString() }).eq('id', entry.id)
    await load()
  }

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-4 gap-4">
        <Card title="Saldo atual" value={money(saldoAtual)} icon={Banknote} />
        <Card title="A receber" value={money(aReceber)} icon={Receipt} />
        <Card title="A pagar" value={money(aPagar)} icon={CalendarCheck} />
        <Card title="Saldo previsto" value={money(saldoPrevisto)} icon={BarChart3} />
      </div>

      <section className="panel">
        <h3>Gráfico de Fluxo de Caixa</h3>
        <div className="mb-4 w-64">
          <label className="label">Mês</label>
          <input className="input" type="month" value={month} onChange={e => setMonth(e.target.value)} />
        </div>
        <div className="space-y-3">
          {days.map(d => (
            <div key={d.date} className="grid grid-cols-12 gap-2 items-center text-xs">
              <div className="col-span-1 text-slate-400">{d.day}</div>
              <div className="col-span-5 bg-slate-800 rounded-md h-4">
                <div className="bar-in h-4" style={{ width: `${(d.entradas / maxBar) * 100}%` }} />
              </div>
              <div className="col-span-2 text-emerald-300">{money(d.entradas)}</div>
              <div className="col-span-3 bg-slate-800 rounded-md h-4">
                <div className="bar-out h-4" style={{ width: `${(d.saidas / maxBar) * 100}%` }} />
              </div>
              <div className="col-span-1 text-red-300">{money(d.saidas)}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-4">Verde = entradas. Vermelho = saídas.</p>
      </section>

      <section className="panel">
        <h3>Lançamentos financeiros</h3>
        <table className="w-full text-sm">
          <thead><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th>Forma</th><th>Cliente/Fornecedor</th><th>Valor</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {monthEntries.map(e => (
              <tr key={e.id}>
                <td>{new Date(e.created_at).toLocaleString('pt-BR')}</td>
                <td>{e.description}</td>
                <td>{e.type}</td>
                <td>{e.payment_method}</td>
                <td>{e.customers?.name || e.suppliers?.name || '-'}</td>
                <td>{money(e.amount)}</td>
                <td>{e.paid_at ? <span className="tag-green">Pago</span> : <span className="tag-yellow">Aberto</span>}</td>
                <td>{!e.paid_at && <button className="btn2" onClick={() => pay(e)}>Baixar</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function ReportsPage() {
  const [month, setMonth] = useState(currentMonth())
  const [sales, setSales] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [financial, setFinancial] = useState<any[]>([])
  const [settings, setSettings] = useState<any>({})

  async function load() {
    const user_id = await getUserId()
    setSettings(await getStoreSettings())
    const start = `${firstDayOfMonth(month)}T00:00:00`
    const end = `${lastDayOfMonth(month)}T23:59:59`

    const { data: salesData } = await supabase.from('sales').select('*, customers(name)').eq('user_id', user_id).gte('created_at', start).lte('created_at', end).order('created_at', { ascending: false })
    const saleIds = (salesData || []).map(s => s.id)

    let saleItems: any[] = []
    if (saleIds.length) {
      const { data } = await supabase.from('sale_items').select('*, products(name, product_code, barcode)').eq('user_id', user_id).in('sale_id', saleIds)
      saleItems = data || []
    }

    const { data: productsData } = await supabase.from('products').select('*').eq('user_id', user_id).order('name')
    const { data: financialData } = await supabase.from('financial_entries').select('*, customers(name), suppliers(name)').eq('user_id', user_id).gte('created_at', start).lte('created_at', end).order('created_at', { ascending: false })

    setSales(salesData || [])
    setItems(saleItems)
    setProducts(productsData || [])
    setFinancial(financialData || [])
  }

  useEffect(() => { load() }, [])

  const validSales = sales.filter(s => s.status !== 'cancelada')
  const total = validSales.reduce((a, s) => a + Number(s.total || 0), 0)
  const profit = validSales.reduce((a, s) => a + Number(s.profit || 0), 0)
  const ticket = validSales.length ? total / validSales.length : 0
  const productsSold = aggregateProductsSold(items).sort((a: any, b: any) => b.quantity - a.quantity)
  const lowStock = products.filter(p => Number(p.stock || 0) <= Number(p.min_stock || 0))
  const fiado = financial.filter(f => f.type === 'receber' && !f.paid_at)
  const vendedores = Object.values(validSales.reduce((acc: any, sale: any) => {
    const seller = sale.seller_name || sale.employee_name || 'Sem vendedor'
    if (!acc[seller]) acc[seller] = { vendedor: seller, quantidade: 0, total: 0, lucro: 0, ticket: 0 }
    acc[seller].quantidade += 1
    acc[seller].total += Number(sale.total || 0)
    acc[seller].lucro += Number(sale.profit || 0)
    acc[seller].ticket = acc[seller].total / acc[seller].quantidade
    return acc
  }, {})) as any[]

  const clientes = Object.values(validSales.reduce((acc: any, sale: any) => {
    const client = sale.customers?.name || 'Cliente não informado'
    if (!acc[client]) acc[client] = { cliente: client, compras: 0, total: 0, ultima_compra: '' }
    acc[client].compras += 1
    acc[client].total += Number(sale.total || 0)
    acc[client].ultima_compra = brDate(sale.created_at)
    return acc
  }, {})) as any[]

  function exportPDF() {
    const doc = new jsPDF()
    let y = 14
    const pageW = doc.internal.pageSize.getWidth()

    doc.setFillColor(15, 23, 42)
    doc.rect(0, 0, pageW, 30, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text(settings.store_name || 'Bazar Eletrônicos', 14, 13)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`CNPJ: ${settings.cnpj || '-'}`, 14, 20)
    doc.text(`Tel: ${settings.phone || '-'} | ${settings.address || '-'}`, 14, 25)

    y = 42
    doc.setTextColor(15, 23, 42)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('Relatório Gerencial Mensal', 14, y)
    y += 7
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Período: ${firstDayOfMonth(month)} até ${lastDayOfMonth(month)}`, 14, y)
    y += 10

    const cards = [
      ['Faturamento', money(total)],
      ['Lucro', money(profit)],
      ['Qtd. vendas', String(validSales.length)],
      ['Ticket médio', money(ticket)]
    ]

    cards.forEach((c, i) => {
      const x = 14 + (i % 2) * 92
      const yy = y + Math.floor(i / 2) * 18
      doc.setDrawColor(220)
      doc.roundedRect(x, yy, 84, 14, 2, 2)
      doc.setFont('helvetica', 'bold')
      doc.text(c[0], x + 3, yy + 5)
      doc.setFont('helvetica', 'normal')
      doc.text(c[1], x + 3, yy + 11)
    })
    y += 42

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Top Produtos Mais Vendidos', 14, y)
    y += 7
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    productsSold.slice(0, 10).forEach((p: any, i) => {
      doc.text(`${i + 1}. ${p.product}`, 14, y)
      doc.text(`${p.quantity} un`, 120, y)
      doc.text(money(p.total), 160, y)
      y += 6
    })

    y += 5
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Estoque Baixo', 14, y)
    y += 7
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    lowStock.slice(0, 8).forEach((p: any, i) => {
      doc.text(`${i + 1}. ${p.name}`, 14, y)
      doc.text(`Atual: ${p.stock}`, 120, y)
      doc.text(`Mínimo: ${p.min_stock}`, 150, y)
      y += 6
    })

    y += 5
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Fiado em Aberto', 14, y)
    y += 7
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    fiado.slice(0, 8).forEach((f: any, i) => {
      doc.text(`${i + 1}. ${f.customers?.name || 'Cliente'}`, 14, y)
      doc.text(money(f.amount), 160, y)
      y += 6
    })

    doc.setFontSize(8)
    doc.setTextColor(100)
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 287)
    doc.text('Sistema ERP Bazar Eletrônicos', 140, 287)

    doc.save(`Relatorio_${month}.pdf`)
  }

  function exportExcel() {
    const vendas = validSales.map(s => ({
      'Data': new Date(s.created_at).toLocaleString('pt-BR'),
      'Cliente': s.customers?.name || 'Cliente não informado',
      'Forma de Pagamento': s.payment_method || '-',
      'Status': s.status || '-',
      'Subtotal': Number(s.subtotal || 0),
      'Desconto': Number(s.discount || 0),
      'Acréscimo': Number(s.addition || 0),
      'Total da Venda': Number(s.total || 0),
      'Lucro': Number(s.profit || 0),
      'Vendedor': s.seller_name || s.employee_name || 'Sem vendedor'
    }))

    const produtos = productsSold.map((p: any) => ({
      'Produto': p.product,
      'Código': p.code || '-',
      'Quantidade Vendida': p.quantity,
      'Faturamento': Number(p.total || 0),
      'Lucro': Number(p.profit || 0)
    }))

    const estoque = lowStock.map(p => ({
      'Produto': p.name,
      'Código': p.product_code || '-',
      'Código de Barras': p.barcode || '-',
      'Estoque Atual': Number(p.stock || 0),
      'Estoque Mínimo': Number(p.min_stock || 0),
      'Valor de Venda': Number(p.sale_price || 0)
    }))

    const fiadoSheet = fiado.map(f => ({
      'Cliente': f.customers?.name || 'Cliente não informado',
      'Descrição': f.description,
      'Vencimento': f.due_date ? brDate(f.due_date) : '-',
      'Valor': Number(f.amount || 0),
      'Situação': f.paid_at ? 'Pago' : 'Em aberto'
    }))

    const vendedoresSheet = vendedores.map(v => ({
      'Vendedor': v.vendedor,
      'Quantidade de Vendas': v.quantidade,
      'Total Vendido': Number(v.total || 0),
      'Lucro': Number(v.lucro || 0),
      'Ticket Médio': Number(v.ticket || 0)
    }))

    const clientesSheet = clientes.map(c => ({
      'Cliente': c.cliente,
      'Quantidade de Compras': c.compras,
      'Total Gasto': Number(c.total || 0),
      'Última Compra': c.ultima_compra
    }))

    const resumo = [{
      'Período': `${firstDayOfMonth(month)} até ${lastDayOfMonth(month)}`,
      'Faturamento': total,
      'Lucro': profit,
      'Quantidade de Vendas': validSales.length,
      'Ticket Médio': ticket,
      'Fiado em Aberto': fiado.reduce((a, f) => a + Number(f.amount || 0), 0)
    }]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), 'Resumo')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vendas), 'Vendas')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(produtos), 'Produtos Vendidos')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(estoque), 'Estoque Baixo')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fiadoSheet), 'Fiado')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vendedoresSheet), 'Vendedores')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clientesSheet), 'Clientes')

    XLSX.writeFile(wb, `Relatorio_${month}.xlsx`)
  }

  return (
    <div className="space-y-4">
      <section className="panel">
        <h3>Relatório mensal profissional</h3>
        <div className="grid md:grid-cols-4 gap-3">
          <div>
            <label className="label">Mês do relatório</label>
            <input className="input" type="month" value={month} onChange={e => setMonth(e.target.value)} />
          </div>
          <button className="btn self-end" onClick={load}>Atualizar</button>
          <button className="btn2 self-end flex items-center justify-center gap-2" onClick={exportPDF}><Download size={16}/> PDF profissional</button>
          <button className="btn2 self-end" onClick={exportExcel}>Excel traduzido</button>
        </div>
      </section>

      <div className="grid md:grid-cols-5 gap-4">
        <Card title="Faturamento" value={money(total)} icon={Receipt} />
        <Card title="Lucro" value={money(profit)} icon={Banknote} />
        <Card title="Qtd. vendas" value={String(validSales.length)} icon={ShoppingCart} />
        <Card title="Ticket médio" value={money(ticket)} icon={BarChart3} />
        <Card title="Fiado aberto" value={money(fiado.reduce((a, f) => a + Number(f.amount || 0), 0))} icon={CalendarCheck} />
      </div>

      <div className="grid xl:grid-cols-2 gap-4">
        <section className="panel">
          <h3>Produtos mais vendidos</h3>
          <table className="w-full text-sm">
            <thead><tr><th>Produto</th><th>Qtd</th><th>Faturamento</th><th>Lucro</th></tr></thead>
            <tbody>{productsSold.slice(0, 10).map((p: any) => <tr key={p.product}><td>{p.product}</td><td>{p.quantity}</td><td>{money(p.total)}</td><td>{money(p.profit)}</td></tr>)}</tbody>
          </table>
        </section>

        <section className="panel">
          <h3>Produtos menos vendidos</h3>
          <table className="w-full text-sm">
            <thead><tr><th>Produto</th><th>Qtd</th><th>Faturamento</th></tr></thead>
            <tbody>{[...productsSold].sort((a: any,b: any) => a.quantity - b.quantity).slice(0, 10).map((p: any) => <tr key={p.product}><td>{p.product}</td><td>{p.quantity}</td><td>{money(p.total)}</td></tr>)}</tbody>
          </table>
        </section>

        <section className="panel">
          <h3>Estoque baixo</h3>
          <table className="w-full text-sm">
            <thead><tr><th>Produto</th><th>Atual</th><th>Mínimo</th><th>Preço</th></tr></thead>
            <tbody>{lowStock.map(p => <tr key={p.id}><td>{p.name}</td><td>{p.stock}</td><td>{p.min_stock}</td><td>{money(p.sale_price)}</td></tr>)}</tbody>
          </table>
        </section>

        <section className="panel">
          <h3>Fiado</h3>
          <table className="w-full text-sm">
            <thead><tr><th>Cliente</th><th>Descrição</th><th>Vencimento</th><th>Valor</th></tr></thead>
            <tbody>{fiado.map(f => <tr key={f.id}><td>{f.customers?.name || '-'}</td><td>{f.description}</td><td>{f.due_date ? brDate(f.due_date) : '-'}</td><td>{money(f.amount)}</td></tr>)}</tbody>
          </table>
        </section>
      </div>
    </div>
  )
}

function PDVPage() {
  const [cashSession, setCashSession] = useState<any>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [query, setQuery] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Dinheiro')
  const [saleDiscount, setSaleDiscount] = useState('')
  const [addition, setAddition] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    const user_id = await getUserId()
    const { data: openedCash } = await supabase.from('cash_sessions').select('*').eq('user_id', user_id).eq('status', 'aberto').maybeSingle()
    setCashSession(openedCash)
    const { data: p } = await supabase.from('products').select('*').eq('user_id', user_id).order('name')
    const { data: c } = await supabase.from('customers').select('*').eq('user_id', user_id).order('name')
    setProducts(p || [])
    setCustomers(c || [])
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products.slice(0, 8)
    return products.filter(p => p.name.toLowerCase().includes(q) || (p.barcode || '').toLowerCase().includes(q) || (p.product_code || '').toLowerCase().includes(q))
  }, [query, products])

  const subtotal = cart.reduce((a, i) => a + i.quantity * i.unit_price, 0)
  const itemDiscount = cart.reduce((a, i) => a + Number(i.discount || 0), 0)
  const total = Math.max(0, subtotal - itemDiscount - Number(saleDiscount || 0) + Number(addition || 0))
  const profit = cart.reduce((a, i) => a + ((i.unit_price - Number(i.product.cost_price || 0)) * i.quantity) - i.discount, 0) - Number(saleDiscount || 0) + Number(addition || 0)

  function addProduct(product: Product) {
    if (Number(product.stock) <= 0) return setMessage('Produto sem estoque.')
    setCart(current => {
      const found = current.find(i => i.product.id === product.id)
      if (found) return current.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...current, { product, quantity: 1, unit_price: Number(product.sale_price || 0), discount: 0 }]
    })
    setQuery('')
  }

  function updateItem(index: number, data: Partial<CartItem>) {
    setCart(c => c.map((item, i) => i === index ? { ...item, ...data } : item))
  }

  async function finishSale() {
    if (!cashSession) return setMessage('Abra o caixa antes de vender.')
    if (!cart.length) return setMessage('Carrinho vazio.')
    const user_id = await getUserId()
    const seller = await getUserEmail()

    const { data: sale, error } = await supabase.from('sales').insert({
      user_id,
      customer_id: customerId || null,
      status: 'finalizada',
      payment_method: paymentMethod,
      subtotal,
      discount: itemDiscount + Number(saleDiscount || 0),
      addition: Number(addition || 0),
      total,
      profit,
      seller_name: seller,
      cash_session_id: cashSession?.id || null
    }).select().single()

    if (error || !sale) return setMessage(error?.message || 'Erro ao vender.')

    for (const item of cart) {
      await supabase.from('sale_items').insert({
        user_id,
        sale_id: sale.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        cost_price: item.product.cost_price,
        discount: item.discount,
        total: item.quantity * item.unit_price - item.discount,
        profit: (item.unit_price - item.product.cost_price) * item.quantity - item.discount
      })

      await supabase.from('products').update({ stock: Number(item.product.stock) - item.quantity }).eq('id', item.product.id).eq('user_id', user_id)

      await supabase.from('stock_movements').insert({
        user_id,
        product_id: item.product.id,
        movement_type: 'saida_venda',
        quantity: item.quantity * -1,
        reason: `Venda ${sale.id}`
      })
    }

    await supabase.from('financial_entries').insert({
      user_id,
      sale_id: sale.id,
      customer_id: customerId || null,
      description: `Venda ${sale.id}`,
      type: paymentMethod === 'Fiado' ? 'receber' : 'entrada',
      payment_method: paymentMethod,
      amount: total,
      due_date: paymentMethod === 'Fiado' ? today() : null,
      paid_at: paymentMethod === 'Fiado' ? null : new Date().toISOString(),
      cash_session_id: cashSession?.id || null
    })

    gerarCupom80mm({
      saleId: sale.id,
      settings: await getStoreSettings(),
      items: cart,
      subtotal,
      discount: itemDiscount + Number(saleDiscount || 0),
      addition: Number(addition || 0),
      total,
      payment: paymentMethod
    })

    setCart([])
    setSaleDiscount('')
    setAddition('')
    setCustomerId('')
    setMessage('Venda finalizada.')
    await load()
  }

  return (
    <div className="space-y-4">
      {!cashSession && <div className="panel border-yellow-500/40"><h3>Caixa fechado</h3><p className="text-yellow-300">Abra o caixa antes de usar o PDV.</p></div>}
    <div className="grid xl:grid-cols-3 gap-4">
      <section className="panel">
        <h3>Buscar produto</h3>
        <div className="relative">
          <Search className="absolute left-3 top-3.5 text-slate-500" size={18}/>
          <input className="input pl-10" placeholder="Nome, código ou código de barras" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <div className="mt-4 space-y-2">
          {filtered.map(p => <button key={p.id} onClick={() => addProduct(p)} className="mini w-full text-left hover:border-emerald-500"><div className="flex justify-between gap-3"><div><b>{p.name}</b><p className="text-xs text-slate-500">Cód: {p.product_code || '-'} • Qtd: {p.stock}</p></div><b>{money(p.sale_price)}</b></div></button>)}
        </div>
      </section>

      <section className="panel xl:col-span-2">
        <h3>Carrinho</h3>
        <table className="w-full text-sm">
          <thead><tr><th>Produto</th><th>Qtd</th><th>Preço</th><th>Desc.</th><th>Total</th><th></th></tr></thead>
          <tbody>{cart.map((item, index) => <tr key={item.product.id}><td>{item.product.name}</td><td><input className="input w-24" type="number" value={item.quantity} onChange={e => updateItem(index, { quantity: Number(e.target.value) })}/></td><td><input className="input w-28" type="number" value={item.unit_price} onChange={e => updateItem(index, { unit_price: Number(e.target.value) })}/></td><td><input className="input w-28" type="number" value={item.discount || ''} onChange={e => updateItem(index, { discount: Number(e.target.value || 0) })}/></td><td>{money(item.quantity * item.unit_price - item.discount)}</td><td><button className="btn-danger" onClick={() => setCart(c => c.filter((_, i) => i !== index))}><Trash2 size={14}/></button></td></tr>)}</tbody>
        </table>

        <div className="mt-5 grid md:grid-cols-4 gap-3">
          <select className="input" value={customerId} onChange={e => setCustomerId(e.target.value)}><option value="">Cliente não informado</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select className="input" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}><option>Dinheiro</option><option>Pix</option><option>Cartão débito</option><option>Cartão crédito</option><option>Fiado</option></select>
          <input className="input" type="number" placeholder="Desconto venda" value={saleDiscount} onChange={e => setSaleDiscount(e.target.value)}/>
          <input className="input" type="number" placeholder="Acréscimo" value={addition} onChange={e => setAddition(e.target.value)}/>
        </div>

        <div className="mt-5 grid md:grid-cols-4 gap-3">
          <div className="mini">Subtotal<br/><b>{money(subtotal)}</b></div>
          <div className="mini">Descontos<br/><b>{money(itemDiscount + Number(saleDiscount || 0))}</b></div>
          <div className="mini">Acréscimo<br/><b>{money(Number(addition || 0))}</b></div>
          <div className="mini">Total<br/><b className="text-2xl text-emerald-300">{money(total)}</b></div>
        </div>

        <button className="btn mt-5 w-full" disabled={!cart.length} onClick={finishSale}>Finalizar venda</button>
        {message && <p className="mt-4 mini">{message}</p>}
      </section>
    </div>
    </div>
  )
}

function ProductsPage() {
  const [items, setItems] = useState<Product[]>([])
  const [form, setForm] = useState<Product>(emptyProduct)
  const [editingId, setEditingId] = useState<string | null>(null)

  async function load() {
    const user_id = await getUserId()
    const { data } = await supabase.from('products').select('*').eq('user_id', user_id).order('created_at', { ascending: false })
    setItems(data || [])
  }

  useEffect(() => { load() }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const user_id = await getUserId()
    if (editingId) await supabase.from('products').update(form).eq('id', editingId).eq('user_id', user_id)
    else await supabase.from('products').insert({ ...form, user_id })
    setForm(emptyProduct)
    setEditingId(null)
    await load()
  }

  async function remove(id?: string) {
    if (!id) return
    const user_id = await getUserId()
    await supabase.from('products').delete().eq('id', id).eq('user_id', user_id)
    await load()
  }

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="panel">
        <h3>Produto</h3>
        <div className="grid md:grid-cols-4 gap-3">
          <div><label className="label">Nome do produto</label><input className="input" placeholder="Ex: Fone Bluetooth X10" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
          <div><label className="label">Código do produto</label><input className="input" placeholder="Ex: PROD-001" value={form.product_code || ''} onChange={e => setForm({ ...form, product_code: e.target.value })} /></div>
          <div><label className="label">Código de barras</label><input className="input" placeholder="Ex: 789100000001" value={form.barcode || ''} onChange={e => setForm({ ...form, barcode: e.target.value })} /></div>
          <div><label className="label">Marca</label><input className="input" placeholder="Ex: JBL, Samsung, Genérico" value={form.brand || ''} onChange={e => setForm({ ...form, brand: e.target.value })} /></div>
          <div><label className="label">Quantidade</label><input className="input" type="number" placeholder="Ex: 10" value={form.stock || ''} onChange={e => setForm({ ...form, stock: Number(e.target.value || 0) })} /></div>
          <div><label className="label">Valor pago</label><input className="input" type="number" step="0.01" placeholder="Ex: 25.00" value={form.cost_price || ''} onChange={e => setForm({ ...form, cost_price: Number(e.target.value || 0) })} /></div>
          <div><label className="label">Valor final</label><input className="input" type="number" step="0.01" placeholder="Ex: 49.90" value={form.sale_price || ''} onChange={e => setForm({ ...form, sale_price: Number(e.target.value || 0) })} /></div>
          <div><label className="label">Estoque mínimo</label><input className="input" type="number" placeholder="Ex: 3" value={form.min_stock || ''} onChange={e => setForm({ ...form, min_stock: Number(e.target.value || 0) })} /></div>
        </div>
        <button className="btn mt-4"><Save size={16} className="inline mr-2"/>Salvar produto</button>
      </form>

      <section className="panel">
        <h3>Lista de produtos</h3>
        <table className="w-full text-sm">
          <thead><tr><th>Produto</th><th>Cód.</th><th>Barras</th><th>Qtd</th><th>Pago</th><th>Final</th><th>Marca</th><th></th></tr></thead>
          <tbody>{items.map(p => <tr key={p.id}><td>{p.name}</td><td>{p.product_code}</td><td>{p.barcode}</td><td>{p.stock}</td><td>{money(p.cost_price)}</td><td>{money(p.sale_price)}</td><td>{p.brand}</td><td className="space-x-2"><button className="btn2" onClick={() => { setEditingId(p.id || null); setForm(p) }}>Editar</button><button className="btn-danger" onClick={() => remove(p.id)}>Excluir</button></td></tr>)}</tbody>
        </table>
      </section>
    </div>
  )
}

function CustomersPage() {
  const [items, setItems] = useState<Customer[]>([])
  const [form, setForm] = useState<Customer>(emptyCustomer)

  async function load() {
    const user_id = await getUserId()
    const { data } = await supabase.from('customers').select('*').eq('user_id', user_id).order('created_at', { ascending: false })
    setItems(data || [])
  }

  useEffect(() => { load() }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const user_id = await getUserId()
    await supabase.from('customers').insert({ ...form, user_id })
    setForm(emptyCustomer)
    await load()
  }

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="panel">
        <h3>Cliente</h3>
        <div className="grid md:grid-cols-3 gap-3">
          <input className="input" placeholder="Nome" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <input className="input" placeholder="CPF" value={form.document || ''} onChange={e => setForm({ ...form, document: e.target.value })} />
          <input className="input" placeholder="Contato" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <input className="input" placeholder="Endereço" value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} />
          <input className="input md:col-span-2" placeholder="Obs" value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} />
        </div>
        <button className="btn mt-4">Salvar</button>
      </form>

      <section className="panel">
        <h3>Lista de clientes</h3>
        <table className="w-full text-sm">
          <thead><tr><th>Nome</th><th>CPF</th><th>Contato</th><th>Endereço</th><th>Obs</th></tr></thead>
          <tbody>{items.map(c => <tr key={c.id}><td>{c.name}</td><td>{c.document}</td><td>{c.phone}</td><td>{c.address}</td><td>{c.notes}</td></tr>)}</tbody>
        </table>
      </section>
    </div>
  )
}

function SettingsPage() {
  const [form, setForm] = useState<any>({ store_name: '', cnpj: '', phone: '', address: '', logo_url: '', theme: 'dark' })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const settings = await getStoreSettings()
      setForm(settings)
    }
    load()
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const user_id = await getUserId()
    if (form.id) await supabase.from('store_settings').update(form).eq('id', form.id).eq('user_id', user_id)
    else {
      const { data } = await supabase.from('store_settings').insert({ ...form, user_id }).select().single()
      if (data) setForm(data)
    }
    setSaved(true)
  }

  return (
    <form onSubmit={save} className="panel">
      <h3>Configurações da loja</h3>
      <div className="grid md:grid-cols-2 gap-4">
        <input className="input" placeholder="Nome da loja" value={form.store_name || ''} onChange={e => setForm({ ...form, store_name: e.target.value })} />
        <input className="input" placeholder="CNPJ" value={form.cnpj || ''} onChange={e => setForm({ ...form, cnpj: e.target.value })} />
        <input className="input" placeholder="Telefone" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} />
        <input className="input" placeholder="Endereço" value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} />
        <input className="input" placeholder="Logo URL" value={form.logo_url || ''} onChange={e => setForm({ ...form, logo_url: e.target.value })} />
        <select className="input" value={form.theme || 'dark'} onChange={e => setForm({ ...form, theme: e.target.value })}><option value="dark">Tema escuro</option><option value="light">Tema claro</option></select>
      </div>
      <button className="btn mt-4">Salvar</button>
      {saved && <p className="mt-3 text-sm text-emerald-300">Salvo.</p>}
    </form>
  )
}


function CustomerHistoryPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [sales, setSales] = useState<any[]>([])
  const [saleItems, setSaleItems] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [financial, setFinancial] = useState<any[]>([])
  const [returns, setReturns] = useState<any[]>([])
  const [warranties, setWarranties] = useState<any[]>([])
  const [reservations, setReservations] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  async function loadCustomers() {
    const user_id = await getUserId()
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', user_id)
      .order('name')

    setCustomers(data || [])
  }

  useEffect(() => { loadCustomers() }, [])

  async function loadHistory(customerId: string) {
    setSelectedCustomerId(customerId)
    setLoading(true)

    const user_id = await getUserId()
    const selected = customers.find(c => c.id === customerId) || null
    setCustomer(selected)

    const { data: salesData } = await supabase
      .from('sales')
      .select('*')
      .eq('user_id', user_id)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })

    const saleIds = (salesData || []).map((s: any) => s.id)

    let itemsData: any[] = []
    if (saleIds.length) {
      const { data } = await supabase
        .from('sale_items')
        .select('*, products(name, product_code, barcode)')
        .eq('user_id', user_id)
        .in('sale_id', saleIds)

      itemsData = data || []
    }

    setSales(salesData || [])
    setSaleItems(itemsData)

    // Ordens de serviço da V19. Tenta consultar service_orders; se a tabela não existir ainda, ignora sem quebrar a tela.
    try {
      const { data } = await supabase
        .from('service_orders')
        .select('*')
        .eq('user_id', user_id)
        .or(`customer_id.eq.${customerId},customer_name.ilike.%${selected?.name || ''}%`)
        .order('created_at', { ascending: false })
      setOrders(data || [])
    } catch {
      setOrders([])
    }

    const { data: finData } = await supabase
      .from('financial_entries')
      .select('*')
      .eq('user_id', user_id)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })

    setFinancial(finData || [])

    try {
      const { data } = await supabase
        .from('customer_returns')
        .select('*')
        .eq('user_id', user_id)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
      setReturns(data || [])
    } catch {
      setReturns([])
    }

    try {
      const { data } = await supabase
        .from('warranties')
        .select('*, products(name)')
        .eq('user_id', user_id)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
      setWarranties(data || [])
    } catch {
      setWarranties([])
    }

    try {
      const { data } = await supabase
        .from('product_reservations')
        .select('*, products(name)')
        .eq('user_id', user_id)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
      setReservations(data || [])
    } catch {
      setReservations([])
    }

    setLoading(false)
  }

  const validSales = sales.filter(s => s.status !== 'cancelada')
  const totalSpent = validSales.reduce((acc, s) => acc + Number(s.total || 0), 0)
  const totalProfit = validSales.reduce((acc, s) => acc + Number(s.profit || 0), 0)
  const pendingDebt = financial
    .filter(f => (f.type === 'receber' || f.type === 'fiado') && !f.paid_at)
    .reduce((acc, f) => acc + Number(f.amount || 0), 0)

  const paidTotal = financial
    .filter(f => f.paid_at)
    .reduce((acc, f) => acc + Number(f.amount || 0), 0)

  const lastPurchase = validSales.length
    ? validSales.map(s => s.created_at).sort().reverse()[0]
    : ''

  function openWhatsApp() {
    if (!customer?.phone) {
      alert('Cliente sem WhatsApp/contato cadastrado.')
      return
    }

    const phone = String(customer.phone).replace(/\D/g, '')
    const finalPhone = phone.startsWith('55') ? phone : `55${phone}`
    const msg = `Olá ${customer.name}, tudo bem? Aqui é da loja.`
    window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  function renderSaleItems(saleId: string) {
    const items = saleItems.filter(i => i.sale_id === saleId)
    if (!items.length) return <span className="text-slate-500">Sem itens vinculados.</span>

    return (
      <div className="space-y-1">
        {items.map(item => (
          <div key={item.id} className="text-xs text-slate-400">
            {item.products?.name || 'Produto'} — {item.quantity}x {money(item.unit_price)} = {money(item.total)}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <section className="panel">
        <h3>Buscar cliente</h3>
        <div className="grid md:grid-cols-3 gap-3">
          <select
            className="input md:col-span-2"
            value={selectedCustomerId}
            onChange={e => loadHistory(e.target.value)}
          >
            <option value="">Selecione um cliente</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} {c.phone ? `- ${c.phone}` : ''}
              </option>
            ))}
          </select>

          <button className="btn2" onClick={loadCustomers}>Atualizar clientes</button>
        </div>
      </section>

      {loading && <section className="panel">Carregando histórico...</section>}

      {customer && !loading && (
        <>
          <section className="panel">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h3 className="mb-1">{customer.name}</h3>
                <p className="text-sm text-slate-400">CPF/CNPJ: {customer.document || '-'}</p>
                <p className="text-sm text-slate-400">Contato: {customer.phone || '-'}</p>
                <p className="text-sm text-slate-400">Endereço: {customer.address || '-'}</p>
                <p className="text-sm text-slate-400">Obs: {customer.notes || '-'}</p>
              </div>

              <button className="btn" onClick={openWhatsApp}>
                Enviar WhatsApp
              </button>
            </div>
          </section>

          <div className="grid md:grid-cols-5 gap-4">
            <div className="card"><p className="text-slate-400">Total gasto</p><strong className="text-2xl">{money(totalSpent)}</strong></div>
            <div className="card"><p className="text-slate-400">Compras</p><strong className="text-2xl">{validSales.length}</strong></div>
            <div className="card"><p className="text-slate-400">Fiado aberto</p><strong className="text-2xl">{money(pendingDebt)}</strong></div>
            <div className="card"><p className="text-slate-400">Pagamentos</p><strong className="text-2xl">{money(paidTotal)}</strong></div>
            <div className="card"><p className="text-slate-400">Última compra</p><strong className="text-xl">{lastPurchase ? brDate(lastPurchase) : '-'}</strong></div>
          </div>

          <section className="panel">
            <h3>Todas as compras</h3>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Pagamento</th>
                  <th>Status</th>
                  <th>Itens</th>
                  <th>Total</th>
                  <th>Lucro</th>
                </tr>
              </thead>
              <tbody>
                {validSales.map(s => (
                  <tr key={s.id}>
                    <td>{new Date(s.created_at).toLocaleString('pt-BR')}</td>
                    <td>{s.payment_method || '-'}</td>
                    <td>{s.status || '-'}</td>
                    <td>{renderSaleItems(s.id)}</td>
                    <td>{money(s.total)}</td>
                    <td>{money(s.profit)}</td>
                  </tr>
                ))}
                {!validSales.length && <tr><td colSpan={6} className="text-slate-500">Nenhuma compra encontrada.</td></tr>}
              </tbody>
            </table>
          </section>

          <section className="panel">
            <h3>Ordens de serviço</h3>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição/Produto</th>
                  <th>Total</th>
                  <th>Pago</th>
                  <th>Entregue</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id}>
                    <td>{o.created_at ? new Date(o.created_at).toLocaleString('pt-BR') : '-'}</td>
                    <td>{o.product_name || o.description || o.service_description || '-'}</td>
                    <td>{money(o.total || o.total_amount || 0)}</td>
                    <td>{o.is_paid || o.paid ? <span className="tag-green">Pago</span> : <span className="tag-yellow">Pendente</span>}</td>
                    <td>{o.is_delivered || o.delivered ? <span className="tag-green">Entregue</span> : <span className="tag-yellow">Pendente</span>}</td>
                  </tr>
                ))}
                {!orders.length && <tr><td colSpan={5} className="text-slate-500">Nenhuma ordem encontrada.</td></tr>}
              </tbody>
            </table>
          </section>

          <div className="grid xl:grid-cols-2 gap-4">
            <section className="panel">
              <h3>Fiado / contas a receber</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Descrição</th>
                    <th>Vencimento</th>
                    <th>Valor</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {financial.filter(f => f.type === 'receber' || f.type === 'fiado').map(f => (
                    <tr key={f.id}>
                      <td>{new Date(f.created_at).toLocaleString('pt-BR')}</td>
                      <td>{f.description}</td>
                      <td>{f.due_date ? brDate(f.due_date) : '-'}</td>
                      <td>{money(f.amount)}</td>
                      <td>{f.paid_at ? <span className="tag-green">Pago</span> : <span className="tag-yellow">Aberto</span>}</td>
                    </tr>
                  ))}
                  {!financial.filter(f => f.type === 'receber' || f.type === 'fiado').length && <tr><td colSpan={5} className="text-slate-500">Nenhum fiado encontrado.</td></tr>}
                </tbody>
              </table>
            </section>

            <section className="panel">
              <h3>Pagamentos</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Descrição</th>
                    <th>Forma</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {financial.filter(f => f.paid_at).map(f => (
                    <tr key={f.id}>
                      <td>{new Date(f.paid_at).toLocaleString('pt-BR')}</td>
                      <td>{f.description}</td>
                      <td>{f.payment_method || '-'}</td>
                      <td>{money(f.amount)}</td>
                    </tr>
                  ))}
                  {!financial.filter(f => f.paid_at).length && <tr><td colSpan={4} className="text-slate-500">Nenhum pagamento encontrado.</td></tr>}
                </tbody>
              </table>
            </section>

            <section className="panel">
              <h3>Produtos reservados</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Produto</th>
                    <th>Qtd</th>
                    <th>Status</th>
                    <th>Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map(r => (
                    <tr key={r.id}>
                      <td>{r.created_at ? new Date(r.created_at).toLocaleString('pt-BR') : '-'}</td>
                      <td>{r.products?.name || r.product_name || '-'}</td>
                      <td>{r.quantity || '-'}</td>
                      <td>{r.status || '-'}</td>
                      <td>{r.notes || '-'}</td>
                    </tr>
                  ))}
                  {!reservations.length && <tr><td colSpan={5} className="text-slate-500">Nenhuma reserva encontrada.</td></tr>}
                </tbody>
              </table>
            </section>

            <section className="panel">
              <h3>Trocas e devoluções</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Produto</th>
                    <th>Motivo</th>
                    <th>Valor</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {returns.map(r => (
                    <tr key={r.id}>
                      <td>{r.created_at ? new Date(r.created_at).toLocaleString('pt-BR') : '-'}</td>
                      <td>{r.product_name || '-'}</td>
                      <td>{r.reason || '-'}</td>
                      <td>{money(r.amount || 0)}</td>
                      <td>{r.status || '-'}</td>
                    </tr>
                  ))}
                  {!returns.length && <tr><td colSpan={5} className="text-slate-500">Nenhuma troca/devolução encontrada.</td></tr>}
                </tbody>
              </table>
            </section>

            <section className="panel xl:col-span-2">
              <h3>Garantias</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Nº série/IMEI</th>
                    <th>Início</th>
                    <th>Fim</th>
                    <th>Status</th>
                    <th>Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {warranties.map(w => (
                    <tr key={w.id}>
                      <td>{w.products?.name || w.product_name || '-'}</td>
                      <td>{w.serial_number || w.imei || '-'}</td>
                      <td>{w.start_date ? brDate(w.start_date) : '-'}</td>
                      <td>{w.end_date ? brDate(w.end_date) : '-'}</td>
                      <td>{w.status || '-'}</td>
                      <td>{w.notes || '-'}</td>
                    </tr>
                  ))}
                  {!warranties.length && <tr><td colSpan={6} className="text-slate-500">Nenhuma garantia encontrada.</td></tr>}
                </tbody>
              </table>
            </section>
          </div>
        </>
      )}

      {!customer && !loading && (
        <section className="panel">
          <p className="text-slate-400">Selecione um cliente para visualizar o histórico completo.</p>
        </section>
      )}
    </div>
  )
}


function ServiceOrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [message, setMessage] = useState('')

  const emptyForm = {
    customer_id: '', customer_name: '', instagram: '', whatsapp: '', device: '',
    reported_defect: '', visual_condition: '', requested_service: '',
    technician: '', priority: 'Normal', estimated_deadline: '',
    estimated_value: '', final_value: '', paid_entry: '',
    payment_method: 'Pix', service_status: 'Recebido',
    internal_notes: '',
    assistance_terms: 'Estou ciente que a assistência técnica não se responsabiliza por dados pessoais que possam ser perdidos durante o reparo. Autorizo o serviço descrito acima.',
    customer_signature: '', photos: '', product_id: '', product_name: ''
  }

  const [form, setForm] = useState<any>(emptyForm)

  async function load() {
    const user_id = await getUserId()
    const { data: cs } = await supabase.from('customers').select('*').eq('user_id', user_id).order('name')
    const { data: ps } = await supabase.from('products').select('*').eq('user_id', user_id).order('name')
    const { data: os } = await supabase.from('service_orders').select('*, customers(name, phone)').eq('user_id', user_id).order('created_at', { ascending: false })
    setCustomers(cs || [])
    setProducts(ps || [])
    setOrders(os || [])
  }

  useEffect(() => { load() }, [])

  const filteredOrders = orders.filter(o => {
    const q = search.trim().toLowerCase()
    const okSearch = !q || String(o.os_number || '').includes(q) || String(o.customer_name || o.customers?.name || '').toLowerCase().includes(q) || String(o.device || '').toLowerCase().includes(q) || String(o.service_status || '').toLowerCase().includes(q)
    const okStatus = statusFilter === 'todos' || o.service_status === statusFilter
    return okSearch && okStatus
  })

  function fillCustomer(customerId: string) {
    const c = customers.find(x => x.id === customerId)
    setForm({ ...form, customer_id: customerId, customer_name: c?.name || '', whatsapp: c?.phone || form.whatsapp })
  }

  function fillProduct(productId: string) {
    const p = products.find(x => x.id === productId)
    setForm({ ...form, product_id: productId, product_name: p?.name || '', device: p?.name || form.device, estimated_value: form.estimated_value || String(p?.sale_price || ''), final_value: form.final_value || String(p?.sale_price || '') })
  }

  const finalValue = Number(form.final_value || 0)
  const paidEntry = Number(form.paid_entry || 0)
  const remaining = Math.max(0, finalValue - paidEntry)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const user_id = await getUserId()
    const payload: any = {
      user_id,
      customer_id: form.customer_id || null,
      customer_name: form.customer_name,
      instagram: form.instagram,
      whatsapp: form.whatsapp,
      device: form.device,
      reported_defect: form.reported_defect,
      visual_condition: form.visual_condition,
      requested_service: form.requested_service,
      technician: form.technician,
      priority: form.priority,
      estimated_deadline: form.estimated_deadline || null,
      estimated_value: Number(form.estimated_value || 0),
      final_value: Number(form.final_value || 0),
      paid_entry: Number(form.paid_entry || 0),
      remaining_balance: remaining,
      payment_method: form.payment_method,
      service_status: form.service_status,
      internal_notes: form.internal_notes,
      assistance_terms: form.assistance_terms,
      customer_signature: form.customer_signature,
      photos: form.photos,
      product_id: form.product_id || null,
      product_name: form.product_name || form.device,
      updated_at: new Date().toISOString()
    }

    let saved: any = null
    if (editingId) {
      const { data, error } = await supabase.from('service_orders').update(payload).eq('id', editingId).eq('user_id', user_id).select().single()
      if (error) return setMessage(error.message)
      saved = data
    } else {
      const { data, error } = await supabase.from('service_orders').insert(payload).select().single()
      if (error) return setMessage(error.message)
      saved = data
    }

    await supabase.from('financial_entries').delete().eq('user_id', user_id).eq('service_order_id', saved.id)

    if (paidEntry > 0) {
      await supabase.from('financial_entries').insert({
        user_id, customer_id: form.customer_id || null, service_order_id: saved.id,
        description: `Entrada da ${formatOSNumber(saved.os_number)}`,
        type: 'entrada', payment_method: form.payment_method, amount: paidEntry,
        paid_at: new Date().toISOString()
      })
    }

    if (remaining > 0) {
      await supabase.from('financial_entries').insert({
        user_id, customer_id: form.customer_id || null, service_order_id: saved.id,
        description: `Saldo restante da ${formatOSNumber(saved.os_number)}`,
        type: 'receber', payment_method: form.payment_method, amount: remaining,
        due_date: form.estimated_deadline || null, paid_at: null
      })
    }

    setEditingId(null)
    setForm(emptyForm)
    setMessage(editingId ? 'Ordem de serviço atualizada.' : 'Ordem de serviço criada.')
    await load()
  }

  function editOrder(order: any) {
    setEditingId(order.id)
    setForm({
      customer_id: order.customer_id || '', customer_name: order.customer_name || order.customers?.name || '',
      instagram: order.instagram || '', whatsapp: order.whatsapp || order.customers?.phone || '',
      device: order.device || '', reported_defect: order.reported_defect || '',
      visual_condition: order.visual_condition || '', requested_service: order.requested_service || '',
      technician: order.technician || '', priority: order.priority || 'Normal',
      estimated_deadline: order.estimated_deadline || '', estimated_value: String(order.estimated_value || ''),
      final_value: String(order.final_value || ''), paid_entry: String(order.paid_entry || ''),
      payment_method: order.payment_method || 'Pix', service_status: order.service_status || 'Recebido',
      internal_notes: order.internal_notes || '', assistance_terms: order.assistance_terms || emptyForm.assistance_terms,
      customer_signature: order.customer_signature || '', photos: order.photos || '',
      product_id: order.product_id || '', product_name: order.product_name || ''
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function deleteOrder(order: any) {
    if (!confirm(`Excluir ${formatOSNumber(order.os_number)}?`)) return
    const user_id = await getUserId()
    await supabase.from('financial_entries').delete().eq('user_id', user_id).eq('service_order_id', order.id)
    await supabase.from('service_orders').delete().eq('id', order.id).eq('user_id', user_id)
    await load()
  }

  async function markPaid(order: any) {
    const user_id = await getUserId()
    await supabase.from('service_orders').update({ paid_entry: Number(order.final_value || 0), remaining_balance: 0 }).eq('id', order.id).eq('user_id', user_id)
    await supabase.from('financial_entries').update({ paid_at: new Date().toISOString(), type: 'entrada' }).eq('user_id', user_id).eq('service_order_id', order.id)
    await load()
  }

  async function generatePDF(order: any) {
    const settings = await getStoreSettings()
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const w = doc.internal.pageSize.getWidth()
    let y = 12

    doc.setFillColor(15, 23, 42)
    doc.rect(0, 0, w, 34, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text(settings.store_name || 'HOMEshop Assistência Técnica', 14, 14)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`CNPJ: ${settings.cnpj || '-'}`, 14, 21)
    doc.text(`Endereço: ${settings.address || '-'}`, 14, 26)
    doc.text(`WhatsApp: ${settings.phone || order.whatsapp || '-'}`, 14, 31)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('ORDEM DE SERVIÇO', w - 14, 15, { align: 'right' })
    doc.setTextColor(220, 38, 38)
    doc.text(`Nº ${formatOSNumber(order.os_number)}`, w - 14, 25, { align: 'right' })

    y = 42
    doc.setTextColor(15, 23, 42)

    function section(title: string) {
      doc.setFillColor(241, 245, 249)
      doc.setDrawColor(203, 213, 225)
      doc.rect(14, y, w - 28, 8, 'FD')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.text(title, 17, y + 5.5)
      y += 10
    }

    function row(label: string, value: any) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.text(label, 16, y + 4)
      doc.setFont('helvetica', 'normal')
      const text = doc.splitTextToSize(String(value || '-'), w - 70)
      doc.text(text, 58, y + 4)
      y += Math.max(7, text.length * 4)
    }

    section('DADOS DO CLIENTE')
    row('Cliente:', order.customer_name || order.customers?.name)
    row('Instagram:', order.instagram)
    row('WhatsApp:', order.whatsapp)
    row('Data/Hora:', new Date(order.created_at).toLocaleString('pt-BR'))

    section('DADOS DO APARELHO')
    row('Aparelho:', order.device)
    row('Defeito relatado:', order.reported_defect)
    row('Condição visual:', order.visual_condition)
    row('Serviço solicitado:', order.requested_service)

    section('DETALHES DO SERVIÇO')
    row('Técnico:', order.technician)
    row('Prioridade:', order.priority)
    row('Prazo estimado:', order.estimated_deadline ? brDate(order.estimated_deadline) : '-')
    row('Status:', order.service_status)
    row('Observações internas:', order.internal_notes)

    section('FINANCEIRO')
    row('Valor estimado:', money(order.estimated_value || 0))
    row('Valor final:', money(order.final_value || 0))
    row('Entrada paga:', money(order.paid_entry || 0))
    row('Saldo restante:', money(order.remaining_balance || 0))
    row('Forma de pagamento:', order.payment_method)
    row('Pix:', '41-98464-8144 — Abquella Carmo de Lima — Banco Itaú')

    section('TERMOS DA ASSISTÊNCIA')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    const terms = doc.splitTextToSize(order.assistance_terms || '-', w - 32)
    doc.text(terms, 16, y)
    y += Math.max(18, terms.length * 4 + 6)

    section('FOTOS ANEXADAS')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    const photos = doc.splitTextToSize(order.photos || 'Nenhuma foto anexada.', w - 32)
    doc.text(photos, 16, y)
    y += Math.max(12, photos.length * 4 + 6)

    if (y > 250) {
      doc.addPage()
      y = 18
    }

    section('ASSINATURA DO CLIENTE')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(order.customer_signature || '________________________________________', 30, y + 10)
    doc.setFontSize(8)
    doc.text('Assinatura do cliente', 55, y + 16)
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 150, y + 16)
    doc.setFontSize(8)
    doc.setTextColor(100)
    doc.text('Documento gerado pelo Sistema Bazar & Eletrônicos', 14, 287)
    doc.save(`${formatOSNumber(order.os_number)}.pdf`)
  }

  function sendWhatsapp(order: any) {
    const msg = `Olá ${order.customer_name || ''}, segue sua Ordem de Serviço ${formatOSNumber(order.os_number)}.\n\nAparelho: ${order.device || '-'}\nServiço: ${order.requested_service || '-'}\nStatus: ${order.service_status || '-'}\nValor final: ${money(order.final_value || 0)}\nEntrada paga: ${money(order.paid_entry || 0)}\nSaldo restante: ${money(order.remaining_balance || 0)}\n\nPix: 41-98464-8144\nAbquella Carmo de Lima\nBanco Itaú`
    openWhatsappNumber(order.whatsapp, msg)
  }

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="panel">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3>{editingId ? 'Alterar Ordem de Serviço' : 'Nova Ordem de Serviço'}</h3>
          {editingId && <button type="button" className="btn2" onClick={() => { setEditingId(null); setForm(emptyForm) }}>Cancelar edição</button>}
        </div>

        <div className="grid md:grid-cols-4 gap-3">
          <div><label className="label">Cliente cadastrado</label><select className="input" value={form.customer_id} onChange={e => fillCustomer(e.target.value)}><option value="">Selecione ou preencha manual</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><label className="label">Nome do cliente</label><input className="input" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} required /></div>
          <div><label className="label">Instagram</label><input className="input" placeholder="@cliente" value={form.instagram} onChange={e => setForm({ ...form, instagram: e.target.value })} /></div>
          <div><label className="label">WhatsApp</label><input className="input" placeholder="(41) 99999-9999" value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} /></div>

          <div><label className="label">Produto/aparelho cadastrado</label><select className="input" value={form.product_id} onChange={e => fillProduct(e.target.value)}><option value="">Selecione se existir</option>{products.map(p => <option key={p.id} value={p.id}>{p.name} - {money(p.sale_price || 0)}</option>)}</select></div>
          <div><label className="label">Aparelho</label><input className="input" placeholder="Ex: iPhone 11, Samsung A32" value={form.device} onChange={e => setForm({ ...form, device: e.target.value })} required /></div>
          <div><label className="label">Técnico responsável</label><input className="input" placeholder="Nome do técnico" value={form.technician} onChange={e => setForm({ ...form, technician: e.target.value })} /></div>
          <div><label className="label">Prioridade</label><select className="input" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}><option>Baixa</option><option>Normal</option><option>Alta</option><option>Urgente</option></select></div>

          <div className="md:col-span-2"><label className="label">Defeito relatado pelo cliente</label><input className="input" placeholder="Ex: tela trincada, não carrega, não liga" value={form.reported_defect} onChange={e => setForm({ ...form, reported_defect: e.target.value })} /></div>
          <div className="md:col-span-2"><label className="label">Condição visual do aparelho</label><input className="input" placeholder="Ex: riscos, tampa quebrada, sem marcas" value={form.visual_condition} onChange={e => setForm({ ...form, visual_condition: e.target.value })} /></div>
          <div className="md:col-span-2"><label className="label">Serviço solicitado</label><input className="input" placeholder="Ex: troca de tela, troca de bateria" value={form.requested_service} onChange={e => setForm({ ...form, requested_service: e.target.value })} /></div>
          <div><label className="label">Prazo estimado</label><input className="input" type="date" value={form.estimated_deadline} onChange={e => setForm({ ...form, estimated_deadline: e.target.value })} /></div>
          <div><label className="label">Status do serviço</label><select className="input" value={form.service_status} onChange={e => setForm({ ...form, service_status: e.target.value })}><option>Recebido</option><option>Em análise</option><option>Aguardando peça</option><option>Em manutenção</option><option>Pronto</option><option>Entregue</option><option>Cancelado</option></select></div>

          <div><label className="label">Valor estimado</label><input className="input" type="number" step="0.01" value={form.estimated_value} onChange={e => setForm({ ...form, estimated_value: e.target.value })} /></div>
          <div><label className="label">Valor final</label><input className="input" type="number" step="0.01" value={form.final_value} onChange={e => setForm({ ...form, final_value: e.target.value })} /></div>
          <div><label className="label">Entrada paga</label><input className="input" type="number" step="0.01" value={form.paid_entry} onChange={e => setForm({ ...form, paid_entry: e.target.value })} /></div>
          <div><label className="label">Saldo restante</label><input className="input" value={money(remaining)} disabled /></div>
          <div><label className="label">Forma de pagamento</label><select className="input" value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })}><option>Pix</option><option>Dinheiro</option><option>Cartão débito</option><option>Cartão crédito</option><option>Fiado</option></select></div>

          <div className="md:col-span-2"><label className="label">Observações internas</label><textarea className="input min-h-[90px]" value={form.internal_notes} onChange={e => setForm({ ...form, internal_notes: e.target.value })} /></div>
          <div className="md:col-span-2"><label className="label">Fotos anexadas</label><textarea className="input min-h-[90px]" placeholder="Cole links das fotos ou nomes dos arquivos separados por linha" value={form.photos} onChange={e => setForm({ ...form, photos: e.target.value })} /></div>
          <div className="md:col-span-3"><label className="label">Termos da assistência</label><textarea className="input min-h-[110px]" value={form.assistance_terms} onChange={e => setForm({ ...form, assistance_terms: e.target.value })} /></div>
          <div><label className="label">Assinatura do cliente</label><textarea className="input min-h-[110px]" placeholder="Digite o nome ou assinatura manual" value={form.customer_signature} onChange={e => setForm({ ...form, customer_signature: e.target.value })} /></div>
        </div>

        <button className="btn mt-4">{editingId ? 'Salvar alterações' : 'Criar ordem de serviço'}</button>
        {message && <p className="mini mt-4">{message}</p>}
      </form>

      <section className="panel">
        <h3>Consultar ordens de serviço</h3>
        <div className="grid md:grid-cols-4 gap-3 mb-4">
          <input className="input md:col-span-2" placeholder="Buscar por OS, cliente, aparelho ou status" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="todos">Todos os status</option><option>Recebido</option><option>Em análise</option><option>Aguardando peça</option><option>Em manutenção</option><option>Pronto</option><option>Entregue</option><option>Cancelado</option></select>
          <button className="btn2" onClick={load}>Atualizar</button>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead><tr><th>OS</th><th>Entrada</th><th>Cliente</th><th>Aparelho</th><th>Técnico</th><th>Prioridade</th><th>Status</th><th>Final</th><th>Saldo</th><th>Ações</th></tr></thead>
            <tbody>
              {filteredOrders.map(o => (
                <tr key={o.id}>
                  <td>{formatOSNumber(o.os_number)}</td><td>{new Date(o.created_at).toLocaleString('pt-BR')}</td><td>{o.customer_name || o.customers?.name || '-'}</td><td>{o.device}</td><td>{o.technician || '-'}</td><td>{o.priority}</td><td>{o.service_status}</td><td>{money(o.final_value || 0)}</td><td>{money(o.remaining_balance || 0)}</td>
                  <td className="space-x-2 whitespace-nowrap"><button className="btn2" onClick={() => generatePDF(o)}>PDF</button><button className="btn2" onClick={() => sendWhatsapp(o)}>WhatsApp</button><button className="btn2" onClick={() => editOrder(o)}>Alterar</button>{Number(o.remaining_balance || 0) > 0 && <button className="btn2" onClick={() => markPaid(o)}>Pago</button>}<button className="btn-danger" onClick={() => deleteOrder(o)}>Excluir</button></td>
                </tr>
              ))}
              {!filteredOrders.length && <tr><td colSpan={10} className="text-slate-500">Nenhuma ordem encontrada.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function App() {
  const [session, setSession] = useState<any>(null)
  const [page, setPage] = useState<Page>('dashboard')
  const [menuCollapsed, setMenuCollapsed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => listener.subscription.unsubscribe()
  }, [])

  if (loading) return <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Carregando...</main>
  if (!session) return <Login />

  const titles: Record<Page, string> = {
    dashboard: 'Dashboard',
    caixa: 'Caixa',
    pdv: 'PDV',
    ordens: 'Ordens de Serviço',
    financeiro: 'Financeiro',
    relatorios: 'Relatórios',
    produtos: 'Produtos',
    clientes: 'Clientes',
    ordens_servico: 'Ordens de Serviço',
    historico_cliente: 'Histórico do Cliente',
    configuracoes: 'Configurações'
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar page={page} setPage={setPage} collapsed={menuCollapsed} setCollapsed={setMenuCollapsed} />
      <main className="flex-1 min-w-0">
        <Header title={titles[page]} />
        <div className="p-6">
          {page === 'dashboard' && <Dashboard />}
          {page === 'caixa' && <CashPage />}
          {page === 'pdv' && <PDVPage />}
          {page === 'ordens' && <ServiceOrdersPage />}
          {page === 'financeiro' && <FinancePage />}
          {page === 'relatorios' && <ReportsPage />}
          {page === 'produtos' && <ProductsPage />}
          {page === 'clientes' && <CustomersPage />}
          {page === 'ordens_servico' && <ServiceOrdersPage />}
          {page === 'historico_cliente' && <CustomerHistoryPage />}
          {page === 'configuracoes' && <SettingsPage />}
        </div>
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
