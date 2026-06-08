import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { brNumber, finishings, money, quoteNumber } from '../lib/utils'
import { connectGoogleDrive, uploadFileToGoogleDrive, isGoogleDriveConfigured } from '../lib/googleDrive'

export default function PublicQuote(){
  const [services,setServices]=useState<any[]>([])
  const [sent,setSent]=useState<any>(null)
  const [file,setFile]=useState<File|null>(null)
  const [errorMsg,setErrorMsg]=useState('')
  const [loading,setLoading]=useState(false)

  const [f,setF]=useState({
    client_name:'',
    company:'',
    phone:'',
    email:'',
    address:'',
    service_price_id:'',
    width_m:'',
    height_m:'',
    finishing:'Sem acabamento',
    description:''
  })

  useEffect(()=>{
    supabase.from('service_prices').select('*').eq('active',true).order('name').then(({data,error})=>{
      if(error) setErrorMsg('Erro ao carregar serviços: ' + error.message)
      setServices(data||[])
    })
  },[])

  const service=services.find(s=>s.id===f.service_price_id)
  const w=brNumber(f.width_m)
  const h=brNumber(f.height_m)
  const area=w*h
  const total=area*Number(service?.price_m2_final||0)

  async function save(e:React.FormEvent){
    e.preventDefault()
    setErrorMsg('')
    setLoading(true)

    try{
      if(!service){
        setErrorMsg('Selecione um serviço.')
        return
      }

      let fileUrl:string|null = null
      let driveFileId:string|null = null
      let driveFileName:string|null = null
      let driveFolderId:string|null = null
      const code=quoteNumber()

      if(file){
        if(!isGoogleDriveConfigured()){
          setErrorMsg('Google Drive não configurado. Configure VITE_GOOGLE_CLIENT_ID no .env.')
          return
        }

        await connectGoogleDrive()

        const uploaded = await uploadFileToGoogleDrive(file,{
          clientName:f.company || f.client_name || 'Cliente novo',
          osNumber:code
        })

        fileUrl = uploaded.viewLink
        driveFileId = uploaded.id
        driveFileName = uploaded.name
        driveFolderId = uploaded.folderId
      }

      const {error}=await supabase.from('public_quotes').insert({
        quote_number:code,
        client_name:f.client_name,
        company:f.company||null,
        phone:f.phone,
        email:f.email||null,
        address:f.address||null,
        service_price_id:service.id,
        service_name:service.name,
        width_m:w,
        height_m:h,
        area_m2:area,
        price_m2:service.price_m2_final,
        estimated_price:total,
        finishing:f.finishing,
        description:f.description||null,
        status:'Novo',
        file_url:fileUrl,
        drive_file_id:driveFileId,
        drive_file_name:driveFileName,
        drive_folder_id:driveFolderId
      })

      if(error){
        setErrorMsg('Erro ao salvar orçamento: ' + error.message)
        return
      }

      setSent({code,total,fileUrl})
    }finally{
      setLoading(false)
    }
  }

  if(sent)return (
    <div className="grid min-h-screen place-items-center bg-matte p-6">
      <div className="card text-center">
        <img src="/logo.png" alt="Garagem Comunicação Visual" className="logo-img mx-auto max-h-28 object-contain"/>
        <h1 className="mt-4 text-3xl font-black">Orçamento enviado!</h1>
        <p className="text-zinc-400">Código: {sent.code}</p>
        <div className="price-preview mt-4"><strong>{money(sent.total)}</strong></div>
        {sent.fileUrl && <a href={sent.fileUrl} target="_blank" className="mt-4 block text-gold">Arquivo enviado para o Drive</a>}
      </div>
    </div>
  )

  return (
    <div className="client-portal">
      <div className="client-shell">
        <section className="client-card">
          <div className="mb-5">
            <img src="/logo.png" alt="Garagem Comunicação Visual" className="logo-img max-h-28 object-contain"/>
          </div>

          <h1 className="text-3xl font-black">Orçamento Rápido</h1>
          <p className="text-zinc-400">Página pública para novos clientes.</p>

          {errorMsg && <div className="mt-4 rounded-xl border border-red-500/30 bg-red-950/60 p-4 text-red-100">{errorMsg}</div>}

          <form onSubmit={save} className="client-grid mt-6">
            <input className="input" placeholder="Nome" value={f.client_name} onChange={e=>setF({...f,client_name:e.target.value})} required/>
            <input className="input" placeholder="Empresa" value={f.company} onChange={e=>setF({...f,company:e.target.value})}/>
            <input className="input" placeholder="WhatsApp" value={f.phone} onChange={e=>setF({...f,phone:e.target.value})} required/>
            <input className="input" placeholder="E-mail" value={f.email} onChange={e=>setF({...f,email:e.target.value})}/>
            <input className="input full" placeholder="Endereço" value={f.address} onChange={e=>setF({...f,address:e.target.value})}/>

            <select className="input" value={f.service_price_id} onChange={e=>setF({...f,service_price_id:e.target.value})} required>
              <option value="">Serviço</option>
              {services.map(s=><option key={s.id} value={s.id}>{s.name} - {money(s.price_m2_final)}/m²</option>)}
            </select>

            <select className="input" value={f.finishing} onChange={e=>setF({...f,finishing:e.target.value})}>
              {finishings.map(o=><option key={o}>{o}</option>)}
            </select>

            <input className="input" placeholder="Largura" value={f.width_m} onChange={e=>setF({...f,width_m:e.target.value})} required/>
            <input className="input" placeholder="Altura" value={f.height_m} onChange={e=>setF({...f,height_m:e.target.value})} required/>

            <textarea className="input full" placeholder="Descrição" value={f.description} onChange={e=>setF({...f,description:e.target.value})}/>

            <div className="full">
              <label className="mb-2 block text-sm text-zinc-400">Arquivo da arte</label>
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <input className="input" type="file" onChange={e=>setFile(e.target.files?.[0]||null)}/>
                <button type="button" className="btn-dark whitespace-nowrap" onClick={()=>connectGoogleDrive().catch(err=>setErrorMsg(err.message))}>
                  Conectar Google Drive
                </button>
              </div>
              {file && <p className="mt-2 text-sm text-zinc-400">Arquivo selecionado: {file.name}</p>}
            </div>

            <div className="price-preview full">
              <div>Área: {area.toFixed(2)} m²</div>
              <strong>{money(total)}</strong>
            </div>

            <button disabled={loading} className="btn-gold full">
              {loading ? 'Enviando...' : 'Enviar'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
