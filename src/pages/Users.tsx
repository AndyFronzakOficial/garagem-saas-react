import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { roles } from '../lib/utils'

export default function Users(){
  const [rows,setRows]=useState<any[]>([])
  const [f,setF]=useState({ email:'', name:'', role:'Funcionário' })
  const [msg,setMsg]=useState('')

  useEffect(()=>{load()},[])

  async function load(){
    const {data}=await supabase.from('profiles').select('*').order('created_at',{ascending:false})
    setRows(data||[])
  }

  async function save(e:React.FormEvent){
    e.preventDefault()
    await supabase.from('profiles').insert({ email:f.email, name:f.name, role:f.role })
    setF({ email:'', name:'', role:'Funcionário' })
    setMsg('Perfil salvo. Crie o login real em Supabase > Authentication > Users com o mesmo e-mail.')
    load()
  }

  async function update(id:string, role:string){
    await supabase.from('profiles').update({role}).eq('id',id)
    load()
  }

  return (
    <div>
      <h1 className="text-4xl font-black">Usuários e Permissões</h1>
      <p className="mb-6 text-zinc-400">Controle visual por perfil. Crie o usuário de login no Supabase Auth e vincule aqui pelo e-mail.</p>

      {msg&&<div className="mb-4 rounded-xl border border-gold/30 bg-gold/10 p-4 text-gold">{msg}</div>}

      <form onSubmit={save} className="card mb-6 grid gap-3 md:grid-cols-4">
        <input className="input" placeholder="E-mail" value={f.email} onChange={e=>setF({...f,email:e.target.value})}/>
        <input className="input" placeholder="Nome" value={f.name} onChange={e=>setF({...f,name:e.target.value})}/>
        <select className="input" value={f.role} onChange={e=>setF({...f,role:e.target.value})}>
          {roles.map((role:string)=><option key={role}>{role}</option>)}
        </select>
        <button className="btn-gold">Salvar perfil</button>
      </form>

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th></tr></thead>
          <tbody>
            {rows.map((row:any)=>(
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.email}</td>
                <td>
                  <select className="input max-w-xs" value={row.role||'Funcionário'} onChange={e=>update(row.id,e.target.value)}>
                    {roles.map((role:string)=><option key={role}>{role}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={3} className="text-zinc-400">Nenhum usuário cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
