import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const statuses=['Entrada','Designer','Produção','Impressão','Acabamento','Pronto','Entregue']

function money(v:any){ return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0)) }
function statusClass(s:string){ if(s==='Urgente')return 'danger'; if(s==='Alta')return 'info'; if(s==='Baixa')return 'success'; return 'warning' }
function brDate(v?:string|null){ if(!v)return '-'; const [y,m,d]=v.slice(0,10).split('-'); return `${d}/${m}/${y}` }

export default function Kanban(){
  const [rows,setRows]=useState<any[]>([])
  const [dragId,setDragId]=useState<string|null>(null)
  const [loading,setLoading]=useState(false)

  useEffect(()=>{load()},[])

  async function load(){
    setLoading(true)
    const {data}=await supabase.from('service_orders').select('*,clients(*)').order('created_at',{ascending:false})
    setRows((data||[]).filter((r:any)=>!r.is_deleted))
    setLoading(false)
  }

  async function drop(status:string){
    if(!dragId)return
    const update:any={status}
    if(status==='Entregue') update.delivered_at=new Date().toISOString().slice(0,10)
    await supabase.from('service_orders').update(update).eq('id',dragId)
    setDragId(null)
    load()
  }

  const totals=useMemo(()=>{
    return statuses.reduce((acc:any,status)=>{
      const list=rows.filter(r=>r.status===status)
      acc[status]={count:list.length,total:list.reduce((a,b)=>a+Number(b.estimated_price||0),0)}
      return acc
    },{})
  },[rows])

  return (
    <div>
      <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div><h1 className="text-4xl font-black">Kanban de Produção</h1><p className="text-zinc-400">Arraste as OS entre as etapas.</p></div>
        <button onClick={load} className="btn-dark">{loading?'Atualizando...':'Atualizar'}</button>
      </header>

      <section className="mb-5 grid gap-4 md:grid-cols-3">
        <article className="card"><small>Total de OS</small><h2 className="text-3xl font-black">{rows.length}</h2></article>
        <article className="card"><small>Em produção</small><h2 className="text-3xl font-black">{rows.filter(r=>['Designer','Produção','Impressão','Acabamento'].includes(r.status)).length}</h2></article>
        <article className="card"><small>Urgentes</small><h2 className="text-3xl font-black">{rows.filter(r=>r.priority==='Urgente').length}</h2></article>
      </section>

      <div className="hidden overflow-x-auto pb-5 md:block">
        <div className="grid min-w-[1500px] grid-cols-7 gap-4">
          {statuses.map(status=>
            <section key={status} className="min-h-[620px] rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-black/20 p-3 shadow-2xl" onDragOver={e=>e.preventDefault()} onDrop={()=>drop(status)}>
              <div className="sticky top-0 z-10 mb-3 rounded-2xl border border-white/10 bg-black/70 p-3 backdrop-blur">
                <div className="flex items-center justify-between">
                  <h2 className="font-black text-gold">{status}</h2>
                  <span className="rounded-full bg-gold/15 px-3 py-1 text-xs font-black text-gold">{totals[status]?.count || 0}</span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">{money(totals[status]?.total || 0)}</p>
              </div>

              <div className="space-y-3">
                {rows.filter(r=>r.status===status).map(r=>
                  <article key={r.id} draggable onDragStart={()=>setDragId(r.id)} className={`rounded-2xl border p-4 shadow-xl transition hover:-translate-y-1 hover:border-gold/40 ${r.priority==='Urgente'?'border-red-500/30 bg-gradient-to-b from-red-950/50 to-black':'border-white/10 bg-gradient-to-b from-zinc-900 to-black'}`}>
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-black">{r.os_number}</h3>
                        <p className="mt-1 text-sm text-zinc-300">{r.service}</p>
                        <p className="text-xs text-zinc-500">{r.clients?.company || r.clients?.name || 'Sem cliente'}</p>
                      </div>
                      <span className={`badge ${statusClass(r.priority || 'Média')}`}>{r.priority || 'Média'}</span>
                    </div>

                    <div className="mb-3 flex flex-wrap gap-2">
                      <span className="badge info">{money(r.estimated_price)}</span>
                      {r.finishing && <span className="badge warning">{r.finishing}</span>}
                    </div>

                    <div className="space-y-1 rounded-xl bg-black/30 p-3 text-xs text-zinc-400">
                      <p>Designer: <span className="text-zinc-200">{r.designer_responsible || '-'}</span></p>
                      <p>Impressor: <span className="text-zinc-200">{r.printer_responsible || '-'}</span></p>
                      <p>Prevista: <span className="text-zinc-200">{brDate(r.due_date)}</span></p>
                    </div>

                    {r.print_file_url && <a href={r.print_file_url} target="_blank" className="mt-3 block text-sm font-bold text-gold">Abrir arquivo</a>}
                  </article>
                )}
                {rows.filter(r=>r.status===status).length===0 && <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">Arraste uma OS para cá</div>}
              </div>
            </section>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:hidden">
        {statuses.map(status=>
          <section key={status} className="card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-black text-gold">{status}</h2>
              <span className="badge warning">{totals[status]?.count || 0}</span>
            </div>
            <div className="grid gap-3">
              {rows.filter(r=>r.status===status).map(r=>
                <article key={r.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <h3 className="font-black">{r.os_number}</h3>
                  <p>{r.service}</p>
                  <p className="text-sm text-zinc-400">{r.clients?.company || r.clients?.name}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={`badge ${statusClass(r.priority || 'Média')}`}>{r.priority || 'Média'}</span>
                    <span className="badge info">{money(r.estimated_price)}</span>
                  </div>
                </article>
              )}
              {rows.filter(r=>r.status===status).length===0 && <p className="text-sm text-zinc-500">Nenhuma OS.</p>}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
