import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { brNumber, cmToM, money, quoteNumber } from '../lib/utils'
import { connectGoogleDrive, uploadFileToGoogleDrive, isGoogleDriveConfigured } from '../lib/googleDrive'

type QuoteItem = {
  localId:string
  service_price_id:string
  service_name:string
  width_cm:string
  height_cm:string
  manual_price:string
  observation:string
}

const newItem = ():QuoteItem => ({
  localId:crypto.randomUUID(),
  service_price_id:'',
  service_name:'',
  width_cm:'',
  height_cm:'',
  manual_price:'',
  observation:''
})

export default function PublicQuote(){
  const [services,setServices]=useState<any[]>([])
  const [sent,setSent]=useState<any>(null)
  const [file,setFile]=useState<File|null>(null)
  const [projectImage,setProjectImage]=useState<File|null>(null)
  const [errorMsg,setErrorMsg]=useState('')
  const [loading,setLoading]=useState(false)
  const [items,setItems]=useState<QuoteItem[]>([newItem()])
  const [theme,setTheme]=useState<'dark'|'light'>(()=>(localStorage.getItem('pdv-theme') as 'dark'|'light') || 'dark')

  function toggleTheme(){
    const next=theme==='dark'?'light':'dark'
    setTheme(next)
    localStorage.setItem('pdv-theme',next)
  }

  const [f,setF]=useState({
    client_name:'',
    company:'',
    phone:'',
    email:'',
    address:'',
    project_name:'',
    description:''
  })

  useEffect(()=>{
    supabase.from('service_prices').select('*').eq('active',true).order('name').then(({data,error})=>{
      if(error) setErrorMsg('Erro ao carregar serviços: ' + error.message)
      setServices(data||[])
    })
  },[])

  function serviceById(id:string){
    return services.find(s=>s.id===id)
  }

  function calcItem(item:QuoteItem){
    const service = serviceById(item.service_price_id)
    const widthM=cmToM(item.width_cm)
    const heightM=cmToM(item.height_cm)
    const area=widthM*heightM
    const autoTotal=area*Number(service?.price_m2_final||0)
    const manualTotal=brNumber(item.manual_price)
    const total=manualTotal > 0 ? manualTotal : autoTotal

    return { service, widthM, heightM, area, autoTotal, manualTotal, total }
  }

  const total = useMemo(()=>items.reduce((sum,item)=>sum+calcItem(item).total,0),[items,services])

  function updateItem(localId:string, patch:Partial<QuoteItem>){
    setItems(prev=>prev.map(item=>item.localId===localId ? {...item,...patch} : item))
  }

  function addItem(){
    setItems(prev=>[...prev,newItem()])
  }

  function removeItem(localId:string){
    setItems(prev=>prev.length===1 ? prev : prev.filter(item=>item.localId!==localId))
  }

  async function uploadProjectImage(file:File, code:string){
    if(!file.type.startsWith('image/')) throw new Error('A imagem do projeto precisa ser um arquivo de imagem.')
    if(file.size > 50 * 1024 * 1024) throw new Error('A imagem do projeto precisa ter no máximo 50MB.')

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const safeCode = code.replace(/[^a-zA-Z0-9_-]/g,'-')
    const path = `public-quotes/${safeCode}/imagem-projeto-${Date.now()}.${ext}`

    const { error } = await supabase.storage
      .from('os-files')
      .upload(path,file,{ upsert:false, contentType:file.type || 'image/jpeg' })

    if(error) throw new Error('Erro ao enviar imagem do projeto para o Supabase: ' + error.message)

    const { data } = supabase.storage.from('os-files').getPublicUrl(path)
    return { url:data.publicUrl, name:file.name, path }
  }

  async function save(e:React.FormEvent){
    e.preventDefault()
    setErrorMsg('')
    setLoading(true)

    try{
      const normalizedItems = items.map((item,index)=>{
        const calc = calcItem(item)
        if(!calc.service) throw new Error(`Selecione o serviço do item ${index+1}.`)
        if(!item.width_cm || !item.height_cm) throw new Error(`Informe as medidas do item ${index+1}.`)

        return {
          service_price_id:calc.service.id,
          service_name:calc.service.name,
          width_m:calc.widthM,
          height_m:calc.heightM,
          width_cm:brNumber(item.width_cm),
          height_cm:brNumber(item.height_cm),
          area_m2:calc.area,
          price_m2:calc.service.price_m2_final,
          auto_estimated_price:calc.autoTotal,
          manual_price:calc.manualTotal > 0 ? calc.manualTotal : null,
          estimated_price:calc.total,
          observation:item.observation || null
        }
      })

      let fileUrl:string|null = null
      let driveFileId:string|null = null
      let driveFileName:string|null = null
      let driveFolderId:string|null = null
      let projectImageUrl:string|null = null
      let projectImageName:string|null = null
      let projectImagePath:string|null = null
      const code=quoteNumber()

      if(projectImage){
        const uploadedImage = await uploadProjectImage(projectImage,code)
        projectImageUrl = uploadedImage.url
        projectImageName = uploadedImage.name
        projectImagePath = uploadedImage.path
      }

      if(file){
        if(!isGoogleDriveConfigured()){
          setErrorMsg('Google Drive não configurado. Configure VITE_GOOGLE_CLIENT_ID no .env.')
          return
        }

        await connectGoogleDrive()
        const uploaded = await uploadFileToGoogleDrive(file,{ clientName:f.company || f.client_name || 'Cliente novo', osNumber:code })
        fileUrl = uploaded.viewLink
        driveFileId = uploaded.id
        driveFileName = uploaded.name
        driveFolderId = uploaded.folderId
      }

      const first = normalizedItems[0]
      const {error}=await supabase.from('public_quotes').insert({
        quote_number:code,
        client_name:f.client_name,
        company:f.company||null,
        phone:f.phone,
        email:f.email||null,
        address:f.address||null,
        project_name:f.project_name||null,
        service_price_id:first.service_price_id,
        service_name:first.service_name,
        width_m:first.width_m,
        height_m:first.height_m,
        width_cm:first.width_cm,
        height_cm:first.height_cm,
        area_m2:normalizedItems.reduce((sum,item)=>sum+Number(item.area_m2||0),0),
        price_m2:first.price_m2,
        auto_estimated_price:normalizedItems.reduce((sum,item)=>sum+Number(item.auto_estimated_price||0),0),
        manual_price:null,
        estimated_price:total,
        finishing:'Sem acabamento',
        description:f.description||null,
        status:'Novo',
        file_url:fileUrl,
        drive_file_id:driveFileId,
        drive_file_name:driveFileName,
        drive_folder_id:driveFolderId,
        project_image_url:projectImageUrl,
        project_image_name:projectImageName,
        project_image_path:projectImagePath,
        quote_items:normalizedItems
      })

      if(error){
        setErrorMsg('Erro ao salvar orçamento: ' + error.message)
        return
      }

      setSent({code,total,fileUrl,project_name:f.project_name,projectImageUrl,items:normalizedItems})
    }catch(err:any){
      setErrorMsg(err.message || 'Erro ao salvar orçamento.')
    }finally{
      setLoading(false)
    }
  }

  if(sent)return (
    <div className={`client-portal portal-public ${theme==='dark'?'theme-dark':''}`}>
      <div className="client-shell grid min-h-screen place-items-center">
      <div className="card text-center w-full max-w-lg">
        <img src="/logo.png" alt="Garagem Comunicação Visual" className="logo-img mx-auto max-h-28 object-contain"/>
        <h1 className="mt-4 text-3xl font-black">PDV enviado!</h1>
        {sent.project_name && <p className="muted-text">Projeto: {sent.project_name}</p>}
        <p className="muted-text">Código: {sent.code}</p>
        <p className="muted-text">Serviços cadastrados: {sent.items?.length || 1}</p>
        <div className="price-preview mt-4"><strong>{money(sent.total)}</strong></div>
        {sent.fileUrl && <a href={sent.fileUrl} target="_blank" className="mt-4 block text-gold">Arquivo enviado para o Drive</a>}
        {sent.projectImageUrl && <a href={sent.projectImageUrl} target="_blank" className="mt-2 block text-gold">Imagem do projeto enviada</a>}
      </div>
      </div>
    </div>
  )

  return (
    <div className={`client-portal portal-public ${theme==='dark'?'theme-dark':''}`}>
      <header className="portal-topbar">
        <div className="portal-topbar-inner">
          <img src="/logo.png" alt="Garagem Comunicação Visual" className="logo-img max-h-12 object-contain"/>
          <button type="button" className="btn-dark" onClick={toggleTheme}>{theme==='dark'?'Tema claro':'Tema escuro'}</button>
        </div>
      </header>
      <div className="client-shell portal-shell-offset">
        <section className="client-card">
          <div className="mb-5">
            <p className="muted-text text-sm font-bold uppercase tracking-[0.25em]">PDV Público</p>
          </div>

          <h1 className="text-3xl font-black text-strong">PDV</h1>
          <p className="muted-text">Informe as medidas em centímetros. Você pode adicionar quantos serviços precisar.</p>

          {errorMsg && <div className="mt-4 rounded-xl border border-red-500/30 bg-red-950/60 p-4 text-red-100">{errorMsg}</div>}

          <form onSubmit={save} className="client-grid mt-6">
            <input className="input" placeholder="Nome" value={f.client_name} onChange={e=>setF({...f,client_name:e.target.value})} required/>
            <input className="input" placeholder="Empresa" value={f.company} onChange={e=>setF({...f,company:e.target.value})}/>
            <input className="input" placeholder="WhatsApp" value={f.phone} onChange={e=>setF({...f,phone:e.target.value})} required/>
            <input className="input" placeholder="E-mail" value={f.email} onChange={e=>setF({...f,email:e.target.value})}/>
            <input className="input full" placeholder="Endereço" value={f.address} onChange={e=>setF({...f,address:e.target.value})}/>
            <input className="input full" placeholder="Nome do projeto. Ex: Fachada Loja Central" value={f.project_name} onChange={e=>setF({...f,project_name:e.target.value})}/>

            <div className="full grid gap-4">
              {items.map((item,index)=>{
                const calc = calcItem(item)
                return (
                  <div key={item.localId} className="portal-inner-card p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <strong className="text-gold">Serviço {index+1}</strong>
                      {items.length > 1 && <button type="button" className="btn-dark" onClick={()=>removeItem(item.localId)}>Remover</button>}
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <select className="input md:col-span-2" value={item.service_price_id} onChange={e=>updateItem(item.localId,{service_price_id:e.target.value})} required>
                        <option value="">Serviço</option>
                        {services.map(s=><option key={s.id} value={s.id}>{s.name} - {money(s.price_m2_final)}/m²</option>)}
                      </select>
                      <input className="input" placeholder="Largura em cm. Ex: 120" value={item.width_cm} onChange={e=>updateItem(item.localId,{width_cm:e.target.value})} required/>
                      <input className="input" placeholder="Altura em cm. Ex: 80" value={item.height_cm} onChange={e=>updateItem(item.localId,{height_cm:e.target.value})} required/>
                      <input className="input md:col-span-2" placeholder="Valor deste serviço opcional. Ex: 250,00" value={item.manual_price} onChange={e=>updateItem(item.localId,{manual_price:e.target.value})}/>
                      <textarea className="input md:col-span-2" placeholder="Observação deste serviço" value={item.observation} onChange={e=>updateItem(item.localId,{observation:e.target.value})}/>
                    </div>

                    <div className="portal-inner-card mt-3 p-3 text-sm muted-text">
                      Área: {calc.area.toFixed(2)} m² • Automático: {money(calc.autoTotal)} • <strong>{money(calc.total)}</strong>
                    </div>
                  </div>
                )
              })}

              <button type="button" className="btn-dark" onClick={addItem}>+ Adicionar mais serviço</button>
            </div>

            <textarea className="input full" placeholder="Observação geral do projeto" value={f.description} onChange={e=>setF({...f,description:e.target.value})}/>

            <div className="full">
              <label className="mb-2 block text-sm muted-text">Imagem do projeto para aparecer no PDF da OS</label>
              <input className="input" type="file" accept="image/*" onChange={e=>setProjectImage(e.target.files?.[0]||null)}/>
              <p className="mt-2 text-xs muted-text">Opcional. Envio direto pelo Supabase, limite de 50MB.</p>
              {projectImage && <p className="mt-2 text-sm muted-text">Imagem selecionada: {projectImage.name}</p>}
            </div>

            <div className="full">
              <label className="mb-2 block text-sm muted-text">Arquivo da arte</label>
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <input className="input" type="file" onChange={e=>setFile(e.target.files?.[0]||null)}/>
                <button type="button" className="btn-dark whitespace-nowrap" onClick={()=>connectGoogleDrive().catch(err=>setErrorMsg(err.message))}>Conectar Google Drive</button>
              </div>
              {file && <p className="mt-2 text-sm muted-text">Arquivo selecionado: {file.name}</p>}
            </div>

            <div className="price-preview full">
              <div>{items.length} serviço(s) no orçamento</div>
              <strong>{money(total)}</strong>
            </div>

            <button disabled={loading} className="btn-gold full">{loading ? 'Enviando...' : 'Enviar orçamento'}</button>
          </form>
        </section>
      </div>
    </div>
  )
}
