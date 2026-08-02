import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login(){
 const nav=useNavigate(); const [email,setEmail]=useState('admin@garagem.com'); const [password,setPassword]=useState('garagem@2026'); const [err,setErr]=useState('')
 async function go(e:React.FormEvent){ e.preventDefault(); const {error}=await supabase.auth.signInWithPassword({email,password}); if(error){setErr(error.message);return} nav('/') }
 return <div className="login-shell theme-dark min-h-screen bg-app text-app grid place-items-center p-4 sm:p-6">
  <form onSubmit={go} className="login-card card w-full max-w-md border-white/10">
   <div className="mb-8 text-center">
    <img src="/logo.png" alt="Garagem Comunicação Visual" className="mx-auto mb-5 max-h-28 object-contain"/>
    <div className="text-3xl font-black text-strong">Acesso ao sistema</div>
    <div className="mt-2 muted-text">Gestão completa para comunicação visual</div>
   </div>
   {err&&<div className="mb-4 rounded-xl border border-red-500/30 bg-red-950/50 p-3 text-red-100">{err}</div>}
   <label className="mb-2 block text-sm font-bold muted-text">E-mail</label>
   <input className="input mb-3" value={email} onChange={e=>setEmail(e.target.value)} />
   <label className="mb-2 block text-sm font-bold muted-text">Senha</label>
   <input className="input mb-5" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
   <button className="btn-gold w-full">Entrar no sistema</button>
  </form>
 </div>
}
