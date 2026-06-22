import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { money, statusClass, today } from '../lib/utils'
import { nextOSNumber } from '../lib/osNumber'
import jsPDF from 'jspdf'

function formatCm(v:any){ return `${Number(v || 0).toFixed(0)}cm` }
function brDate(v?:string|null){
  if(!v)return '-'
  const [y,m,d]=v.slice(0,10).split('-')
  return y && m && d ? `${d}/${m}/${y}` : '-'
}
async function imageToDataURL(url:string){
  try{
    const res = await fetch(url,{mode:'cors'})
    const blob = await res.blob()
    return await new Promise<string>((resolve,reject)=>{
      const reader = new FileReader()
      reader.onloadend = () => resolve(String(reader.result))
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }catch{ return '' }
}
function normalizeItems(r:any){
  if(Array.isArray(r.quote_items) && r.quote_items.length) return r.quote_items
  return [{
    service_price_id:r.service_price_id,
    service_name:r.service_name || r.service || 'Serviço',
    width_cm:Number(r.width_cm || 0) || Number(r.width_m || 0) * 100,
    height_cm:Number(r.height_cm || 0) || Number(r.height_m || 0) * 100,
    width_m:Number(r.width_m || 0) || Number(r.width_cm || 0) / 100,
    height_m:Number(r.height_m || 0) || Number(r.height_cm || 0) / 100,
    area_m2:Number(r.area_m2 || 0),
    price_m2:r.price_m2 || 0,
    estimated_price:r.estimated_price || 0,
    observation:r.description || null
  }]
}
function servicesDescription(items:any[]){
  return items.map((item,index)=>{
    const obs = item.observation ? ` Obs: ${item.observation}` : ''
    return `${index+1}. ${item.service_name || 'Serviço'} - ${formatCm(item.width_cm)} x ${formatCm(item.height_cm)} - ${money(item.estimated_price)}.${obs}`
  }).join('\n')
}

export default function Quotes(){
  const [rows,setRows]=useState<any[]>([])
  const [company,setCompany]=useState<any>(null)
  const [msg,setMsg]=useState('')
  const [loading,setLoading]=useState(false)
  const [search,setSearch]=useState('')
  const [statusFilter,setStatusFilter]=useState('')

  useEffect(()=>{load()},[])

  async function load(){
    setLoading(true)
    const [quotes,cfg]=await Promise.all([
      supabase.from('public_quotes').select('*').order('created_at',{ascending:false}),
      supabase.from('company_settings').select('*').eq('id',1).maybeSingle()
    ])
    if(quotes.error) setMsg('Erro ao carregar orçamentos: ' + quotes.error.message)
    else setRows(quotes.data || [])
    if(!cfg.error) setCompany(cfg.data)
    setLoading(false)
  }

  const filtered = useMemo(()=>{
    const q = search.toLowerCase().trim()
    return rows.filter(r=>{
      const text = [r.quote_number,r.client_name,r.company,r.phone,r.email,r.project_name,r.service_name,r.description,JSON.stringify(r.quote_items || [])].join(' ').toLowerCase()
      if(q && !text.includes(q)) return false
      if(statusFilter && (r.status || 'Novo') !== statusFilter) return false
      return true
    })
  },[rows,search,statusFilter])

  async function updateStatus(id:string,status:string){
    await supabase.from('public_quotes').update({status}).eq('id',id)
    load()
  }

  async function findOrCreateClient(r:any){
    const phone = r.phone || ''
    if(phone){
      const existing = await supabase.from('clients').select('*').eq('phone',phone).maybeSingle()
      if(existing.data) return existing.data.id
    }
    const created = await supabase.from('clients').insert({
      name:r.client_name || r.company || 'Cliente sem nome',
      company:r.company || r.client_name || 'Sem empresa',
      phone:r.phone || '',
      email:r.email || null,
      address:r.address || null
    }).select('*').single()
    if(created.error) throw new Error('Erro ao criar cliente: ' + created.error.message)
    return created.data.id
  }

  async function convertToOrder(r:any){
    const ok = confirm('Converter este orçamento aprovado em Ordem de Serviço?')
    if(!ok) return
    setLoading(true)
    setMsg('')
    try{
      const clientId = await findOrCreateClient(r)
      const num = await nextOSNumber()
      const items = normalizeItems(r)
      const first = items[0] || {}
      const fileUrl = r.file_url || r.print_file_url || r.drive_link || null
      const total = items.reduce((sum:any,item:any)=>sum+Number(item.estimated_price || 0),0) || Number(r.estimated_price || 0)

      const { error: orderError } = await supabase.from('service_orders').insert({
        os_number:num,
        client_id:clientId,
        service:items.length > 1 ? `${items.length} serviços` : (first.service_name || r.service_name || 'Orçamento'),
        service_price_id:first.service_price_id || r.service_price_id || null,
        service_type:first.service_name || r.service_name || 'Orçamento',
        width_m:first.width_m || 0,
        height_m:first.height_m || 0,
        width_cm:first.width_cm || 0,
        height_cm:first.height_cm || 0,
        area_m2:items.reduce((sum:any,item:any)=>sum+Number(item.area_m2 || 0),0),
        price_m2:first.price_m2 || 0,
        estimated_price:total,
        measures:items.length > 1 ? `${items.length} serviços no orçamento` : `${formatCm(first.width_cm)} x ${formatCm(first.height_cm)}`,
        finishing:'Sem acabamento',
        description:r.description || servicesDescription(items),
        print_file_url:fileUrl,
        drive_file_id:r.drive_file_id || null,
        drive_file_name:r.drive_file_name || null,
        drive_folder_id:r.drive_folder_id || null,
        project_image_url:r.project_image_url || null,
        project_image_name:r.project_image_name || null,
        project_image_path:r.project_image_path || null,
        approved_art_image_url:r.project_image_url || null,
        approved_art_image_name:r.project_image_name || null,
        approved_art_image_path:r.project_image_path || null,
        quote_items:items,
        source:'Orçamento Público',
        status:'Entrada',
        priority:'Média',
        due_date:null,
        delivered_at:null
      })
      if(orderError) throw new Error('Erro ao criar ordem de serviço: ' + orderError.message)

      await supabase.from('accounts_receivable').insert({
        client_id:clientId,
        title:`${num} - ${r.project_name || first.service_name || 'Orçamento'}`,
        due_date:today(),
        amount:total,
        reference:new Date().toLocaleDateString('pt-BR',{month:'2-digit',year:'numeric'}),
        status:'Aberto'
      })

      const { error: quoteError } = await supabase.from('public_quotes').update({ status:'Convertido', converted_os_number:num }).eq('id',r.id)
      if(quoteError) setMsg(`OS ${num} criada, mas não consegui atualizar o orçamento: ${quoteError.message}`)
      else setMsg(`Orçamento convertido para ${num}. Agora aparece em Ordens de Serviço.`)
      load()
    }catch(err:any){
      setMsg(err.message || 'Erro ao converter orçamento.')
    }finally{ setLoading(false) }
  }

  async function quotePdf(r:any){
    const pdf = new jsPDF('p','mm','a4')
    const cfg = company || {}
    const items = normalizeItems(r)
    const total = items.reduce((sum:number,item:any)=>sum+Number(item.estimated_price || 0),0) || Number(r.estimated_price || 0)

    pdf.setFillColor(18,18,18)
    pdf.rect(0,0,210,26,'F')
    const logo = await imageToDataURL(cfg.logo_url || '/logo.png')
    if(logo){ try{ pdf.addImage(logo,'PNG',10,6,48,15) }catch{} }
    else{
      pdf.setTextColor(244,197,66); pdf.setFontSize(16); pdf.text(cfg.company_name || 'Garagem Comunicação Visual',10,15)
    }
    pdf.setTextColor(255,255,255); pdf.setFontSize(14); pdf.text('ORÇAMENTO',142,11); pdf.setFontSize(9); pdf.text(r.quote_number || '-',142,18)

    pdf.setTextColor(0,0,0); pdf.setFontSize(8)
    pdf.text(cfg.company_name || 'Garagem Comunicação Visual',10,34)
    pdf.text(`CNPJ: ${cfg.cnpj || '36.685.414/0001-49'}`,10,39)
    pdf.text(cfg.address || 'R. Califórnia, 287 - Guaraituba, Colombo - PR',10,44)
    pdf.text(`Telefone: ${cfg.phone || '(41) 99267-5409'}`,10,49)
    pdf.line(10,56,200,56)

    pdf.setFontSize(11); pdf.text('DADOS DO CLIENTE',10,66)
    pdf.setFontSize(9)
    pdf.text(`Cliente: ${r.client_name || '-'}`,10,76)
    pdf.text(`Empresa: ${r.company || '-'}`,10,83)
    pdf.text(`Telefone: ${r.phone || '-'}`,10,90)
    pdf.text(`E-mail: ${r.email || '-'}`,10,97)
    pdf.text(`Projeto: ${r.project_name || '-'}`,118,76)
    pdf.text(`Emissão: ${new Date().toLocaleDateString('pt-BR')}`,118,83)
    pdf.text(`Status: ${r.status || 'Novo'}`,118,90)
    pdf.line(10,106,200,106)

    pdf.setFontSize(11); pdf.text('SERVIÇOS DO ORÇAMENTO',10,116)
    let y = 126
    pdf.setFontSize(8.5)
    items.forEach((item:any,index:number)=>{
      if(y > 238){ pdf.addPage(); y = 20 }
      pdf.setFont('helvetica','bold')
      pdf.text(`${index+1}. ${item.service_name || 'Serviço'}`,10,y)
      pdf.setFont('helvetica','normal')
      pdf.text(`Medidas: ${formatCm(item.width_cm)} x ${formatCm(item.height_cm)} | Área: ${Number(item.area_m2 || 0).toFixed(2)} m²`,10,y+6)
      pdf.text(`Valor: ${money(item.estimated_price)}`,150,y+6)
      const obs = item.observation || 'Sem observação.'
      pdf.text(pdf.splitTextToSize(`Observação: ${obs}`,185),10,y+12)
      y += 24
    })
    y += 4
    pdf.setFontSize(11); pdf.text(`TOTAL: ${money(total)}`,150,y)

    if(r.project_image_url){
      const img = await imageToDataURL(r.project_image_url)
      if(img){ try{ pdf.addImage(img,'JPEG',118,158,72,50) }catch{ try{ pdf.addImage(img,'PNG',118,158,72,50) }catch{} } }
      pdf.setFontSize(10); pdf.text('Imagem do projeto',118,154)
    }

    pdf.line(20,267,90,267); pdf.line(120,267,190,267)
    pdf.setFontSize(9); pdf.text('Assinatura do Cliente',33,274); pdf.text('Responsável Garagem',134,274)
    pdf.setFillColor(18,18,18); pdf.rect(0,286,210,11,'F')
    pdf.setTextColor(255,255,255); pdf.setFontSize(8); pdf.text('Garagem Comunicação Visual',10,293); pdf.text(cfg.phone || '(41) 99267-5409',165,293)
    pdf.save(`orcamento-${r.quote_number || 'cliente'}.pdf`)
  }

  return (
    <div>
      <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-4xl font-black">Orçamentos</h1>
          <p className="text-zinc-400">Orçamentos públicos recebidos, PDF para cliente e conversão para OS aprovada.</p>
        </div>
        <button className="btn-dark" onClick={load}>{loading ? 'Atualizando...' : 'Atualizar'}</button>
      </header>

      {msg && <div className="mb-4 rounded-xl border border-gold/30 bg-gold/10 p-4 text-gold">{msg}</div>}

      <section className="card mb-5 grid gap-3 md:grid-cols-3">
        <input className="input md:col-span-2" placeholder="Buscar por cliente, projeto, serviço, telefone..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <select className="input" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
          <option value="">Todos os status</option>
          <option>Novo</option><option>Em análise</option><option>Convertido</option><option>Recusado</option>
        </select>
      </section>

      <div className="card table-wrap">
        <table className="min-w-[1350px]">
          <thead><tr><th>Código</th><th>Cliente</th><th>Projeto</th><th>Serviços</th><th>Imagem/Arquivo</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            {filtered.map(r=>{
              const items = normalizeItems(r)
              const total = items.reduce((sum:number,item:any)=>sum+Number(item.estimated_price || 0),0) || Number(r.estimated_price || 0)
              return (
                <tr key={r.id}>
                  <td><strong>{r.quote_number}</strong><br/>{r.converted_os_number && <small className="text-green-300">OS: {r.converted_os_number}</small>}<br/><small className="text-zinc-500">{brDate(r.created_at)}</small></td>
                  <td><strong>{r.client_name}</strong><br/><small>{r.company}</small><br/><small>{r.phone}</small><br/><small>{r.email}</small></td>
                  <td><strong>{r.project_name || '-'}</strong><br/><small className="text-zinc-400">{r.description || '-'}</small></td>
                  <td>
                    <div className="grid gap-2">
                      {items.map((item:any,index:number)=>(
                        <div key={index} className="rounded-xl border border-white/10 bg-black/20 p-2">
                          <strong>{index+1}. {item.service_name}</strong><br/>
                          <small>{formatCm(item.width_cm)} x {formatCm(item.height_cm)} • {money(item.estimated_price)}</small><br/>
                          {item.observation && <small className="text-zinc-400">Obs: {item.observation}</small>}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td>
                    {r.project_image_url && <a className="btn-gold mb-2 inline-block" href={r.project_image_url} target="_blank" rel="noreferrer">Ver imagem</a>}
                    {(r.file_url || r.print_file_url || r.drive_link) ? <a className="btn-dark inline-block" href={r.file_url || r.print_file_url || r.drive_link} target="_blank" rel="noreferrer">Abrir arquivo</a> : <span className="text-zinc-500">Sem arquivo</span>}
                  </td>
                  <td><strong>{money(total)}</strong></td>
                  <td>
                    <select className={`input ${statusClass(r.status || 'Novo')}`} value={r.status || 'Novo'} onChange={e=>updateStatus(r.id,e.target.value)}>
                      <option>Novo</option><option>Em análise</option><option>Convertido</option><option>Recusado</option>
                    </select>
                  </td>
                  <td><div className="grid gap-2"><button className="btn-dark" onClick={()=>quotePdf(r)}>PDF Orçamento</button><button disabled={loading || r.status === 'Convertido'} className="btn-gold" onClick={()=>convertToOrder(r)}>{r.status === 'Convertido' ? 'Convertido' : 'Converter OS'}</button></div></td>
                </tr>
              )
            })}
            {filtered.length===0 && <tr><td colSpan={8} className="p-8 text-center text-zinc-400">Nenhum orçamento encontrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
