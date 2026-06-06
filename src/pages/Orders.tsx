import { useEffect,useState } from 'react'
import { supabase } from '../lib/supabase'
import { brNumber, finishings, formatDateBR, imageToDataURL, money, orderStatuses, osNumber, priorities, safeFileName, statusClass, today } from '../lib/utils'
import jsPDF from 'jspdf'

export default function Orders(){
  const [rows,setRows]=useState<any[]>([])
  const [clients,setClients]=useState<any[]>([])
  const [prices,setPrices]=useState<any[]>([])
  const [file,setFile]=useState<File|null>(null)
  const [company,setCompany]=useState<any>(null)
  const [showForm,setShowForm]=useState(false)
  const [f,setF]=useState({
    client_id:'',
    service_price_id:'',
    service:'',
    width_m:'',
    height_m:'',
    finishing:'Sem acabamento',
    description:'',
    due_date:'',
    priority:'Média',
    designer_responsible:'',
    printer_responsible:''
  })

  useEffect(()=>{load()},[])

  async function load(){
    const [orders,cls,prs,cfg]=await Promise.all([
      supabase.from('service_orders').select('*,clients(*)').order('created_at',{ascending:false}),
      supabase.from('clients').select('*').order('company'),
      supabase.from('service_prices').select('*').eq('active',true).order('name'),
      supabase.from('company_settings').select('*').eq('id',1).maybeSingle()
    ])
    setRows(orders.data||[])
    setClients(cls.data||[])
    setPrices(prs.data||[])
    setCompany(cfg.data||null)
  }

  const price = prices.find(p=>p.id===f.service_price_id)
  const width=brNumber(f.width_m), height=brNumber(f.height_m), area=width*height
  const total = area * Number(price?.price_m2_final || 0)

  async function uploadSelected(clientId:string){
    if(!file)return null
    const path = `${clientId}/${Date.now()}-${safeFileName(file.name)}`
    const { error } = await supabase.storage.from('os-files').upload(path,file,{upsert:true,contentType:file.type||'application/octet-stream'})
    if(error){ alert('Erro upload: '+error.message); return null }
    return supabase.storage.from('os-files').getPublicUrl(path).data.publicUrl
  }

  async function create(e:React.FormEvent){
    e.preventDefault()
    if(!f.client_id || !price)return
    const fileUrl = await uploadSelected(f.client_id)
    const num=osNumber()
    await supabase.from('service_orders').insert({
      os_number:num,
      client_id:f.client_id,
      service:f.service || price.name,
      service_price_id:price.id,
      service_type:price.name,
      width_m:width,
      height_m:height,
      area_m2:area,
      price_m2:price.price_m2_final,
      estimated_price:total,
      measures:`${width.toFixed(2)}m x ${height.toFixed(2)}m`,
      finishing:f.finishing,
      description:f.description||null,
      print_file_url:fileUrl,
      source:'Interno',
      status:'Entrada',
      due_date:f.due_date||null,
      priority:f.priority,
      designer_responsible:f.designer_responsible||null,
      printer_responsible:f.printer_responsible||null
    })
    await supabase.from('accounts_receivable').insert({client_id:f.client_id,title:`${num} - ${f.service || price.name}`,due_date:f.due_date||today(),amount:total,reference:new Date().toLocaleDateString('pt-BR',{month:'2-digit',year:'numeric'}),status:'Aberto'})
    setShowForm(false); setFile(null); setF({client_id:'',service_price_id:'',service:'',width_m:'',height_m:'',finishing:'Sem acabamento',description:'',due_date:'',priority:'Média',designer_responsible:'',printer_responsible:''})
    load()
  }

  async function patch(id:string, field:string, value:any){
    const update:any = {[field]: value}
    if(field==='status' && value==='Entregue') update.delivered_at = today()
    await supabase.from('service_orders').update(update).eq('id',id)
    load()
  }

  function qrUrl(text:string){ return `https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(text)}` }

  async function pdf(o:any){
    const d=new jsPDF('p','mm','a4')
    const cfg = company || {}
    try{
      const logo = await imageToDataURL('/logo.png')
      d.addImage(logo,'PNG',12,8,62,24)
    }catch{
      d.setFontSize(20); d.text('Garagem Comunicação Visual',12,18)
    }

    d.setFillColor(17,17,17)
    d.rect(0,0,210,5,'F')
    d.setTextColor(0,0,0)
    d.setFontSize(9)
    d.text(`CNPJ: ${cfg.cnpj || '36.685.414/0001-49'}`,82,14)
    d.text(`${cfg.address || 'R. Califórnia, 287 - Guaraituba, Colombo - PR'}`,82,21)
    d.text(`Telefone: ${cfg.phone || '(41) 99267-5409'}`,82,28)

    try{
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = qrUrl(o.os_number)
      await new Promise(res=>{img.onload=res; img.onerror=res})
      d.addImage(img,'PNG',174,8,22,22)
    }catch{}

    d.setFontSize(16)
    d.text('TERMO DE RETIRADA / ENTREGA',12,48)
    d.setFontSize(10)
    d.text(`OS: ${o.os_number}`,12,60)
    d.text(`Data prevista: ${formatDateBR(o.due_date)}`,75,60)
    d.text(`Data entrega: ${formatDateBR(o.delivered_at)}`,135,60)

    d.setDrawColor(220)
    d.roundedRect(12,72,186,44,3,3)
    d.text(`Cliente: ${o.clients?.name||''}`,18,82)
    d.text(`Empresa: ${o.clients?.company||''}`,18,90)
    d.text(`Telefone: ${o.clients?.phone||''}`,18,98)
    d.text(`Endereço: ${o.clients?.address||''}`,18,106)

    d.roundedRect(12,126,186,58,3,3)
    d.text(`Serviço: ${o.service}`,18,136)
    d.text(`Tipo: ${o.service_type||''}`,18,144)
    d.text(`Medidas: ${o.measures||''}`,18,152)
    d.text(`Acabamento: ${o.finishing||''}`,18,160)
    d.text(`Prioridade: ${o.priority||'Média'}`,110,160)
    d.text(`Designer: ${o.designer_responsible||'-'}`,18,168)
    d.text(`Impressor: ${o.printer_responsible||'-'}`,110,168)
    d.text(`Valor: ${money(o.estimated_price)}`,18,176)

    d.text('Observações:',12,197)
    d.text(d.splitTextToSize(o.description||'Sem observações.',180),12,205)

    d.text('Declaro que recebi/conferi o serviço descrito nesta Ordem de Serviço.',12,238)
    d.line(20,265,90,265)
    d.line(120,265,190,265)
    d.text('Assinatura do Cliente',34,272)
    d.text('Assinatura do Responsável',132,272)

    d.save(`${o.os_number}.pdf`)
  }

  return <div>
    <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div><h1 className="text-4xl font-black">Ordens de Serviço</h1><p className="text-zinc-400">Serviços lançados pelo portal e pelo atendimento.</p></div>
      <button className="btn-gold" onClick={()=>setShowForm(!showForm)}>{showForm?'Fechar':'Nova OS manual'}</button>
    </header>

    {showForm && <form onSubmit={create} className="card mb-6 grid gap-3 md:grid-cols-4">
      <select className="input" value={f.client_id} onChange={e=>setF({...f,client_id:e.target.value})} required><option value="">Cliente</option>{clients.map(c=><option key={c.id} value={c.id}>{c.company || c.name}</option>)}</select>
      <select className="input" value={f.service_price_id} onChange={e=>setF({...f,service_price_id:e.target.value})} required><option value="">Serviço</option>{prices.map(p=><option key={p.id} value={p.id}>{p.name} - {money(p.price_m2_final)}/m²</option>)}</select>
      <input className="input" placeholder="Nome do serviço" value={f.service} onChange={e=>setF({...f,service:e.target.value})}/>
      <select className="input" value={f.finishing} onChange={e=>setF({...f,finishing:e.target.value})}>{finishings.map(x=><option key={x}>{x}</option>)}</select>
      <input className="input" placeholder="Largura" value={f.width_m} onChange={e=>setF({...f,width_m:e.target.value})}/>
      <input className="input" placeholder="Altura" value={f.height_m} onChange={e=>setF({...f,height_m:e.target.value})}/>
      <input className="input" type="date" value={f.due_date} onChange={e=>setF({...f,due_date:e.target.value})}/>
      <select className="input" value={f.priority} onChange={e=>setF({...f,priority:e.target.value})}>{priorities.map(x=><option key={x}>{x}</option>)}</select>
      <input className="input" placeholder="Designer responsável" value={f.designer_responsible} onChange={e=>setF({...f,designer_responsible:e.target.value})}/>
      <input className="input" placeholder="Impressor responsável" value={f.printer_responsible} onChange={e=>setF({...f,printer_responsible:e.target.value})}/>
      <input className="input md:col-span-2" type="file" onChange={e=>setFile(e.target.files?.[0]||null)}/>
      <textarea className="input md:col-span-4" placeholder="Descrição" value={f.description} onChange={e=>setF({...f,description:e.target.value})}/>
      <div className="price-preview md:col-span-4"><div>Área: {area.toFixed(2)}m²</div><strong>{money(total)}</strong></div>
      <button className="btn-gold md:col-span-4">Criar OS</button>
    </form>}

    <div className="card table-wrap">
      <table>
        <thead><tr><th>OS</th><th>Cliente</th><th>Serviço</th><th>Responsáveis</th><th>Datas</th><th>Prioridade</th><th>Arquivo</th><th>Status</th><th>PDF</th></tr></thead>
        <tbody>{rows.map(r=><tr key={r.id}>
          <td>{r.os_number}<br/><span className="badge info">{r.source}</span></td>
          <td>{r.clients?.name}<br/><small>{r.clients?.company}</small></td>
          <td>{r.service}<br/><small>{r.finishing}</small><br/><small>{money(r.estimated_price)}</small></td>
          <td><input className="input mb-2" placeholder="Designer" defaultValue={r.designer_responsible||''} onBlur={e=>patch(r.id,'designer_responsible',e.target.value)}/><input className="input" placeholder="Impressor" defaultValue={r.printer_responsible||''} onBlur={e=>patch(r.id,'printer_responsible',e.target.value)}/></td>
          <td><label className="text-xs text-zinc-400">Prevista</label><input type="date" className="input mb-2" defaultValue={r.due_date||''} onBlur={e=>patch(r.id,'due_date',e.target.value||null)}/><label className="text-xs text-zinc-400">Entrega</label><input type="date" className="input" defaultValue={r.delivered_at||''} onBlur={e=>patch(r.id,'delivered_at',e.target.value||null)}/></td>
          <td><select className={`input ${statusClass(r.priority||'Média')}`} value={r.priority||'Média'} onChange={e=>patch(r.id,'priority',e.target.value)}>{priorities.map(p=><option key={p}>{p}</option>)}</select></td>
          <td>{r.print_file_url?<a className="text-gold" href={r.print_file_url} target="_blank">Baixar</a>:'-'}</td>
          <td><select className={`input ${statusClass(r.status)}`} value={r.status} onChange={e=>patch(r.id,'status',e.target.value)}>{orderStatuses.map(s=><option key={s}>{s}</option>)}</select></td>
          <td><button className="btn-gold" onClick={()=>pdf(r)}>PDF</button></td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>
}
