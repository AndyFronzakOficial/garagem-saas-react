import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { money } from '../lib/utils'
import { Pencil, Save, Trash2, X } from 'lucide-react'

export default function Prices(){
  const [rows,setRows]=useState<any[]>([])
  const [editing,setEditing]=useState<string|null>(null)
  const [edit,setEdit]=useState({name:'', partner:'', final:'', active:true})
  const [f,setF]=useState({name:'',partner:'',final:''})
  const [msg,setMsg]=useState('')
  const [err,setErr]=useState('')

  useEffect(()=>{load()},[])

  async function load(){
    const {data,error}=await supabase
      .from('service_prices')
      .select('*')
      .order('name')

    if(error) setErr(error.message)
    setRows(data||[])
  }

  function startEdit(r:any){
    setEditing(r.id)
    setEdit({
      name:r.name || '',
      partner:String(r.price_m2_partner ?? ''),
      final:String(r.price_m2_final ?? ''),
      active:!!r.active
    })
  }

  async function saveEdit(id:string){
    setMsg('')
    setErr('')

    const {error}=await supabase
      .from('service_prices')
      .update({
        name:edit.name,
        price_m2_partner:Number(String(edit.partner).replace(',','.')),
        price_m2_final:Number(String(edit.final).replace(',','.')),
        active:edit.active
      })
      .eq('id',id)

    if(error){
      setErr(error.message)
      return
    }

    setEditing(null)
    setMsg('Serviço atualizado.')
    load()
  }

  async function create(e:React.FormEvent){
    e.preventDefault()
    setMsg('')
    setErr('')

    const {error}=await supabase.from('service_prices').insert({
      name:f.name,
      price_m2_partner:Number(String(f.partner).replace(',','.')),
      price_m2_final:Number(String(f.final).replace(',','.')),
      active:true
    })

    if(error){
      setErr(error.message)
      return
    }

    setF({name:'',partner:'',final:''})
    setMsg('Serviço criado.')
    load()
  }

  async function remove(id:string){
    const ok = confirm('Tem certeza que deseja excluir este serviço? Se ele já foi usado em OS antigas, prefira desativar em vez de excluir.')
    if(!ok)return

    const {error}=await supabase
      .from('service_prices')
      .delete()
      .eq('id',id)

    if(error){
      setErr('Não foi possível excluir. Talvez esse serviço já esteja vinculado a uma OS. Nesse caso, desative o serviço.')
      return
    }

    setMsg('Serviço excluído.')
    load()
  }

  async function toggleActive(r:any){
    const {error}=await supabase
      .from('service_prices')
      .update({active:!r.active})
      .eq('id',r.id)

    if(error){
      setErr(error.message)
      return
    }

    load()
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-4xl font-black">Preços por m²</h1>
        <p className="text-zinc-400">Cadastre, edite, desative ou exclua serviços.</p>
      </header>

      {msg && <div className="mb-4 rounded-xl border border-green-500/30 bg-green-950/40 p-4 text-green-200">{msg}</div>}
      {err && <div className="mb-4 rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-red-200">{err}</div>}

      <form onSubmit={create} className="card mb-6 grid gap-3 md:grid-cols-4">
        <input className="input" placeholder="Serviço. Ex: ACM" value={f.name} onChange={e=>setF({...f,name:e.target.value})} required />
        <input className="input" placeholder="Preço terceiro m²" value={f.partner} onChange={e=>setF({...f,partner:e.target.value})} required />
        <input className="input" placeholder="Preço cliente final m²" value={f.final} onChange={e=>setF({...f,final:e.target.value})} required />
        <button className="btn-gold">Adicionar serviço</button>
      </form>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Serviço</th>
              <th>Terceiro</th>
              <th>Cliente final</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            {rows.map(r=>(
              <tr key={r.id}>
                <td>
                  {editing===r.id ? (
                    <input className="input" value={edit.name} onChange={e=>setEdit({...edit,name:e.target.value})}/>
                  ) : (
                    <strong>{r.name}</strong>
                  )}
                </td>

                <td>
                  {editing===r.id ? (
                    <input className="input max-w-40" value={edit.partner} onChange={e=>setEdit({...edit,partner:e.target.value})}/>
                  ) : (
                    <div>
                      <strong>{money(r.price_m2_partner)}</strong>
                      <div className="text-xs text-zinc-500">por m²</div>
                    </div>
                  )}
                </td>

                <td>
                  {editing===r.id ? (
                    <input className="input max-w-40" value={edit.final} onChange={e=>setEdit({...edit,final:e.target.value})}/>
                  ) : (
                    <div>
                      <strong>{money(r.price_m2_final)}</strong>
                      <div className="text-xs text-zinc-500">por m²</div>
                    </div>
                  )}
                </td>

                <td>
                  {editing===r.id ? (
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={edit.active} onChange={e=>setEdit({...edit,active:e.target.checked})}/>
                      Ativo
                    </label>
                  ) : (
                    <button onClick={()=>toggleActive(r)} className={`badge ${r.active?'success':'danger'}`}>
                      {r.active?'Ativo':'Inativo'}
                    </button>
                  )}
                </td>

                <td>
                  {editing===r.id ? (
                    <div className="flex flex-wrap gap-2">
                      <button className="btn-gold flex items-center gap-2" onClick={()=>saveEdit(r.id)} type="button">
                        <Save size={16}/> Salvar
                      </button>
                      <button className="btn-dark flex items-center gap-2" onClick={()=>setEditing(null)} type="button">
                        <X size={16}/> Cancelar
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button className="btn-dark flex items-center gap-2" onClick={()=>startEdit(r)} type="button">
                        <Pencil size={16}/> Editar
                      </button>
                      <button className="btn-red flex items-center gap-2" onClick={()=>remove(r.id)} type="button">
                        <Trash2 size={16}/> Excluir
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}

            {rows.length===0 && (
              <tr><td colSpan={5} className="text-zinc-400">Nenhum serviço cadastrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-xl border border-gold/20 bg-gold/5 p-4 text-sm text-zinc-300">
        Dica de produção: se um serviço já foi usado em ordens antigas, é melhor deixar <strong>Inativo</strong> em vez de excluir. Assim o histórico não vira um quebra-cabeça amaldiçoado.
      </div>
    </div>
  )
}
