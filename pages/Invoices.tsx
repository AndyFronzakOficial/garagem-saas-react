import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import jsPDF from 'jspdf'
import { supabase } from '../lib/supabase'
import { brNumber, formatDateBR, money, safeFileName, today } from '../lib/utils'

// V37 - NFS-e simples em 1 clique.
// Objetivo: selecionar a OS, conferir os dados e clicar em "Gerar NFS-e".
// O certificado A1 e a senha continuam fora do React, em variáveis seguras da Vercel/backend.

type InvoiceStatus = 'Rascunho'|'Enviando'|'Autorizada'|'Rejeitada'|'Simulação'|'Anexada'|'Cancelada'

type NfseMode = 'Simulação'|'Real via backend'

const emptyForm = {
  order_id:'',
  invoice_status:'Rascunho' as InvoiceStatus,
  invoice_number:'',
  invoice_series:'',
  invoice_issue_date:today(),
  invoice_total:'',
  invoice_customer_name:'',
  invoice_taxpayer_document:'',
  invoice_fiscal_description:'',
  invoice_fiscal_notes:''
}

const defaultNfseConfig = {
  nfse_provider:'Nacional',
  nfse_environment:'Homologação',
  nfse_municipality_code:'',
  nfse_service_code:'',
  nfse_service_item:'',
  nfse_cnae:'',
  nfse_iss_rate:'',
  nfse_dps_series:'1',
  nfse_next_dps_number:'1',
  nfse_tax_regime:'Simples Nacional',
  nfse_operation_nature:'Tributação no município'
}

function onlyDigits(v:any){
  return String(v || '').replace(/\D/g,'')
}

function customerName(o:any){
  return o?.clients?.company || o?.clients?.name || o?.client_name || 'Cliente não informado'
}

function customerContact(o:any){
  return [o?.clients?.phone,o?.clients?.email].filter(Boolean).join(' • ') || '-'
}

function customerAddress(o:any){
  return o?.clients?.address || '-'
}

function orderValue(o:any){
  return brNumber(o?.estimated_price || o?.invoice_total || o?.total || 0)
}

function normalizeItems(o:any){
  if(Array.isArray(o?.quote_items) && o.quote_items.length) return o.quote_items
  return [{
    service_name:o?.service || o?.service_type || 'Serviço de comunicação visual',
    quantity:1,
    estimated_price:o?.estimated_price || 0,
    observation:o?.description || ''
  }]
}

function defaultDescription(o:any){
  const items = normalizeItems(o)
  return items.map((item:any,index:number)=>{
    const name = item.service_name || item.service || 'Serviço de comunicação visual'
    const qty = Number(item.quantity || 1) || 1
    const width = item.width_cm ? `${item.width_cm}cm` : ''
    const height = item.height_cm ? `${item.height_cm}cm` : ''
    const measure = width && height ? ` - medida ${width} x ${height}` : ''
    const obs = item.observation ? ` - ${item.observation}` : ''
    return `${index+1}. ${name} - qtd. ${qty}${measure}${obs}`
  }).join('\n')
}

function statusColor(status:string){
  if(['Autorizada','Anexada'].includes(status)) return 'border-green-500/30 bg-green-950/40 text-green-200'
  if(['Rejeitada','Cancelada'].includes(status)) return 'border-red-500/30 bg-red-950/40 text-red-200'
  if(['Enviando'].includes(status)) return 'border-blue-500/30 bg-blue-950/40 text-blue-200'
  return 'border-gold/30 bg-gold/10 text-gold'
}

function invoiceFileName(o:any){
  const os = String(o?.os_number || 'nota').replace(/[^a-zA-Z0-9_-]/g,'-')
  return `conferencia-nfse-${os}.pdf`
}

