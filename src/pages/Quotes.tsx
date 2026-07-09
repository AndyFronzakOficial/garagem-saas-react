import { useEffect, useMemo, useRef, useState } from 'react'
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
function numberInput(v:any){ return Number(String(v ?? '').replace(',','.')) || 0 }

export default function Quotes(){
  const [rows,setRows]=useState<any[]>([])
  const [company,setCompany]=useState<any>(null)
  const [msg,setMsg]=useState('')
  const [loading,setLoading]=useState(false)
  const [search,setSearch]=useState('')
  const [statusFilter,setStatusFilter]=useState('')
  const [periodType,setPeriodType]=useState('')
  const [periodValue,setPeriodValue]=useState('')
  const [valueOrder,setValueOrder]=useState('')
  const [selectedIds,setSelectedIds]=useState<string[]>([])
  const [editQuote,setEditQuote]=useState<any|null>(null)
  const topScrollRef = useRef<HTMLDivElement|null>(null)
  const tableScrollRef = useRef<HTMLDivElement|null>(null)

  useEffect(()=>{load()},[])

  async function load(){
    setLoading(true)
    const [quotes,cfg]=await Promise.all([
      supabase.from('public_quotes').select('*').order('created_at',{ascending:false}),
      supabase.from('company_settings').select('*').eq('id',1).maybeSingle()
    ])
    if(quotes.error) setMsg('Erro ao carregar orçamentos: ' + quotes.error.message)
    else {
      setRows(quotes.data || [])
      setSelectedIds([])
    }
    if(!cfg.error) setCompany(cfg.data)
    setLoading(false)
  }

  const filtered = useMemo(()=>{
    const q = search.toLowerCase().trim()
    const filteredRows = rows.filter(r=>{
      const text = [r.quote_number,r.client_name,r.company,r.phone,r.email,r.project_name,r.service_name,r.description,JSON.stringify(r.quote_items || [])].join(' ').toLowerCase()
      if(q && !text.includes(q)) return false
      if(statusFilter && (r.status || 'Novo') !== statusFilter) return false
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
        const totalA = normalizeItems(a).reduce((sum:number,item:any)=>sum+Number(item.estimated_price || 0),0) || Number(a.estimated_price || 0)
        const totalB = normalizeItems(b).reduce((sum:number,item:any)=>sum+Number(item.estimated_price || 0),0) || Number(b.estimated_price || 0)
        return valueOrder === 'asc' ? totalA - totalB : totalB - totalA
      })
    }
    return filteredRows
  },[rows,search,statusFilter,periodType,periodValue,valueOrder])

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

  function openEditQuote(r:any){
    const items = normalizeItems(r).map((item:any)=>({
      service_name:item.service_name || 'Serviço',
      width_cm:String(item.width_cm || 0),
      height_cm:String(item.height_cm || 0),
      estimated_price:String(item.estimated_price || 0),
      observation:item.observation || ''
    }))
    setEditQuote({
      id:r.id,
      quote_number:r.quote_number || '',
      client_name:r.client_name || '',
      company:r.company || '',
      phone:r.phone || '',
      email:r.email || '',
      project_name:r.project_name || '',
      description:r.description || '',
      status:r.status || 'Novo',
      items
    })
    setMsg('Editando orçamento. Altere os campos e clique em salvar alteração.')
    window.scrollTo({top:0,behavior:'smooth'})
  }

  function updateEditQuoteItem(index:number, patch:any){
    setEditQuote((prev:any)=>{
      if(!prev) return prev
      const items = [...prev.items]
      items[index] = {...items[index],...patch}
      return {...prev,items}
    })
  }

  async function saveEditedQuote(e:React.FormEvent){
    e.preventDefault()
    if(!editQuote) return
    setLoading(true)
    const items = (editQuote.items || []).map((item:any)=>{
      const width = numberInput(item.width_cm)
      const height = numberInput(item.height_cm)
      return {
        service_name:item.service_name || 'Serviço',
        width_cm:width,
        height_cm:height,
        width_m:width/100,
        height_m:height/100,
        area_m2:(width/100)*(height/100),
        estimated_price:numberInput(item.estimated_price),
        observation:item.observation || null
      }
    })
    const first = items[0] || {}
    const total = items.reduce((sum:number,item:any)=>sum+Number(item.estimated_price || 0),0)
    const { error } = await supabase.from('public_quotes').update({
      client_name:editQuote.client_name,
      company:editQuote.company,
      phone:editQuote.phone,
      email:editQuote.email,
      project_name:editQuote.project_name,
      description:editQuote.description,
      status:editQuote.status,
      quote_items:items,
      service_name:first.service_name || 'Serviço',
      width_cm:first.width_cm || 0,
      height_cm:first.height_cm || 0,
      width_m:first.width_m || 0,
      height_m:first.height_m || 0,
      area_m2:first.area_m2 || 0,
      estimated_price:total
    }).eq('id',editQuote.id)
    if(error) setMsg('Erro ao atualizar orçamento: ' + error.message)
    else { setMsg('Orçamento atualizado com sucesso.'); setEditQuote(null) }
    await load()
    setLoading(false)
  }

  async function deleteSelectedQuotes(){
    if(selectedIds.length === 0){ setMsg('Selecione pelo menos um orçamento para excluir.'); return }
    const ok = confirm(`Excluir ${selectedIds.length} orçamento(s) selecionado(s)? Essa ação não pode ser desfeita.`)
    if(!ok) return
    setLoading(true)
    const { error } = await supabase.from('public_quotes').delete().in('id', selectedIds)
    if(error) setMsg('Erro ao excluir orçamento(s): ' + error.message)
    else setMsg(`${selectedIds.length} orçamento(s) excluído(s) com sucesso.`)
    setSelectedIds([])
    await load()
    setLoading(false)
  }

  async function updateStatus(id:string,status:string){
    await supabase.from('public_quotes').update({status}).eq('id',id)
    load()
  }

  async function findOrCreateClient(r:any){
    if(r.client_id) return r.client_id
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

      // Cria a OS e retorna o ID para vincular automaticamente no financeiro.
      const createdOrder = await supabase.from('service_orders').insert({
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
      }).select('id,os_number').single()
      if(createdOrder.error) throw new Error('Erro ao criar ordem de serviço: ' + createdOrder.error.message)

      // Cria a conta a receber já vinculada ao cliente e à OS gerada.
      await supabase.from('accounts_receivable').insert({
        client_id:clientId,
        service_order_id:createdOrder.data.id,
        title:`${num} - ${r.project_name || first.service_name || 'Orçamento'}`,
        due_date:today(),
        amount:total,
        paid_amount:0,
        pending_amount:total,
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
        <div className="flex flex-wrap gap-2">
          {selectedIds.length > 0 && <button className="btn-red" onClick={deleteSelectedQuotes}>Excluir selecionados ({selectedIds.length})</button>}
          <button className="btn-dark" onClick={load}>{loading ? 'Atualizando...' : 'Atualizar'}</button>
        </div>
      </header>

      {msg && <div className="mb-4 rounded-xl border border-gold/30 bg-gold/10 p-4 text-gold">{msg}</div>}

      {editQuote && (
        <form onSubmit={saveEditedQuote} className="card mb-5 space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div><h2 className="text-2xl font-black">Editar orçamento {editQuote.quote_number}</h2><p className="text-zinc-400">Atualize os dados do cliente, projeto e serviços.</p></div>
            <button type="button" className="btn-dark" onClick={()=>setEditQuote(null)}>Cancelar edição</button>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <input className="input" placeholder="Cliente" value={editQuote.client_name} onChange={e=>setEditQuote({...editQuote,client_name:e.target.value})}/>
            <input className="input" placeholder="Empresa" value={editQuote.company} onChange={e=>setEditQuote({...editQuote,company:e.target.value})}/>
            <input className="input" placeholder="Telefone" value={editQuote.phone} onChange={e=>setEditQuote({...editQuote,phone:e.target.value})}/>
            <input className="input" placeholder="E-mail" value={editQuote.email} onChange={e=>setEditQuote({...editQuote,email:e.target.value})}/>
            <input className="input md:col-span-2" placeholder="Projeto" value={editQuote.project_name} onChange={e=>setEditQuote({...editQuote,project_name:e.target.value})}/>
            <select className="input" value={editQuote.status} onChange={e=>setEditQuote({...editQuote,status:e.target.value})}><option>Novo</option><option>Em análise</option><option>Convertido</option><option>Recusado</option></select>
            <input className="input" placeholder="Descrição" value={editQuote.description} onChange={e=>setEditQuote({...editQuote,description:e.target.value})}/>
          </div>
          <div className="grid gap-3">
            {(editQuote.items || []).map((item:any,index:number)=>(
              <div key={index} className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 md:grid-cols-5">
                <input className="input" placeholder="Serviço" value={item.service_name} onChange={e=>updateEditQuoteItem(index,{service_name:e.target.value})}/>
                <input className="input" placeholder="Largura cm" value={item.width_cm} onChange={e=>updateEditQuoteItem(index,{width_cm:e.target.value})}/>
                <input className="input" placeholder="Altura cm" value={item.height_cm} onChange={e=>updateEditQuoteItem(index,{height_cm:e.target.value})}/>
                <input className="input" placeholder="Valor" value={item.estimated_price} onChange={e=>updateEditQuoteItem(index,{estimated_price:e.target.value})}/>
                <input className="input" placeholder="Observação" value={item.observation} onChange={e=>updateEditQuoteItem(index,{observation:e.target.value})}/>
              </div>
            ))}
          </div>
          <button className="btn-gold">Salvar alteração</button>
        </form>
      )}

      <section className="card mb-5 grid gap-3 md:grid-cols-6">
        <input className="input md:col-span-2" placeholder="Buscar por nome, cliente, projeto, serviço ou telefone..." value={search} onChange={e=>setSearch(e.target.value)}/>
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
          <option>Novo</option><option>Em análise</option><option>Convertido</option><option>Recusado</option>
        </select>
      </section>

      <div className="card p-0">
        <div ref={topScrollRef} onScroll={()=>syncHorizontalScroll('top')} className="overflow-x-auto border-b border-white/10 px-5 pt-4 pb-2">
          <div className="h-1 min-w-[1350px]"></div>
        </div>
        <div ref={tableScrollRef} onScroll={()=>syncHorizontalScroll('table')} className="table-wrap px-5 pb-5 pt-2">
        <table className="min-w-[1350px]">
          <thead><tr><th><input type="checkbox" checked={filtered.length>0 && selectedIds.length===filtered.length} onChange={e=>toggleAllVisible(e.target.checked)}/></th><th>Código</th><th>Cliente</th><th>Projeto</th><th>Serviços</th><th>Imagem/Arquivo</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            {filtered.map(r=>{
              const items = normalizeItems(r)
              const total = items.reduce((sum:number,item:any)=>sum+Number(item.estimated_price || 0),0) || Number(r.estimated_price || 0)
              return (
                <tr key={r.id}>
                  <td><input type="checkbox" checked={selectedIds.includes(r.id)} onChange={e=>toggleSelected(r.id,e.target.checked)}/></td>
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
                  <td><div className="grid gap-2"><button className="btn-dark" onClick={()=>openEditQuote(r)}>Editar</button><button className="btn-dark" onClick={()=>quotePdf(r)}>PDF Orçamento</button><button disabled={loading || r.status === 'Convertido'} className="btn-gold" onClick={()=>convertToOrder(r)}>{r.status === 'Convertido' ? 'Convertido' : 'Converter OS'}</button></div></td>
                </tr>
              )
            })}
            {filtered.length===0 && <tr><td colSpan={9} className="p-8 text-center text-zinc-400">Nenhum orçamento encontrado.</td></tr>}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
