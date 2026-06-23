import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import jsPDF from 'jspdf'

function money(v:any){ return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0)) }
function today(){ return new Date().toISOString().slice(0,10) }
function currentMonth(){ return new Date().toISOString().slice(0,7) }
function monthRange(ym:string){ const [y,m]=ym.split('-').map(Number); return {start:`${ym}-01`,end:new Date(y,m,0).toISOString().slice(0,10)} }
function brDate(v?:string|null){ if(!v)return '-'; const [y,m,d]=v.slice(0,10).split('-'); return `${d}/${m}/${y}` }

export default function Finance(){
  const [tab,setTab]=useState<'receber'|'pagar'|'fluxo'|'custos'>('receber')
  const [period,setPeriod]=useState(currentMonth())
  const [receber,setReceber]=useState<any[]>([])
  const [pagar,setPagar]=useState<any[]>([])
  const [form,setForm]=useState({title:'',supplier:'',amount:'',due_date:today(),recurring:false})
  const [orders,setOrders]=useState<any[]>([])
  const [costEdit,setCostEdit]=useState<Record<string,any>>({})

  useEffect(()=>{load()},[period])

  async function load(){
    const {start,end}=monthRange(period)
    const [r,p]=await Promise.all([
      supabase.from('accounts_receivable').select('*,clients(*)').gte('due_date',start).lte('due_date',end).order('due_date',{ascending:false}),
      supabase.from('accounts_payable').select('*').gte('due_date',start).lte('due_date',end).order('due_date',{ascending:false})
    ])
    setReceber(r.data||[])
    setPagar(p.data||[])
    const o = await supabase.from('service_orders').select('*,clients(*)').gte('created_at',start).lte('created_at',end+'T23:59:59').order('created_at',{ascending:false})
    setOrders((o.data||[]).filter((x:any)=>!x.is_deleted))
  }

  async function create(e:React.FormEvent){
    e.preventDefault()
    const amount=Number(String(form.amount).replace(',','.'))
    if(tab==='receber'){
      await supabase.from('accounts_receivable').insert({title:form.title,due_date:form.due_date,amount,reference:period,status:'Aberto',is_recurring:form.recurring})
    }else{
      await supabase.from('accounts_payable').insert({title:form.title,supplier:form.supplier,due_date:form.due_date,amount,reference:period,status:'A pagar',is_recurring:form.recurring})
    }
    setForm({title:'',supplier:'',amount:'',due_date:today(),recurring:false})
    load()
  }

  async function updateStatus(table:string,id:string,status:string){
    await supabase.from(table).update({status}).eq('id',id)
    load()
  }

  function receipt(row:any,type:'receber'|'pagar'){
    const pdf=new jsPDF()
    pdf.setFontSize(18)
    pdf.text(type==='receber'?'Comprovante de Recebimento':'Comprovante de Pagamento',12,18)
    pdf.setFontSize(11)
    pdf.text(`Título: ${row.title}`,12,36)
    pdf.text(`Valor: ${money(row.amount)}`,12,46)
    pdf.text(`Vencimento: ${brDate(row.due_date)}`,12,56)
    pdf.text(`Status: ${row.status}`,12,66)
    pdf.text(`Cliente/Fornecedor: ${row.clients?.name || row.supplier || '-'}`,12,76)
    pdf.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`,12,86)
    pdf.line(20,130,90,130)
    pdf.text('Assinatura / Conferência',28,138)
    pdf.save(`comprovante-${row.title}.pdf`)
  }

  const entradas=receber.reduce((a,b)=>a+Number(b.amount||0),0)
  const saidas=pagar.reduce((a,b)=>a+Number(b.amount||0),0)
  const vencidasReceber=receber.filter(r=>r.status!=='Recebido' && r.due_date < today())
  const vencidasPagar=pagar.filter(r=>r.status!=='Paga' && r.due_date < today())

  const dailyFlow=useMemo(()=>{
    const map:Record<string,{in:number,out:number}>={}
    receber.forEach(r=>{map[r.due_date]=map[r.due_date]||{in:0,out:0};map[r.due_date].in+=Number(r.amount||0)})
    pagar.forEach(r=>{map[r.due_date]=map[r.due_date]||{in:0,out:0};map[r.due_date].out+=Number(r.amount||0)})
    return Object.entries(map).sort(([a],[b])=>a.localeCompare(b))
  },[receber,pagar])

  const rows=tab==='receber'?receber:pagar
  const orderTotals = orders.reduce((acc,o)=>{ acc.sales+=Number(o.estimated_price||0); acc.costs+=Number(o.material_cost||0)+Number(o.installation_cost||0)+Number(o.designer_cost||0)+Number(o.other_cost||0); return acc },{sales:0,costs:0})
  async function saveOrderCosts(o:any){ const e=costEdit[o.id]||{}; await supabase.from('service_orders').update({material_cost:Number(String(e.material_cost ?? o.material_cost ?? 0).replace(',','.'))||0,installation_cost:Number(String(e.installation_cost ?? o.installation_cost ?? 0).replace(',','.'))||0,designer_cost:Number(String(e.designer_cost ?? o.designer_cost ?? 0).replace(',','.'))||0,other_cost:Number(String(e.other_cost ?? o.other_cost ?? 0).replace(',','.'))||0}).eq('id',o.id); load() }

  return (
    <div>
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div><h1 className="text-4xl font-black">Financeiro</h1><p className="text-zinc-400">Contas, fluxo e recibos.</p></div>
        <input type="month" className="input max-w-xs" value={period} onChange={e=>setPeriod(e.target.value)}/>
      </header>

      <section className="mb-5 grid gap-4 md:grid-cols-4">
        <article className="card"><small>Entradas</small><h2 className="text-2xl font-black">{money(entradas)}</h2></article>
        <article className="card"><small>Saídas</small><h2 className="text-2xl font-black">{money(saidas)}</h2></article>
        <article className="card"><small>Saldo</small><h2 className="text-2xl font-black">{money(entradas-saidas)}</h2></article>
        <article className="card"><small>Vencidas</small><h2 className="text-2xl font-black">{vencidasReceber.length+vencidasPagar.length}</h2></article>
      </section>

      <div className="mb-5 flex flex-wrap gap-3">
        <button onClick={()=>setTab('receber')} className={tab==='receber'?'btn-gold':'btn-dark'}>Contas a receber</button>
        <button onClick={()=>setTab('pagar')} className={tab==='pagar'?'btn-gold':'btn-dark'}>Contas a pagar</button>
        <button onClick={()=>setTab('fluxo')} className={tab==='fluxo'?'btn-gold':'btn-dark'}>Fluxo de caixa</button>
        <button onClick={()=>setTab('custos')} className={tab==='custos'?'btn-gold':'btn-dark'}>Controle de custos</button>
      </div>

      {tab!=='fluxo' && tab!=='custos' && (
        <form onSubmit={create} className="card mb-6 grid gap-3 md:grid-cols-5">
          <input className="input" placeholder="Título" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required/>
          {tab==='pagar' && <input className="input" placeholder="Fornecedor" value={form.supplier} onChange={e=>setForm({...form,supplier:e.target.value})}/>}
          <input className="input" type="date" value={form.due_date} onChange={e=>setForm({...form,due_date:e.target.value})}/>
          <input className="input" placeholder="Valor" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} required/>
          <label className="flex items-center gap-2 rounded-xl border border-white/10 px-4"><input type="checkbox" checked={form.recurring} onChange={e=>setForm({...form,recurring:e.target.checked})}/> Recorrente</label>
          <button className="btn-gold">Adicionar</button>
        </form>
      )}

      {tab==='custos' ? (
        <div>
          <section className="mb-5 grid gap-4 md:grid-cols-3"><article className="card"><small>Vendas em OS</small><h2 className="text-2xl font-black">{money(orderTotals.sales)}</h2></article><article className="card"><small>Custos lançados</small><h2 className="text-2xl font-black">{money(orderTotals.costs)}</h2></article><article className="card"><small>Lucro estimado</small><h2 className="text-2xl font-black">{money(orderTotals.sales-orderTotals.costs)}</h2></article></section>
          <div className="card table-wrap"><table><thead><tr><th>OS</th><th>Cliente</th><th>Venda</th><th>Material</th><th>Instalação</th><th>Designer</th><th>Outros</th><th>Lucro</th><th>Ação</th></tr></thead><tbody>{orders.map(o=>{const e=costEdit[o.id]||{}; const mat=Number(e.material_cost ?? o.material_cost ?? 0)||0; const inst=Number(e.installation_cost ?? o.installation_cost ?? 0)||0; const des=Number(e.designer_cost ?? o.designer_cost ?? 0)||0; const oth=Number(e.other_cost ?? o.other_cost ?? 0)||0; const sale=Number(o.estimated_price||0); return <tr key={o.id}><td>{o.os_number}<br/><small>{o.service}</small></td><td>{o.clients?.name||'-'}</td><td>{money(sale)}</td><td><input className="input w-28" value={e.material_cost ?? o.material_cost ?? ''} onChange={ev=>setCostEdit({...costEdit,[o.id]:{...e,material_cost:ev.target.value}})}/></td><td><input className="input w-28" value={e.installation_cost ?? o.installation_cost ?? ''} onChange={ev=>setCostEdit({...costEdit,[o.id]:{...e,installation_cost:ev.target.value}})}/></td><td><input className="input w-28" value={e.designer_cost ?? o.designer_cost ?? ''} onChange={ev=>setCostEdit({...costEdit,[o.id]:{...e,designer_cost:ev.target.value}})}/></td><td><input className="input w-28" value={e.other_cost ?? o.other_cost ?? ''} onChange={ev=>setCostEdit({...costEdit,[o.id]:{...e,other_cost:ev.target.value}})}/></td><td>{money(sale-mat-inst-des-oth)}</td><td><button className="btn-gold" onClick={()=>saveOrderCosts(o)}>Salvar</button></td></tr>})}</tbody></table></div>
        </div>
      ) : tab==='fluxo' ? (
        <div className="card table-wrap">
          <table><thead><tr><th>Dia</th><th>Entradas</th><th>Saídas</th><th>Saldo</th></tr></thead>
          <tbody>
            {dailyFlow.map(([day,v])=><tr key={day}><td>{brDate(day)}</td><td>{money(v.in)}</td><td>{money(v.out)}</td><td>{money(v.in-v.out)}</td></tr>)}
            {dailyFlow.length===0 && <tr><td colSpan={4} className="text-zinc-400">Nenhum lançamento.</td></tr>}
          </tbody></table>
        </div>
      ) : (
        <div className="card table-wrap">
          <table><thead><tr><th>Título</th><th>Vencimento</th><th>Valor</th><th>Recorrente</th><th>Status</th><th>Recibo</th></tr></thead>
          <tbody>
            {rows.map(r=><tr key={r.id}>
              <td>{r.title}<br/><small>{r.supplier || r.clients?.name}</small></td>
              <td>{brDate(r.due_date)}</td>
              <td>{money(r.amount)}</td>
              <td>{r.is_recurring?'Sim':'Não'}</td>
              <td><select className="input" value={r.status} onChange={e=>updateStatus(tab==='receber'?'accounts_receivable':'accounts_payable',r.id,e.target.value)}>
                {tab==='receber' ? <><option>Aberto</option><option>Recebido</option><option>Vencido</option></> : <><option>A pagar</option><option>Paga</option><option>Vencida</option></>}
              </select></td>
              <td><button className="btn-gold" onClick={()=>receipt(r,tab as any)}>PDF</button></td>
            </tr>)}
            {rows.length===0 && <tr><td colSpan={6} className="text-zinc-400">Nenhum lançamento.</td></tr>}
          </tbody></table>
        </div>
      )}
    </div>
  )
}
