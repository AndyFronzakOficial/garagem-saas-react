import { useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import { supabase } from '../lib/supabase'
import { brNumber, formatDateBR, money } from '../lib/utils'

// Mês atual usado como filtro padrão dos relatórios.
function currentMonth(){ return new Date().toISOString().slice(0,7) }

// Calcula primeiro e último dia do mês selecionado.
function monthRange(ym:string){
  const [y,m]=ym.split('-').map(Number)
  return {start:`${ym}-01`,end:new Date(y,m,0).toISOString().slice(0,10)}
}

// Soma segura para valores monetários vindos do banco ou de inputs.
function amount(v:any){ return brNumber(v) }

// Considera dinheiro real: se paid_amount estiver vazio, usa amount apenas quando o status está finalizado.
function paidReal(row:any,finalStatuses:string[]){
  const paid = amount(row.paid_amount)
  if(paid > 0) return paid
  return finalStatuses.includes(row.status) ? amount(row.amount) : 0
}

function pending(row:any,finalStatuses:string[]){
  return Math.max(amount(row.amount) - paidReal(row,finalStatuses),0)
}

function clientName(row:any){
  return row.clients?.company || row.clients?.name || row.service_orders?.clients?.company || row.service_orders?.clients?.name || 'Sem cliente'
}

function osCost(o:any){
  return amount(o.material_cost)+amount(o.installation_cost)+amount(o.designer_cost)+amount(o.other_cost)
}

function osRevenue(o:any){
  return amount(o.estimated_price || o.final_price || 0)
}

function createdInRange(row:any,start:string,end:string){
  const d=String(row.created_at || row.due_date || '').slice(0,10)
  return d>=start && d<=end
}

function ensurePage(pdf:jsPDF,y:number,needed=12){
  if(y+needed<285) return y
  pdf.addPage()
  return 18
}

function row(pdf:jsPDF,y:number,cols:any[],widths:number[]){
  let x=10
  cols.forEach((c,i)=>{
    const text = pdf.splitTextToSize(String(c ?? '-'),widths[i]-2)
    pdf.text(text,x,y)
    x+=widths[i]
  })
  return y+7
}

export default function Reports(){
  const [period,setPeriod]=useState(currentMonth())
  const [receber,setReceber]=useState<any[]>([])
  const [pagar,setPagar]=useState<any[]>([])
  const [orders,setOrders]=useState<any[]>([])
  const [clients,setClients]=useState<any[]>([])
  const [installations,setInstallations]=useState<any[]>([])
  const [msg,setMsg]=useState('')

  useEffect(()=>{load()},[period])

  async function load(){
    const {start,end}=monthRange(period)

    // Relatórios usam dados integrados: financeiro, clientes, OS e agenda.
    const [r,p,o,c,i]=await Promise.all([
      supabase.from('accounts_receivable').select('*,clients(*),service_orders(*)').gte('due_date',start).lte('due_date',end).order('due_date',{ascending:true}),
      supabase.from('accounts_payable').select('*,clients(*),service_orders(*,clients(*))').gte('due_date',start).lte('due_date',end).order('due_date',{ascending:true}),
      supabase.from('service_orders').select('*,clients(*)').order('created_at',{ascending:false}),
      supabase.from('clients').select('*').order('name',{ascending:true}),
      supabase.from('installations').select('*,service_orders(os_number,service,client_id,clients(name,company))').gte('installation_date',start).lte('installation_date',end).order('installation_date',{ascending:true})
    ])

    if(r.error) setMsg('Erro ao carregar contas a receber: '+r.error.message)
    if(p.error) setMsg('Erro ao carregar contas a pagar: '+p.error.message)
    if(o.error) setMsg('Erro ao carregar ordens: '+o.error.message)

    setReceber((r.data||[]).filter((x:any)=>!x.is_deleted))
    setPagar((p.data||[]).filter((x:any)=>!x.is_deleted))
    setOrders((o.data||[]).filter((x:any)=>!x.is_deleted && createdInRange(x,start,end)))
    setClients(c.data||[])
    setInstallations(i.data||[])
  }

  const report=useMemo(()=>{
    const totalReceber=receber.reduce((a,b)=>a+amount(b.amount),0)
    const totalPagar=pagar.reduce((a,b)=>a+amount(b.amount),0)
    const recebido=receber.reduce((a,b)=>a+paidReal(b,['Recebido']),0)
    const pago=pagar.reduce((a,b)=>a+paidReal(b,['Paga']),0)
    const faltaReceber=receber.reduce((a,b)=>a+pending(b,['Recebido']),0)
    const faltaPagar=pagar.reduce((a,b)=>a+pending(b,['Paga']),0)
    const vendasOS=orders.reduce((a,b)=>a+osRevenue(b),0)
    const custosOS=orders.reduce((a,b)=>a+osCost(b),0)
    const lucroReal=recebido - pago - custosOS
    const lucroPrevisto=vendasOS - custosOS
    const saldoCaixa=recebido-pago

    // Agrupa saldos por cliente para saber quem falta pagar e quanto já pagou.
    const clientsMap:Record<string,{cliente:string,total:number,pago:number,falta:number,os:string[]}>= {}
    receber.forEach(r=>{
      const name=clientName(r)
      clientsMap[name]=clientsMap[name]||{cliente:name,total:0,pago:0,falta:0,os:[]}
      clientsMap[name].total += amount(r.amount)
      clientsMap[name].pago += paidReal(r,['Recebido'])
      clientsMap[name].falta += pending(r,['Recebido'])
      if(r.service_orders?.os_number) clientsMap[name].os.push(r.service_orders.os_number)
    })

    const topClientes = Object.values(clientsMap).sort((a,b)=>b.total-a.total).slice(0,10)
    const clientesPendentes = Object.values(clientsMap).filter(c=>c.falta>0).sort((a,b)=>b.falta-a.falta)
    const lucroPorOS = orders.map(o=>({
      os:o.os_number || '-',
      cliente:o.clients?.company || o.clients?.name || 'Sem cliente',
      servico:o.service || '-',
      venda:osRevenue(o),
      custo:osCost(o),
      lucro:osRevenue(o)-osCost(o),
      margem:osRevenue(o)>0 ? Math.round(((osRevenue(o)-osCost(o))/osRevenue(o))*100) : 0,
      status:o.status || '-'
    })).sort((a,b)=>b.lucro-a.lucro)

    const hoje = new Date().toISOString().slice(0,10)
    const vencidas = [
      ...receber.filter(r=>pending(r,['Recebido'])>0 && r.due_date<hoje).map(r=>({...r,tipo:'Receber'})),
      ...pagar.filter(r=>pending(r,['Paga'])>0 && r.due_date<hoje).map(r=>({...r,tipo:'Pagar'}))
    ]

    const limite = new Date(); limite.setDate(limite.getDate()+7)
    const end=limite.toISOString().slice(0,10)
    const paraVencer = [
      ...receber.filter(r=>pending(r,['Recebido'])>0 && r.due_date>=hoje && r.due_date<=end).map(r=>({...r,tipo:'Receber'})),
      ...pagar.filter(r=>pending(r,['Paga'])>0 && r.due_date>=hoje && r.due_date<=end).map(r=>({...r,tipo:'Pagar'}))
    ].sort((a,b)=>String(a.due_date).localeCompare(String(b.due_date)))

    return {totalReceber,totalPagar,recebido,pago,faltaReceber,faltaPagar,vendasOS,custosOS,lucroReal,lucroPrevisto,saldoCaixa,topClientes,clientesPendentes,lucroPorOS,vencidas,paraVencer}
  },[receber,pagar,orders])

  function exportPdf(){
    const pdf=new jsPDF('p','mm','a4')
    let y=14

    // Cabeçalho profissional do relatório geral.
    pdf.setFillColor(18,18,18)
    pdf.rect(0,0,210,28,'F')
    pdf.setTextColor(244,197,66)
    pdf.setFont('helvetica','bold')
    pdf.setFontSize(15)
    pdf.text('Relatórios Avançados e Lucro Real',10,14)
    pdf.setTextColor(255,255,255)
    pdf.setFontSize(9)
    pdf.text(`Período: ${period} · Emitido em ${new Date().toLocaleString('pt-BR')}`,10,22)

    y=40
    pdf.setTextColor(0,0,0)
    pdf.setFontSize(12)
    pdf.text('1. Resumo executivo',10,y)
    y+=8
    pdf.setFontSize(9)
    ;[
      `Entradas previstas: ${money(report.totalReceber)} | Recebido real: ${money(report.recebido)} | Falta receber: ${money(report.faltaReceber)}`,
      `Saídas previstas: ${money(report.totalPagar)} | Pago real: ${money(report.pago)} | Falta pagar: ${money(report.faltaPagar)}`,
      `Saldo de caixa: ${money(report.saldoCaixa)} | Vendas em OS: ${money(report.vendasOS)} | Custos em OS: ${money(report.custosOS)}`,
      `Lucro previsto por OS: ${money(report.lucroPrevisto)} | Lucro real aproximado: ${money(report.lucroReal)}`
    ].forEach(line=>{ pdf.text(line,10,y); y+=6 })

    y=ensurePage(pdf,y+4,20)
    pdf.setFontSize(12); pdf.text('2. Lucro por ordem de serviço',10,y); y+=7
    pdf.setFontSize(8)
    y=row(pdf,y,['OS','Cliente','Serviço','Venda','Custo','Lucro','Margem','Status'],[22,34,38,22,22,22,17,23])
    report.lucroPorOS.forEach(o=>{ y=ensurePage(pdf,y,9); y=row(pdf,y,[o.os,o.cliente,o.servico,money(o.venda),money(o.custo),money(o.lucro),`${o.margem}%`,o.status],[22,34,38,22,22,22,17,23]) })
    if(!report.lucroPorOS.length){ pdf.text('Nenhuma OS no período.',10,y); y+=7 }

    y=ensurePage(pdf,y+4,20)
    pdf.setFontSize(12); pdf.text('3. Clientes com valores pendentes',10,y); y+=7
    pdf.setFontSize(8)
    y=row(pdf,y,['Cliente','Total','Já pagou','Falta pagar','OS vinculadas'],[62,28,28,28,45])
    report.clientesPendentes.forEach(c=>{ y=ensurePage(pdf,y,9); y=row(pdf,y,[c.cliente,money(c.total),money(c.pago),money(c.falta),c.os.join(', ') || '-'],[62,28,28,28,45]) })
    if(!report.clientesPendentes.length){ pdf.text('Nenhum cliente pendente no período.',10,y); y+=7 }

    y=ensurePage(pdf,y+4,20)
    pdf.setFontSize(12); pdf.text('4. Contas para vencer nos próximos 7 dias',10,y); y+=7
    pdf.setFontSize(8)
    y=row(pdf,y,['Tipo','Cliente/Fornecedor','Título','Vencimento','Pendente'],[22,52,58,28,28])
    report.paraVencer.forEach(r=>{ y=ensurePage(pdf,y,9); y=row(pdf,y,[r.tipo,r.supplier || clientName(r),r.title,formatDateBR(r.due_date),money(pending(r,r.tipo==='Receber'?['Recebido']:['Paga']))],[22,52,58,28,28]) })
    if(!report.paraVencer.length){ pdf.text('Nenhuma conta vencendo nos próximos 7 dias.',10,y); y+=7 }

    y=ensurePage(pdf,y+4,20)
    pdf.setFontSize(12); pdf.text('5. Agenda do período',10,y); y+=7
    pdf.setFontSize(8)
    y=row(pdf,y,['Data','Hora','Tipo','OS','Cliente','Status'],[24,18,26,26,58,32])
    installations.forEach(i=>{ y=ensurePage(pdf,y,9); y=row(pdf,y,[formatDateBR(i.installation_date),String(i.installation_time||'-').slice(0,5),i.delivery_type || 'Instalação',i.service_orders?.os_number || '-',i.service_orders?.clients?.company || i.service_orders?.clients?.name || '-',i.status],[24,18,26,26,58,32]) })
    if(!installations.length){ pdf.text('Nenhum agendamento no período.',10,y); y+=7 }

    // Rodapé com páginas.
    const pages=pdf.getNumberOfPages()
    for(let p=1;p<=pages;p++){
      pdf.setPage(p)
      pdf.setFontSize(8)
      pdf.setTextColor(120,120,120)
      pdf.text(`Página ${p} de ${pages}`,178,290)
      pdf.text('Garagem SaaS · Relatórios avançados',10,290)
    }

    pdf.save(`relatorios-avancados-lucro-real-${period}.pdf`)
  }

  return <div>
    <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-4xl font-black">Relatórios Avançados</h1>
        <p className="text-zinc-400">Lucro real, lucro previsto, clientes pendentes, contas a vencer e agenda.</p>
      </div>
      <div className="flex flex-col gap-2 md:flex-row">
        <input type="month" className="input" value={period} onChange={e=>setPeriod(e.target.value)}/>
        <button className="btn-gold" onClick={exportPdf}>Baixar relatório PDF</button>
      </div>
    </header>

    {msg&&<div className="mb-4 rounded-xl border border-red-500/30 bg-red-950/50 p-3 text-red-100">{msg}</div>}

    <section className="mb-5 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
      <article className="metric-card"><small>Recebido real</small><h2 className="text-2xl font-black">{money(report.recebido)}</h2></article>
      <article className="metric-card"><small>Pago real</small><h2 className="text-2xl font-black">{money(report.pago)}</h2></article>
      <article className="metric-card"><small>Saldo caixa</small><h2 className="text-2xl font-black">{money(report.saldoCaixa)}</h2></article>
      <article className="metric-card"><small>Custos OS</small><h2 className="text-2xl font-black">{money(report.custosOS)}</h2></article>
      <article className="metric-card"><small>Lucro previsto</small><h2 className="text-2xl font-black">{money(report.lucroPrevisto)}</h2></article>
      <article className="metric-card"><small>Lucro real aprox.</small><h2 className="text-2xl font-black">{money(report.lucroReal)}</h2></article>
    </section>

    <section className="grid gap-5 xl:grid-cols-2">
      <div className="dashboard-panel table-wrap">
        <h2 className="mb-4 text-2xl font-black">Lucro por OS</h2>
        <table><thead><tr><th>OS</th><th>Cliente</th><th>Venda</th><th>Custo</th><th>Lucro</th><th>Margem</th></tr></thead><tbody>
          {report.lucroPorOS.map(o=><tr key={o.os}><td>{o.os}<br/><small>{o.servico}</small></td><td>{o.cliente}</td><td>{money(o.venda)}</td><td>{money(o.custo)}</td><td>{money(o.lucro)}</td><td>{o.margem}%</td></tr>)}
          {report.lucroPorOS.length===0&&<tr><td colSpan={6} className="text-zinc-400">Sem OS no período.</td></tr>}
        </tbody></table>
      </div>

      <div className="dashboard-panel table-wrap">
        <h2 className="mb-4 text-2xl font-black">Clientes que faltam pagar</h2>
        <table><thead><tr><th>Cliente</th><th>Total</th><th>Já pagou</th><th>Falta</th></tr></thead><tbody>
          {report.clientesPendentes.map(c=><tr key={c.cliente}><td>{c.cliente}<br/><small>{c.os.join(', ')}</small></td><td>{money(c.total)}</td><td>{money(c.pago)}</td><td>{money(c.falta)}</td></tr>)}
          {report.clientesPendentes.length===0&&<tr><td colSpan={4} className="text-zinc-400">Sem pendências no período.</td></tr>}
        </tbody></table>
      </div>

      <div className="dashboard-panel table-wrap">
        <h2 className="mb-4 text-2xl font-black">Contas para vencer em 7 dias</h2>
        <table><thead><tr><th>Tipo</th><th>Cliente/Fornecedor</th><th>Título</th><th>Vencimento</th><th>Pendente</th></tr></thead><tbody>
          {report.paraVencer.map((r:any)=><tr key={`${r.tipo}-${r.id}`}><td>{r.tipo}</td><td>{r.supplier || clientName(r)}</td><td>{r.title}</td><td>{formatDateBR(r.due_date)}</td><td>{money(pending(r,r.tipo==='Receber'?['Recebido']:['Paga']))}</td></tr>)}
          {report.paraVencer.length===0&&<tr><td colSpan={5} className="text-zinc-400">Nada para vencer nos próximos 7 dias.</td></tr>}
        </tbody></table>
      </div>

      <div className="dashboard-panel table-wrap">
        <h2 className="mb-4 text-2xl font-black">Agenda do período</h2>
        <table><thead><tr><th>Data</th><th>Tipo</th><th>OS</th><th>Cliente</th><th>Status</th></tr></thead><tbody>
          {installations.map(i=><tr key={i.id}><td>{formatDateBR(i.installation_date)}<br/><small>{String(i.installation_time || '').slice(0,5)}</small></td><td>{i.delivery_type || 'Instalação'}</td><td>{i.service_orders?.os_number || '-'}</td><td>{i.service_orders?.clients?.company || i.service_orders?.clients?.name || '-'}</td><td>{i.status}</td></tr>)}
          {installations.length===0&&<tr><td colSpan={5} className="text-zinc-400">Sem agenda no período.</td></tr>}
        </tbody></table>
      </div>
    </section>
  </div>
}
