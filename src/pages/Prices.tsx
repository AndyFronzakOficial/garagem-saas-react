import { useEffect,useState } from 'react'
import { supabase } from '../lib/supabase'
import { money } from '../lib/utils'
export default function Prices(){
 const [rows,setRows]=useState<any[]>([]); const [f,setF]=useState({name:'',partner:'',final:''})
 useEffect(()=>{load()},[])
 async function load(){ const {data}=await supabase.from('service_prices').select('*').order('name'); setRows(data||[]) }
 async function save(e:React.FormEvent){ e.preventDefault(); await supabase.from('service_prices').insert({name:f.name,price_m2_partner:Number(f.partner.replace(',','.')),price_m2_final:Number(f.final.replace(',','.')),active:true}); setF({name:'',partner:'',final:''}); load() }
 return <div><h1 className="text-4xl font-black">Preços por m²</h1><form onSubmit={save} className="card my-6 grid gap-3 md:grid-cols-4"><input className="input" placeholder="Serviço" value={f.name} onChange={e=>setF({...f,name:e.target.value})}/><input className="input" placeholder="Terceiro" value={f.partner} onChange={e=>setF({...f,partner:e.target.value})}/><input className="input" placeholder="Cliente final" value={f.final} onChange={e=>setF({...f,final:e.target.value})}/><button className="btn-gold">Adicionar</button></form><div className="card overflow-auto"><table className="w-full text-left"><thead className="text-gold"><tr><th className="p-3">Serviço</th><th>Terceiro</th><th>Final</th></tr></thead><tbody>{rows.map(r=><tr className="border-t border-white/10" key={r.id}><td className="p-3 font-bold">{r.name}</td><td>{money(r.price_m2_partner)}</td><td>{money(r.price_m2_final)}</td></tr>)}</tbody></table></div></div>
}
