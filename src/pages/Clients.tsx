import { useEffect,useState } from 'react'
import { supabase } from '../lib/supabase'

const emptyClient = {name:'',company:'',phone:'',email:'',address:''}

export default function Clients(){
 const [rows,setRows]=useState<any[]>([])
 const [f,setF]=useState(emptyClient)
 const [editingId,setEditingId]=useState<string|null>(null)
 const [msg,setMsg]=useState('')
 useEffect(()=>{load()},[])
 async function load(){ const {data}=await supabase.from('clients').select('*').order('created_at',{ascending:false}); setRows(data||[]) }
 function startEdit(r:any){ setEditingId(r.id); setF({name:r.name||'',company:r.company||'',phone:r.phone||'',email:r.email||'',address:r.address||''}); window.scrollTo({top:0,behavior:'smooth'}) }
 function cancelEdit(){ setEditingId(null); setF(emptyClient); setMsg('') }
 async function save(e:React.FormEvent){
  e.preventDefault()
  const payload = {name:f.name,company:f.company,phone:f.phone,email:f.email,address:f.address}
  const res = editingId ? await supabase.from('clients').update(payload).eq('id',editingId) : await supabase.from('clients').insert(payload)
  if(res.error){ setMsg('Erro ao salvar cliente: '+res.error.message); return }
  setMsg(editingId ? 'Cliente atualizado com sucesso.' : 'Cliente salvo com sucesso.')
  setEditingId(null); setF(emptyClient); load()
 }
 return <div><h1 className="text-4xl font-black">Clientes</h1>{msg&&<div className="mt-4 rounded-xl border border-gold/30 bg-gold/10 p-3 text-gold">{msg}</div>}<form onSubmit={save} className="card my-6 grid gap-3 md:grid-cols-3"><input className="input" placeholder="Nome" value={f.name} onChange={e=>setF({...f,name:e.target.value})}/><input className="input" placeholder="Empresa" value={f.company} onChange={e=>setF({...f,company:e.target.value})}/><input className="input" placeholder="Telefone" value={f.phone} onChange={e=>setF({...f,phone:e.target.value})}/><input className="input" placeholder="E-mail" value={f.email} onChange={e=>setF({...f,email:e.target.value})}/><input className="input md:col-span-2" placeholder="Endereço" value={f.address} onChange={e=>setF({...f,address:e.target.value})}/><div className="flex gap-2 md:col-span-3"><button className="btn-gold">{editingId?'Salvar alteração':'Salvar'}</button>{editingId&&<button type="button" className="btn-dark" onClick={cancelEdit}>Cancelar edição</button>}</div></form><Table rows={rows} onEdit={startEdit}/></div>
}
function Table({rows,onEdit}:{rows:any[],onEdit:(row:any)=>void}){return <div className="card overflow-auto"><table className="w-full text-left"><thead className="text-gold"><tr><th className="p-3">Nome</th><th>Empresa</th><th>Telefone</th><th>E-mail</th><th>Ações</th></tr></thead><tbody>{rows.map(r=><tr className="border-t border-white/10" key={r.id}><td className="p-3">{r.name}</td><td>{r.company}</td><td>{r.phone}</td><td>{r.email}</td><td><button className="btn-dark" onClick={()=>onEdit(r)}>Editar</button></td></tr>)}{rows.length===0&&<tr><td colSpan={5} className="p-4 text-zinc-400">Nenhum cliente cadastrado.</td></tr>}</tbody></table></div>}
