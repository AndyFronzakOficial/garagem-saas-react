import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login(){
  const nav = useNavigate()
  const [email,setEmail]=useState('admin@garagem.com')
  const [password,setPassword]=useState('123456')
  const [err,setErr]=useState('')

  async function go(e:React.FormEvent){
    e.preventDefault()
    const {error}=await supabase.auth.signInWithPassword({email,password})
    if(error){ setErr(error.message); return }
    nav('/')
  }

  return <div className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_20%_0%,rgba(244,197,66,.14),transparent_35%),#050606] p-6">
    <form onSubmit={go} className="card w-full max-w-md">
      <div className="mb-8 text-center">
        <img src="/logo.png" alt="Garagem Comunicação Visual" className="logo-img mx-auto max-h-32 object-contain" />
        <div className="mt-3 text-zinc-400">SaaS ERP</div>
      </div>
      {err&&<div className="mb-4 rounded-xl bg-red-900/50 p-3">{err}</div>}
      <input className="input mb-3" value={email} onChange={e=>setEmail(e.target.value)} />
      <input className="input mb-5" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
      <button className="btn-gold w-full">Entrar</button>
    </form>
  </div>
}
