import { useEffect, useMemo, useRef, useState } from 'react'
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

const statuses = ['Entrada','Designer','Produção','Impressão','Acabamento','Pronto','Entregue','Cancelado']
const priorities = ['Baixa','Média','Alta','Urgente']

function statusClass(s:string){
  if(['Pronto','Entregue','Recebido','Paga'].includes(s)) return 'success'
  if(['Urgente','Cancelado','Vencido','Vencida'].includes(s)) return 'danger'
  if(['Designer','Produção','Impressão','Acabamento','Alta'].includes(s)) return 'info'
  return 'warning'
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
  }catch{
    return ''
  }
}

function imageSize(dataUrl:string){
  return new Promise<{width:number,height:number}>((resolve,reject)=>{
    const img = new Image()
    img.onload = () => resolve({width:img.width,height:img.height})
    img.onerror = reject
    img.src = dataUrl
  })
}

async function addProjectImageToPdf(pdf:jsPDF, imageUrl?:string|null){
  if(!imageUrl) return

  const dataUrl = await imageToDataURL(imageUrl)
  if(!dataUrl) return

  try{
    const size = await imageSize(dataUrl)
    const maxW = 92
    const maxH = 58
    const ratio = Math.min(maxW / size.width, maxH / size.height)
    const w = size.width * ratio
    const h = size.height * ratio
    const x = 108 + ((maxW - w) / 2)
    const y = 163 + ((maxH - h) / 2)

    pdf.setFontSize(11)
    pdf.text('ARTE APROVADA / IMAGEM DO PROJETO',108,158)
    pdf.setDrawColor(220,220,220)
    pdf.roundedRect(108,161,maxW,maxH,2,2)
    pdf.addImage(dataUrl, x, y, w, h)
  }catch{}
}


function normalizeItems(o:any){
  if(Array.isArray(o.quote_items) && o.quote_items.length) return o.quote_items
  return [{
    service_name:o.service || o.service_type || 'Serviço',
    width_cm:Number(o.width_cm || 0) || Number(o.width_m || 0) * 100,
    height_cm:Number(o.height_cm || 0) || Number(o.height_m || 0) * 100,
    area_m2:Number(o.area_m2 || 0),
    estimated_price:o.estimated_price || 0,
    observation:o.description || null
  }]
}

function formatCm(v:any){
  return `${Number(v || 0).toFixed(0)}cm`
}
function numberInput(v:any){ return Number(String(v ?? '').replace(',','.')) || 0 }

