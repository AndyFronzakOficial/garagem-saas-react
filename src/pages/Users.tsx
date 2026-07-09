import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { roles } from '../lib/utils'

export default function Users(){
  const [rows,setRows]=useState<any[]>([])
  const [f,setF]=useState({email:'',name:'',role:'Orçamento'})
  const [msg,setMsg]=useState('')
  useEffect(()=>{load()},[])
  async function load(){ const {data}=await supabase.from('profiles').select('*').order('created_at',{ascending:false}); setRows(data||[]) }
  async function save(e:React.FormEvent){ e.preventDefault(); await supabase.from('profiles').upsert({email:f.email,name:f.name,role:f.role},{onConflict:'email'}); setMsg('Perfil salvo. Crie o usuário em Supabase > Authentication com o mesmo e-mail.'); setF({email:'',name:'',role:'Orçamento'}); load() }
  async function update(id:string, role:string){ await supabase.from('profiles').update({role}).eq('id',id); load() }
  async function remove(id:string){ if(!confirm('Remover perfil?')) return; await supabase.from('profiles').delete().eq('id',id); load() }
  return <div><h1 className="text-4xl font-black">Usuários e Perfis</h1><p className="mb-6 text-zinc-400">Controle o que cada funcionário pode acessar.</p>{msg&&<div className="mb-4 rounded-xl border border-gold/30 bg-gold/10 p-4 text-gold">{msg}</div>}<form onSubmit={save} className="card mb-6 grid gap-3 md:grid-cols-4"><input className="input" placeholder="E-mail" value={f.email} onChange={e=>setF({...f,email:e.target.value})} required/><input className="input" placeholder="Nome" value={f.name} onChange={e=>setF({...f,name:e.target.value})} required/><select className="input" value={f.role} onChange={e=>setF({...f,role:e.target.value})}>{roles.map(r=><option key={r}>{r}</option>)}</select><button className="btn-gold">Salvar perfil</button></form><div className="card table-wrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Ações</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.name}</td><td>{r.email}</td><td><select className="input max-w-xs" value={r.role||'Orçamento'} onChange={e=>update(r.id,e.target.value)}>{roles.map(role=><option key={role}>{role}</option>)}</select></td><td><button className="btn-red" onClick={()=>remove(r.id)}>Remover</button></td></tr>)}{rows.length===0&&<tr><td colSpan={4} className="text-zinc-400">Nenhum perfil cadastrado.</td></tr>}</tbody></table></div><div className="card mt-6"><h2 className="text-xl font-black">Perfil Orçamento</h2><p className="text-zinc-400">Acessa apenas Clientes, Leads e Ordens. Não vê Financeiro, Estoque e Precificação.</p></div></div>
}
