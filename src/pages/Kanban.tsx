import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { formatDateBR, money, orderStatuses, statusClass } from '../lib/utils'
import { CalendarDays, GripVertical, Printer, UserRound } from 'lucide-react'

export default function Kanban(){
  const [rows,setRows]=useState<any[]>([])
  const [dragId,setDragId]=useState<string|null>(null)
  const [loading,setLoading]=useState(false)

  useEffect(()=>{load()},[])

  async function load(){
    setLoading(true)
    const {data,error}=await supabase
      .from('service_orders')
      .select('*,clients(*)')
      .order('created_at',{ascending:false})

    if(!error) setRows(data||[])
    setLoading(false)
  }

  async function drop(status:string){
    if(!dragId)return

    const patch:any = { status }
    if(status === 'Entregue') patch.delivered_at = new Date().toISOString().slice(0,10)

    await supabase.from('service_orders').update(patch).eq('id',dragId)
    setDragId(null)
    load()
  }

  const totals = useMemo(()=>{
    return orderStatuses.reduce((acc:any,status)=>{
      const list = rows.filter(r=>r.status===status)
      acc[status] = {
        count:list.length,
        total:list.reduce((a,b)=>a+Number(b.estimated_price||0),0)
      }
      return acc
    },{})
  },[rows])

  return (
    <div>
      <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-4xl font-black">Kanban de Produção</h1>
          <p className="text-zinc-400">Arraste os cards entre as etapas da produção.</p>
        </div>

        <button onClick={load} className="btn-dark">
          {loading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </header>

      <div className="mb-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <div className="card">
          <small className="text-zinc-400">Total de OS</small>
          <h2 className="text-3xl font-black">{rows.length}</h2>
        </div>
        <div className="card">
          <small className="text-zinc-400">Em produção</small>
          <h2 className="text-3xl font-black">{rows.filter(r=>['Designer','Produção','Impressão','Acabamento'].includes(r.status)).length}</h2>
        </div>
        <div className="card">
          <small className="text-zinc-400">Urgentes</small>
          <h2 className="text-3xl font-black text-red-300">{rows.filter(r=>r.priority==='Urgente').length}</h2>
        </div>
      </div>

      <div className="overflow-x-auto pb-5">
        <div className="grid min-w-[1500px] grid-cols-7 gap-4">
          {orderStatuses.map(status=>(
            <section
              key={status}
              onDragOver={e=>e.preventDefault()}
              onDrop={()=>drop(status)}
              className="min-h-[620px] rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-black/20 p-3 shadow-2xl"
            >
              <div className="sticky top-0 z-10 mb-3 rounded-2xl border border-white/10 bg-black/70 p-3 backdrop-blur">
                <div className="flex items-center justify-between">
                  <h2 className="font-black text-gold">{status}</h2>
                  <span className="rounded-full bg-gold/15 px-3 py-1 text-xs font-black text-gold">
                    {totals[status]?.count || 0}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">{money(totals[status]?.total || 0)}</p>
              </div>

              <div className="space-y-3">
                {rows.filter(r=>r.status===status).map(r=>(
                  <article
                    key={r.id}
                    draggable
                    onDragStart={()=>setDragId(r.id)}
                    className={`group rounded-2xl border p-4 shadow-xl transition hover:-translate-y-1 hover:border-gold/40 hover:shadow-gold/10 ${
                      r.priority === 'Urgente'
                        ? 'border-red-500/30 bg-gradient-to-b from-red-950/50 to-black'
                        : 'border-white/10 bg-gradient-to-b from-zinc-900 to-black'
                    }`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <GripVertical size={16} className="text-zinc-500" />
                          <h3 className="text-lg font-black">{r.os_number}</h3>
                        </div>
                        <p className="mt-1 text-sm text-zinc-300">{r.service}</p>
                        <p className="text-xs text-zinc-500">{r.clients?.company || r.clients?.name || 'Sem cliente'}</p>
                      </div>

                      <span className={`badge ${statusClass(r.priority || 'Média')}`}>
                        {r.priority || 'Média'}
                      </span>
                    </div>

                    <div className="mb-3 flex flex-wrap gap-2">
                      <span className="badge info">{money(r.estimated_price)}</span>
                      {r.finishing && <span className="badge warning">{r.finishing}</span>}
                    </div>

                    <div className="space-y-2 rounded-xl bg-black/30 p-3 text-xs text-zinc-400">
                      <p className="flex items-center gap-2">
                        <UserRound size={14}/>
                        Designer: <span className="text-zinc-200">{r.designer_responsible || '-'}</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <Printer size={14}/>
                        Impressor: <span className="text-zinc-200">{r.printer_responsible || '-'}</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <CalendarDays size={14}/>
                        Prevista: <span className="text-zinc-200">{formatDateBR(r.due_date)}</span>
                      </p>
                    </div>

                    {r.print_file_url && (
                      <a href={r.print_file_url} target="_blank" className="mt-3 block text-sm font-bold text-gold">
                        Baixar arquivo
                      </a>
                    )}
                  </article>
                ))}

                {rows.filter(r=>r.status===status).length === 0 && (
                  <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">
                    Arraste uma OS para cá
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
