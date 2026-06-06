import { useEffect,useState } from 'react'
import { supabase } from '../lib/supabase'
export default function Clients(){
 const [rows,setRows]=useState<any[]>([]); const [f,setF]=useState({name:'',company:'',phone:'',email:'',address:''})
 useEffect(()=>{load()},[])
 async function load(){ const {data}=await supabase.from('clients').select('*').order('created_at',{ascending:false}); setRows(data||[]) }
 async function save(e:React.FormEvent){ e.preventDefault(); await supabase.from('clients').insert(f); setF({name:'',company:'',phone:'',email:'',address:''}); load() }
 return <div><h1 className="text-4xl font-black">Clientes</h1><form onSubmit={save} className="card my-6 grid gap-3 md:grid-cols-3"><input className="input" placeholder="Nome" value={f.name} onChange={e=>setF({...f,name:e.target.value})}/><input className="input" placeholder="Empresa" value={f.company} onChange={e=>setF({...f,company:e.target.value})}/><input className="input" placeholder="Telefone" value={f.phone} onChange={e=>setF({...f,phone:e.target.value})}/><input className="input" placeholder="E-mail" value={f.email} onChange={e=>setF({...f,email:e.target.value})}/><input className="input md:col-span-2" placeholder="Endereço" value={f.address} onChange={e=>setF({...f,address:e.target.value})}/><button className="btn-gold md:col-span-3">Salvar</button></form><Table rows={rows}/></div>
}
function Table({rows}:{rows:any[]}){return <div className="card overflow-auto"><table className="w-full text-left"><thead className="text-gold"><tr><th className="p-3">Nome</th><th>Empresa</th><th>Telefone</th><th>E-mail</th></tr></thead><tbody>{rows.map(r=><tr className="border-t border-white/10" key={r.id}><td className="p-3">{r.name}</td><td>{r.company}</td><td>{r.phone}</td><td>{r.email}</td></tr>)}</tbody></table></div>}
