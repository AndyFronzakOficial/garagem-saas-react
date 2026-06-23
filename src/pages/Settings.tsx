import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { safeFileName } from '../lib/utils'

export default function Settings(){
  const [file,setFile]=useState<File|null>(null)
  const [msg,setMsg]=useState('')
  const [f,setF]=useState({company_name:'Garagem Comunicação Visual',cnpj:'36.685.414/0001-49',address:'R. Califórnia, 287 - Guaraituba, Colombo - PR, 83410-140',phone:'(41) 99267-5409',whatsapp:'(41) 99267-5409',email:'',pdf_footer:'Garagem Comunicação Visual',logo_url:'/logo.png',monthly_goal:'35000',notify_os_new:true,notify_os_ready:true,notify_overdue:true,notify_installation:true})

  useEffect(()=>{load()},[])
  async function load(){
    const {data}=await supabase.from('company_settings').select('*').eq('id',1).maybeSingle()
    if(data) setF({company_name:data.company_name||f.company_name,cnpj:data.cnpj||f.cnpj,address:data.address||f.address,phone:data.phone||f.phone,whatsapp:data.whatsapp||data.phone||f.whatsapp,email:data.email||'',pdf_footer:data.pdf_footer||data.company_name||f.pdf_footer,logo_url:data.logo_url||'/logo.png',monthly_goal:String(data.monthly_goal||'35000'),notify_os_new:data.notify_os_new!==false,notify_os_ready:data.notify_os_ready!==false,notify_overdue:data.notify_overdue!==false,notify_installation:data.notify_installation!==false})
  }
  async function save(e:React.FormEvent){
    e.preventDefault()
    let logoUrl=f.logo_url
    if(file){
      const path=`logo/${Date.now()}-${safeFileName(file.name)}`
      const {error}=await supabase.storage.from('os-files').upload(path,file,{upsert:true,contentType:file.type||'image/png'})
      if(error){ alert('Erro ao enviar logo: '+error.message); return }
      logoUrl=supabase.storage.from('os-files').getPublicUrl(path).data.publicUrl
    }
    await supabase.from('company_settings').upsert({id:1,...f,logo_url:logoUrl,monthly_goal:Number(String(f.monthly_goal).replace(',','.'))||0})
    setF({...f,logo_url:logoUrl}); setMsg('Configurações salvas.')
  }
  return <div><h1 className="text-4xl font-black">Configurações da Empresa</h1><p className="mb-6 text-zinc-400">Logo, nome, endereço, telefone, WhatsApp, e-mail e rodapé do PDF.</p><form onSubmit={save} className="card max-w-5xl space-y-5"><div className="text-center"><img src={f.logo_url||'/logo.png'} className="logo-img mx-auto max-h-32"/></div>{msg&&<div className="rounded-xl border border-green-500/30 bg-green-950/50 p-3 text-green-200">{msg}</div>}<div className="grid gap-4 md:grid-cols-2"><div><label className="text-sm text-zinc-400">Logo</label><input type="file" accept="image/*" className="input mt-1" onChange={e=>setFile(e.target.files?.[0]||null)}/></div><div><label className="text-sm text-zinc-400">Meta mensal</label><input className="input mt-1" value={f.monthly_goal} onChange={e=>setF({...f,monthly_goal:e.target.value})}/></div><div><label className="text-sm text-zinc-400">Nome</label><input className="input mt-1" value={f.company_name} onChange={e=>setF({...f,company_name:e.target.value})}/></div><div><label className="text-sm text-zinc-400">CNPJ</label><input className="input mt-1" value={f.cnpj} onChange={e=>setF({...f,cnpj:e.target.value})}/></div><div><label className="text-sm text-zinc-400">Telefone</label><input className="input mt-1" value={f.phone} onChange={e=>setF({...f,phone:e.target.value})}/></div><div><label className="text-sm text-zinc-400">WhatsApp</label><input className="input mt-1" value={f.whatsapp} onChange={e=>setF({...f,whatsapp:e.target.value})}/></div><div><label className="text-sm text-zinc-400">E-mail</label><input className="input mt-1" value={f.email} onChange={e=>setF({...f,email:e.target.value})}/></div><div><label className="text-sm text-zinc-400">Endereço</label><input className="input mt-1" value={f.address} onChange={e=>setF({...f,address:e.target.value})}/></div><div className="md:col-span-2"><label className="text-sm text-zinc-400">Rodapé do PDF</label><textarea className="input mt-1" value={f.pdf_footer} onChange={e=>setF({...f,pdf_footer:e.target.value})}/></div></div><section className="rounded-2xl border border-white/10 bg-black/20 p-4"><h2 className="mb-3 text-xl font-black">Notificações</h2><div className="grid gap-3 md:grid-cols-2"><label><input type="checkbox" checked={f.notify_os_new} onChange={e=>setF({...f,notify_os_new:e.target.checked})}/> OS nova</label><label><input type="checkbox" checked={f.notify_os_ready} onChange={e=>setF({...f,notify_os_ready:e.target.checked})}/> OS pronta</label><label><input type="checkbox" checked={f.notify_overdue} onChange={e=>setF({...f,notify_overdue:e.target.checked})}/> Conta vencida</label><label><input type="checkbox" checked={f.notify_installation} onChange={e=>setF({...f,notify_installation:e.target.checked})}/> Instalação reagendada</label></div></section><button className="btn-gold">Salvar configurações</button></form></div>
}