export default function Orders(){
  const [rows,setRows]=useState<any[]>([])
  const [company,setCompany]=useState<any>(null)
  const [loading,setLoading]=useState(false)
  const [search,setSearch]=useState('')
  const [statusFilter,setStatusFilter]=useState('')
  const [priorityFilter,setPriorityFilter]=useState('')
  const [periodType,setPeriodType]=useState('')
  const [periodValue,setPeriodValue]=useState('')
  const [valueOrder,setValueOrder]=useState('')
  const [selectedIds,setSelectedIds]=useState<string[]>([])
  const [msg,setMsg]=useState('')
  const [editOrder,setEditOrder]=useState<any|null>(null)
  const topScrollRef = useRef<HTMLDivElement|null>(null)
  const tableScrollRef = useRef<HTMLDivElement|null>(null)

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
      setSelectedIds([])
    }

    if(!cfg.error){
      setCompany(cfg.data)
    }

    setLoading(false)
  }

  function syncHorizontalScroll(source:'top'|'table'){
    const top = topScrollRef.current
    const table = tableScrollRef.current
    if(!top || !table) return
    if(source === 'top') table.scrollLeft = top.scrollLeft
    else top.scrollLeft = table.scrollLeft
  }


  function toggleSelected(id:string, checked:boolean){
    setSelectedIds(prev=>checked ? Array.from(new Set([...prev,id])) : prev.filter(x=>x!==id))
  }

  function toggleAllVisible(checked:boolean){
    setSelectedIds(checked ? filtered.map(r=>r.id) : [])
  }

  

  async function deleteSelectedOrders(){
    if(selectedIds.length === 0){ setMsg('Selecione pelo menos uma ordem de serviço para excluir.'); return }
    const ok = confirm(`Excluir ${selectedIds.length} ordem(ns) de serviço selecionada(s)?`)
    if(!ok) return
    setLoading(true)
    const { error } = await supabase.from('service_orders').update({ is_deleted:true }).in('id', selectedIds)
    if(error) setMsg('Erro ao excluir ordem(ns): ' + error.message)
    else setMsg(`${selectedIds.length} ordem(ns) excluída(s) com sucesso.`)
    setSelectedIds([])
    await load()
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

  function openEditOrder(o:any){
    setEditOrder({
      id:o.id,
      os_number:o.os_number || '',
      service:o.service || '',
      service_type:o.service_type || '',
      finishing:o.finishing || '',
      measures:o.measures || '',
      description:o.description || '',
      estimated_price:String(o.estimated_price || ''),
      priority:o.priority || 'Média',
      status:o.status || 'Entrada',
      due_date:o.due_date || '',
      delivered_at:o.delivered_at || ''
    })
    setMsg('Editando ordem de serviço. Altere os campos e clique em salvar alteração.')
    window.scrollTo({top:0,behavior:'smooth'})
  }

  async function saveEditedOrder(e:React.FormEvent){
    e.preventDefault()
    if(!editOrder) return
    setLoading(true)
    const update:any = {
      service:editOrder.service,
      service_type:editOrder.service_type,
      finishing:editOrder.finishing,
      measures:editOrder.measures,
      description:editOrder.description,
      estimated_price:numberInput(editOrder.estimated_price),
      priority:editOrder.priority,
      status:editOrder.status,
      due_date:editOrder.due_date || null,
      delivered_at:editOrder.delivered_at || null
    }
    if(editOrder.status === 'Entregue' && !update.delivered_at) update.delivered_at = today()
    const { error } = await supabase.from('service_orders').update(update).eq('id',editOrder.id)
    if(error) setMsg('Erro ao atualizar OS: ' + error.message)
    else { setMsg('Ordem de serviço atualizada com sucesso.'); setEditOrder(null) }
    await load()
    setLoading(false)
  }

  async function uploadApprovedImage(order:any, file:File){
    setMsg('')

    try{
      if(!file.type.startsWith('image/')) throw new Error('Selecione um arquivo de imagem.')
      if(file.size > 50 * 1024 * 1024) throw new Error('A imagem precisa ter no máximo 50MB.')

      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const safeNumber = String(order.os_number || order.id).replace(/[^a-zA-Z0-9_-]/g,'-')
      const path = `service-orders/${safeNumber}/arte-aprovada-${Date.now()}.${ext}`

      const { error } = await supabase.storage
        .from('os-files')
        .upload(path,file,{ upsert:false, contentType:file.type || 'image/jpeg' })

      if(error) throw new Error('Erro ao enviar imagem para o Supabase: ' + error.message)

      const { data } = supabase.storage.from('os-files').getPublicUrl(path)

      const update:any = {
        approved_art_image_url:data.publicUrl,
        approved_art_image_name:file.name,
        approved_art_image_path:path,
        project_image_url:data.publicUrl,
        project_image_name:file.name,
        project_image_path:path
      }

      const updated = await supabase.from('service_orders').update(update).eq('id',order.id)
      if(updated.error) throw new Error('Imagem enviada, mas não consegui salvar na OS: ' + updated.error.message)

      setMsg('Imagem/arte aprovada adicionada na OS. Ela vai aparecer no PDF.')
      load()
    }catch(err:any){
      setMsg(err.message || 'Erro ao enviar imagem.')
    }
  }



  async function uploadInvoice(order:any, file:File){
    setMsg('')

    try{
      const allowed = ['application/pdf','text/xml','application/xml','image/png','image/jpeg','image/webp']
      const lowerName = file.name.toLowerCase()
      const validExt = lowerName.endsWith('.pdf') || lowerName.endsWith('.xml') || lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.webp')
      if(!allowed.includes(file.type) && !validExt) throw new Error('Envie a nota fiscal em PDF, XML ou imagem.')
      if(file.size > 50 * 1024 * 1024) throw new Error('A nota fiscal precisa ter no máximo 50MB.')

      const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf'
      const safeNumber = String(order.os_number || order.id).replace(/[^a-zA-Z0-9_-]/g,'-')
      const path = `service-orders/${safeNumber}/nota-fiscal-${Date.now()}.${ext}`

      const { error } = await supabase.storage
        .from('os-files')
        .upload(path,file,{ upsert:false, contentType:file.type || 'application/octet-stream' })

      if(error) throw new Error('Erro ao enviar nota fiscal para o Supabase: ' + error.message)

      const { data } = supabase.storage.from('os-files').getPublicUrl(path)

      const updated = await supabase.from('service_orders').update({
        invoice_file_url:data.publicUrl,
        invoice_file_name:file.name,
        invoice_file_path:path,
        invoice_uploaded_at:new Date().toISOString()
      }).eq('id',order.id)

      if(updated.error) throw new Error('Nota enviada, mas não consegui salvar na OS: ' + updated.error.message)

      setMsg('Nota fiscal anexada na OS. O cliente já consegue baixar pelo Portal Terceiro.')
      load()
    }catch(err:any){
      setMsg(err.message || 'Erro ao enviar nota fiscal.')
    }
  }

  const filtered = useMemo(()=>{
    const q = search.toLowerCase().trim()
    const filteredRows = rows.filter(r=>{
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
      if(periodType && periodValue){
        const created = String(r.created_at || '').slice(0,10)
        if(periodType === 'day' && created !== periodValue) return false
        if(periodType === 'month' && created.slice(0,7) !== periodValue) return false
        if(periodType === 'year' && created.slice(0,4) !== periodValue) return false
      }

      return true
    })
    if(valueOrder){
      filteredRows.sort((a,b)=>{
        const totalA = Number(a.estimated_price || 0)
        const totalB = Number(b.estimated_price || 0)
        return valueOrder === 'asc' ? totalA - totalB : totalB - totalA
      })
    }
    return filteredRows
  },[rows,search,statusFilter,priorityFilter,periodType,periodValue,valueOrder])

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
    pdf.text('SERVIÇOS DA ORDEM',10,116)

    const items = normalizeItems(o)
    let y = 127
    let shownItems = 0
    pdf.setFontSize(8.5)
    items.forEach((item:any,index:number)=>{
      if(y > 148) return
      shownItems += 1
      pdf.setFont('helvetica','bold')
      pdf.text(`${index+1}. ${item.service_name || 'Serviço'}`,10,y)
      pdf.setFont('helvetica','normal')
      pdf.text(`Medidas: ${formatCm(item.width_cm)} x ${formatCm(item.height_cm)} | Área: ${Number(item.area_m2 || 0).toFixed(2)} m²`,10,y+5)
      pdf.text(`Valor: ${money(item.estimated_price)}`,74,y+5)
      const obs = item.observation || (index === 0 ? o.description : '') || 'Sem observação.'
      const obsLines = pdf.splitTextToSize(`Obs: ${obs}`,92)
      pdf.text(obsLines,10,y+10)
      y += 14 + (obsLines.length * 4)
    })
    if(items.length > shownItems){
      pdf.setFontSize(8)
      pdf.text(`+ ${items.length - shownItems} serviço(s) no orçamento completo.`,10,158)
    }

    pdf.setFontSize(9)
    pdf.text(`Prioridade: ${o.priority || 'Média'}`,132,128)
    pdf.text(`Valor total: ${money(o.estimated_price)}`,132,136)
    pdf.text(`Acabamento: ${o.finishing || '-'}`,132,144)

    await addProjectImageToPdf(pdf,o.approved_art_image_url || o.project_image_url)

    pdf.line(10,224,200,224)

    pdf.setFontSize(11)
    pdf.text('RESPONSÁVEIS',10,234)
    pdf.setFontSize(9)
    pdf.text(`Designer: ${o.designer_responsible || '-'}`,10,244)
    pdf.text(`Impressor: ${o.printer_responsible || '-'}`,95,244)

    if(o.print_file_url){
      pdf.setFontSize(11)
      pdf.text('ARQUIVO ANEXO',10,255)
      pdf.setFontSize(9)
      pdf.textWithLink(o.drive_file_name || 'Abrir arquivo enviado',10,264,{url:o.print_file_url})
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
    pdf.text(cfg.pdf_footer || cfg.company_name || 'Garagem Comunicação Visual',10,293)
    pdf.text(cfg.whatsapp || cfg.phone || '(41) 99267-5409',165,293)

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
          {selectedIds.length > 0 && <button className="btn-red" onClick={deleteSelectedOrders}>Excluir selecionadas ({selectedIds.length})</button>}
          <button className="btn-dark" onClick={load}>{loading?'Atualizando...':'Atualizar'}</button>
        </div>
      </header>

      {msg && <div className="mb-4 rounded-xl border border-gold/30 bg-gold/10 p-4 text-gold">{msg}</div>}

      {editOrder && (
        <form onSubmit={saveEditedOrder} className="card mb-5 space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div><h2 className="text-2xl font-black">Editar OS {editOrder.os_number}</h2><p className="text-zinc-400">Atualize os dados principais da ordem de serviço.</p></div>
            <button type="button" className="btn-dark" onClick={()=>setEditOrder(null)}>Cancelar edição</button>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <input className="input" placeholder="Serviço" value={editOrder.service} onChange={e=>setEditOrder({...editOrder,service:e.target.value})}/>
            <input className="input" placeholder="Tipo de serviço" value={editOrder.service_type} onChange={e=>setEditOrder({...editOrder,service_type:e.target.value})}/>
            <input className="input" placeholder="Acabamento" value={editOrder.finishing} onChange={e=>setEditOrder({...editOrder,finishing:e.target.value})}/>
            <input className="input" placeholder="Medidas" value={editOrder.measures} onChange={e=>setEditOrder({...editOrder,measures:e.target.value})}/>
            <input className="input" placeholder="Valor" value={editOrder.estimated_price} onChange={e=>setEditOrder({...editOrder,estimated_price:e.target.value})}/>
            <select className="input" value={editOrder.priority} onChange={e=>setEditOrder({...editOrder,priority:e.target.value})}>{priorities.map(p=><option key={p}>{p}</option>)}</select>
            <select className="input" value={editOrder.status} onChange={e=>setEditOrder({...editOrder,status:e.target.value})}>{statuses.map(s=><option key={s}>{s}</option>)}</select>
            <input className="input" type="date" value={editOrder.due_date} onChange={e=>setEditOrder({...editOrder,due_date:e.target.value})}/>
            <input className="input" type="date" value={editOrder.delivered_at} onChange={e=>setEditOrder({...editOrder,delivered_at:e.target.value})}/>
            <textarea className="input md:col-span-3" placeholder="Descrição" value={editOrder.description} onChange={e=>setEditOrder({...editOrder,description:e.target.value})}/>
          </div>
          <button className="btn-gold">Salvar alteração</button>
        </form>
      )}

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

      <section className="card mb-5 grid gap-3 md:grid-cols-6">
        <input
          className="input md:col-span-2"
          placeholder="Buscar por nome, OS, cliente, serviço ou telefone..."
          value={search}
          onChange={e=>setSearch(e.target.value)}
        />

        <select className="input" value={periodType} onChange={e=>{setPeriodType(e.target.value); setPeriodValue('')}}>
          <option value="">Filtrar data</option>
          <option value="day">Por dia</option>
          <option value="month">Por mês</option>
          <option value="year">Por ano</option>
        </select>
        {periodType === 'day' && <input className="input" type="date" value={periodValue} onChange={e=>setPeriodValue(e.target.value)}/>}
        {periodType === 'month' && <input className="input" type="month" value={periodValue} onChange={e=>setPeriodValue(e.target.value)}/>}
        {periodType === 'year' && <input className="input" type="number" min="2000" max="2100" placeholder="Ano" value={periodValue} onChange={e=>setPeriodValue(e.target.value)}/>}
        {!periodType && <div className="hidden md:block"></div>}

        <select className="input" value={valueOrder} onChange={e=>setValueOrder(e.target.value)}>
          <option value="">Valor</option>
          <option value="asc">Valor crescente</option>
          <option value="desc">Valor decrescente</option>
        </select>

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
        <div ref={topScrollRef} onScroll={()=>syncHorizontalScroll('top')} className="overflow-x-auto border-b border-white/10 px-5 pt-4 pb-2">
          <div className="h-1 min-w-[1580px]"></div>
        </div>
        <div ref={tableScrollRef} onScroll={()=>syncHorizontalScroll('table')} className="overflow-x-auto px-5 pb-5 pt-2">
          <table className="min-w-[1580px]">
            <thead>
              <tr className="bg-black/30">
                <th><input type="checkbox" checked={filtered.length>0 && selectedIds.length===filtered.length} onChange={e=>toggleAllVisible(e.target.checked)}/></th>
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
                  <td><input type="checkbox" checked={selectedIds.includes(r.id)} onChange={e=>toggleSelected(r.id,e.target.checked)}/></td>
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
                    {Array.isArray(r.quote_items) && r.quote_items.length > 1 && (
                      <div className="mt-2 grid gap-1">
                        {r.quote_items.slice(0,3).map((item:any,index:number)=>(
                          <small key={index} className="block rounded-lg border border-white/10 bg-black/20 p-1 text-zinc-300">
                            {index+1}. {item.service_name} • {formatCm(item.width_cm)} x {formatCm(item.height_cm)} • {money(item.estimated_price)}
                          </small>
                        ))}
                      </div>
                    )}
                  </td>

                  <td>
                    <strong>{money(r.estimated_price)}</strong>
                  </td>

                  <td className="min-w-[220px]">
                    {(r.approved_art_image_url || r.project_image_url) && (
                      <div className="mb-2">
                        <a className="btn-gold block text-center" href={r.approved_art_image_url || r.project_image_url} target="_blank" rel="noreferrer">
                          Arte aprovada
                        </a>
                        <small className="break-all text-zinc-400">{r.approved_art_image_name || r.project_image_name || 'Imagem enviada pelo Supabase'}</small>
                      </div>
                    )}

                    <label className="btn-dark mb-2 block cursor-pointer text-center">
                      {(r.approved_art_image_url || r.project_image_url) ? 'Alterar imagem' : 'Adicionar imagem'}
                      <input className="hidden" type="file" accept="image/*" onChange={e=>{ const f=e.target.files?.[0]; if(f) uploadApprovedImage(r,f); e.currentTarget.value='' }}/>
                    </label>

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

                    <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-2">
                      <strong className="mb-2 block text-xs text-zinc-300">Nota fiscal</strong>
                      {r.invoice_file_url ? (
                        <div className="grid gap-2">
                          <a className="btn-gold text-center" href={r.invoice_file_url} target="_blank" rel="noreferrer">Baixar NF</a>
                          <small className="break-all text-zinc-400">{r.invoice_file_name || 'Nota fiscal anexada'}</small>
                        </div>
                      ) : <small className="text-zinc-500">Nenhuma NF anexada.</small>}
                      <label className="btn-dark mt-2 block cursor-pointer text-center">
                        {r.invoice_file_url ? 'Alterar nota fiscal' : 'Emitir nota fiscal'}
                        <input className="hidden" type="file" accept=".pdf,.xml,image/*" onChange={e=>{ const f=e.target.files?.[0]; if(f) uploadInvoice(r,f); e.currentTarget.value='' }}/>
                      </label>
                    </div>
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
                      <button className="btn-dark" onClick={()=>openEditOrder(r)}>Editar</button>
                      <button className="btn-gold" onClick={()=>professionalPdf(r,false)}>PDF OS</button>
                      <button className="btn-dark" onClick={()=>professionalPdf(r,true)}>Produção</button>
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length===0 && (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-zinc-400">
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
