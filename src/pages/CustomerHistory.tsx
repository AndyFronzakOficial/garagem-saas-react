import { useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import { supabase } from '../lib/supabase'
import { money } from '../lib/utils'

function brDate(v?:string|null){
  if(!v)return '-'
  const d = new Date(v)
  if(!isNaN(d.getTime())) return d.toLocaleDateString('pt-BR')
  const [y,m,day]=String(v).slice(0,10).split('-')
  return day&&m&&y?`${day}/${m}/${y}`:'-'
}
function brDateTime(v?:string|null){
  if(!v)return '-'
  const d = new Date(v)
  return isNaN(d.getTime()) ? brDate(v) : d.toLocaleString('pt-BR')
}
function getItems(o:any){
  if(Array.isArray(o.quote_items) && o.quote_items.length) return o.quote_items
  return [{
    service_name:o.service || o.service_type || 'Serviço',
    width_cm:Number(o.width_cm || 0) || Number(o.width_m || 0) * 100,
    height_cm:Number(o.height_cm || 0) || Number(o.height_m || 0) * 100,
    quantity:o.quantity || 1,
    estimated_price:o.estimated_price || 0,
    observation:o.description || 'Sem observação',
    finishing:o.finishing || 'Sem acabamento'
  }]
}
function formatCm(v:any){ return `${Number(v || 0).toFixed(0)}cm` }


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

export default function CustomerHistory(){
  const [clients,setClients]=useState<any[]>([])
  const [orders,setOrders]=useState<any[]>([])
  const [company,setCompany]=useState<any>(null)
  const [selected,setSelected]=useState('')
  const [search,setSearch]=useState('')
  const [signatureOrder,setSignatureOrder]=useState<any>(null)

  useEffect(()=>{ load() },[])
  async function load(){
    const [c,o,cfg]=await Promise.all([
      supabase.from('clients').select('*').order('name'),
      supabase.from('service_orders').select('*,clients(*)').order('created_at',{ascending:false}),
      supabase.from('company_settings').select('*').eq('id',1).maybeSingle()
    ])
    setClients(c.data||[])
    setOrders((o.data||[]).filter((x:any)=>!x.is_deleted))
    if(!cfg.error) setCompany(cfg.data)
  }

  function downloadContract(order:any){
    const client = order.clients || selectedClient || {}
    const pdf=new jsPDF('p','mm','a4')

    // Aqui calculamos a entrada mínima obrigatória de 50% para iniciar a produção.
    const total = Number(order.estimated_price || 0)
    const entradaMinima = total * 0.5
    const saldoRestante = Math.max(total - entradaMinima,0)

    // Cabeçalho profissional do contrato simplificado.
    pdf.setFillColor(18,18,18)
    pdf.rect(0,0,210,28,'F')
    pdf.setTextColor(244,197,66)
    pdf.setFont('helvetica','bold')
    pdf.setFontSize(14)
    pdf.text(company?.company_name || company?.name || 'Garagem Comunicação Visual',12,12)
    pdf.setTextColor(255,255,255)
    pdf.setFontSize(10)
    pdf.text('CONTRATO SIMPLIFICADO DE PRESTAÇÃO DE SERVIÇOS',12,20)
    pdf.text('COMUNICAÇÃO VISUAL',145,20)

    pdf.setTextColor(0,0,0)
    pdf.setFont('helvetica','normal')
    pdf.setFontSize(9)

    let y = 38

    // Função auxiliar para escrever textos longos sem estourar a largura do PDF.
    function paragraph(title:string,text:string){
      if(y > 260){ pdf.addPage(); y = 18 }
      pdf.setFont('helvetica','bold')
      pdf.text(title,12,y)
      y += 6
      pdf.setFont('helvetica','normal')
      const lines = pdf.splitTextToSize(text,186)
      pdf.text(lines,12,y)
      y += lines.length * 5 + 5
    }

    // Dados principais do contrato.
    pdf.setFont('helvetica','bold')
    pdf.text('DADOS DO CONTRATO',12,y)
    y += 7
    pdf.setFont('helvetica','normal')
    pdf.text(`Cliente: ${client?.name || client?.company || '-'}`,12,y); y += 6
    pdf.text(`Empresa do cliente: ${client?.company || '-'}`,12,y); y += 6
    pdf.text(`OS: ${order.os_number || '-'}`,12,y); y += 6
    pdf.text(`Serviço: ${order.service || order.service_type || '-'}`,12,y); y += 6
    pdf.text(`Valor total aprovado: ${money(total)}`,12,y); y += 6
    pdf.text(`Entrada mínima obrigatória de 50%: ${money(entradaMinima)}`,12,y); y += 6
    pdf.text(`Saldo restante previsto: ${money(saldoRestante)}`,12,y); y += 9

    paragraph('1. Objeto',
      'O presente contrato tem como objeto a prestação de serviços de comunicação visual, incluindo criação, produção, impressão, acabamento, instalação ou outros serviços descritos na ordem de serviço aprovada pelo cliente.'
    )

    paragraph('2. Aprovação de arte e informações',
      'Ao aprovar este documento, o cliente declara que conferiu arte, textos, medidas, cores, quantidades, materiais, acabamentos, prazos e demais informações. Após a aprovação, qualquer alteração poderá gerar novo prazo e custo adicional.'
    )

    paragraph('3. Condição de pagamento - entrada mínima de 50%',
      `Para início da produção, compra de materiais, reserva de agenda ou execução do serviço, deverá haver pagamento mínimo de 50% do valor total aprovado, correspondente neste contrato a ${money(entradaMinima)}. O saldo restante deverá ser quitado antes da entrega, retirada ou instalação do material, salvo acordo formal registrado entre as partes.`
    )

    paragraph('4. Prazos e execução',
      'Os prazos de produção começam a contar após a aprovação da arte, confirmação das informações necessárias e identificação do pagamento mínimo exigido. Atrasos causados por falta de aprovação, envio de arquivos incorretos, ausência de pagamento ou mudanças solicitadas pelo cliente poderão alterar o prazo final.'
    )

    paragraph('5. Responsabilidade do cliente',
      'O cliente é responsável pela conferência de nomes, telefones, endereços, medidas, ortografia, cores desejadas, arquivos enviados e autorizações de uso de marcas, imagens e conteúdos. A empresa não se responsabiliza por erros aprovados previamente pelo cliente.'
    )

    paragraph('6. Cancelamento e alterações',
      'Após a aprovação e início da produção, valores referentes a materiais, impressão, mão de obra, deslocamentos e etapas já executadas poderão ser retidos. Alterações solicitadas depois da aprovação serão analisadas e poderão gerar cobrança adicional.'
    )

    paragraph('7. Validade e aceite',
      'Este contrato simplificado passa a valer a partir da aprovação da ordem de serviço, assinatura física/digital, confirmação por mensagem ou pagamento da entrada. O aceite indica concordância com as condições descritas acima.'
    )

    pdf.setFont('helvetica','normal')
    pdf.text(`Status da aprovação: ${order.art_approval_status || 'Pendente'}`,12,y); y += 6
    pdf.text(`Data/hora da assinatura: ${brDateTime(order.art_approved_at)}`,12,y); y += 10

    if(order.art_approval_signature){
      try{ pdf.addImage(order.art_approval_signature,'PNG',18,y,78,32) }catch{}
      y += 38
    }else{
      y += 22
    }

    pdf.line(20,y,98,y)
    pdf.text('Assinatura do Cliente',36,y+7)
    pdf.line(112,y,190,y)
    pdf.text('Responsável pela Empresa',128,y+7)

    pdf.setFontSize(8)
    pdf.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`,12,287)
    pdf.save(`contrato-${order.os_number || 'cliente'}.pdf`)
  }

  async function downloadServiceOrder(order:any){
    const pdf = new jsPDF('p','mm','a4')
    const cfg = company || {}
    const client = order.clients || selectedClient || {}

    pdf.setFillColor(18,18,18)
    pdf.rect(0,0,210,26,'F')

    const logoUrl = cfg.logo_url || '/logo.png'
    const logo = await imageToDataURL(logoUrl)

    if(logo){
      try{ pdf.addImage(logo,'PNG',10,6,48,15) }catch{}
    }else{
      pdf.setTextColor(244,197,66)
      pdf.setFontSize(16)
      pdf.text(cfg.company_name || cfg.name || 'Garagem Comunicação Visual',10,15)
    }

    pdf.setTextColor(255,255,255)
    pdf.setFontSize(14)
    pdf.text('ORDEM DE SERVIÇO',130,11)
    pdf.setFontSize(9)
    pdf.text(order.os_number || '-',130,18)

    pdf.setTextColor(0,0,0)
    pdf.setFontSize(8)
    pdf.text(cfg.company_name || cfg.name || 'Garagem Comunicação Visual',10,34)
    pdf.text(`CNPJ: ${cfg.cnpj || '36.685.414/0001-49'}`,10,39)
    pdf.text(cfg.address || 'R. Califórnia, 287 - Guaraituba, Colombo - PR',10,44)
    pdf.text(`Telefone: ${cfg.phone || '(41) 99267-5409'}`,10,49)

    pdf.setDrawColor(220,220,220)
    pdf.line(10,56,200,56)

    pdf.setFontSize(11)
    pdf.text('DADOS DO CLIENTE',10,66)

    pdf.setFontSize(9)
    pdf.text(`Cliente: ${client?.name || '-'}`,10,76)
    pdf.text(`Empresa: ${client?.company || '-'}`,10,83)
    pdf.text(`Telefone: ${client?.phone || '-'}`,10,90)
    pdf.text(`Endereço: ${client?.address || '-'}`,10,97)

    pdf.text(`Emissão: ${new Date().toLocaleDateString('pt-BR')}`,132,76)
    pdf.text(`Previsão: ${brDate(order.due_date)}`,132,83)
    pdf.text(`Entrega: ${brDate(order.delivered_at)}`,132,90)
    pdf.text(`Status: ${order.status || '-'}`,132,97)

    pdf.line(10,106,200,106)

    pdf.setFontSize(11)
    pdf.text('SERVIÇOS DA ORDEM',10,116)

    const items = getItems(order)
    let y = 127
    let shownItems = 0
    pdf.setFontSize(8.5)
    items.forEach((item:any,index:number)=>{
      if(y > 148) return
      shownItems += 1
      pdf.setFont('helvetica','bold')
      pdf.text(`${index+1}. ${item.service_name || item.name || 'Serviço'}`,10,y)
      pdf.setFont('helvetica','normal')
      const qty = item.quantity || 1
      const area = Number(item.area_m2 || 0)
      pdf.text(`Medidas: ${formatCm(item.width_cm)} x ${formatCm(item.height_cm)} | Qtd: ${qty}${area ? ` | Área: ${area.toFixed(2)} m²` : ''}`,10,y+5)
      pdf.text(`Valor: ${money(item.estimated_price || item.value || 0)}`,100,y+5)
      const obs = item.observation || item.obs || (index === 0 ? order.description : '') || 'Sem observação.'
      const finishing = item.finishing || item.finish || order.finishing || 'Sem acabamento'
      const obsLines = pdf.splitTextToSize(`Obs: ${obs} | Acabamento: ${finishing}`,92)
      pdf.text(obsLines,10,y+10)
      y += 14 + (obsLines.length * 4)
    })
    if(items.length > shownItems){
      pdf.setFontSize(8)
      pdf.text(`+ ${items.length - shownItems} serviço(s) no orçamento completo.`,10,158)
    }

    pdf.setFontSize(9)
    pdf.text(`Prioridade: ${order.priority || 'Média'}`,132,128)
    pdf.text(`Valor total: ${money(order.estimated_price)}`,132,136)
    pdf.text(`Acabamento: ${order.finishing || '-'}`,132,144)

    await addProjectImageToPdf(pdf,order.approved_art_image_url || order.project_image_url)

    pdf.line(10,224,200,224)

    pdf.setFontSize(11)
    pdf.text('RESPONSÁVEIS',10,234)
    pdf.setFontSize(9)
    pdf.text(`Designer: ${order.designer_responsible || '-'}`,10,244)
    pdf.text(`Impressor: ${order.printer_responsible || '-'}`,95,244)

    if(order.print_file_url){
      pdf.setFontSize(11)
      pdf.text('ARQUIVO ANEXO',10,255)
      pdf.setFontSize(9)
      pdf.textWithLink(order.drive_file_name || 'Abrir arquivo enviado',10,264,{url:order.print_file_url})
    }

    if(order.art_approval_signature){
      try{ pdf.addImage(order.art_approval_signature,'PNG',25,249,58,20) }catch{}
      pdf.setFontSize(7.5)
      pdf.text(`Assinado em: ${brDateTime(order.art_approved_at)}`,22,274)
    }else{
      pdf.line(20,267,90,267)
      pdf.setFontSize(9)
      pdf.text('Assinatura do Cliente',33,274)
    }
    pdf.line(120,267,190,267)
    pdf.setFontSize(9)
    pdf.text('Responsável Garagem',134,274)

    pdf.setFillColor(18,18,18)
    pdf.rect(0,286,210,11,'F')
    pdf.setTextColor(255,255,255)
    pdf.setFontSize(8)
    pdf.text(cfg.pdf_footer || cfg.company_name || cfg.name || 'Garagem Comunicação Visual',10,293)
    pdf.text(cfg.whatsapp || cfg.phone || '(41) 99267-5409',165,293)

    pdf.save(`os-${order.os_number || 'ordem'}.pdf`)
  }

  const list = clients.filter(c=>[c.name,c.company,c.phone,c.email].join(' ').toLowerCase().includes(search.toLowerCase()))
  const selectedClient = clients.find(c=>c.id===selected) || list[0]
  const clientOrders = useMemo(()=> selectedClient ? orders.filter(o=>o.client_id===selectedClient.id) : [],[orders,selectedClient])
  const total = clientOrders.reduce((a,b)=>a+Number(b.estimated_price||0),0)
  const avg = clientOrders.length ? total / clientOrders.length : 0
  const last = clientOrders[0]
  const topServices = Object.entries(clientOrders.reduce((acc:any,o:any)=>{ const items=getItems(o); if(items.length){items.forEach((i:any)=>acc[i.service_name || i.name || o.service || 'Serviço']=(acc[i.service_name || i.name || o.service || 'Serviço']||0)+1)} return acc },{})).sort((a:any,b:any)=>b[1]-a[1]).slice(0,5)

  return <div>
    <h1 className="text-4xl font-black">Histórico do Cliente</h1>
    <p className="mb-6 text-zinc-400">Total gasto, pedidos, ticket médio, último pedido, serviços mais comprados e documentos assinados.</p>
    <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
      <div className="card">
        <input className="input mb-4" placeholder="Buscar cliente..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <div className="max-h-[650px] space-y-2 overflow-y-auto pr-1">
          {list.map(c=><button key={c.id} onClick={()=>setSelected(c.id)} className={`w-full rounded-xl border p-3 text-left ${selectedClient?.id===c.id?'border-gold/50 bg-gold/10':'border-white/10 bg-black/20 hover:bg-white/5'}`}>
            <strong>{c.name || c.company}</strong><br/><small className="text-zinc-400">{c.company} · {c.phone}</small>
          </button>)}
        </div>
      </div>
      <div>
        {selectedClient ? <>
          <div className="card mb-5"><h2 className="text-2xl font-black text-gold">{selectedClient.name}</h2><p className="text-zinc-400">{selectedClient.company} · {selectedClient.phone} · {selectedClient.email}</p></div>
          <section className="mb-5 grid gap-4 md:grid-cols-4">
            <article className="card"><small>Total gasto</small><h2 className="text-2xl font-black">{money(total)}</h2></article>
            <article className="card"><small>Quantidade de pedidos</small><h2 className="text-2xl font-black">{clientOrders.length}</h2></article>
            <article className="card"><small>Ticket médio</small><h2 className="text-2xl font-black">{money(avg)}</h2></article>
            <article className="card"><small>Último pedido</small><h2 className="text-xl font-black">{last?.os_number || '-'}</h2><small>{brDate(last?.created_at)}</small></article>
          </section>
          <section className="grid gap-5 xl:grid-cols-2">
            <div className="card"><h3 className="mb-4 text-xl font-black">Serviços mais comprados</h3>{topServices.map(([name,count]:any)=><div key={name} className="mb-3 flex justify-between rounded-xl bg-black/20 p-3"><span>{name}</span><strong>{count}x</strong></div>)}{topServices.length===0&&<p className="text-zinc-400">Sem serviços.</p>}</div>
            <div className="card table-wrap"><table><thead><tr><th>OS</th><th>Serviço</th><th>Data</th><th>Valor</th></tr></thead><tbody>{clientOrders.map(o=><tr key={o.id}><td>{o.os_number}</td><td>{o.service}</td><td>{brDate(o.created_at)}</td><td>{money(o.estimated_price)}</td></tr>)}</tbody></table></div>
          </section>
          <section className="card mt-5 table-wrap">
            <h3 className="mb-4 text-xl font-black">Documentos, contrato e assinatura</h3>
            <table>
              <thead><tr><th>OS</th><th>Data</th><th>Status</th><th>Assinatura</th><th>Documentos</th></tr></thead>
              <tbody>{clientOrders.map(o=><tr key={o.id}>
                <td>{o.os_number}</td>
                <td>{brDate(o.created_at)}</td>
                <td><span className="badge info">{o.art_approval_status || 'Pendente'}</span></td>
                <td>{o.art_approval_signature ? <button className="btn-dark" onClick={()=>setSignatureOrder(o)}>Ver assinatura</button> : <span className="text-zinc-400">Sem assinatura</span>}<br/><small className="text-zinc-400">{o.art_approved_at ? brDateTime(o.art_approved_at) : '-'}</small></td>
                <td><div className="flex flex-wrap gap-2"><button className="btn-gold" onClick={()=>downloadContract(o)}>Baixar contrato</button><button className="btn-dark" onClick={()=>downloadServiceOrder(o)}>Baixar OS</button>{o.invoice_file_url&&<a className="btn-dark" href={o.invoice_file_url} target="_blank" rel="noreferrer" download>Baixar NF</a>}</div></td>
              </tr>)}</tbody>
            </table>
          </section>
        </> : <div className="card text-zinc-400">Nenhum cliente cadastrado.</div>}
      </div>
    </section>
    {signatureOrder&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"><div className="card w-full max-w-xl"><h2 className="text-2xl font-black">Assinatura · {signatureOrder.os_number}</h2><p className="mb-4 text-zinc-400">Assinado em: {brDateTime(signatureOrder.art_approved_at)}</p>{signatureOrder.art_approval_signature?<img src={signatureOrder.art_approval_signature} className="w-full rounded-xl bg-white p-4"/>:<p className="text-zinc-400">Sem assinatura registrada.</p>}<button className="btn-dark mt-4" onClick={()=>setSignatureOrder(null)}>Fechar</button></div></div>}
  </div>
}
