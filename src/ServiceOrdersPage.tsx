import React, { useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import { CheckCircle2, FileText, MessageCircle, Plus, Trash2 } from 'lucide-react'
import { supabase } from './lib/supabase'

type Product = {
  id: string
  name: string
  product_code: string | null
  sale_price: number
}

type OrderItemDraft = {
  product_id: string
  product_name: string
  product_code: string
  quantity: number
  unit_price: number
  total: number
}

type SavedOrderItem = {
  id: string
  product_id: string | null
  product_name: string
  product_code: string | null
  quantity: number
  unit_price: number
  total: number
  products?: { name?: string; product_code?: string } | null
}

type ServiceOrder = {
  id: string
  customer_name: string
  instagram: string | null
  whatsapp: string | null
  order_date: string
  payment_method: string
  payment_status: string
  paid_at: string | null
  delivered: boolean
  delivered_at: string | null
  subtotal: number
  total: number
  notes: string | null
  pix_key: string
  pix_holder: string
  pix_bank: string
  created_at: string
  service_order_items?: SavedOrderItem[]
}

const PIX_KEY = '41-98464-8144'
const PIX_HOLDER = 'Abquella Carmo de Lima'
const PIX_BANK = 'Banco Itaú'

function money(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function brDate(value: string) {
  if (!value) return '-'
  return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR')
}

async function getUserId() {
  const { data } = await supabase.auth.getUser()
  return data.user?.id || ''
}

async function getStoreSettings() {
  const user_id = await getUserId()
  const { data } = await supabase
    .from('store_settings')
    .select('*')
    .eq('user_id', user_id)
    .limit(1)
    .maybeSingle()

  return data || {
    store_name: 'HOMEshop',
    cnpj: '',
    phone: '',
    address: ''
  }
}

function normalizarItens(order: ServiceOrder): OrderItemDraft[] {
  return (order.service_order_items || []).map(item => ({
    product_id: item.product_id || '',
    product_name: item.product_name || item.products?.name || 'Produto',
    product_code: item.product_code || item.products?.product_code || '',
    quantity: Number(item.quantity || 0),
    unit_price: Number(item.unit_price || 0),
    total: Number(item.total || 0)
  }))
}

async function gerarOrdemServicoPDF(order: ServiceOrder, items: OrderItemDraft[]) {
  const settings = await getStoreSettings()
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const left = 15
  const right = pageWidth - 15

  doc.setDrawColor(120)
  doc.setTextColor(45, 45, 45)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text(settings.store_name || 'HOMEshop', pageWidth / 2, 20, { align: 'center' })
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('ORDEM DE SERVIÇO / PEDIDO', pageWidth / 2, 27, { align: 'center' })

  if (settings.cnpj) doc.text(`CNPJ: ${settings.cnpj}`, pageWidth / 2, 33, { align: 'center' })
  if (settings.phone || settings.address) {
    doc.text([settings.phone, settings.address].filter(Boolean).join(' • '), pageWidth / 2, 38, { align: 'center' })
  }

  doc.setFillColor(238, 238, 238)
  doc.roundedRect(left, 45, right - left, 30, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(`NOME: ${order.customer_name.toUpperCase()}`, left + 5, 55)
  doc.text(`INSTAGRAM: ${order.instagram || '-'}`, left + 5, 63)
  doc.text(`WHATSAPP: ${order.whatsapp || '-'}`, 105, 63)
  doc.text(`DATA: ${brDate(order.order_date)}`, left + 5, 71)

  const tableTop = 82
  const rowHeight = 10
  const xQty = left
  const xDesc = 35
  const xUnit = 135
  const xTotal = 165

  doc.setFillColor(225, 225, 225)
  doc.rect(left, tableTop, right - left, rowHeight, 'F')
  doc.rect(left, tableTop, right - left, rowHeight)
  doc.line(xDesc, tableTop, xDesc, tableTop + rowHeight)
  doc.line(xUnit, tableTop, xUnit, tableTop + rowHeight)
  doc.line(xTotal, tableTop, xTotal, tableTop + rowHeight)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('QTD', 25, tableTop + 6, { align: 'center' })
  doc.text('DESCRIÇÃO PRODUTOS', 85, tableTop + 6, { align: 'center' })
  doc.text('V.UNIT', 150, tableTop + 6, { align: 'center' })
  doc.text('TOTAL', 180, tableTop + 6, { align: 'center' })

  const rows = Math.max(10, items.length)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)

  for (let i = 0; i < rows; i += 1) {
    const y = tableTop + rowHeight + i * rowHeight
    doc.rect(left, y, right - left, rowHeight)
    doc.line(xDesc, y, xDesc, y + rowHeight)
    doc.line(xUnit, y, xUnit, y + rowHeight)
    doc.line(xTotal, y, xTotal, y + rowHeight)

    const item = items[i]
    if (item) {
      doc.text(String(item.quantity), 25, y + 6, { align: 'center' })
      const descricao = item.product_code
        ? `${item.product_name} (${item.product_code})`
        : item.product_name
      doc.text(descricao.slice(0, 52), 85, y + 6, { align: 'center' })
      doc.text(money(item.unit_price), 150, y + 6, { align: 'center' })
      doc.text(money(item.total), 180, y + 6, { align: 'center' })
    }
  }

  const bottom = tableTop + rowHeight + rows * rowHeight
  doc.setFillColor(225, 225, 225)
  doc.rect(135, bottom, right - 135, 14, 'F')
  doc.rect(135, bottom, right - 135, 14)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('TOTAL R$', 130, bottom + 9, { align: 'right' })
  doc.text(money(order.total), 140, bottom + 9)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`PIX: ${order.pix_key || PIX_KEY}`, left, bottom + 8)
  doc.text(order.pix_holder || PIX_HOLDER, left, bottom + 14)
  doc.text(order.pix_bank || PIX_BANK, left, bottom + 20)

  const checkY = bottom + 28
  doc.rect(left, checkY, 5, 5)
  if (order.payment_status === 'pago') {
    doc.setFont('helvetica', 'bold')
    doc.text('X', left + 1.2, checkY + 4)
  }
  doc.setFont('helvetica', 'normal')
  doc.text('Pago', left + 8, checkY + 4)

  doc.rect(left, checkY + 10, 5, 5)
  if (order.delivered) {
    doc.setFont('helvetica', 'bold')
    doc.text('X', left + 1.2, checkY + 14)
  }
  doc.setFont('helvetica', 'normal')
  doc.text('Entregue', left + 8, checkY + 14)

  doc.text(`Forma de Pagamento: ${order.payment_method || 'Pix'}`, 65, checkY + 4)
  doc.line(103, checkY + 5, right, checkY + 5)

  if (order.notes) {
    doc.setFontSize(8)
    doc.text(`Observações: ${order.notes}`.slice(0, 120), left, checkY + 24)
  }

  doc.setFontSize(7)
  doc.setTextColor(110)
  doc.text(`Ordem: ${order.id.slice(0, 8).toUpperCase()} • Gerada em ${new Date().toLocaleString('pt-BR')}`, left, 290)

  doc.save(`ordem-servico-${order.id.slice(0, 8)}.pdf`)
}

export default function ServiceOrdersPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<ServiceOrder[]>([])
  const [customerName, setCustomerName] = useState('')
  const [instagram, setInstagram] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10))
  const [paymentMethod, setPaymentMethod] = useState('Pix')
  const [notes, setNotes] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitPrice, setUnitPrice] = useState('')
  const [items, setItems] = useState<OrderItemDraft[]>([])
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [statusFilter, setStatusFilter] = useState('todos')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function load() {
    const user_id = await getUserId()

    const { data: productsData } = await supabase
      .from('products')
      .select('id, name, product_code, sale_price')
      .eq('user_id', user_id)
      .order('name')

    const { data: ordersData, error } = await supabase
      .from('service_orders')
      .select('*, service_order_items(*, products(name, product_code))')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })

    if (error) setMessage(error.message)
    setProducts((productsData || []) as Product[])
    setOrders((ordersData || []) as ServiceOrder[])
  }

  useEffect(() => { load() }, [])

  const subtotal = items.reduce((sum, item) => sum + item.total, 0)
  const total = subtotal

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const sameMonth = String(order.order_date || '').slice(0, 7) === month
      const sameStatus = statusFilter === 'todos' || order.payment_status === statusFilter
      return sameMonth && sameStatus
    })
  }, [orders, month, statusFilter])

  function selectProduct(productId: string) {
    setSelectedProductId(productId)
    const product = products.find(item => item.id === productId)
    setUnitPrice(product ? String(Number(product.sale_price || 0)) : '')
  }

  function addItem() {
    const product = products.find(item => item.id === selectedProductId)
    const qtd = Number(quantity || 0)
    const price = Number(unitPrice || 0)

    if (!product || qtd <= 0) {
      setMessage('Selecione um produto e informe uma quantidade válida.')
      return
    }

    setItems(current => [
      ...current,
      {
        product_id: product.id,
        product_name: product.name,
        product_code: product.product_code || '',
        quantity: qtd,
        unit_price: price,
        total: qtd * price
      }
    ])

    setSelectedProductId('')
    setQuantity('1')
    setUnitPrice('')
    setMessage('')
  }

  async function createOrder() {
    if (!customerName.trim()) {
      setMessage('Informe o nome da cliente.')
      return
    }

    if (!items.length) {
      setMessage('Adicione pelo menos um produto.')
      return
    }

    setLoading(true)
    setMessage('')
    const user_id = await getUserId()

    const { data: order, error } = await supabase
      .from('service_orders')
      .insert({
        user_id,
        customer_name: customerName.trim(),
        instagram: instagram.trim() || null,
        whatsapp: whatsapp.trim() || null,
        order_date: orderDate,
        payment_method: paymentMethod,
        payment_status: 'pendente',
        delivered: false,
        subtotal,
        total,
        notes: notes.trim() || null,
        pix_key: PIX_KEY,
        pix_holder: PIX_HOLDER,
        pix_bank: PIX_BANK
      })
      .select()
      .single()

    if (error || !order) {
      setMessage(error?.message || 'Não foi possível criar a ordem.')
      setLoading(false)
      return
    }

    const itemsPayload = items.map(item => ({
      user_id,
      service_order_id: order.id,
      product_id: item.product_id,
      product_name: item.product_name,
      product_code: item.product_code || null,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.total
    }))

    const { error: itemsError } = await supabase.from('service_order_items').insert(itemsPayload)

    if (itemsError) {
      setMessage(itemsError.message)
      setLoading(false)
      return
    }

    const { error: financeError } = await supabase.from('financial_entries').insert({
      user_id,
      service_order_id: order.id,
      description: `Ordem de serviço ${order.id.slice(0, 8)} - ${customerName.trim()}`,
      type: 'receber',
      payment_method: paymentMethod,
      amount: total,
      due_date: orderDate,
      paid_at: null
    })

    if (financeError) {
      setMessage(`Ordem criada, mas houve erro no financeiro: ${financeError.message}`)
    } else {
      setMessage('Ordem criada, financeiro sincronizado e PDF gerado.')
    }

    await gerarOrdemServicoPDF(order as ServiceOrder, items)

    setCustomerName('')
    setInstagram('')
    setWhatsapp('')
    setOrderDate(new Date().toISOString().slice(0, 10))
    setPaymentMethod('Pix')
    setNotes('')
    setItems([])
    setLoading(false)
    await load()
  }

  async function setPaid(order: ServiceOrder, paid: boolean) {
    const user_id = await getUserId()
    const paidAt = paid ? new Date().toISOString() : null

    let cashSessionId: string | null = null
    if (paid) {
      const { data: cash } = await supabase
        .from('cash_sessions')
        .select('id')
        .eq('user_id', user_id)
        .eq('status', 'aberto')
        .maybeSingle()
      cashSessionId = cash?.id || null
    }

    const { error } = await supabase
      .from('service_orders')
      .update({ payment_status: paid ? 'pago' : 'pendente', paid_at: paidAt })
      .eq('id', order.id)
      .eq('user_id', user_id)

    if (error) {
      setMessage(error.message)
      return
    }

    const { data: existing } = await supabase
      .from('financial_entries')
      .select('id')
      .eq('user_id', user_id)
      .eq('service_order_id', order.id)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('financial_entries')
        .update({
          type: paid ? 'entrada' : 'receber',
          paid_at: paidAt,
          payment_method: order.payment_method,
          cash_session_id: paid ? cashSessionId : null
        })
        .eq('id', existing.id)
        .eq('user_id', user_id)
    } else {
      await supabase.from('financial_entries').insert({
        user_id,
        service_order_id: order.id,
        description: `Ordem de serviço ${order.id.slice(0, 8)} - ${order.customer_name}`,
        type: paid ? 'entrada' : 'receber',
        payment_method: order.payment_method,
        amount: order.total,
        due_date: order.order_date,
        paid_at: paidAt,
        cash_session_id: paid ? cashSessionId : null
      })
    }

    setMessage(paid ? 'Pagamento confirmado e lançado no financeiro.' : 'Pagamento voltou para pendente.')
    await load()
  }

  async function toggleDelivered(order: ServiceOrder) {
    const user_id = await getUserId()
    const delivered = !order.delivered
    await supabase
      .from('service_orders')
      .update({ delivered, delivered_at: delivered ? new Date().toISOString() : null })
      .eq('id', order.id)
      .eq('user_id', user_id)
    await load()
  }

  function sendWhatsApp(order: ServiceOrder) {
    const digits = String(order.whatsapp || '').replace(/\D/g, '')
    if (!digits) {
      setMessage('Essa ordem não possui WhatsApp cadastrado.')
      return
    }

    const phone = digits.startsWith('55') ? digits : `55${digits}`
    const text = [
      `Olá, ${order.customer_name}!`,
      `Sua ordem de serviço nº ${order.id.slice(0, 8).toUpperCase()} foi registrada.`,
      `Total: ${money(order.total)}`,
      `Pagamento: ${order.payment_method}`,
      `PIX: ${order.pix_key || PIX_KEY}`,
      `${order.pix_holder || PIX_HOLDER} - ${order.pix_bank || PIX_BANK}`,
      order.payment_status === 'pago' ? 'Pagamento confirmado.' : 'Pagamento pendente.'
    ].join('\n')

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }

  async function printSavedOrder(order: ServiceOrder) {
    await gerarOrdemServicoPDF(order, normalizarItens(order))
  }

  const pendingTotal = filteredOrders
    .filter(order => order.payment_status !== 'pago')
    .reduce((sum, order) => sum + Number(order.total || 0), 0)

  const paidTotal = filteredOrders
    .filter(order => order.payment_status === 'pago')
    .reduce((sum, order) => sum + Number(order.total || 0), 0)

  return (
    <div className="space-y-4">
      <section className="panel">
        <h3>Nova ordem de serviço</h3>
        <div className="grid md:grid-cols-4 gap-3">
          <div>
            <label className="label">Nome da cliente</label>
            <input className="input" placeholder="Ex: Bispa Rafa" value={customerName} onChange={e => setCustomerName(e.target.value)} />
          </div>
          <div>
            <label className="label">Instagram</label>
            <input className="input" placeholder="Ex: @cliente" value={instagram} onChange={e => setInstagram(e.target.value)} />
          </div>
          <div>
            <label className="label">WhatsApp</label>
            <input className="input" placeholder="Ex: (41) 99999-9999" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
          </div>
          <div>
            <label className="label">Data</label>
            <input className="input" type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
          </div>
        </div>

        <div className="grid md:grid-cols-5 gap-3 mt-4">
          <div className="md:col-span-2">
            <label className="label">Produto</label>
            <select className="input" value={selectedProductId} onChange={e => selectProduct(e.target.value)}>
              <option value="">Selecione um produto</option>
              {products.map(product => (
                <option key={product.id} value={product.id}>{product.name} — {money(product.sale_price)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Quantidade</label>
            <input className="input" type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} />
          </div>
          <div>
            <label className="label">Valor unitário</label>
            <input className="input" type="number" step="0.01" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} />
          </div>
          <button className="btn self-end flex items-center justify-center gap-2" type="button" onClick={addItem}><Plus size={16}/>Adicionar</button>
        </div>

        <div className="overflow-auto mt-5">
          <table className="w-full text-sm">
            <thead><tr><th>Qtd</th><th>Descrição</th><th>Valor unitário</th><th>Total</th><th></th></tr></thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={`${item.product_id}-${index}`}>
                  <td>{item.quantity}</td>
                  <td>{item.product_name}</td>
                  <td>{money(item.unit_price)}</td>
                  <td>{money(item.total)}</td>
                  <td><button className="btn-danger" type="button" onClick={() => setItems(current => current.filter((_, i) => i !== index))}><Trash2 size={14}/></button></td>
                </tr>
              ))}
              {!items.length && <tr><td colSpan={5} className="text-slate-500">Nenhum produto adicionado.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="grid md:grid-cols-4 gap-3 mt-5">
          <div>
            <label className="label">Forma de pagamento</label>
            <select className="input" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
              <option>Pix</option><option>Dinheiro</option><option>Cartão débito</option><option>Cartão crédito</option><option>Fiado</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label">Observações</label>
            <input className="input" placeholder="Observações da ordem" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <div className="mini">Total da ordem<br/><b className="text-2xl text-emerald-300">{money(total)}</b></div>
        </div>

        <div className="mini mt-4 text-sm">
          <b>PIX:</b> {PIX_KEY} — {PIX_HOLDER} — {PIX_BANK}
        </div>

        <button className="btn mt-4 w-full flex items-center justify-center gap-2" type="button" onClick={createOrder} disabled={loading}>
          <FileText size={18}/>{loading ? 'Salvando...' : 'Criar ordem e gerar PDF'}
        </button>
        {message && <p className="mini mt-4">{message}</p>}
      </section>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="card"><p className="text-slate-400">Ordens no mês</p><strong className="text-2xl">{filteredOrders.length}</strong></div>
        <div className="card"><p className="text-slate-400">Pago</p><strong className="text-2xl text-emerald-300">{money(paidTotal)}</strong></div>
        <div className="card"><p className="text-slate-400">A receber</p><strong className="text-2xl text-yellow-300">{money(pendingTotal)}</strong></div>
      </div>

      <section className="panel">
        <h3>Histórico de ordens</h3>
        <div className="grid md:grid-cols-3 gap-3 mb-4">
          <div><label className="label">Mês</label><input className="input" type="month" value={month} onChange={e => setMonth(e.target.value)} /></div>
          <div><label className="label">Pagamento</label><select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="todos">Todos</option><option value="pendente">Pendente</option><option value="pago">Pago</option></select></div>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead><tr><th>Data</th><th>Cliente</th><th>Contato</th><th>Total</th><th>Pagamento</th><th>Entrega</th><th>Ações</th></tr></thead>
            <tbody>
              {filteredOrders.map(order => (
                <tr key={order.id}>
                  <td>{brDate(order.order_date)}</td>
                  <td><b>{order.customer_name}</b><br/><span className="text-xs text-slate-500">{order.instagram || ''}</span></td>
                  <td>{order.whatsapp || '-'}</td>
                  <td>{money(order.total)}</td>
                  <td>{order.payment_status === 'pago' ? <span className="tag-green">Pago</span> : <span className="tag-yellow">Pendente</span>}</td>
                  <td>{order.delivered ? <span className="tag-green">Entregue</span> : <span className="tag-yellow">Pendente</span>}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <button className="btn2" type="button" onClick={() => printSavedOrder(order)}>PDF</button>
                      <button className="btn2 flex items-center gap-1" type="button" onClick={() => sendWhatsApp(order)}><MessageCircle size={14}/>WhatsApp</button>
                      <button className={order.payment_status === 'pago' ? 'btn-danger' : 'btn'} type="button" onClick={() => setPaid(order, order.payment_status !== 'pago')}>
                        {order.payment_status === 'pago' ? 'Marcar não pago' : 'Confirmar pagamento'}
                      </button>
                      <button className="btn2 flex items-center gap-1" type="button" onClick={() => toggleDelivered(order)}><CheckCircle2 size={14}/>{order.delivered ? 'Não entregue' : 'Entregue'}</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredOrders.length && <tr><td colSpan={7} className="text-slate-500">Nenhuma ordem encontrada.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