export default function Invoices(){
  const location = useLocation()
  const [orders,setOrders] = useState<any[]>([])
  const [company,setCompany] = useState<any>(null)
  const [form,setForm] = useState<any>(emptyForm)
  const [nfseConfig,setNfseConfig] = useState<any>(defaultNfseConfig)
  const [mode,setMode] = useState<NfseMode>('Simulação')
  const [search,setSearch] = useState('')
  const [msg,setMsg] = useState('')
  const [saving,setSaving] = useState(false)
  const [showConfig,setShowConfig] = useState(false)
  const [selectedFile,setSelectedFile] = useState<File|null>(null)

  useEffect(()=>{ load() },[])

  useEffect(()=>{
    const id = new URLSearchParams(location.search).get('os')
    if(id && orders.length){
      const order = orders.find(o=>o.id === id)
      if(order) selectOrder(order)
    }
  },[location.search,orders])

  async function load(){
    // Carrega as ordens e a configuração fiscal salva na empresa.
    const [o,cfg] = await Promise.all([
      supabase.from('service_orders').select('*,clients(*)').order('created_at',{ascending:false}),
      supabase.from('company_settings').select('*').eq('id',1).maybeSingle()
    ])

    if(o.error){
      setMsg('Erro ao carregar ordens de serviço: '+o.error.message)
      return
    }

    const cfgData = cfg.data || null
    const localCfg = JSON.parse(localStorage.getItem('garagem_nfse_config') || '{}')

    setOrders((o.data || []).filter((x:any)=>!x.is_deleted))
    setCompany(cfgData)
    setNfseConfig({
      ...defaultNfseConfig,
      ...localCfg,
      ...(cfgData || {})
    })
  }

  function selectOrder(order:any){
    // Preenche todos os dados da nota automaticamente a partir da OS e do cliente.
    setForm({
      order_id:order.id,
      invoice_status:order.invoice_status || order.nfse_status || (order.invoice_file_url ? 'Anexada' : 'Rascunho'),
      invoice_number:order.invoice_number || '',
      invoice_series:order.invoice_series || order.nfse_dps_series || nfseConfig.nfse_dps_series || '1',
      invoice_issue_date:order.invoice_issue_date || today(),
      invoice_total:String(order.invoice_total || orderValue(order) || ''),
      invoice_customer_name:order.invoice_customer_name || customerName(order),
      invoice_taxpayer_document:order.invoice_taxpayer_document || order.clients?.document || order.clients?.cpf_cnpj || '',
      invoice_fiscal_description:order.invoice_fiscal_description || defaultDescription(order),
      invoice_fiscal_notes:order.invoice_fiscal_notes || ''
    })
    setSelectedFile(null)
    setMsg('OS selecionada. Confira os dados e clique em Gerar NFS-e.')
    window.scrollTo({top:0,behavior:'smooth'})
  }

  const selectedOrder = useMemo(()=>orders.find(o=>o.id === form.order_id),[orders,form.order_id])

  const filtered = useMemo(()=>{
    const q = search.toLowerCase().trim()
    return orders.filter(o=>{
      const text = [
        o.os_number,
        customerName(o),
        o.clients?.phone,
        o.service,
        o.service_type,
        o.invoice_number,
        o.nfse_access_key,
        o.invoice_status,
        o.nfse_status
      ].join(' ').toLowerCase()
      return !q || text.includes(q)
    })
  },[orders,search])

  const totals = useMemo(()=>{
    const emitidas = orders.filter(o=>o.invoice_file_url || o.nfse_access_key || o.invoice_status === 'Autorizada').length
    return {
      totalOS:orders.reduce((a,o)=>a+orderValue(o),0),
      emitidas,
      pendentes:orders.length - emitidas,
      simuladas:orders.filter(o=>o.invoice_status === 'Simulação' || o.nfse_status === 'Simulação').length
    }
  },[orders])

  function validationList(){
    return [
      {label:'Ordem de serviço selecionada', ok:Boolean(selectedOrder)},
      {label:'Cliente preenchido', ok:Boolean(form.invoice_customer_name?.trim())},
      {label:'CPF/CNPJ do tomador preenchido', ok:Boolean(onlyDigits(form.invoice_taxpayer_document))},
      {label:'Valor da nota preenchido', ok:brNumber(form.invoice_total) > 0},
      {label:'Descrição do serviço preenchida', ok:Boolean(form.invoice_fiscal_description?.trim())},
      {label:'Código IBGE do município', ok:Boolean(onlyDigits(nfseConfig.nfse_municipality_code))},
      {label:'Código de serviço municipal', ok:Boolean(nfseConfig.nfse_service_code)},
      {label:'Item LC 116', ok:Boolean(nfseConfig.nfse_service_item)}
    ]
  }

  function validateNfse(){
    const missing = validationList().filter(x=>!x.ok).map(x=>x.label)
    if(missing.length){
      return 'Antes de gerar, corrija:\n- '+missing.join('\n- ')
    }
    return ''
  }

  async function saveFiscalConfig(){
    // Salva dados fiscais que não são sensíveis. Certificado A1 nunca é salvo aqui.
    setSaving(true)
    setMsg('')
    try{
      const payload = {
        id:1,
        ...nfseConfig,
        nfse_iss_rate:brNumber(nfseConfig.nfse_iss_rate),
        nfse_next_dps_number:Number(nfseConfig.nfse_next_dps_number || 1)
      }
      const res = await supabase.from('company_settings').upsert(payload)
      if(res.error) throw new Error(res.error.message)
      localStorage.setItem('garagem_nfse_config',JSON.stringify(nfseConfig))
      setMsg('Configuração fiscal salva. Agora você só precisa selecionar uma OS e gerar a NFS-e.')
      await load()
    }catch(err:any){
      localStorage.setItem('garagem_nfse_config',JSON.stringify(nfseConfig))
      setMsg('Configuração salva localmente. Para salvar no Supabase, rode o patch SQL V36. Detalhe: '+(err.message || err))
    }finally{
      setSaving(false)
    }
  }

  async function saveDraftStatus(status:InvoiceStatus, extra:any={}){
    if(!selectedOrder) return

    const payload = {
      invoice_type:'NFS-e Serviço',
      invoice_status:status,
      invoice_number:extra.invoiceNumber || form.invoice_number || null,
      invoice_series:nfseConfig.nfse_dps_series || form.invoice_series || '1',
      invoice_issue_date:today(),
      invoice_total:brNumber(form.invoice_total),
      invoice_customer_name:form.invoice_customer_name || customerName(selectedOrder),
      invoice_taxpayer_document:form.invoice_taxpayer_document || null,
      invoice_fiscal_description:form.invoice_fiscal_description || null,
      invoice_fiscal_notes:form.invoice_fiscal_notes || null,
      nfse_environment:nfseConfig.nfse_environment,
      nfse_provider:nfseConfig.nfse_provider,
      nfse_status:extra.status || status,
      nfse_access_key:extra.accessKey || null,
      nfse_protocol:extra.protocol || null,
      nfse_dps_number:Number(nfseConfig.nfse_next_dps_number || 1),
      nfse_dps_series:nfseConfig.nfse_dps_series || '1',
      nfse_dps_xml:extra.dpsXml || null,
      nfse_xml:extra.nfseXml || null,
      nfse_request_payload:extra.requestPayload || null,
      nfse_response_payload:extra.responsePayload || null,
      nfse_error_message:extra.message || null,
      danfse_url:extra.danfseUrl || null,
      invoice_file_url:extra.danfseUrl || selectedOrder.invoice_file_url || null
    }

    const updated = await supabase.from('service_orders').update(payload).eq('id',selectedOrder.id)
    if(updated.error) throw new Error(updated.error.message)
  }

  function buildRequestPayload(){
    return {
      order:{
        id:selectedOrder?.id,
        os_number:selectedOrder?.os_number,
        status:selectedOrder?.status
      },
      prestador:{
        nome:company?.company_name,
        cnpj:company?.cnpj,
        municipioIbge:nfseConfig.nfse_municipality_code
      },
      tomador:{
        nome:form.invoice_customer_name || customerName(selectedOrder),
        documento:onlyDigits(form.invoice_taxpayer_document),
        contato:customerContact(selectedOrder),
        endereco:customerAddress(selectedOrder)
      },
      servico:{
        descricao:form.invoice_fiscal_description,
        valor:brNumber(form.invoice_total),
        codigoServico:nfseConfig.nfse_service_code,
        itemListaServico:nfseConfig.nfse_service_item,
        cnae:nfseConfig.nfse_cnae,
        aliquotaIss:brNumber(nfseConfig.nfse_iss_rate)
      },
      dps:{
        ambiente:nfseConfig.nfse_environment,
        provedor:nfseConfig.nfse_provider,
        modo:mode,
        codigoMunicipio:onlyDigits(nfseConfig.nfse_municipality_code),
        serie:nfseConfig.nfse_dps_series || '1',
        numero:Number(nfseConfig.nfse_next_dps_number || 1),
        regime:nfseConfig.nfse_tax_regime,
        naturezaOperacao:nfseConfig.nfse_operation_nature
      }
    }
  }

  function simulatedResult(requestPayload:any){
    return {
      authorized:false,
      status:'Simulação',
      message:'Simulação concluída. A NFS-e foi preparada e registrada no sistema, mas não foi enviada ao fisco.',
      protocol:`SIM-${Date.now()}`,
      accessKey:null,
      dpsXml:`<DPS_SIMULADA><OS>${selectedOrder?.os_number || ''}</OS><VALOR>${brNumber(form.invoice_total).toFixed(2)}</VALOR></DPS_SIMULADA>`,
      requestPayload
    }
  }

  async function emitNfse(){
    const validation = validateNfse()
    if(validation){
      setMsg(validation)
      return
    }
    if(!selectedOrder) return

    setSaving(true)
    setMsg(mode === 'Simulação' ? 'Gerando NFS-e em simulação...' : 'Enviando para o backend fiscal...')

    const requestPayload = buildRequestPayload()

    try{
      await saveDraftStatus('Enviando',{requestPayload})

      let result:any

      if(mode === 'Simulação'){
        // No modo simulação, a nota é gerada sem chamar serviço fiscal externo.
        result = simulatedResult(requestPayload)
      }else{
        // No modo real, o React chama apenas o backend. O backend usa certificado A1 via variável segura.
        const response = await fetch('/api/nfse/emitir',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify(requestPayload)
        })
        result = await response.json().catch(()=>({
          status:'Rejeitada',
          message:'Resposta inválida do backend fiscal.'
        }))
        if(!response.ok && !result.status) result.status = 'Rejeitada'
      }

      const finalStatus:InvoiceStatus = result.authorized ? 'Autorizada' : result.status === 'Simulação' ? 'Simulação' : 'Rejeitada'
      await saveDraftStatus(finalStatus,{
        ...result,
        requestPayload,
        responsePayload:result
      })

      if(finalStatus === 'Autorizada' || finalStatus === 'Simulação'){
        const nextNumber = Number(nfseConfig.nfse_next_dps_number || 1) + 1
        setNfseConfig((prev:any)=>({...prev,nfse_next_dps_number:String(nextNumber)}))
        await supabase.from('company_settings').update({nfse_next_dps_number:nextNumber}).eq('id',1)
      }

      setMsg(result.message || 'Retorno recebido. Confira o status da NFS-e na lista.')
      await load()
    }catch(err:any){
      setMsg('Erro ao gerar NFS-e: '+(err.message || err))
    }finally{
      setSaving(false)
    }
  }

  function copyVariables(){
    const vars = [
      '# Variáveis seguras para colocar na Vercel, nunca no React',
      `NFSE_MOCK_MODE=${mode === 'Simulação' ? 'true' : 'false'}`,
      `NFSE_PROVIDER=${nfseConfig.nfse_provider}`,
      `NFSE_ENV=${nfseConfig.nfse_environment}`,
      `NFSE_MUNICIPIO_IBGE=${onlyDigits(nfseConfig.nfse_municipality_code)}`,
      `NFSE_CNPJ_PRESTADOR=${company?.cnpj || 'SEU_CNPJ'}`,
      'NFSE_INSCRICAO_MUNICIPAL=SUA_INSCRICAO_MUNICIPAL',
      'NFSE_A1_PFX_BASE64=COLE_O_BASE64_DO_CERTIFICADO_A1',
      'NFSE_A1_PASSWORD=SENHA_DO_CERTIFICADO_A1',
      'NFSE_REAL_TRANSMISSION_ENABLED=false'
    ].join('\n')
    navigator.clipboard?.writeText(vars)
    setMsg('Variáveis copiadas. Cole na Vercel em Project Settings > Environment Variables. Mantenha NFSE_MOCK_MODE=true até testar tudo.')
  }

  function copyInvoiceData(){
    const text = [
      `OS: ${selectedOrder?.os_number || '-'}`,
      `Cliente: ${form.invoice_customer_name}`,
      `CPF/CNPJ: ${form.invoice_taxpayer_document}`,
      `Valor: ${money(brNumber(form.invoice_total))}`,
      `Município IBGE: ${nfseConfig.nfse_municipality_code}`,
      `Código serviço: ${nfseConfig.nfse_service_code}`,
      `Item LC 116: ${nfseConfig.nfse_service_item}`,
      '',
      'Descrição:',
      form.invoice_fiscal_description
    ].join('\n')
    navigator.clipboard?.writeText(text)
    setMsg('Dados da NFS-e copiados.')
  }

  function generateConferencePdf(){
    if(!selectedOrder){
      setMsg('Selecione uma OS primeiro.')
      return
    }

    // PDF de conferência: não tem validade fiscal; serve para revisar antes da emissão.
    const pdf = new jsPDF('p','mm','a4')
    const pageW = pdf.internal.pageSize.getWidth()
    const margin = 14
    let y = 16

    pdf.setFillColor(18,18,18)
    pdf.rect(0,0,pageW,34,'F')
    pdf.setTextColor(255,211,77)
    pdf.setFont('helvetica','bold')
    pdf.setFontSize(17)
    pdf.text('CONFERÊNCIA DE NFS-E',margin,y)
    pdf.setFontSize(9)
    pdf.setTextColor(245,245,245)
    pdf.text(company?.company_name || 'Garagem Comunicação Visual',margin,y+8)
    pdf.text(`Data: ${formatDateBR(today())}`,pageW-margin,y+8,{align:'right'})

    y = 46
    pdf.setTextColor(0,0,0)
    pdf.setFont('helvetica','bold')
    pdf.setFontSize(12)
    pdf.text('1. Dados principais',margin,y)
    y += 7
    pdf.setFont('helvetica','normal')
    pdf.setFontSize(10)
    pdf.text(`OS: ${selectedOrder.os_number || '-'}`,margin,y)
    pdf.text(`Valor: ${money(brNumber(form.invoice_total))}`,pageW-margin,y,{align:'right'})
    y += 6
    pdf.text(`Cliente: ${form.invoice_customer_name || customerName(selectedOrder)}`,margin,y)
    y += 6
    pdf.text(`CPF/CNPJ: ${form.invoice_taxpayer_document || '-'}`,margin,y)
    y += 6
    pdf.text(`Contato: ${customerContact(selectedOrder)}`,margin,y)
    y += 6
    pdf.text(`Endereço: ${customerAddress(selectedOrder)}`,margin,y)
    y += 10

    pdf.setFont('helvetica','bold')
    pdf.text('2. Configuração fiscal',margin,y)
    y += 7
    pdf.setFont('helvetica','normal')
    pdf.text(`Provedor: ${nfseConfig.nfse_provider} • Ambiente: ${nfseConfig.nfse_environment}`,margin,y)
    y += 6
    pdf.text(`Município IBGE: ${nfseConfig.nfse_municipality_code || '-'} • Serviço: ${nfseConfig.nfse_service_code || '-'}`,margin,y)
    y += 6
    pdf.text(`Item LC 116: ${nfseConfig.nfse_service_item || '-'} • CNAE: ${nfseConfig.nfse_cnae || '-'}`,margin,y)
    y += 6
    pdf.text(`Série DPS: ${nfseConfig.nfse_dps_series || '1'} • Nº DPS: ${nfseConfig.nfse_next_dps_number || '1'}`,margin,y)
    y += 10

    pdf.setFont('helvetica','bold')
    pdf.text('3. Descrição do serviço',margin,y)
    y += 6
    pdf.setFont('helvetica','normal')
    pdf.setFontSize(9)
    const lines = pdf.splitTextToSize(form.invoice_fiscal_description || defaultDescription(selectedOrder),pageW-(margin*2))
    pdf.text(lines,margin,y)

    pdf.setDrawColor(220,220,220)
    pdf.line(margin,278,pageW-margin,278)
    pdf.setFontSize(8)
    pdf.setTextColor(90,90,90)
    pdf.text('Documento interno de conferência. A validade fiscal depende da autorização da NFS-e pelo emissor oficial.',margin,284)
    pdf.save(invoiceFileName(selectedOrder))
  }

  async function uploadInvoiceFile(){
    if(!selectedOrder){
      setMsg('Selecione uma OS primeiro.')
      return
    }
    if(!selectedFile){
      setMsg('Escolha o PDF, XML ou imagem da nota fiscal emitida.')
      return
    }

    setSaving(true)
    setMsg('Anexando nota fiscal...')
    try{
      const path = `notas-fiscais/${selectedOrder.id}/${Date.now()}-${safeFileName(selectedFile.name)}`
      const up = await supabase.storage.from('os-files').upload(path,selectedFile,{upsert:true,contentType:selectedFile.type || 'application/octet-stream'})
      if(up.error) throw new Error(up.error.message)
      const url = supabase.storage.from('os-files').getPublicUrl(path).data.publicUrl
      const res = await supabase.from('service_orders').update({
        invoice_file_url:url,
        invoice_status:'Anexada',
        invoice_type:'NFS-e Serviço',
        invoice_total:brNumber(form.invoice_total),
        invoice_customer_name:form.invoice_customer_name || customerName(selectedOrder),
        invoice_taxpayer_document:form.invoice_taxpayer_document || null,
        invoice_fiscal_description:form.invoice_fiscal_description || null
      }).eq('id',selectedOrder.id)
      if(res.error) throw new Error(res.error.message)
      setSelectedFile(null)
      setMsg('Nota anexada e vinculada à OS.')
      await load()
    }catch(err:any){
      setMsg('Erro ao anexar nota fiscal: '+(err.message || err))
    }finally{
      setSaving(false)
    }
  }

  const checks = validationList()
  const readyToEmit = checks.every(c=>c.ok)

  return <div className="page-fade">
    <header className="hero-card mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-sm font-black uppercase tracking-[.35em] text-gold/80">Fiscal / NFS-e</p>
        <h1 className="mt-2 text-4xl font-black md:text-5xl">Emitir NFS-e</h1>
        <p className="text-zinc-400">Selecione a OS, confira os dados e gere a nota em simulação ou envie para o backend fiscal.</p>
      </div>
      <div className={`rounded-2xl border p-3 text-sm ${mode === 'Simulação' ? 'border-gold/30 bg-gold/10 text-gold' : 'border-blue-500/30 bg-blue-950/40 text-blue-200'}`}>
        Modo atual: <strong>{mode}</strong><br />Certificado A1 só no backend/Vercel.
      </div>
    </header>

    {msg && <div className="mb-5 whitespace-pre-wrap rounded-xl border border-gold/30 bg-gold/10 p-3 text-gold">{msg}</div>}

    <section className="mb-5 grid gap-4 md:grid-cols-4">
      <article className="metric-card"><small>Valor das OS</small><h2 className="text-2xl font-black">{money(totals.totalOS)}</h2></article>
      <article className="metric-card"><small>Emitidas/anexadas</small><h2 className="text-2xl font-black">{totals.emitidas}</h2></article>
      <article className="metric-card"><small>Simulações</small><h2 className="text-2xl font-black">{totals.simuladas}</h2></article>
      <article className="metric-card"><small>Pendentes</small><h2 className="text-2xl font-black">{totals.pendentes}</h2></article>
    </section>

    <section className="card mb-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-black">Configuração rápida</h2>
          <p className="text-sm text-zinc-400">Preencha uma vez. Depois é só selecionar a OS e clicar em Gerar NFS-e.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="input w-56" value={mode} onChange={e=>setMode(e.target.value as NfseMode)}>
            <option>Simulação</option>
            <option>Real via backend</option>
          </select>
          <button type="button" className="btn-dark" onClick={()=>setShowConfig(!showConfig)}>{showConfig ? 'Ocultar configuração' : 'Ver configuração'}</button>
          <button type="button" className="btn-dark" onClick={copyVariables}>Copiar variáveis Vercel</button>
        </div>
      </div>

      {showConfig && <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div><label className="text-sm text-zinc-400">Provedor</label><select className="input mt-1" value={nfseConfig.nfse_provider} onChange={e=>setNfseConfig({...nfseConfig,nfse_provider:e.target.value})}><option>Nacional</option><option>Municipal</option></select></div>
        <div><label className="text-sm text-zinc-400">Ambiente</label><select className="input mt-1" value={nfseConfig.nfse_environment} onChange={e=>setNfseConfig({...nfseConfig,nfse_environment:e.target.value})}><option>Homologação</option><option>Produção</option></select></div>
        <div><label className="text-sm text-zinc-400">Município IBGE</label><input className="input mt-1" placeholder="Ex: 4105805" value={nfseConfig.nfse_municipality_code} onChange={e=>setNfseConfig({...nfseConfig,nfse_municipality_code:e.target.value})}/></div>
        <div><label className="text-sm text-zinc-400">Código serviço</label><input className="input mt-1" value={nfseConfig.nfse_service_code} onChange={e=>setNfseConfig({...nfseConfig,nfse_service_code:e.target.value})}/></div>
        <div><label className="text-sm text-zinc-400">Item LC 116</label><input className="input mt-1" placeholder="Ex: 13.05" value={nfseConfig.nfse_service_item} onChange={e=>setNfseConfig({...nfseConfig,nfse_service_item:e.target.value})}/></div>
        <div><label className="text-sm text-zinc-400">CNAE</label><input className="input mt-1" value={nfseConfig.nfse_cnae} onChange={e=>setNfseConfig({...nfseConfig,nfse_cnae:e.target.value})}/></div>
        <div><label className="text-sm text-zinc-400">ISS %</label><input className="input mt-1" placeholder="Ex: 2,00" value={nfseConfig.nfse_iss_rate} onChange={e=>setNfseConfig({...nfseConfig,nfse_iss_rate:e.target.value})}/></div>
        <div><label className="text-sm text-zinc-400">Série DPS</label><input className="input mt-1" value={nfseConfig.nfse_dps_series} onChange={e=>setNfseConfig({...nfseConfig,nfse_dps_series:e.target.value})}/></div>
        <div><label className="text-sm text-zinc-400">Próximo nº DPS</label><input className="input mt-1" value={nfseConfig.nfse_next_dps_number} onChange={e=>setNfseConfig({...nfseConfig,nfse_next_dps_number:e.target.value})}/></div>
        <div><label className="text-sm text-zinc-400">Regime</label><input className="input mt-1" value={nfseConfig.nfse_tax_regime} onChange={e=>setNfseConfig({...nfseConfig,nfse_tax_regime:e.target.value})}/></div>
        <div className="md:col-span-2"><label className="text-sm text-zinc-400">Natureza da operação</label><input className="input mt-1" value={nfseConfig.nfse_operation_nature} onChange={e=>setNfseConfig({...nfseConfig,nfse_operation_nature:e.target.value})}/></div>
        <div className="md:col-span-4"><button type="button" className="btn-gold" onClick={saveFiscalConfig} disabled={saving}>Salvar configuração fiscal</button></div>
      </div>}
    </section>

    <section className="grid gap-6 xl:grid-cols-3">
      <div className="card xl:col-span-2">
        <h2 className="mb-4 text-2xl font-black">1. Selecionar OS e conferir</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-sm text-zinc-400">Ordem de Serviço</label>
            <select className="input mt-1" value={form.order_id} onChange={e=>{ const o=orders.find(x=>x.id===e.target.value); if(o) selectOrder(o); else setForm(emptyForm) }}>
              <option value="">Selecione uma OS</option>
              {orders.map(o=><option key={o.id} value={o.id}>{o.os_number || 'Sem número'} - {customerName(o)} - {money(orderValue(o))}</option>)}
            </select>
          </div>
          <div><label className="text-sm text-zinc-400">Cliente / Tomador</label><input className="input mt-1" value={form.invoice_customer_name} onChange={e=>setForm({...form,invoice_customer_name:e.target.value})}/></div>
          <div><label className="text-sm text-zinc-400">CPF/CNPJ</label><input className="input mt-1" value={form.invoice_taxpayer_document} onChange={e=>setForm({...form,invoice_taxpayer_document:e.target.value})}/></div>
          <div><label className="text-sm text-zinc-400">Valor da NFS-e</label><input className="input mt-1" value={form.invoice_total} onChange={e=>setForm({...form,invoice_total:e.target.value})}/></div>
          <div><label className="text-sm text-zinc-400">Data</label><input type="date" className="input mt-1" value={form.invoice_issue_date} onChange={e=>setForm({...form,invoice_issue_date:e.target.value})}/></div>
          <div className="md:col-span-2"><label className="text-sm text-zinc-400">Descrição do serviço</label><textarea className="input mt-1 min-h-[130px]" value={form.invoice_fiscal_description} onChange={e=>setForm({...form,invoice_fiscal_description:e.target.value})}/></div>
          <div className="md:col-span-2"><label className="text-sm text-zinc-400">Observações internas</label><textarea className="input mt-1" value={form.invoice_fiscal_notes} onChange={e=>setForm({...form,invoice_fiscal_notes:e.target.value})}/></div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="btn-gold" onClick={emitNfse} disabled={saving || !selectedOrder}>{saving ? 'Processando...' : 'Gerar NFS-e'}</button>
          <button type="button" className="btn-dark" onClick={generateConferencePdf} disabled={!selectedOrder}>PDF conferência</button>
          <button type="button" className="btn-dark" onClick={copyInvoiceData} disabled={!selectedOrder}>Copiar dados</button>
        </div>
      </div>

      <aside className="card">
        <h2 className="mb-4 text-2xl font-black">2. Conferência rápida</h2>
        <div className="space-y-2">
          {checks.map(c=><div key={c.label} className={`rounded-xl border p-2 text-sm ${c.ok ? 'border-green-500/30 bg-green-950/30 text-green-200' : 'border-red-500/30 bg-red-950/30 text-red-200'}`}>{c.ok ? '✓' : '!' } {c.label}</div>)}
        </div>
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-zinc-300">
          {readyToEmit ? 'Tudo preenchido. Pode gerar a NFS-e.' : 'Preencha os itens pendentes antes de gerar.'}
        </div>
        {selectedOrder && <div className={`mt-4 rounded-xl border p-3 text-sm ${statusColor(form.invoice_status || selectedOrder.invoice_status || selectedOrder.nfse_status || 'Rascunho')}`}>
          Status atual: <strong>{selectedOrder.invoice_status || selectedOrder.nfse_status || form.invoice_status || 'Rascunho'}</strong><br />
          {selectedOrder.nfse_protocol && <>Protocolo: {selectedOrder.nfse_protocol}<br /></>}
          {selectedOrder.nfse_access_key && <>Chave: {selectedOrder.nfse_access_key}<br /></>}
          {selectedOrder.nfse_error_message && <span>{selectedOrder.nfse_error_message}</span>}
          {selectedOrder.invoice_file_url && <a className="btn-gold mt-3 block text-center" href={selectedOrder.invoice_file_url} target="_blank" rel="noreferrer">Abrir nota/DANFSE</a>}
        </div>}

        <div className="mt-5 border-t border-white/10 pt-4">
          <h3 className="font-black">Anexar nota pronta</h3>
          <p className="mb-2 text-sm text-zinc-400">Use quando emitir no portal externo e quiser salvar PDF/XML na OS.</p>
          <input type="file" className="input" accept=".pdf,.xml,image/*" onChange={e=>setSelectedFile(e.target.files?.[0] || null)}/>
          <button type="button" className="btn-dark mt-2 w-full" onClick={uploadInvoiceFile} disabled={saving || !selectedFile}>Anexar na OS</button>
        </div>
      </aside>
    </section>

    <section className="card mt-6">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-black">Ordens e NFS-e</h2>
          <p className="text-sm text-zinc-400">Clique em uma OS para preparar a emissão rapidamente.</p>
        </div>
        <input className="input max-w-md" placeholder="Buscar OS, cliente, telefone ou status" value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-zinc-400"><tr><th className="p-2">OS</th><th>Cliente</th><th>Valor</th><th>Status nota</th><th>Ação</th></tr></thead>
          <tbody>
            {filtered.map(o=>{
              const status = o.invoice_status || o.nfse_status || (o.invoice_file_url ? 'Anexada' : 'Pendente')
              return <tr key={o.id} className="border-t border-white/10">
                <td className="p-2 font-bold">{o.os_number || '-'}</td>
                <td>{customerName(o)}</td>
                <td>{money(orderValue(o))}</td>
                <td><span className={`rounded-full border px-2 py-1 text-xs ${statusColor(status)}`}>{status}</span></td>
                <td><button type="button" className="btn-dark" onClick={()=>selectOrder(o)}>Selecionar</button></td>
              </tr>
            })}
            {!filtered.length && <tr><td colSpan={5} className="p-4 text-center text-zinc-400">Nenhuma OS encontrada.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </div>
}
