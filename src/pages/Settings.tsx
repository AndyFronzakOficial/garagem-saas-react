import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Settings(){
  const [f,setF]=useState({
    company_name:'Garagem Comunicação Visual',
    cnpj:'36.685.414/0001-49',
    address:'R. Califórnia, 287 - Guaraituba, Colombo - PR, 83410-140',
    phone:'(41) 99267-5409',
    logo_url:'/logo.png'
  })
  const [msg,setMsg]=useState('')

  useEffect(()=>{load()},[])

  async function load(){
    const {data}=await supabase.from('company_settings').select('*').eq('id',1).maybeSingle()
    if(data)setF({
      company_name:data.company_name||f.company_name,
      cnpj:data.cnpj||f.cnpj,
      address:data.address||f.address,
      phone:data.phone||f.phone,
      logo_url:data.logo_url||'/logo.png'
    })
  }

  async function save(e:React.FormEvent){
    e.preventDefault()
    await supabase.from('company_settings').upsert({id:1,...f})
    setMsg('Configurações salvas.')
  }

  return <div>
    <h1 className="text-4xl font-black">Configurações da Empresa</h1>
    <p className="mb-6 text-zinc-400">Dados usados no PDF e identificação do sistema.</p>

    <form onSubmit={save} className="card max-w-3xl space-y-4">
      <div className="text-center"><img src="/logo.png" className="logo-img mx-auto max-h-32"/></div>
      <div><label className="text-sm text-zinc-400">Nome da empresa</label><input className="input mt-1" value={f.company_name} onChange={e=>setF({...f,company_name:e.target.value})}/></div>
      <div><label className="text-sm text-zinc-400">CNPJ</label><input className="input mt-1" value={f.cnpj} onChange={e=>setF({...f,cnpj:e.target.value})}/></div>
      <div><label className="text-sm text-zinc-400">Endereço</label><input className="input mt-1" value={f.address} onChange={e=>setF({...f,address:e.target.value})}/></div>
      <div><label className="text-sm text-zinc-400">Telefone</label><input className="input mt-1" value={f.phone} onChange={e=>setF({...f,phone:e.target.value})}/></div>
      <button className="btn-gold">Salvar configurações</button>
      {msg&&<p className="text-green-300">{msg}</p>}
    </form>
  </div>
}
