import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { money, statusClass, today } from '../lib/utils'
import { nextOSNumber } from '../lib/osNumber'

export default function Leads(){
  const [rows,setRows]=useState<any[]>([])
  const [msg,setMsg]=useState('')
  const [loading,setLoading]=useState(false)

  useEffect(()=>{load()},[])

  async function load(){
    const {data,error}=await supabase
      .from('public_quotes')
      .select('*')
      .order('created_at',{ascending:false})

    if(error){
      setMsg('Erro ao carregar leads: ' + error.message)
      return
    }

    setRows(data||[])
  }

  async function updateStatus(id:string,status:string){
    await supabase
      .from('public_quotes')
      .update({status})
      .eq('id',id)

    load()
  }

  async function findOrCreateClient(r:any){
    const phone = r.phone || ''

    if(phone){
      const existing = await supabase
        .from('clients')
        .select('*')
        .eq('phone',phone)
        .maybeSingle()

      if(existing.data){
        return existing.data.id
      }
    }

    const created = await supabase
      .from('clients')
      .insert({
        name:r.client_name || r.company || 'Cliente sem nome',
        company:r.company || r.client_name || 'Sem empresa',
        phone:r.phone || '',
        email:r.email || null,
        address:r.address || null
      })
      .select('*')
      .single()

    if(created.error){
      throw new Error('Erro ao criar cliente: ' + created.error.message)
    }

    return created.data.id
  }

  async function convertToOrder(r:any){
    const ok = confirm('Converter este lead em orçamento dentro de Ordem de Serviço?')
    if(!ok) return

    setLoading(true)
    setMsg('')

    try{
      const clientId = await findOrCreateClient(r)
      const num = await nextOSNumber()

      const widthCm =
        Number(r.width_cm || 0) ||
        Number(r.width_m || 0) * 100

      const heightCm =
        Number(r.height_cm || 0) ||
        Number(r.height_m || 0) * 100

      const widthM =
        Number(r.width_m || 0) ||
        widthCm / 100

      const heightM =
        Number(r.height_m || 0) ||
        heightCm / 100

      const area =
        Number(r.area_m2 || 0) ||
        widthM * heightM

      const fileUrl =
        r.file_url ||
        r.print_file_url ||
        r.drive_link ||
        null

      const { error: orderError } = await supabase
        .from('service_orders')
        .insert({
          os_number:num,
          client_id:clientId,
          service:r.service_name || r.service || 'Orçamento',
          service_price_id:r.service_price_id || null,
          service_type:r.service_name || r.service || 'Orçamento',
          width_m:widthM,
          height_m:heightM,
          width_cm:widthCm,
          height_cm:heightCm,
          area_m2:area,
          price_m2:r.price_m2 || 0,
          estimated_price:r.estimated_price || 0,
          measures:`${Number(widthCm || 0).toFixed(0)}cm x ${Number(heightCm || 0).toFixed(0)}cm`,
          finishing:'Sem acabamento',
          description:r.description || null,
          print_file_url:fileUrl,
          drive_file_id:r.drive_file_id || null,
          drive_file_name:r.drive_file_name || null,
          drive_folder_id:r.drive_folder_id || null,
          project_image_url:r.project_image_url || null,
          project_image_name:r.project_image_name || null,
          project_image_path:r.project_image_path || null,
          source:'Orçamento Público',
          status:'Orçamento',
          priority:'Média',
          due_date:null,
          delivered_at:null
        })

      if(orderError){
        throw new Error('Erro ao criar ordem de serviço: ' + orderError.message)
      }

      await supabase
        .from('accounts_receivable')
        .insert({
          client_id:clientId,
          title:`${num} - ${r.service_name || 'Orçamento'}`,
          due_date:today(),
          amount:r.estimated_price || 0,
          reference:new Date().toLocaleDateString('pt-BR',{month:'2-digit',year:'numeric'}),
          status:'Aberto'
        })

      const { error: leadError } = await supabase
        .from('public_quotes')
        .update({
          status:'Convertido',
          converted_os_number:num
        })
        .eq('id',r.id)

      if(leadError){
        // A OS já foi criada, então não quebra tudo por causa do status do lead.
        setMsg(`OS ${num} criada, mas não consegui atualizar o status do lead: ${leadError.message}`)
      }else{
        setMsg(`Lead convertido para ${num}. Agora aparece em Ordem de Serviço como Orçamento.`)
      }

      load()
    }catch(err:any){
      setMsg(err.message || 'Erro ao converter lead.')
    }finally{
      setLoading(false)
    }
  }

  return (
    <div>
      <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-4xl font-black">Novos Leads</h1>
          <p className="text-zinc-400">Orçamentos públicos enviados por clientes novos.</p>
        </div>

        <button className="btn-dark" onClick={load}>
          Atualizar
        </button>
      </header>

      {msg && (
        <div className="mb-4 rounded-xl border border-gold/30 bg-gold/10 p-4 text-gold">
          {msg}
        </div>
      )}

      <div className="card table-wrap">
        <table className="min-w-[1100px]">
          <thead>
            <tr>
              <th>Código</th>
              <th>Cliente</th>
              <th>Serviço</th>
              <th>Medidas</th>
              <th>Arquivo</th>
              <th>Valor</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            {rows.map(r=>(
              <tr key={r.id}>
                <td>
                  <strong>{r.quote_number}</strong><br/>
                  {r.converted_os_number && <small className="text-green-300">OS: {r.converted_os_number}</small>}
                </td>

                <td>
                  <strong>{r.client_name}</strong><br/>
                  <small>{r.company}</small><br/>
                  <small>{r.phone}</small>
                </td>

                <td>
                  <strong>{r.service_name}</strong><br/>
                  <small>{r.description}</small>
                </td>

                <td>
                  {(r.width_cm || Number(r.width_m||0)*100)?.toFixed ? (r.width_cm || Number(r.width_m||0)*100).toFixed(0) : r.width_cm}cm
                  {' x '}
                  {(r.height_cm || Number(r.height_m||0)*100)?.toFixed ? (r.height_cm || Number(r.height_m||0)*100).toFixed(0) : r.height_cm}cm
                  <br/>
                  <small>{Number(r.area_m2||0).toFixed(2)} m²</small>
                </td>

                <td>
                  {r.project_image_url && (
                    <a
                      className="btn-gold mb-2 inline-block"
                      href={r.project_image_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ver imagem
                    </a>
                  )}
                  {(r.file_url || r.print_file_url || r.drive_link) ? (
                    <a
                      className="btn-dark inline-block"
                      href={r.file_url || r.print_file_url || r.drive_link}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir arquivo
                    </a>
                  ) : (
                    <span className="text-zinc-500">Sem arquivo</span>
                  )}
                </td>

                <td>
                  <strong>{money(r.estimated_price)}</strong>
                </td>

                <td>
                  <select
                    className={`input ${statusClass(r.status || 'Novo')}`}
                    value={r.status || 'Novo'}
                    onChange={e=>updateStatus(r.id,e.target.value)}
                  >
                    <option>Novo</option>
                    <option>Em análise</option>
                    <option>Convertido</option>
                    <option>Recusado</option>
                  </select>
                </td>

                <td>
                  <button
                    disabled={loading || r.status === 'Convertido'}
                    className="btn-gold"
                    onClick={()=>convertToOrder(r)}
                  >
                    {r.status === 'Convertido' ? 'Convertido' : 'Converter em OS'}
                  </button>
                </td>
              </tr>
            ))}

            {rows.length===0 && (
              <tr>
                <td colSpan={8} className="text-zinc-400">
                  Nenhum lead encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
