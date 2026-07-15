import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { brNumber, formatDateBR, money, onlyNumbers, whatsappLink } from '../lib/utils'

// Data padrão para abrir o formulário sempre no dia atual.
function today(){ return new Date().toISOString().slice(0,10) }

// Status visual usado nos cards e na tabela da agenda.
function badge(s:string){
  if(['Concluído','Entregue','Instalado'].includes(s)) return 'success'
  if(['Cancelado'].includes(s)) return 'danger'
  if(['Em rota','Em execução','Reagendado'].includes(s)) return 'info'
  return 'warning'
}

// Formata hora gravada no Supabase sem deixar segundos aparecendo na tela.
function shortTime(v?:string|null){
  if(!v) return '-'
  return String(v).slice(0,5)
}

// Formulário inicial da agenda de entrega/instalação.
const emptyForm = {
  id:'',
  delivery_type:'Instalação',
  service_order_id:'',
  client_id:'',
  team:'',
  responsible:'',
  vehicle:'',
  route:'',
  address:'',
  installation_date:today(),
  installation_time:'',
  status:'Agendado',
  cost:'',
  notes:''
}

export default function Deliveries(){
  const [rows,setRows]=useState<any[]>([])
  const [orders,setOrders]=useState<any[]>([])
  const [clients,setClients]=useState<any[]>([])
  const [form,setForm]=useState<any>(emptyForm)
  const [editing,setEditing]=useState(false)
  const [filterDate,setFilterDate]=useState('')
  const [filterStatus,setFilterStatus]=useState('Todos')
  const [msg,setMsg]=useState('')

  useEffect(()=>{load()},[])

  async function load(){
    // Carrega a agenda, as OS e os clientes para permitir vínculo completo.
    const [i,o,c]=await Promise.all([
      supabase
        .from('installations')
        .select('*,service_orders(os_number,service,client_id,clients(name,company,phone,address))')
        .order('installation_date',{ascending:true}),
      supabase
        .from('service_orders')
        .select('id,os_number,service,client_id,clients(id,name,company,phone,address)')
        .order('created_at',{ascending:false}),
      supabase
        .from('clients')
        .select('*')
        .order('name',{ascending:true})
    ])

    if(i.error) setMsg('Erro ao carregar agenda: '+i.error.message)
    setRows(i.data||[])
    setOrders((o.data||[]).filter((x:any)=>!x.is_deleted))
    setClients(c.data||[])
  }

  // Ao escolher uma OS, o sistema busca cliente/endereço e preenche o formulário automaticamente.
  function handleOrderChange(service_order_id:string){
    const selected = orders.find(o=>o.id===service_order_id)
    const client = selected?.clients

    setForm((prev:any)=>({
      ...prev,
      service_order_id,
      client_id:selected?.client_id || client?.id || prev.client_id || '',
      address:prev.address || client?.address || '',
      notes:prev.notes || (selected ? `${selected.os_number} - ${selected.service || 'Serviço'}` : '')
    }))
  }

  function handleClientChange(client_id:string){
    const client = clients.find(c=>c.id===client_id)
    setForm((prev:any)=>({...prev,client_id,address:prev.address || client?.address || ''}))
  }

  function startEdit(row:any){
    setEditing(true)
    setForm({
      id:row.id,
      delivery_type:row.delivery_type || 'Instalação',
      service_order_id:row.service_order_id || '',
      client_id:row.client_id || row.service_orders?.client_id || '',
      team:row.team || '',
      responsible:row.responsible || '',
      vehicle:row.vehicle || '',
      route:row.route || '',
      address:row.address || row.service_orders?.clients?.address || '',
      installation_date:row.installation_date || today(),
      installation_time:row.installation_time ? shortTime(row.installation_time) : '',
      status:row.status || 'Agendado',
      cost:String(row.cost || ''),
      notes:row.notes || ''
    })
    window.scrollTo({top:0,behavior:'smooth'})
  }

  function cancelEdit(){
    setEditing(false)
    setForm(emptyForm)
    setMsg('')
  }

  async function save(e:React.FormEvent){
    e.preventDefault()
    setMsg('')

    // Payload gravado na tabela installations. Mantém compatibilidade com a estrutura antiga.
    const payload:any={
      delivery_type:form.delivery_type,
      service_order_id:form.service_order_id || null,
      client_id:form.client_id || null,
      team:form.team || null,
      responsible:form.responsible || null,
      vehicle:form.vehicle || null,
      route:form.route || null,
      address:form.address || null,
      installation_date:form.installation_date || today(),
      installation_time:form.installation_time || null,
      status:form.status || 'Agendado',
      cost:brNumber(form.cost),
      notes:form.notes || null
    }

    if(payload.status === 'Concluído' || payload.status === 'Entregue' || payload.status === 'Instalado'){
      payload.completed_at = new Date().toISOString()
    }

    const res = editing
      ? await supabase.from('installations').update(payload).eq('id',form.id)
      : await supabase.from('installations').insert(payload)

    if(res.error){
      setMsg('Erro ao salvar agenda: '+res.error.message)
      return
    }

    setMsg(editing?'Agendamento atualizado com sucesso.':'Agendamento criado com sucesso.')
    setEditing(false)
    setForm(emptyForm)
    load()
  }

  async function updateStatus(id:string,status:string){
    // Atualização rápida de status direto no card/tabela.
    const payload:any={status}
    if(['Concluído','Entregue','Instalado'].includes(status)) payload.completed_at = new Date().toISOString()
    await supabase.from('installations').update(payload).eq('id',id)
    load()
  }

  async function updateDate(id:string,date:string){
    await supabase.from('installations').update({installation_date:date,status:'Reagendado'}).eq('id',id)
    load()
  }

  async function remove(id:string){
    if(!confirm('Apagar este agendamento?')) return
    await supabase.from('installations').delete().eq('id',id)
    load()
  }

  function getClient(row:any){
    const byId = clients.find(c=>c.id === row.client_id)
    return byId || row.service_orders?.clients || null
  }

  function clientLabel(row:any){
    const c = getClient(row)
    return c?.company || c?.name || 'Sem cliente'
  }

  const filteredRows = useMemo(()=>{
    return rows.filter(r=>{
      const byDate = filterDate ? r.installation_date === filterDate : true
      const byStatus = filterStatus === 'Todos' ? true : r.status === filterStatus
      return byDate && byStatus
    })
  },[rows,filterDate,filterStatus])

  const groupedByDate = useMemo(()=>{
    const map:Record<string,any[]>={}
    filteredRows.forEach(r=>{
      const key = r.installation_date || 'Sem data'
      map[key]=map[key]||[]
      map[key].push(r)
    })
    return Object.entries(map).sort(([a],[b])=>a.localeCompare(b))
  },[filteredRows])

  const stats = useMemo(()=>{
    const todayRows = rows.filter(r=>r.installation_date === today())
    const pending = rows.filter(r=>!['Concluído','Entregue','Instalado','Cancelado'].includes(r.status))
    const delayed = pending.filter(r=>r.installation_date && r.installation_date < today())
    return {today:todayRows.length,pending:pending.length,delayed:delayed.length,total:rows.length}
  },[rows])

  return (
    <div>
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-4xl font-black">Agenda de Entrega / Instalação</h1>
          <p className="text-zinc-400">Controle de instalação, entrega, retirada, medição, equipe, veículo, rota, horário e status.</p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row">
          <input className="input" type="date" value={filterDate} onChange={e=>setFilterDate(e.target.value)}/>
          <select className="input" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
            <option>Todos</option><option>Agendado</option><option>Em rota</option><option>Em execução</option><option>Reagendado</option><option>Concluído</option><option>Entregue</option><option>Instalado</option><option>Cancelado</option>
          </select>
          {(filterDate || filterStatus !== 'Todos') && <button className="btn-dark" onClick={()=>{setFilterDate('');setFilterStatus('Todos')}}>Limpar filtros</button>}
        </div>
      </header>

      {msg&&<div className="mb-4 rounded-xl border border-gold/30 bg-gold/10 p-3 text-gold">{msg}</div>}

      <section className="mb-5 grid gap-4 md:grid-cols-4">
        <article className="metric-card"><small>Hoje</small><h2 className="text-3xl font-black">{stats.today}</h2></article>
        <article className="metric-card"><small>Pendentes</small><h2 className="text-3xl font-black">{stats.pending}</h2></article>
        <article className="metric-card"><small>Atrasados</small><h2 className="text-3xl font-black">{stats.delayed}</h2></article>
        <article className="metric-card"><small>Total na agenda</small><h2 className="text-3xl font-black">{stats.total}</h2></article>
      </section>

      <form onSubmit={save} className="card mb-6 grid gap-3 md:grid-cols-4">
        <h2 className="md:col-span-4 text-2xl font-black">{editing?'Editar agendamento':'Novo agendamento'}</h2>

        <select className="input" value={form.delivery_type} onChange={e=>setForm({...form,delivery_type:e.target.value})}>
          <option>Instalação</option><option>Entrega</option><option>Retirada</option><option>Medição</option><option>Visita técnica</option>
        </select>

        <select className="input" value={form.service_order_id} onChange={e=>handleOrderChange(e.target.value)}>
          <option value="">Sem OS vinculada</option>
          {orders.map(o=><option key={o.id} value={o.id}>{o.os_number} - {o.service}</option>)}
        </select>

        <select className="input" value={form.client_id} onChange={e=>handleClientChange(e.target.value)}>
          <option value="">Cliente</option>
          {clients.map(c=><option key={c.id} value={c.id}>{c.company || c.name}</option>)}
        </select>

        <select className="input" value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
          <option>Agendado</option><option>Em rota</option><option>Em execução</option><option>Reagendado</option><option>Concluído</option><option>Entregue</option><option>Instalado</option><option>Cancelado</option>
        </select>

        <input className="input" placeholder="Equipe" value={form.team} onChange={e=>setForm({...form,team:e.target.value})}/>
        <input className="input" placeholder="Responsável" value={form.responsible} onChange={e=>setForm({...form,responsible:e.target.value})}/>
        <input className="input" placeholder="Veículo" value={form.vehicle} onChange={e=>setForm({...form,vehicle:e.target.value})}/>
        <input className="input" placeholder="Rota" value={form.route} onChange={e=>setForm({...form,route:e.target.value})}/>

        <input className="input md:col-span-2" placeholder="Endereço" value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/>
        <input className="input" type="date" value={form.installation_date} onChange={e=>setForm({...form,installation_date:e.target.value})}/>
        <input className="input" type="time" value={form.installation_time} onChange={e=>setForm({...form,installation_time:e.target.value})}/>

        <input className="input" placeholder="Custo de deslocamento/instalação" value={form.cost} onChange={e=>setForm({...form,cost:e.target.value})}/>
        <input className="input md:col-span-2" placeholder="Observações" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/>
        <div className="flex gap-2">
          <button className="btn-gold">{editing?'Salvar alteração':'Agendar'}</button>
          {editing&&<button type="button" className="btn-dark" onClick={cancelEdit}>Cancelar</button>}
        </div>
      </form>

      <section className="mb-6 grid gap-4 xl:grid-cols-2">
        {groupedByDate.map(([date,items])=>(
          <div key={date} className="dashboard-panel">
            <h2 className="mb-4 text-2xl font-black">{date === 'Sem data' ? date : formatDateBR(date)}</h2>
            <div className="grid gap-3">
              {items.map(r=>{
                const client = getClient(r)
                const phone = onlyNumbers(client?.phone || '')
                return <article key={r.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="text-lg font-black">{r.delivery_type || 'Instalação'} · {clientLabel(r)}</h3>
                      <p className="text-sm text-zinc-400">{r.service_orders?.os_number || '-'} · {r.service_orders?.service || r.notes || '-'}</p>
                    </div>
                    <span className={`badge ${badge(r.status)}`}>{r.status}</span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                    <p><strong>Horário:</strong> {shortTime(r.installation_time)}</p>
                    <p><strong>Equipe:</strong> {r.team || '-'}</p>
                    <p><strong>Responsável:</strong> {r.responsible || '-'}</p>
                    <p><strong>Veículo:</strong> {r.vehicle || '-'}</p>
                    <p className="md:col-span-2"><strong>Endereço:</strong> {r.address || '-'}</p>
                    <p><strong>Custo:</strong> {money(brNumber(r.cost))}</p>
                    <p><strong>Rota:</strong> {r.route || '-'}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="btn-dark" onClick={()=>startEdit(r)}>Editar</button>
                    <select className={`input max-w-[180px] ${badge(r.status)}`} value={r.status} onChange={e=>updateStatus(r.id,e.target.value)}>
                      <option>Agendado</option><option>Em rota</option><option>Em execução</option><option>Reagendado</option><option>Concluído</option><option>Entregue</option><option>Instalado</option><option>Cancelado</option>
                    </select>
                    {phone&&<a className="btn-dark" href={whatsappLink(phone,`Olá, sobre seu agendamento de ${r.delivery_type || 'serviço'} em ${formatDateBR(r.installation_date)} às ${shortTime(r.installation_time)}.`)} target="_blank">WhatsApp</a>}
                    <button className="btn-red" onClick={()=>remove(r.id)}>Apagar</button>
                  </div>
                </article>
              })}
            </div>
          </div>
        ))}
        {groupedByDate.length===0&&<div className="dashboard-panel text-zinc-400">Nenhum agendamento encontrado.</div>}
      </section>

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Tipo</th><th>OS/Cliente</th><th>Equipe</th><th>Data</th><th>Hora</th><th>Status</th><th>Custo</th><th>Ações</th></tr></thead>
          <tbody>
            {filteredRows.map(r=><tr key={r.id}>
              <td>{r.delivery_type || 'Instalação'}</td>
              <td>{r.service_orders?.os_number || '-'}<br/><small>{clientLabel(r)}</small></td>
              <td>{r.team || '-'}<br/><small>{r.responsible || ''}</small></td>
              <td><input className="input" type="date" defaultValue={r.installation_date} onBlur={e=>updateDate(r.id,e.target.value)}/></td>
              <td>{shortTime(r.installation_time)}</td>
              <td><span className={`badge ${badge(r.status)}`}>{r.status}</span></td>
              <td>{money(brNumber(r.cost))}</td>
              <td className="flex flex-wrap gap-2"><button className="btn-dark" onClick={()=>startEdit(r)}>Editar</button><button className="btn-red" onClick={()=>remove(r.id)}>Apagar</button></td>
            </tr>)}
            {filteredRows.length===0 && <tr><td colSpan={8} className="text-zinc-400">Nenhuma entrega/instalação cadastrada.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
