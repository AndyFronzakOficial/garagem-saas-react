import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import jsPDF from 'jspdf'

function money(v:any){
  return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0))
}

function brDate(v?:string|null){
  if(!v)return '-'
  const [y,m,d]=v.slice(0,10).split('-')
  return `${d}/${m}/${y}`
}

function today(){
  return new Date().toISOString().slice(0,10)
}

const statuses = ['Entrada','Designer','Produção','Impressão','Acabamento','Pronto','Entregue']
const priorities = ['Baixa','Média','Alta','Urgente']

function statusClass(s:string){
  if(['Pronto','Entregue'].includes(s)) return 'success'
  if(['Urgente','Cancelado'].includes(s)) return 'danger'
  if(['Designer','Produção','Impressão','Acabamento','Alta'].includes(s)) return 'info'
  return 'warning'
}

export default function Orders(){
  const [rows,setRows]=useState<any[]>([])
  const [loading,setLoading]=useState(false)

  useEffect(()=>{load()},[])

  async function load(){
    setLoading(true)

    const {data,error}=await supabase
      .from('service_orders')
      .select('*,clients(*)')
      .order('created_at',{ascending:false})

    if(!error){
      setRows((data||[]).filter((r:any)=>!r.is_deleted))
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

  function downloadPdf(o:any){
    const pdf = new jsPDF('p','mm','a4')

    pdf.setFontSize(18)
    pdf.text('Garagem Comunicação Visual',12,16)

    pdf.setFontSize(10)
    pdf.text('CNPJ: 36.685.414/0001-49',12,24)
    pdf.text('R. Califórnia, 287 - Guaraituba, Colombo - PR',12,30)
    pdf.text('(41) 99267-5409',12,36)

    pdf.setFontSize(16)
    pdf.text('ORDEM DE SERVIÇO / RETIRADA',12,52)

    pdf.setFontSize(10)
    pdf.text(`OS: ${o.os_number || '-'}`,12,66)
    pdf.text(`Cliente: ${o.clients?.name || '-'}`,12,76)
    pdf.text(`Empresa: ${o.clients?.company || '-'}`,12,84)
    pdf.text(`Telefone: ${o.clients?.phone || '-'}`,12,92)
    pdf.text(`Endereço: ${o.clients?.address || '-'}`,12,100)

    pdf.roundedRect(12,110,186,60,3,3)

    pdf.text(`Serviço: ${o.service || '-'}`,18,122)
    pdf.text(`Tipo: ${o.service_type || '-'}`,18,130)
    pdf.text(`Medidas: ${o.measures || '-'}`,18,138)
    pdf.text(`Acabamento: ${o.finishing || '-'}`,18,146)
    pdf.text(`Status: ${o.status || '-'}`,18,154)
    pdf.text(`Valor: ${money(o.estimated_price)}`,18,162)

    pdf.text(`Data prevista: ${brDate(o.due_date)}`,110,122)
    pdf.text(`Data entrega: ${brDate(o.delivered_at)}`,110,130)
    pdf.text(`Prioridade: ${o.priority || 'Média'}`,110,138)

    pdf.text('Observações:',12,184)
    pdf.text(pdf.splitTextToSize(o.description || 'Sem observações.',180),12,192)

    pdf.text('Declaro que recebi/conferi o serviço descrito nesta Ordem de Serviço.',12,238)
    pdf.line(20,265,90,265)
    pdf.line(120,265,190,265)
    pdf.text('Assinatura do Cliente',34,272)
    pdf.text('Responsável Garagem',136,272)

    pdf.save(`${o.os_number || 'ordem-servico'}.pdf`)
  }

  function productionPdf(o:any){
    const pdf = new jsPDF('p','mm','a4')

    pdf.setFontSize(18)
    pdf.text('ORDEM DE PRODUÇÃO',12,18)

    pdf.setFontSize(11)
    pdf.text(`OS: ${o.os_number || '-'}`,12,34)
    pdf.text(`Serviço: ${o.service || '-'}`,12,44)
    pdf.text(`Cliente: ${o.clients?.company || o.clients?.name || '-'}`,12,54)
    pdf.text(`Medidas: ${o.measures || '-'}`,12,64)
    pdf.text(`Acabamento: ${o.finishing || '-'}`,12,74)
    pdf.text(`Designer: ${o.designer_responsible || '-'}`,12,84)
    pdf.text(`Impressor: ${o.printer_responsible || '-'}`,12,94)
    pdf.text(`Prioridade: ${o.priority || 'Média'}`,12,104)

    pdf.text('Observações:',12,120)
    pdf.text(pdf.splitTextToSize(o.description || 'Sem observações.',180),12,130)

    if(o.print_file_url){
      pdf.text('Arquivo:',12,174)
      pdf.textWithLink('Abrir arquivo enviado',30,174,{url:o.print_file_url})
    }

    pdf.line(20,250,90,250)
    pdf.line(120,250,190,250)
    pdf.text('Produção',45,258)
    pdf.text('Conferência',145,258)

    pdf.save(`producao-${o.os_number || 'os'}.pdf`)
  }

  return (
    <div>
      <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-4xl font-black">Ordens de Serviço</h1>
          <p className="text-zinc-400">Serviços lançados pelo portal, orçamento rápido e atendimento.</p>
        </div>

        <button className="btn-dark" onClick={load}>
          {loading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </header>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>OS</th>
              <th>Cliente</th>
              <th>Serviço</th>
              <th>Valor</th>
              <th>Arquivo</th>
              <th>Responsáveis</th>
              <th>Datas</th>
              <th>Prioridade</th>
              <th>Status</th>
              <th>PDF</th>
            </tr>
          </thead>

          <tbody>
            {rows.map(r=>(
              <tr key={r.id}>
                <td>
                  <strong>{r.os_number}</strong><br/>
                  <span className="badge info">{r.source || 'Interno'}</span>
                </td>

                <td>
                  {r.clients?.name || '-'}<br/>
                  <small>{r.clients?.company || '-'}</small><br/>
                  <small>{r.clients?.phone || '-'}</small>
                </td>

                <td>
                  <strong>{r.service}</strong><br/>
                  <small>{r.service_type}</small><br/>
                  <small>{r.finishing}</small><br/>
                  <small>{r.measures}</small>
                </td>

                <td>{money(r.estimated_price)}</td>

                <td>
                  {r.print_file_url ? (
                    <div className="flex flex-col gap-2">
                      <a className="btn-gold text-center" href={r.print_file_url} target="_blank" rel="noreferrer">
                        Abrir arquivo
                      </a>

                      <a className="btn-dark text-center" href={r.print_file_url} target="_blank" rel="noreferrer">
                        Baixar
                      </a>

                      {r.drive_file_name && (
                        <small className="text-zinc-400">{r.drive_file_name}</small>
                      )}
                    </div>
                  ) : (
                    <span className="text-zinc-500">Sem arquivo</span>
                  )}
                </td>

                <td>
                  <input
                    className="input mb-2"
                    placeholder="Designer"
                    defaultValue={r.designer_responsible || ''}
                    onBlur={e=>patch(r.id,'designer_responsible',e.target.value)}
                  />

                  <input
                    className="input"
                    placeholder="Impressor"
                    defaultValue={r.printer_responsible || ''}
                    onBlur={e=>patch(r.id,'printer_responsible',e.target.value)}
                  />
                </td>

                <td>
                  <label className="text-xs text-zinc-400">Prevista</label>
                  <input
                    type="date"
                    className="input mb-2"
                    defaultValue={r.due_date || ''}
                    onBlur={e=>patch(r.id,'due_date',e.target.value || null)}
                  />

                  <label className="text-xs text-zinc-400">Entrega</label>
                  <input
                    type="date"
                    className="input"
                    defaultValue={r.delivered_at || ''}
                    onBlur={e=>patch(r.id,'delivered_at',e.target.value || null)}
                  />
                </td>

                <td>
                  <select
                    className={`input ${statusClass(r.priority || 'Média')}`}
                    value={r.priority || 'Média'}
                    onChange={e=>patch(r.id,'priority',e.target.value)}
                  >
                    {priorities.map(p=><option key={p}>{p}</option>)}
                  </select>
                </td>

                <td>
                  <select
                    className={`input ${statusClass(r.status)}`}
                    value={r.status}
                    onChange={e=>patch(r.id,'status',e.target.value)}
                  >
                    {statuses.map(s=><option key={s}>{s}</option>)}
                  </select>
                </td>

                <td>
                  <div className="flex flex-col gap-2">
                    <button className="btn-gold" onClick={()=>downloadPdf(r)}>
                      Retirada
                    </button>

                    <button className="btn-dark" onClick={()=>productionPdf(r)}>
                      Produção
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {rows.length===0 && (
              <tr>
                <td colSpan={10} className="text-zinc-400">
                  Nenhuma ordem de serviço encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
