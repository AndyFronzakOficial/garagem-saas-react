import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import jsPDF from 'jspdf'
import { brNumber, money } from '../lib/utils'

// Retorna a data de hoje no formato aceito pelo input date e pelo Supabase.
function today(){ return new Date().toISOString().slice(0,10) }

// Retorna o mês atual no formato YYYY-MM para o filtro mensal do financeiro.
function currentMonth(){ return new Date().toISOString().slice(0,7) }

// Calcula o primeiro e o último dia do mês selecionado no filtro.
function monthRange(ym:string){
  const [y,m]=ym.split('-').map(Number)
  return {start:`${ym}-01`,end:new Date(y,m,0).toISOString().slice(0,10)}
}

// Formata datas gravadas no banco para exibição em pt-BR.
function brDate(v?:string|null){
  if(!v) return '-'
  const [y,m,d]=String(v).slice(0,10).split('-')
  if(!y || !m || !d) return '-'
  return `${d}/${m}/${y}`
}

// Soma segura: evita NaN quando o valor vem vazio, nulo ou com vírgula.
function amount(v:any){ return brNumber(v) }

// Calcula quanto falta pagar/receber em um lançamento.
function pendingAmount(row:any){
  return Math.max(amount(row.amount) - amount(row.paid_amount),0)
}

// Retorna o nome do cliente ligado ao lançamento ou à ordem de serviço.
function clientName(row:any){
  return row.clients?.company || row.clients?.name || row.service_orders?.clients?.company || row.service_orders?.clients?.name || '-'
}

// Retorna o número da OS vinculada ao lançamento financeiro.
function orderNumber(row:any){
  return row.service_orders?.os_number || row.os_number || '-'
}

// Define status automático considerando valor total, valor já pago e vencimento.
function autoStatus(type:'receber'|'pagar', total:number, paid:number, dueDate:string){
  if(total > 0 && paid >= total) return type === 'receber' ? 'Recebido' : 'Paga'
  if(dueDate && dueDate < today()) return type === 'receber' ? 'Vencido' : 'Vencida'
  return type === 'receber' ? 'Aberto' : 'A pagar'
}

// Estado inicial do formulário de cadastro/edição do financeiro.
const emptyForm = {
  title:'',
  supplier:'',
  client_id:'',
  service_order_id:'',
  amount:'',
  paid_amount:'',
  due_date:today(),
  recurring:false
}

type FinanceTab = 'receber'|'pagar'|'fluxo'|'custos'|'relatorio'

type EntryType = 'receber'|'pagar'

