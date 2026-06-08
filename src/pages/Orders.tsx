import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import jsPDF from 'jspdf'

function money(v:any){
  return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0))
}

function brDate(v?:string|null){
  if(!v)return '-'
  const [y,m,d]=v.slice(0,10).split('-')
  if(!y || !m || !d)return '-'
  return `${d}/${m}/${y}`
}

function today(){
  return new Date().toISOString().slice(0,10)
}

const statuses = ['Entrada','Designer','Produção','Impressão','Acabamento','Pronto','Entregue']
const priorities = ['Baixa','Média','Alta','Urgente']

function statusClass(s:string){
  if(['Pronto','Entregue','Recebido','Paga'].includes(s)) return 'success'
  if(['Urgente','Cancelado','Vencido','Vencida'].includes(s)) return 'danger'
  if(['Designer','Produção','Impressão','Acabamento','Alta'].includes(s)) return 'info'
  return 'warning'
}

async function imageToDataURL(url:string){
  try{
    const res = await fetch(url)
    const blob = await res.blob()
    return await new Promise<string>((resolve,reject)=>{
      const reader = new FileReader()
      reader.onloadend = () => resolve(String(reader.result))
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }catch{
    return ''
  }
}

export default function Orders(){
  const [rows,setRows]=useState<any[]>([])
  const [company,setCompany]=useState<any>(null)
  const [loading,setLoading]=useState(false)
  const [search,setSearch]=useState('')
  const [statusFilter,setStatusFilter]=useState('')
  const [priorityFilter,setPriorityFilter]=useState('')

  useEffect(()=>{load()},[])

  async function load(){
    setLoading(true)

    const [orders,cfg]=await Promise.all([
      supabase
        .from('service_orders')
        .select('*,clients(*)')
        .order('created_at',{ascending:false}),
      supabase
        .from('company_settings')
        .select('*')
        .eq('id',1)
        .maybeSingle()
    ])

    if(!orders.error){
      setRows((orders.data||[]).filter((r:any)=>!r.is_deleted))
    }

    if(!cfg.error){
      setCompany(cfg.data)
    }

    setLoading(false)
  }

  async function patch(id:string, field:string, value:any){
    const update:any = {[field]:value}

    if(field === 'status' && value === 'Entregue'){
      update.delivered_at = today()
    }

    await supabase
      .from('service_orders')
      .update(update)
      .eq('id',id)

    load()
  }

  const filtered = useMemo(()=>{
    const q = search.toLowerCase().trim()
    return rows.filter(r=>{
      const text = [
        r.os_number,
        r.service,
        r.service_type,
        r.clients?.name,
        r.clients?.company,
        r.clients?.phone,
        r.status,
        r.priority
      ].join(' ').toLowerCase()

      if(q && !text.includes(q)) return false
      if(statusFilter && r.status !== statusFilter) return false
      if(priorityFilter && (r.priority || 'Média') !== priorityFilter) return false

      return true
    })
  },[rows,search,statusFilter,priorityFilter])

  const totalValue = filtered.reduce((a,b)=>a+Number(b.estimated_price||0),0)
  const inProduction = filtered.filter(r=>['Designer','Produção','Impressão','Acabamento'].includes(r.status)).length
  const done = filtered.filter(r=>['Pronto','Entregue'].includes(r.status)).length

  async function professionalPdf(o:any, production=false){
    const pdf = new jsPDF('p','mm','a4')
    const cfg = company || {}

    pdf.setFillColor(18,18,18)
    pdf.rect(0,0,210,26,'F')

    const logoUrl = cfg.logo_url || '/logo.png'
    const logo = await imageToDataURL(logoUrl)

    if(logo){
      try{ pdf.addImage(logo,'PNG',10,6,48,15) }catch{}
    }else{
      pdf.setTextColor(244,197,66)
      pdf.setFontSize(16)
      pdf.text(cfg.company_name || 'Garagem Comunicação Visual',10,15)
    }

    pdf.setTextColor(255,255,255)
    pdf.setFontSize(14)
    pdf.text(production ? 'ORDEM DE PRODUÇÃO' : 'ORDEM DE SERVIÇO',130,11)
    pdf.setFontSize(9)
    pdf.text(o.os_number || '-',130,18)

    pdf.setTextColor(0,0,0)
    pdf.setFontSize(8)
    pdf.text(cfg.company_name || 'Garagem Comunicação Visual',10,34)
    pdf.text(`CNPJ: ${cfg.cnpj || '36.685.414/0001-49'}`,10,39)
    pdf.text(cfg.address || 'R. Califórnia, 287 - Guaraituba, Colombo - PR',10,44)
    pdf.text(`Telefone: ${cfg.phone || '(41) 99267-5409'}`,10,49)

    pdf.setDrawColor(220,220,220)
    pdf.line(10,56,200,56)

    pdf.setFontSize(11)
    pdf.text('DADOS DO CLIENTE',10,66)

    pdf.setFontSize(9)
    pdf.text(`Cliente: ${o.clients?.name || '-'}`,10,76)
    pdf.text(`Empresa: ${o.clients?.company || '-'}`,10,83)
    pdf.text(`Telefone: ${o.clients?.phone || '-'}`,10,90)
    pdf.text(`Endereço: ${o.clients?.address || '-'}`,10,97)

    pdf.text(`Emissão: ${new Date().toLocaleDateString('pt-BR')}`,132,76)
    pdf.text(`Previsão: ${brDate(o.due_date)}`,132,83)
    pdf.text(`Entrega: ${brDate(o.delivered_at)}`,132,90)
    pdf.text(`Status: ${o.status || '-'}`,132,97)

    pdf.line(10,106,200,106)

    pdf.setFontSize(11)
    pdf.text('DESCRIÇÃO DO SERVIÇO',10,116)

    pdf.setFontSize(9)
    pdf.text(`Serviço: ${o.service || '-'}`,10,128)
    pdf.text(`Tipo: ${o.service_type || '-'}`,10,136)
    pdf.text(`Medidas: ${o.measures || '-'}`,10,144)
    pdf.text(`Acabamento: ${o.finishing || '-'}`,10,152)
    pdf.text(`Prioridade: ${o.priority || 'Média'}`,132,128)
    pdf.text(`Valor: ${money(o.estimated_price)}`,132,136)

    pdf.text('Observações:',10,164)
    pdf.text(pdf.splitTextToSize(o.description || 'Sem observações.',185),10,171)

    pdf.line(10,194,200,194)

    pdf.setFontSize(11)
    pdf.text('RESPONSÁVEIS',10,204)
    pdf.setFontSize(9)
    pdf.text(`Designer: ${o.designer_responsible || '-'}`,10,214)
    pdf.text(`Impressor: ${o.printer_responsible || '-'}`,95,214)

    if(o.print_file_url){
      pdf.setFontSize(11)
      pdf.text('ARQUIVO ANEXO',10,228)
      pdf.setFontSize(9)
      pdf.textWithLink(o.drive_file_name || 'Abrir arquivo enviado',10,238,{url:o.print_file_url})
    }

    if(!production){
      pdf.line(20,267,90,267)
      pdf.line(120,267,190,267)
      pdf.setFontSize(9)
      pdf.text('Assinatura do Cliente',33,274)
      pdf.text('Responsável Garagem',134,274)
    }else{
      pdf.line(20,267,90,267)
      pdf.line(120,267,190,267)
      pdf.setFontSize(9)
      pdf.text('Produção',44,274)
      pdf.text('Conferência',143,274)
    }

    pdf.setFillColor(18,18,18)
    pdf.rect(0,286,210,11,'F')
    pdf.setTextColor(255,255,255)
    pdf.setFontSize(8)
    pdf.text('Garagem Comunicação Visual',10,293)
    pdf.text(cfg.phone || '(41) 99267-5409',165,293)

    pdf.save(`${production?'producao':'os'}-${o.os_number || 'ordem'}.pdf`)
  }

  return (
    <div>
      <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-4xl font-black">Ordens de Serviço</h1>
          <p className="text-zinc-400">Gerencie serviços, arquivos, produção e PDFs profissionais.</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button className="btn-dark" onClick={load}>{loading?'Atualizando...':'Atualizar'}</button>
        </div>
      </header>

      <section className="mb-5 grid gap-4 md:grid-cols-4">
        <article className="card">
          <small className="text-zinc-400">Total de OS</small>
          <h2 className="text-3xl font-black">{filtered.length}</h2>
        </article>
        <article className="card">
          <small className="text-zinc-400">Em produção</small>
          <h2 className="text-3xl font-black">{inProduction}</h2>
        </article>
        <article className="card">
          <small className="text-zinc-400">Finalizadas</small>
          <h2 className="text-3xl font-black">{done}</h2>
        </article>
        <article className="card">
          <small className="text-zinc-400">Valor total</small>
          <h2 className="text-3xl font-black">{money(totalValue)}</h2>
        </article>
      </section>

      <section className="card mb-5 grid gap-3 md:grid-cols-4">
        <input
          className="input md:col-span-2"
          placeholder="Buscar por OS, cliente, serviço ou telefone..."
          value={search}
          onChange={e=>setSearch(e.target.value)}
        />

        <select className="input" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
          <option value="">Todos os status</option>
          {statuses.map(s=><option key={s}>{s}</option>)}
        </select>

        <select className="input" value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value)}>
          <option value="">Todas prioridades</option>
          {priorities.map(p=><option key={p}>{p}</option>)}
        </select>
      </section>

      <div className="card p-0">
        <div className="overflow-x-auto">
          <table className="min-w-[1450px]">
            <thead>
              <tr className="bg-black/30">
                <th>OS</th>
                <th>Cliente</th>
                <th>Serviço</th>
                <th>Valor</th>
                <th>Arquivo</th>
                <th>Responsáveis</th>
                <th>Datas</th>
                <th>Prioridade</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map(r=>(
                <tr key={r.id} className="hover:bg-white/[0.03]">
                  <td>
                    <strong className="text-base">{r.os_number}</strong><br/>
                    <span className="badge info">{r.source || 'Interno'}</span>
                  </td>

                  <td>
                    <strong>{r.clients?.name || '-'}</strong><br/>
                    <small className="text-zinc-400">{r.clients?.company || '-'}</small><br/>
                    <small className="text-zinc-500">{r.clients?.phone || '-'}</small>
                  </td>

                  <td>
                    <strong>{r.service}</strong><br/>
                    <small className="text-zinc-400">{r.service_type}</small><br/>
                    <small className="text-zinc-400">{r.finishing}</small><br/>
                    <small className="text-zinc-500">{r.measures}</small>
                  </td>

                  <td>
                    <strong>{money(r.estimated_price)}</strong>
                  </td>

                  <td className="min-w-[190px]">
                    {r.print_file_url ? (
                      <div className="grid gap-2">
                        <a className="btn-gold text-center" href={r.print_file_url} target="_blank" rel="noreferrer">
                          Abrir arquivo
                        </a>
                        <a className="btn-dark text-center" href={r.print_file_url} target="_blank" rel="noreferrer">
                          Baixar
                        </a>
                        <small className="break-all text-zinc-400">{r.drive_file_name || 'Arquivo enviado'}</small>
                      </div>
                    ) : (
                      <span className="text-zinc-500">Sem arquivo</span>
                    )}
                  </td>

                  <td className="min-w-[210px]">
                    <input className="input mb-2" placeholder="Designer" defaultValue={r.designer_responsible || ''} onBlur={e=>patch(r.id,'designer_responsible',e.target.value)}/>
                    <input className="input" placeholder="Impressor" defaultValue={r.printer_responsible || ''} onBlur={e=>patch(r.id,'printer_responsible',e.target.value)}/>
                  </td>

                  <td className="min-w-[210px]">
                    <label className="text-xs text-zinc-400">Prevista</label>
                    <input type="date" className="input mb-2" defaultValue={r.due_date || ''} onBlur={e=>patch(r.id,'due_date',e.target.value || null)}/>
                    <label className="text-xs text-zinc-400">Entrega</label>
                    <input type="date" className="input" defaultValue={r.delivered_at || ''} onBlur={e=>patch(r.id,'delivered_at',e.target.value || null)}/>
                  </td>

                  <td>
                    <select className={`input ${statusClass(r.priority || 'Média')}`} value={r.priority || 'Média'} onChange={e=>patch(r.id,'priority',e.target.value)}>
                      {priorities.map(p=><option key={p}>{p}</option>)}
                    </select>
                  </td>

                  <td>
                    <select className={`input ${statusClass(r.status)}`} value={r.status || 'Entrada'} onChange={e=>patch(r.id,'status',e.target.value)}>
                      {statuses.map(s=><option key={s}>{s}</option>)}
                    </select>
                  </td>

                  <td className="min-w-[150px]">
                    <div className="grid gap-2">
                      <button className="btn-gold" onClick={()=>professionalPdf(r,false)}>PDF OS</button>
                      <button className="btn-dark" onClick={()=>professionalPdf(r,true)}>Produção</button>
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length===0 && (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-zinc-400">
                    Nenhuma ordem de serviço encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
