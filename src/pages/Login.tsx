import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
export default function Login(){
 const nav=useNavigate(); const [email,setEmail]=useState('admin@garagem.com'); const [password,setPassword]=useState('garagem@2026'); const [err,setErr]=useState('')
 async function go(e:React.FormEvent){ e.preventDefault(); const {error}=await supabase.auth.signInWithPassword({email,password}); if(error){setErr(error.message);return} nav('/') }
 return <div className="grid min-h-screen place-items-center p-6"><form onSubmit={go} className="card w-full max-w-md"><div className="mb-8 text-center"><div className="text-5xl font-black text-gold">Garagem</div><div className="text-zinc-400">SaaS ERP</div></div>{err&&<div className="mb-4 rounded-xl bg-red-900/50 p-3">{err}</div>}<input className="input mb-3" value={email} onChange={e=>setEmail(e.target.value)} /><input className="input mb-5" type="password" value={password} onChange={e=>setPassword(e.target.value)} /><button className="btn-gold w-full">Entrar</button></form></div>
}
