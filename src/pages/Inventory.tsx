import { useEffect,useState } from 'react'
import { supabase } from '../lib/supabase'
import { brNumber } from '../lib/utils'

export default function Inventory(){
  const [rows,setRows]=useState<any[]>([])
  const [f,setF]=useState({material:'',quantity:'',unit:'m²',min_quantity:'',notes:''})
  useEffect(()=>{load()},[])
  async function load(){const{data}=await supabase.from('inventory').select('*').order('material');setRows(data||[])}
  async function save(e:React.FormEvent){e.preventDefault();await supabase.from('inventory').insert({material:f.material,quantity:brNumber(f.quantity),unit:f.unit,min_quantity:brNumber(f.min_quantity),notes:f.notes||null});setF({material:'',quantity:'',unit:'m²',min_quantity:'',notes:''});load()}
  async function del(id:string){await supabase.from('inventory').delete().eq('id',id);load()}
  return <div><h1 className="text-4xl font-black">Estoque</h1><form onSubmit={save} className="card my-6 grid gap-3 md:grid-cols-5"><input className="input" placeholder="Material" value={f.material} onChange={e=>setF({...f,material:e.target.value})}/><input className="input" placeholder="Quantidade" value={f.quantity} onChange={e=>setF({...f,quantity:e.target.value})}/><input className="input" placeholder="Unidade" value={f.unit} onChange={e=>setF({...f,unit:e.target.value})}/><input className="input" placeholder="Mínimo" value={f.min_quantity} onChange={e=>setF({...f,min_quantity:e.target.value})}/><button className="btn-gold">Adicionar</button><input className="input md:col-span-5" placeholder="Observações" value={f.notes} onChange={e=>setF({...f,notes:e.target.value})}/></form><div className="card table-wrap"><table><thead><tr><th>Material</th><th>Qtd</th><th>Unidade</th><th>Mínimo</th><th>Status</th><th></th></tr></thead><tbody>{rows.map(r=>{const low=Number(r.quantity)<=Number(r.min_quantity);return <tr key={r.id}><td>{r.material}</td><td>{r.quantity}</td><td>{r.unit}</td><td>{r.min_quantity}</td><td><span className={`badge ${low?'danger':'success'}`}>{low?'Baixo':'OK'}</span></td><td><button className="btn-red" onClick={()=>del(r.id)}>Apagar</button></td></tr>})}</tbody></table></div></div>
}
