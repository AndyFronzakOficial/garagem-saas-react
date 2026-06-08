import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { brNumber, finishings, formatDateBR, money, onlyNumbers, today } from '../lib/utils'
import { nextOSNumber } from '../lib/osNumber'
import { connectGoogleDrive, uploadFileToGoogleDrive, isGoogleDriveConfigured } from '../lib/googleDrive'

export default function Portal() {
  const [step, setStep] = useState<'login' | 'form'>('login')
  const [client, setClient] = useState<any>(null)
  const [company, setCompany] = useState('')
  const [phone, setPhone] = useState('')
  const [services, setServices] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [msg, setMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(false)

  const [f, setF] = useState({
    service_price_id: '',
    service: '',
    width_m: '',
    height_m: '',
    finishing: 'Sem acabamento',
    description: ''
  })

  useEffect(() => {
    supabase
      .from('service_prices')
      .select('*')
      .eq('active', true)
      .order('name')
      .then(({ data, error }) => {
        if (error) setErrorMsg('Erro ao carregar serviços: ' + error.message)
        setServices(data || [])
      })
  }, [])

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    setMsg('')

    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .ilike('company', company)
      .limit(1)
      .maybeSingle()

    if (error) {
      setErrorMsg('Erro ao buscar cliente: ' + error.message)
      return
    }

    if (data && onlyNumbers(data.phone || '') === onlyNumbers(phone)) {
      setClient(data)
      setStep('form')
      loadOrders(data.id)
    } else {
      setErrorMsg('Empresa ou telefone inválido.')
    }
  }

  async function loadOrders(id: string) {
    const { data, error } = await supabase
      .from('service_orders')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: false })

    if (error) setErrorMsg('Erro ao carregar serviços: ' + error.message)
    setOrders(data || [])
  }

  const service = services.find(s => s.id === f.service_price_id)
  const width = brNumber(f.width_m)
  const height = brNumber(f.height_m)
  const area = width * height
  const total = area * Number(service?.price_m2_partner || 0)

  async function uploadToDrive(osNumber: string) {
    if (!file) return {
      fileUrl: null,
      driveFileId: null,
      driveFileName: null,
      driveFolderId: null
    }

    if (!isGoogleDriveConfigured()) {
      throw new Error('Google Drive não configurado. Configure VITE_GOOGLE_CLIENT_ID no .env.')
    }

    await connectGoogleDrive()

    const uploaded = await uploadFileToGoogleDrive(file, {
      clientName: client?.company || client?.name || 'Cliente',
      osNumber
    })

    return {
      fileUrl: uploaded.viewLink,
      driveFileId: uploaded.id,
      driveFileName: uploaded.name,
      driveFolderId: uploaded.folderId
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    setMsg('')
    setLoading(true)

    try {
      if (!service || !client) {
        setErrorMsg('Cliente ou serviço inválido.')
        return
      }

      const num = await nextOSNumber()
      const uploaded = await uploadToDrive(num)

      const { error: orderError } = await supabase.from('service_orders').insert({
        os_number: num,
        client_id: client.id,
        service: f.service || service.name,
        service_price_id: service.id,
        service_type: service.name,
        width_m: width,
        height_m: height,
        area_m2: area,
        price_m2: service.price_m2_partner,
        estimated_price: total,
        measures: `${width.toFixed(2)}m x ${height.toFixed(2)}m`,
        finishing: f.finishing,
        description: f.description || null,
        print_file_url: uploaded.fileUrl,
        drive_file_id: uploaded.driveFileId,
        drive_file_name: uploaded.driveFileName,
        drive_folder_id: uploaded.driveFolderId,
        source: 'Cliente',
        status: 'Entrada',
        priority: 'Média'
      })

      if (orderError) {
        setErrorMsg('Erro ao salvar OS: ' + orderError.message)
        return
      }

      const { error: receiveError } = await supabase.from('accounts_receivable').insert({
        client_id: client.id,
        title: `${num} - ${f.service || service.name}`,
        due_date: today(),
        amount: total,
        reference: new Date().toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' }),
        status: 'Aberto'
      })

      if (receiveError) {
        setErrorMsg('OS criada, mas erro ao criar conta a receber: ' + receiveError.message)
        return
      }

      setMsg(`Serviço cadastrado: ${num} - ${money(total)}`)
      setFile(null)
      setF({
        service_price_id: '',
        service: '',
        width_m: '',
        height_m: '',
        finishing: 'Sem acabamento',
        description: ''
      })

      await loadOrders(client.id)
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao enviar serviço.')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'login') {
    return (
      <div className="grid min-h-screen place-items-center bg-matte p-6">
        <form onSubmit={login} className="card w-full max-w-md">
          <div className="mb-6 text-center">
            <img src="/logo.png" alt="Garagem Comunicação Visual" className="logo-img mx-auto max-h-28 object-contain"/>
            <div className="mt-2 text-zinc-400">Portal Terceiro</div>
          </div>

          {errorMsg && <div className="mb-4 rounded-xl bg-red-900/60 p-3 text-red-100">{errorMsg}</div>}

          <input className="input mb-3" placeholder="Nome da empresa" value={company} onChange={e => setCompany(e.target.value)} required />
          <input className="input mb-5" placeholder="Telefone somente números" value={phone} onChange={e => setPhone(e.target.value)} required />

          <button className="btn-gold w-full">Entrar</button>
        </form>
      </div>
    )
  }

  return (
    <div className="client-portal">
      <div className="client-shell">
        <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <img src="/logo.png" alt="Garagem Comunicação Visual" className="logo-img max-h-24 object-contain"/>
            <div className="text-zinc-400">Portal Terceiro · {client?.company}</div>
          </div>
          <button className="btn-dark" onClick={() => setStep('login')}>Sair</button>
        </header>

        {msg && <div className="mb-4 rounded-xl border border-gold/30 bg-gold/10 p-4 text-gold">{msg}</div>}
        {errorMsg && <div className="mb-4 rounded-xl border border-red-500/30 bg-red-950/60 p-4 text-red-100">{errorMsg}</div>}

        <section className="client-card">
          <h1 className="text-3xl font-black">Cadastrar serviço</h1>
          <p className="mt-1 text-zinc-400">Envie medidas, acabamento, descrição e arquivo da arte.</p>

          <form onSubmit={save} className="client-grid mt-6">
            <select className="input" value={f.service_price_id} onChange={e => setF({ ...f, service_price_id: e.target.value })} required>
              <option value="">Serviço</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.name} - {money(s.price_m2_partner)}/m²</option>)}
            </select>

            <input className="input" placeholder="Nome do serviço" value={f.service} onChange={e => setF({ ...f, service: e.target.value })} />

            <input className="input" placeholder="Largura" value={f.width_m} onChange={e => setF({ ...f, width_m: e.target.value })} required />
            <input className="input" placeholder="Altura" value={f.height_m} onChange={e => setF({ ...f, height_m: e.target.value })} required />

            <select className="input" value={f.finishing} onChange={e => setF({ ...f, finishing: e.target.value })}>
              {finishings.map(o => <option key={o}>{o}</option>)}
            </select>

            <div className="price-preview">
              <div>Área: {area.toFixed(2)} m²</div>
              <strong>{money(total)}</strong>
            </div>

            <textarea className="input full" placeholder="Descrição" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} />

            <div className="full">
              <label className="mb-2 block text-sm text-zinc-400">Arquivo da arte</label>

              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <input className="input" type="file" onChange={e => setFile(e.target.files?.[0] || null)} />
                <button type="button" className="btn-dark whitespace-nowrap" onClick={() => connectGoogleDrive().catch(err => setErrorMsg(err.message))}>
                  Conectar Google Drive
                </button>
              </div>

              {file && <p className="mt-2 text-sm text-zinc-400">Arquivo selecionado: {file.name}</p>}
            </div>

            <button disabled={loading} className="btn-gold full">
              {loading ? 'Enviando...' : 'Enviar serviço'}
            </button>
          </form>
        </section>

        <section className="client-card mt-6">
          <h2 className="text-2xl font-black">Rastreamento dos serviços</h2>

          <div className="grid gap-4 mt-4">
            {orders.map(o => {
              const steps = ['Entrada','Designer','Produção','Impressão','Acabamento','Pronto','Entregue']
              const current = Math.max(0, steps.indexOf(o.status))

              return (
                <article key={o.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="text-xl font-black text-gold">{o.os_number} · {o.service}</h3>
                      <p className="text-sm text-zinc-400">{o.finishing} · {money(o.estimated_price)}</p>
                    </div>
                    <span className="badge info">{o.status}</span>
                  </div>

                  <div className="mt-5 grid gap-2 md:grid-cols-7">
                    {steps.map((s,i)=>
                      <div key={s} className={`rounded-xl border p-3 text-center text-xs ${i<=current?'border-gold/50 bg-gold/10 text-gold':'border-white/10 bg-black/20 text-zinc-500'}`}>
                        {s}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 grid gap-3 text-sm md:grid-cols-4">
                    <p>Arquivo: {o.print_file_url ? <a className="text-gold" href={o.print_file_url} target="_blank">Abrir</a> : '-'}</p>
                    <p>Data prevista: {formatDateBR(o.due_date)}</p>
                    <p>Data entrega: {formatDateBR(o.delivered_at)}</p>
                    <p>Valor: {money(o.estimated_price)}</p>
                  </div>
                </article>
              )
            })}

            {orders.length === 0 && <div className="rounded-2xl border border-white/10 p-6 text-center text-zinc-400">Nenhum serviço enviado ainda.</div>}
          </div>
        </section>
      </div>
    </div>
  )
}