export default function Finance(){
  const [tab,setTab]=useState<FinanceTab>('receber')
  const [period,setPeriod]=useState(currentMonth())
  const [receber,setReceber]=useState<any[]>([])
  const [pagar,setPagar]=useState<any[]>([])
  const [clients,setClients]=useState<any[]>([])
  const [orders,setOrders]=useState<any[]>([])
  const [form,setForm]=useState<any>(emptyForm)
  const [editingEntry,setEditingEntry]=useState<{id:string,type:EntryType}|null>(null)
  const [costEdit,setCostEdit]=useState<Record<string,any>>({})
  const [msg,setMsg]=useState('')

  useEffect(()=>{load()},[period])

  // Ao mudar entre receber/pagar, limpa a edição para evitar salvar na aba errada.
  useEffect(()=>{
    if(tab === 'receber' || tab === 'pagar'){
      setEditingEntry(null)
      setForm(emptyForm)
      setMsg('')
    }
  },[tab])

  async function load(){
    const {start,end}=monthRange(period)

    // Carrega todos os dados necessários para contas, clientes, OS, custos e relatório.
    const [r,p,c,o]=await Promise.all([
      supabase
        .from('accounts_receivable')
        .select('*,clients(*),service_orders(*)')
        .gte('due_date',start)
        .lte('due_date',end)
        .order('due_date',{ascending:true}),
      supabase
        .from('accounts_payable')
        .select('*,clients(*),service_orders(*,clients(*))')
        .gte('due_date',start)
        .lte('due_date',end)
        .order('due_date',{ascending:true}),
      supabase
        .from('clients')
        .select('*')
        .order('name',{ascending:true}),
      supabase
        .from('service_orders')
        .select('*,clients(*)')
        .order('created_at',{ascending:false})
    ])

    if(r.error) setMsg('Erro ao carregar contas a receber: '+r.error.message)
    if(p.error) setMsg('Erro ao carregar contas a pagar: '+p.error.message)

    setReceber((r.data||[]).filter((x:any)=>!x.is_deleted))
    setPagar((p.data||[]).filter((x:any)=>!x.is_deleted))
    setClients(c.data||[])
    setOrders((o.data||[]).filter((x:any)=>!x.is_deleted))
  }

  // Ao escolher uma OS, o sistema preenche cliente, título e valor de referência automaticamente.
  function handleOrderChange(service_order_id:string){
    const selected = orders.find(o=>o.id === service_order_id)

    setForm((prev:any)=>({
      ...prev,
      service_order_id,
      client_id:selected?.client_id || prev.client_id || '',
      title:prev.title || (selected ? `${selected.os_number} - ${selected.service || 'Ordem de serviço'}` : ''),
      amount:prev.amount || (selected?.estimated_price ? String(selected.estimated_price) : '')
    }))
  }

  // Prepara um registro existente para edição no mesmo formulário usado no cadastro.
  function startEditEntry(row:any,type:EntryType){
    setTab(type)
    setEditingEntry({id:row.id,type})
    setForm({
      title:row.title||'',
      supplier:row.supplier||'',
      client_id:row.client_id||row.service_orders?.client_id||'',
      service_order_id:row.service_order_id||'',
      amount:String(row.amount||''),
      paid_amount:String(row.paid_amount||''),
      due_date:row.due_date||today(),
      recurring:!!row.is_recurring
    })
    setMsg('Editando lançamento financeiro. Altere os campos e clique em salvar alteração.')
    window.scrollTo({top:0,behavior:'smooth'})
  }

  function cancelEditEntry(){
    setEditingEntry(null)
    setForm(emptyForm)
    setMsg('')
  }

  // Cadastra ou atualiza contas a receber e contas a pagar.
  async function create(e:React.FormEvent){
    e.preventDefault()

    const type:EntryType = editingEntry?.type || (tab === 'pagar' ? 'pagar' : 'receber')
    const table = type==='receber' ? 'accounts_receivable' : 'accounts_payable'
    const total = amount(form.amount)
    const paid = Math.min(amount(form.paid_amount),total)
    const status = autoStatus(type,total,paid,form.due_date)

    // Payload documentado: cada campo abaixo corresponde a uma coluna do banco.
    const payload:any = {
      title:form.title,
      due_date:form.due_date,
      amount:total,
      paid_amount:paid,
      pending_amount:Math.max(total-paid,0),
      reference:period,
      status,
      is_recurring:!!form.recurring,
      client_id:form.client_id || null,
      service_order_id:form.service_order_id || null
    }

    if(type==='pagar') payload.supplier = form.supplier || null

    const res = editingEntry
      ? await supabase.from(table).update(payload).eq('id',editingEntry.id)
      : await supabase.from(table).insert(payload)

    if(res.error){
      setMsg('Erro ao salvar lançamento: '+res.error.message)
      return
    }

    setMsg(editingEntry?'Lançamento atualizado com sucesso.':'Lançamento adicionado com sucesso.')
    setEditingEntry(null)
    setForm(emptyForm)
    load()
  }

  // Atualiza o status e ajusta valor pago automaticamente quando marcar como recebido/pago.
  async function updateStatus(type:EntryType,row:any,status:string){
    const table = type==='receber' ? 'accounts_receivable' : 'accounts_payable'
    const payload:any = {status}

    if(status === 'Recebido' || status === 'Paga'){
      payload.paid_amount = amount(row.amount)
      payload.pending_amount = 0
    } else {
      payload.pending_amount = pendingAmount(row)
    }

    await supabase.from(table).update(payload).eq('id',row.id)
    load()
  }

  // Exclui um lançamento financeiro após confirmação do usuário.
  async function deleteEntry(row:any,type:EntryType){
    const ok = confirm(`Excluir o lançamento "${row.title}"?`)
    if(!ok) return

    const table = type==='receber' ? 'accounts_receivable' : 'accounts_payable'
    const {error}=await supabase.from(table).delete().eq('id',row.id)

    if(error) setMsg('Erro ao excluir lançamento: '+error.message)
    else setMsg('Lançamento excluído com sucesso.')

    load()
  }

  // Atualiza apenas o valor já pago/recebido digitado diretamente na tabela.
  async function updatePaidAmount(row:any,type:EntryType,value:any){
    const table = type==='receber' ? 'accounts_receivable' : 'accounts_payable'
    const total = amount(row.amount)
    const paid = Math.min(amount(value),total)
    const status = autoStatus(type,total,paid,row.due_date)

    await supabase
      .from(table)
      .update({paid_amount:paid,pending_amount:Math.max(total-paid,0),status})
      .eq('id',row.id)

    load()
  }

  // Gera um comprovante simples de pagamento/recebimento do item selecionado.
  function receipt(row:any,type:EntryType){
    const pdf=new jsPDF()
    pdf.setFontSize(18)
    pdf.text(type==='receber'?'Comprovante de Recebimento':'Comprovante de Pagamento',12,18)
    pdf.setFontSize(11)
    pdf.text(`Título: ${row.title}`,12,36)
    pdf.text(`Valor total: ${money(amount(row.amount))}`,12,46)
    pdf.text(`Valor pago/recebido: ${money(amount(row.paid_amount))}`,12,56)
    pdf.text(`Pendente: ${money(pendingAmount(row))}`,12,66)
    pdf.text(`Vencimento: ${brDate(row.due_date)}`,12,76)
    pdf.text(`Status: ${row.status}`,12,86)
    pdf.text(`Cliente/Fornecedor: ${clientName(row) !== '-' ? clientName(row) : (row.supplier || '-')}`,12,96)
    pdf.text(`OS vinculada: ${orderNumber(row)}`,12,106)
    pdf.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`,12,116)
    pdf.line(20,150,90,150)
    pdf.text('Assinatura / Conferência',28,158)
    pdf.save(`comprovante-${String(row.title||'financeiro').replace(/[^a-zA-Z0-9_-]/g,'-')}.pdf`)
  }

  // Métricas principais: entradas e saídas consideram valores realmente pagos/recebidos.
  const totalReceber=receber.reduce((a,b)=>a+amount(b.amount),0)
  const totalPagar=pagar.reduce((a,b)=>a+amount(b.amount),0)
  const entradas=receber.reduce((a,b)=>a+amount(b.paid_amount),0)
  const saidas=pagar.reduce((a,b)=>a+amount(b.paid_amount),0)
  const aReceber=receber.reduce((a,b)=>a+pendingAmount(b),0)
  const aPagar=pagar.reduce((a,b)=>a+pendingAmount(b),0)
  const saldo=entradas-saidas
  const vencidasReceber=receber.filter(r=>pendingAmount(r)>0 && r.due_date < today())
  const vencidasPagar=pagar.filter(r=>pendingAmount(r)>0 && r.due_date < today())

  const contasParaVencer=useMemo(()=>{
    const limite = new Date()
    limite.setDate(limite.getDate()+7)
    const end = limite.toISOString().slice(0,10)
    return [
      ...receber.filter(r=>pendingAmount(r)>0 && r.due_date>=today() && r.due_date<=end).map(r=>({...r,kind:'Receber'})),
      ...pagar.filter(r=>pendingAmount(r)>0 && r.due_date>=today() && r.due_date<=end).map(r=>({...r,kind:'Pagar'}))
    ].sort((a,b)=>String(a.due_date).localeCompare(String(b.due_date)))
  },[receber,pagar])

  // Fluxo diário baseado em valores pagos/recebidos, mantendo o saldo real correto.
  const dailyFlow=useMemo(()=>{
    const map:Record<string,{in:number,out:number}>={}
    receber.forEach(r=>{map[r.due_date]=map[r.due_date]||{in:0,out:0};map[r.due_date].in+=amount(r.paid_amount)})
    pagar.forEach(r=>{map[r.due_date]=map[r.due_date]||{in:0,out:0};map[r.due_date].out+=amount(r.paid_amount)})
    return Object.entries(map).sort(([a],[b])=>a.localeCompare(b))
  },[receber,pagar])

  // Agrupamento por cliente para mostrar quem já pagou e quanto ainda falta pagar.
  const clientBalances=useMemo(()=>{
    const map:Record<string,{client:string,total:number,paid:number,pending:number}>={}

    receber.forEach(r=>{
      const name = clientName(r)
      map[name]=map[name]||{client:name,total:0,paid:0,pending:0}
      map[name].total+=amount(r.amount)
      map[name].paid+=amount(r.paid_amount)
      map[name].pending+=pendingAmount(r)
    })

    return Object.values(map).sort((a,b)=>b.pending-a.pending)
  },[receber])

  const rows=tab==='receber'?receber:pagar

  // Calcula venda, custos lançados e lucro estimado por OS.
  const orderTotals = orders.reduce((acc,o)=>{
    acc.sales+=amount(o.estimated_price)
    acc.costs+=amount(o.material_cost)+amount(o.installation_cost)+amount(o.designer_cost)+amount(o.other_cost)
    return acc
  },{sales:0,costs:0})

  async function saveOrderCosts(o:any){
    const e=costEdit[o.id]||{}

    await supabase
      .from('service_orders')
      .update({
        material_cost:amount(e.material_cost ?? o.material_cost),
        installation_cost:amount(e.installation_cost ?? o.installation_cost),
        designer_cost:amount(e.designer_cost ?? o.designer_cost),
        other_cost:amount(e.other_cost ?? o.other_cost)
      })
      .eq('id',o.id)

    load()
  }

  // Helper do PDF: adiciona nova página quando a tabela chega ao fim da folha.
  function ensurePdfSpace(pdf:jsPDF,y:number,needed=10){
    if(y + needed < 285) return y
    pdf.addPage()
    return 18
  }

  // Helper do PDF: escreve uma linha de tabela com colunas fixas.
  function pdfRow(pdf:jsPDF,y:number,cols:string[],widths:number[]){
    let x=10
    cols.forEach((col,i)=>{
      const text = pdf.splitTextToSize(String(col || '-'), widths[i]-2)
      pdf.text(text,x,y)
      x+=widths[i]
    })
    return y+7
  }

  // Relatório geral profissional em PDF com resumo, contas, clientes e vencimentos.
  function generalReportPdf(){
    const pdf = new jsPDF('p','mm','a4')
    const title = `Relatório Financeiro Geral - ${period}`
    let y = 14

    // Cabeçalho visual do relatório.
    pdf.setFillColor(18,18,18)
    pdf.rect(0,0,210,26,'F')
    pdf.setTextColor(244,197,66)
    pdf.setFontSize(16)
    pdf.text(title,10,16)
    pdf.setTextColor(255,255,255)
    pdf.setFontSize(9)
    pdf.text(`Emitido em ${new Date().toLocaleString('pt-BR')}`,10,22)

    y=38
    pdf.setTextColor(0,0,0)
    pdf.setFontSize(12)
    pdf.text('Resumo financeiro',10,y)
    y+=8
    pdf.setFontSize(9)
    ;[
      `Total a receber: ${money(totalReceber)} | Recebido: ${money(entradas)} | Falta receber: ${money(aReceber)}`,
      `Total a pagar: ${money(totalPagar)} | Pago: ${money(saidas)} | Falta pagar: ${money(aPagar)}`,
      `Saldo real: ${money(saldo)} | Vencidas: ${vencidasReceber.length + vencidasPagar.length} | Para vencer em 7 dias: ${contasParaVencer.length}`
    ].forEach(line=>{ pdf.text(line,10,y); y+=6 })

    y+=4
    pdf.setFontSize(12)
    pdf.text('Contas a receber',10,y)
    y+=7
    pdf.setFontSize(8)
    y=pdfRow(pdf,y,['Cliente','Título','Venc.','Valor','Recebido','Falta','Status'],[31,46,18,22,22,22,20])
    receber.forEach(r=>{
      y=ensurePdfSpace(pdf,y,8)
      y=pdfRow(pdf,y,[clientName(r),r.title,brDate(r.due_date),money(amount(r.amount)),money(amount(r.paid_amount)),money(pendingAmount(r)),r.status],[31,46,18,22,22,22,20])
    })
    if(!receber.length){ pdf.text('Nenhuma conta a receber no período.',10,y); y+=7 }

    y=ensurePdfSpace(pdf,y+4,20)
    pdf.setFontSize(12)
    pdf.text('Contas a pagar',10,y)
    y+=7
    pdf.setFontSize(8)
    y=pdfRow(pdf,y,['Fornecedor/Cliente','OS','Título','Venc.','Valor','Pago','Falta','Status'],[33,18,38,18,20,20,20,18])
    pagar.forEach(r=>{
      y=ensurePdfSpace(pdf,y,8)
      y=pdfRow(pdf,y,[r.supplier || clientName(r),orderNumber(r),r.title,brDate(r.due_date),money(amount(r.amount)),money(amount(r.paid_amount)),money(pendingAmount(r)),r.status],[33,18,38,18,20,20,20,18])
    })
    if(!pagar.length){ pdf.text('Nenhuma conta a pagar no período.',10,y); y+=7 }

    y=ensurePdfSpace(pdf,y+4,20)
    pdf.setFontSize(12)
    pdf.text('Clientes com valores pendentes',10,y)
    y+=7
    pdf.setFontSize(8)
    y=pdfRow(pdf,y,['Cliente','Total','Já pagou','Falta pagar'],[70,35,35,35])
    clientBalances.forEach(c=>{
      y=ensurePdfSpace(pdf,y,8)
      y=pdfRow(pdf,y,[c.client,money(c.total),money(c.paid),money(c.pending)],[70,35,35,35])
    })
    if(!clientBalances.length){ pdf.text('Nenhum cliente com movimento no período.',10,y); y+=7 }

    y=ensurePdfSpace(pdf,y+4,20)
    pdf.setFontSize(12)
    pdf.text('Contas para vencer nos próximos 7 dias',10,y)
    y+=7
    pdf.setFontSize(8)
    y=pdfRow(pdf,y,['Tipo','Cliente/Fornecedor','Título','Vencimento','Pendente'],[20,50,58,26,28])
    contasParaVencer.forEach(r=>{
      y=ensurePdfSpace(pdf,y,8)
      y=pdfRow(pdf,y,[r.kind,r.supplier || clientName(r),r.title,brDate(r.due_date),money(pendingAmount(r))],[20,50,58,26,28])
    })
    if(!contasParaVencer.length){ pdf.text('Nenhuma conta vencendo nos próximos 7 dias.',10,y); y+=7 }

    // Rodapé com paginação simples.
    const totalPages = pdf.getNumberOfPages()
    for(let i=1;i<=totalPages;i++){
      pdf.setPage(i)
      pdf.setFontSize(8)
      pdf.setTextColor(120,120,120)
      pdf.text(`Página ${i} de ${totalPages}`,178,290)
      pdf.text('Relatório gerado pelo módulo Financeiro.',10,290)
    }

    pdf.save(`relatorio-financeiro-geral-${period}.pdf`)
  }

  return (
    <div>
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-4xl font-black">Financeiro</h1>
          <p className="text-zinc-400">Entradas, saídas, saldo real, contas, OS vinculadas e relatórios.</p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row">
          <input type="month" className="input max-w-xs" value={period} onChange={e=>setPeriod(e.target.value)}/>
          <button className="btn-gold" onClick={generalReportPdf}>Relatório geral PDF</button>
        </div>
      </header>

      {msg&&<div className="mb-4 rounded-xl border border-gold/30 bg-gold/10 p-3 text-gold">{msg}</div>}

      <section className="mb-5 grid gap-4 md:grid-cols-4 xl:grid-cols-7">
        <article className="card"><small>Entradas recebidas</small><h2 className="text-2xl font-black">{money(entradas)}</h2></article>
        <article className="card"><small>Saídas pagas</small><h2 className="text-2xl font-black">{money(saidas)}</h2></article>
        <article className="card"><small>Saldo real</small><h2 className="text-2xl font-black">{money(saldo)}</h2></article>
        <article className="card"><small>Total a receber</small><h2 className="text-2xl font-black">{money(totalReceber)}</h2></article>
        <article className="card"><small>Falta receber</small><h2 className="text-2xl font-black">{money(aReceber)}</h2></article>
        <article className="card"><small>Falta pagar</small><h2 className="text-2xl font-black">{money(aPagar)}</h2></article>
        <article className="card"><small>Vencidas</small><h2 className="text-2xl font-black">{vencidasReceber.length+vencidasPagar.length}</h2></article>
      </section>

      <div className="mb-5 flex flex-wrap gap-3">
        <button onClick={()=>setTab('receber')} className={tab==='receber'?'btn-gold':'btn-dark'}>Contas a receber</button>
        <button onClick={()=>setTab('pagar')} className={tab==='pagar'?'btn-gold':'btn-dark'}>Contas a pagar</button>
        <button onClick={()=>setTab('fluxo')} className={tab==='fluxo'?'btn-gold':'btn-dark'}>Fluxo de caixa</button>
        <button onClick={()=>setTab('custos')} className={tab==='custos'?'btn-gold':'btn-dark'}>Controle de custos</button>
        <button onClick={()=>setTab('relatorio')} className={tab==='relatorio'?'btn-gold':'btn-dark'}>Resumo do relatório</button>
      </div>

      {(tab==='receber' || tab==='pagar') && (
        <form onSubmit={create} className="card mb-6 grid gap-3 md:grid-cols-6">
          <input className="input" placeholder="Título" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required/>

          <select className="input" value={form.client_id} onChange={e=>setForm({...form,client_id:e.target.value})}>
            <option value="">Cliente</option>
            {clients.map(c=><option key={c.id} value={c.id}>{c.company || c.name}</option>)}
          </select>

          <select className="input" value={form.service_order_id} onChange={e=>handleOrderChange(e.target.value)}>
            <option value="">OS vinculada</option>
            {orders.map(o=><option key={o.id} value={o.id}>{o.os_number} - {o.clients?.company || o.clients?.name || 'Sem cliente'}</option>)}
          </select>

          {tab==='pagar' && <input className="input" placeholder="Fornecedor" value={form.supplier} onChange={e=>setForm({...form,supplier:e.target.value})}/>} 

          <input className="input" type="date" value={form.due_date} onChange={e=>setForm({...form,due_date:e.target.value})}/>
          <input className="input" placeholder="Valor total" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} required/>
          <input className="input" placeholder={tab==='receber'?'Valor já recebido':'Valor já pago'} value={form.paid_amount} onChange={e=>setForm({...form,paid_amount:e.target.value})}/>

          <label className="flex items-center gap-2 rounded-xl border border-white/10 px-4">
            <input type="checkbox" checked={form.recurring} onChange={e=>setForm({...form,recurring:e.target.checked})}/> Recorrente
          </label>

          <div className="flex gap-2 md:col-span-6">
            <button className="btn-gold">{editingEntry?'Salvar alteração':'Adicionar'}</button>
            {editingEntry&&<button type="button" className="btn-dark" onClick={cancelEditEntry}>Cancelar edição</button>}
          </div>
        </form>
      )}

      {tab==='custos' ? (
        <div>
          <section className="mb-5 grid gap-4 md:grid-cols-3">
            <article className="card"><small>Vendas em OS</small><h2 className="text-2xl font-black">{money(orderTotals.sales)}</h2></article>
            <article className="card"><small>Custos lançados</small><h2 className="text-2xl font-black">{money(orderTotals.costs)}</h2></article>
            <article className="card"><small>Lucro estimado</small><h2 className="text-2xl font-black">{money(orderTotals.sales-orderTotals.costs)}</h2></article>
          </section>

          <div className="card table-wrap">
            <table>
              <thead><tr><th>OS</th><th>Cliente</th><th>Venda</th><th>Material</th><th>Instalação</th><th>Designer</th><th>Outros</th><th>Lucro</th><th>Ação</th></tr></thead>
              <tbody>
                {orders.map(o=>{
                  const e=costEdit[o.id]||{}
                  const mat=amount(e.material_cost ?? o.material_cost)
                  const inst=amount(e.installation_cost ?? o.installation_cost)
                  const des=amount(e.designer_cost ?? o.designer_cost)
                  const oth=amount(e.other_cost ?? o.other_cost)
                  const sale=amount(o.estimated_price)

                  return <tr key={o.id}>
                    <td>{o.os_number}<br/><small>{o.service}</small></td>
                    <td>{o.clients?.company || o.clients?.name || '-'}</td>
                    <td>{money(sale)}</td>
                    <td><input className="input w-28" value={e.material_cost ?? o.material_cost ?? ''} onChange={ev=>setCostEdit({...costEdit,[o.id]:{...e,material_cost:ev.target.value}})}/></td>
                    <td><input className="input w-28" value={e.installation_cost ?? o.installation_cost ?? ''} onChange={ev=>setCostEdit({...costEdit,[o.id]:{...e,installation_cost:ev.target.value}})}/></td>
                    <td><input className="input w-28" value={e.designer_cost ?? o.designer_cost ?? ''} onChange={ev=>setCostEdit({...costEdit,[o.id]:{...e,designer_cost:ev.target.value}})}/></td>
                    <td><input className="input w-28" value={e.other_cost ?? o.other_cost ?? ''} onChange={ev=>setCostEdit({...costEdit,[o.id]:{...e,other_cost:ev.target.value}})}/></td>
                    <td>{money(sale-mat-inst-des-oth)}</td>
                    <td><button className="btn-gold" onClick={()=>saveOrderCosts(o)}>Salvar</button></td>
                  </tr>
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab==='fluxo' ? (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Dia</th><th>Entradas recebidas</th><th>Saídas pagas</th><th>Saldo real</th></tr></thead>
            <tbody>
              {dailyFlow.map(([day,v])=><tr key={day}><td>{brDate(day)}</td><td>{money(v.in)}</td><td>{money(v.out)}</td><td>{money(v.in-v.out)}</td></tr>)}
              {dailyFlow.length===0 && <tr><td colSpan={4} className="text-zinc-400">Nenhum lançamento.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : tab==='relatorio' ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <section className="card table-wrap">
            <h2 className="mb-3 text-2xl font-black">Clientes que faltam pagar</h2>
            <table>
              <thead><tr><th>Cliente</th><th>Total</th><th>Já pagou</th><th>Falta</th></tr></thead>
              <tbody>
                {clientBalances.map(c=><tr key={c.client}><td>{c.client}</td><td>{money(c.total)}</td><td>{money(c.paid)}</td><td>{money(c.pending)}</td></tr>)}
                {clientBalances.length===0 && <tr><td colSpan={4} className="text-zinc-400">Sem dados no período.</td></tr>}
              </tbody>
            </table>
          </section>

          <section className="card table-wrap">
            <h2 className="mb-3 text-2xl font-black">Contas para vencer</h2>
            <table>
              <thead><tr><th>Tipo</th><th>Cliente/Fornecedor</th><th>Título</th><th>Vencimento</th><th>Pendente</th></tr></thead>
              <tbody>
                {contasParaVencer.map((r:any)=><tr key={`${r.kind}-${r.id}`}><td>{r.kind}</td><td>{r.supplier || clientName(r)}</td><td>{r.title}</td><td>{brDate(r.due_date)}</td><td>{money(pendingAmount(r))}</td></tr>)}
                {contasParaVencer.length===0 && <tr><td colSpan={5} className="text-zinc-400">Nenhuma conta vencendo nos próximos 7 dias.</td></tr>}
              </tbody>
            </table>
          </section>
        </div>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Título</th>
                <th>Cliente/Fornecedor</th>
                <th>OS</th>
                <th>Vencimento</th>
                <th>Valor</th>
                <th>{tab==='receber'?'Já recebido':'Já pago'}</th>
                <th>Falta</th>
                <th>Recorrente</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r=><tr key={r.id}>
                <td>{r.title}</td>
                <td>{tab==='pagar' ? (r.supplier || clientName(r)) : clientName(r)}</td>
                <td>{orderNumber(r)}</td>
                <td>{brDate(r.due_date)}</td>
                <td>{money(amount(r.amount))}</td>
                <td><input className="input w-28" defaultValue={r.paid_amount || ''} onBlur={e=>updatePaidAmount(r,tab as EntryType,e.target.value)}/></td>
                <td>{money(pendingAmount(r))}</td>
                <td>{r.is_recurring?'Sim':'Não'}</td>
                <td>
                  <select className="input" value={r.status} onChange={e=>updateStatus(tab as EntryType,r,e.target.value)}>
                    {tab==='receber' ? <><option>Aberto</option><option>Recebido</option><option>Vencido</option></> : <><option>A pagar</option><option>Paga</option><option>Vencida</option></>}
                  </select>
                </td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-dark" onClick={()=>startEditEntry(r,tab as EntryType)}>Editar</button>
                    <button className="btn-gold" onClick={()=>receipt(r,tab as EntryType)}>PDF</button>
                    <button className="btn-dark" onClick={()=>deleteEntry(r,tab as EntryType)}>Excluir</button>
                  </div>
                </td>
              </tr>)}
              {rows.length===0 && <tr><td colSpan={10} className="text-zinc-400">Nenhum lançamento.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
