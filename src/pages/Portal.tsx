import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { brNumber, cmToM, formatDateBR, money, onlyNumbers } from '../lib/utils'
import { nextOSNumber } from '../lib/osNumber'
import { connectGoogleDrive, uploadFileToGoogleDrive, isGoogleDriveConfigured } from '../lib/googleDrive'
import jsPDF from 'jspdf'

export default function Portal() {
  const [step, setStep] = useState<'login'|'form'>('login')
  const [client, setClient] = useState<any>(null)
  const [company, setCompany] = useState('')
  const [phone, setPhone] = useState('')
  const [services, setServices] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [file, setFile] = useState<File|null>(null)
  const [msg, setMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [f, setF] = useState({service_price_id:'',service:'',width_cm:'',height_cm:'',description:''})
  const [signingOrder,setSigningOrder]=useState<any>(null)
  const [artRevisionNote,setArtRevisionNote]=useState('')
  const [theme,setTheme]=useState<'dark'|'light'>(()=>(localStorage.getItem('portal-theme') as 'dark'|'light') || 'dark')

  function toggleTheme(){
    const next=theme==='dark'?'light':'dark'
    setTheme(next)
    localStorage.setItem('portal-theme',next)
  }
  function goTo(id:string){ document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'}) }
  function logout(){ setClient(null); setStep('login'); setCompany(''); setPhone(''); setMsg(''); setErrorMsg('') }

  useEffect(()=>{ supabase.from('service_prices').select('*').eq('active',true).order('name').then(({data,error})=>{ if(error) setErrorMsg('Erro ao carregar serviços: '+error.message); setServices(data||[]) }) },[])

  async function login(e:React.FormEvent){
    e.preventDefault(); setErrorMsg(''); setMsg('')
    const {data,error}=await supabase.from('clients').select('*').ilike('company',company).limit(1).maybeSingle()
    if(error){ setErrorMsg('Erro ao buscar cliente: '+error.message); return }
    if(data && onlyNumbers(data.phone||'')===onlyNumbers(phone)){ setClient(data); setStep('form'); loadOrders(data.id) }
    else setErrorMsg('Empresa ou telefone inválido.')
  }
  async function loadOrders(id:string){ const {data,error}=await supabase.from('service_orders').select('*').eq('client_id',id).order('created_at',{ascending:false}); if(error) setErrorMsg('Erro ao carregar serviços: '+error.message); setOrders(data||[]) }

  const service=services.find(s=>s.id===f.service_price_id)
  const widthM=cmToM(f.width_cm)
  const heightM=cmToM(f.height_cm)
  const area=widthM*heightM
  const total=area*Number(service?.price_m2_partner||0)

  async function uploadToDrive(osNumber:string){
    if(!file) return {fileUrl:null,driveFileId:null,driveFileName:null,driveFolderId:null}
    if(!isGoogleDriveConfigured()) throw new Error('Google Drive não configurado. Configure VITE_GOOGLE_CLIENT_ID no .env.')
    await connectGoogleDrive()
    const uploaded=await uploadFileToGoogleDrive(file,{clientName:client?.company||client?.name||'Cliente',osNumber})
    return {fileUrl:uploaded.viewLink,driveFileId:uploaded.id,driveFileName:uploaded.name,driveFolderId:uploaded.folderId}
  }


  function getCanvasData(){
    const canvas = document.getElementById('signature-canvas') as HTMLCanvasElement | null
    return canvas?.toDataURL('image/png') || null
  }
  function startDraw(e:any){
    const canvas=e.currentTarget as HTMLCanvasElement; const ctx=canvas.getContext('2d'); if(!ctx)return
    canvas.dataset.drawing='true'; const rect=canvas.getBoundingClientRect(); const x=(e.touches?.[0]?.clientX ?? e.clientX)-rect.left; const y=(e.touches?.[0]?.clientY ?? e.clientY)-rect.top; ctx.beginPath(); ctx.moveTo(x,y)
  }
  function draw(e:any){
    const canvas=e.currentTarget as HTMLCanvasElement; if(canvas.dataset.drawing!=='true')return; e.preventDefault()
    const ctx=canvas.getContext('2d'); if(!ctx)return; const rect=canvas.getBoundingClientRect(); const x=(e.touches?.[0]?.clientX ?? e.clientX)-rect.left; const y=(e.touches?.[0]?.clientY ?? e.clientY)-rect.top; ctx.lineWidth=2; ctx.lineCap='round'; ctx.strokeStyle='#111'; ctx.lineTo(x,y); ctx.stroke()
  }
  function stopDraw(e:any){ e.currentTarget.dataset.drawing='false' }
  function clearSignature(){ const canvas=document.getElementById('signature-canvas') as HTMLCanvasElement|null; const ctx=canvas?.getContext('2d'); if(ctx&&canvas){ctx.clearRect(0,0,canvas.width,canvas.height)} }
  async function approveArt(order:any){
    const signature=getCanvasData()
    if(!signature){ setErrorMsg('Faça a assinatura antes de aprovar.'); return }
    const {error}=await supabase.from('service_orders').update({art_approval_status:'Aprovada',art_approved_at:new Date().toISOString(),art_approval_signature:signature,art_revision_note:null}).eq('id',order.id)
    if(error) setErrorMsg('Erro ao aprovar arte: '+error.message); else { setMsg('Arte aprovada e assinatura registrada.'); setSigningOrder(null); loadOrders(client.id) }
  }
  async function requestRevision(order:any){
    const {error}=await supabase.from('service_orders').update({art_approval_status:'Alteração solicitada',art_revision_requested_at:new Date().toISOString(),art_revision_note:artRevisionNote||'Cliente solicitou alteração.'}).eq('id',order.id)
    if(error) setErrorMsg('Erro ao solicitar alteração: '+error.message); else { setMsg('Solicitação de alteração registrada.'); setSigningOrder(null); setArtRevisionNote(''); loadOrders(client.id) }
  }
  function downloadContract(order:any){
    const pdf=new jsPDF('p','mm','a4')
    pdf.setFontSize(16); pdf.text('TERMO DE APROVAÇÃO DE ARTE E ORDEM DE SERVIÇO',12,18)
    pdf.setFontSize(10)
    pdf.text(`Cliente: ${client?.name || client?.company || '-'}`,12,34)
    pdf.text(`Empresa: ${client?.company || '-'}`,12,42)
    pdf.text(`OS: ${order.os_number}`,12,50)
    pdf.text(`Serviço: ${order.service}`,12,58)
    pdf.text(`Valor: ${money(order.estimated_price)}`,12,66)
    const text='Ao aprovar este documento, o cliente declara que conferiu a arte, medidas, textos, cores, informações, serviços e condições da ordem de serviço. Após a aprovação, alterações podem gerar novo prazo e custo adicional conforme análise da empresa.'
    pdf.text(pdf.splitTextToSize(text,180),12,82)
    if(order.art_approval_signature){ try{ pdf.addImage(order.art_approval_signature,'PNG',20,135,70,30) }catch{} }
    pdf.line(20,170,95,170); pdf.text('Assinatura do Cliente',34,178)
    pdf.text(`Emitido em: ${new Date().toLocaleString('pt-BR')}`,12,194)
    pdf.save(`contrato-${order.os_number}.pdf`)
  }

  async function save(e:React.FormEvent){
    e.preventDefault(); setErrorMsg(''); setMsg(''); setLoading(true)
    try{
      if(!service || !client){ setErrorMsg('Cliente ou serviço inválido.'); return }
      const num=await nextOSNumber()
      const uploaded=await uploadToDrive(num)
      const {error}=await supabase.from('service_orders').insert({os_number:num,client_id:client.id,service:f.service||service.name,service_price_id:service.id,service_type:service.name,width_m:widthM,height_m:heightM,width_cm:brNumber(f.width_cm),height_cm:brNumber(f.height_cm),area_m2:area,price_m2:service.price_m2_partner,estimated_price:total,measures:`${brNumber(f.width_cm).toFixed(0)}cm x ${brNumber(f.height_cm).toFixed(0)}cm`,finishing:'Sem acabamento',description:f.description||null,print_file_url:uploaded.fileUrl,drive_file_id:uploaded.driveFileId,drive_file_name:uploaded.driveFileName,drive_folder_id:uploaded.driveFolderId,source:'Cliente',status:'Orçamento',priority:'Média'})
      if(error){ setErrorMsg('Erro ao salvar orçamento: '+error.message); return }
      setMsg(`Orçamento cadastrado: ${num} - ${money(total)}`); setFile(null); setF({service_price_id:'',service:'',width_cm:'',height_cm:'',description:''}); await loadOrders(client.id)
    }catch(err:any){ setErrorMsg(err.message || 'Erro ao enviar serviço.') }
    finally{ setLoading(false) }
  }

  if(step==='login') return (
    <div className={`client-portal portal-public ${theme==='dark'?'theme-dark':''}`}>
      <div className="client-shell grid min-h-screen place-items-center">
        <form onSubmit={login} className="card w-full max-w-md">
          <div className="mb-6 text-center">
            <img src="/logo.png" className="logo-img mx-auto max-h-28 object-contain"/>
            <div className="mt-2 muted-text">Portal Terceiro</div>
          </div>
          <button type="button" className="btn-dark mb-4 w-full" onClick={toggleTheme}>{theme==='dark'?'Tema claro':'Tema escuro'}</button>
          {errorMsg&&<div className="mb-4 rounded-xl bg-red-900/60 p-3 text-red-100">{errorMsg}</div>}
          <input className="input mb-3" placeholder="Nome da empresa" value={company} onChange={e=>setCompany(e.target.value)} required/>
          <input className="input mb-5" placeholder="Telefone somente números" value={phone} onChange={e=>setPhone(e.target.value)} required/>
          <button className="btn-gold w-full">Entrar</button>
        </form>
      </div>
    </div>
  )

  return (
    <div className={`client-portal portal-public ${theme==='dark'?'theme-dark':''}`}>
      <header className="portal-topbar">
        <div className="portal-topbar-inner">
          <button className="portal-logo-btn" onClick={()=>goTo('portal-top')} aria-label="Topo">
            <img src="/logo.png" className="logo-img max-h-12 object-contain"/>
          </button>
          <nav className="portal-actions">
            <button className="btn-dark" onClick={()=>goTo('rastreamento')}>Rastrear serviço</button>
            <button className="btn-dark" onClick={()=>goTo('cadastro-orcamento')}>Cadastrar orçamento</button>
            <button className="btn-dark" onClick={toggleTheme}>{theme==='dark'?'Light':'Dark'}</button>
            <button className="btn-red" onClick={logout}>Sair</button>
          </nav>
        </div>
      </header>

      <div id="portal-top" className="client-shell portal-shell-offset">
        <section className="portal-hero card mb-6">
          <div>
            <p className="muted-text text-sm font-bold uppercase tracking-[0.25em]">Portal Terceiro</p>
            <h1 className="mt-2 text-3xl font-black text-strong md:text-4xl">Olá, {client?.company || client?.name}</h1>
            <p className="mt-2 muted-text">Acompanhe suas ordens, baixe arquivos e cadastre novos orçamentos.</p>
          </div>
          <div className="portal-hero-badge">{orders.length} serviço(s)</div>
        </section>

        {msg&&<div className="mb-4 rounded-xl border border-gold/30 bg-gold/10 p-4 text-gold">{msg}</div>}
        {errorMsg&&<div className="mb-4 rounded-xl border border-red-500/30 bg-red-950/60 p-4 text-red-100">{errorMsg}</div>}

        <section id="cadastro-orcamento" className="client-card scroll-mt-28">
          <h1 className="text-3xl font-black text-strong">Cadastrar orçamento</h1>
          <p className="mt-1 muted-text">Informe as medidas em centímetros. Exemplo: 120 x 80.</p>
          <form onSubmit={save} className="client-grid mt-6">
            <select className="input full" value={f.service_price_id} onChange={e=>setF({...f,service_price_id:e.target.value})} required>
              <option value="">Serviço</option>
              {services.map(s=><option key={s.id} value={s.id}>{s.name} - {money(s.price_m2_partner)}/m²</option>)}
            </select>
            <input className="input full" placeholder="Nome do serviço" value={f.service} onChange={e=>setF({...f,service:e.target.value})}/>
            <input className="input" placeholder="Largura em cm. Ex: 120" value={f.width_cm} onChange={e=>setF({...f,width_cm:e.target.value})} required/>
            <input className="input" placeholder="Altura em cm. Ex: 80" value={f.height_cm} onChange={e=>setF({...f,height_cm:e.target.value})} required/>
            <textarea className="input full" placeholder="Descrição" value={f.description} onChange={e=>setF({...f,description:e.target.value})}/>
            <div className="full">
              <label className="mb-2 block text-sm muted-text">Arquivo da arte</label>
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <input className="input" type="file" onChange={e=>setFile(e.target.files?.[0]||null)}/>
                <button type="button" className="btn-dark whitespace-nowrap" onClick={()=>connectGoogleDrive().catch(err=>setErrorMsg(err.message))}>Conectar Google Drive</button>
              </div>
              {file&&<p className="mt-2 text-sm muted-text">Arquivo selecionado: {file.name}</p>}
            </div>
            <div className="price-preview full p-5">
              <div>Área: {area.toFixed(2)} m²</div>
              <strong>{money(total)}</strong>
            </div>
            <button disabled={loading} className="btn-gold full">{loading?'Enviando...':'Enviar orçamento'}</button>
          </form>
        </section>

        <section id="rastreamento" className="client-card mt-6 scroll-mt-28">
          <h2 className="text-2xl font-black text-strong">Rastreamento dos serviços</h2>
          <p className="mt-1 muted-text">Veja status, arquivos, nota fiscal e aprovação de arte.</p>
          <div className="mt-4 grid gap-4">
            {orders.map(o=>{
              const steps=['Orçamento','Entrada','Designer','Produção','Impressão','Acabamento','Pronto','Entregue']
              const current=Math.max(0,steps.indexOf(o.status))
              return (
                <article key={o.id} className="portal-order-card">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div><h3 className="text-xl font-black text-strong">{o.os_number} · {o.service}</h3><p className="text-sm muted-text">{money(o.estimated_price)}</p></div>
                    <span className="badge info">{o.status}</span>
                  </div>
                  <div className="mt-5 grid gap-2 md:grid-cols-4 lg:grid-cols-8">
                    {steps.map((s,i)=><div key={s} className={`rounded-xl border p-3 text-center text-xs ${i<=current?'border-gold/50 bg-gold/10 text-gold':'portal-step-idle'}`}>{s}</div>)}
                  </div>
                  <div className="mt-4 grid gap-3 text-sm md:grid-cols-5">
                    <p>Arquivo: {o.print_file_url?<a className="text-gold" href={o.print_file_url} target="_blank">Abrir</a>:'-'}</p>
                    <p>Nota fiscal: {o.invoice_file_url?<a className="text-gold" href={o.invoice_file_url} target="_blank" download>Baixar NF</a>:'Ainda não foi gerada'}</p>
                    <p>Data prevista: {formatDateBR(o.due_date)}</p>
                    <p>Data entrega: {formatDateBR(o.delivered_at)}</p>
                    <p>Valor: {money(o.estimated_price)}</p>
                  </div>
                  <div className="portal-inner-card mt-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div><strong>Aprovação de arte</strong><br/><small className="muted-text">Status: {o.art_approval_status || 'Pendente'} {o.art_approved_at ? '· '+formatDateBR(o.art_approved_at) : ''}</small></div>
                      <div className="flex flex-wrap gap-2">
                        <button className="btn-dark" onClick={()=>downloadContract(o)}>Baixar contrato</button>
                        {o.print_file_url&&<a className="btn-dark" href={o.print_file_url} target="_blank">Ler/Baixar arquivo</a>}
                        {o.invoice_file_url ? <a className="btn-dark" href={o.invoice_file_url} target="_blank" download>Baixar nota fiscal</a> : <span className="portal-empty-pill">Nota fiscal ainda não foi gerada</span>}
                        <button className="btn-gold" onClick={()=>setSigningOrder(o)}>Aprovar / Solicitar alteração</button>
                      </div>
                    </div>
                    {o.approved_art_image_url||o.project_image_url?<img src={o.approved_art_image_url||o.project_image_url} className="max-h-80 rounded-xl border border-white/10 object-contain"/>:<p className="text-sm muted-text">Nenhuma arte/imagem anexada ainda.</p>}
                    {o.art_revision_note&&<p className="mt-3 text-sm text-yellow-200">Alteração solicitada: {o.art_revision_note}</p>}
                  </div>
                </article>
              )
            })}
            {orders.length===0&&<div className="rounded-2xl border border-white/10 p-6 text-center muted-text">Nenhum orçamento enviado ainda.</div>}
          </div>
        </section>

        {signingOrder&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"><div className="card w-full max-w-2xl"><h2 className="text-2xl font-black text-strong">Aprovar arte · {signingOrder.os_number}</h2><p className="my-3 muted-text">Leia o contrato e a ordem de serviço/arquivo antes de assinar. Assine com mouse ou dedo.</p><canvas id="signature-canvas" width={620} height={180} className="w-full rounded-xl bg-white" onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw} onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}></canvas><div className="mt-3 flex flex-wrap gap-2"><button className="btn-dark" onClick={clearSignature}>Limpar assinatura</button><button className="btn-gold" onClick={()=>approveArt(signingOrder)}>Aprovar arte com assinatura</button><button className="btn-dark" onClick={()=>downloadContract(signingOrder)}>Baixar contrato</button></div><textarea className="input mt-4" placeholder="Descreva a alteração solicitada, se houver..." value={artRevisionNote} onChange={e=>setArtRevisionNote(e.target.value)}></textarea><div className="mt-3 flex flex-wrap gap-2"><button className="btn-red" onClick={()=>requestRevision(signingOrder)}>Solicitar alteração</button><button className="btn-dark" onClick={()=>setSigningOrder(null)}>Fechar</button></div></div></div>}
      </div>
    </div>
  )

}
