import { useState } from 'react'
import { supabase } from '../lib/supabase'

const tables = ['company_settings','clients','public_quotes','service_orders','accounts_receivable','accounts_payable','inventory','service_prices','deliveries','profiles']

export default function Backup(){
  const [loading,setLoading]=useState(false)
  const [msg,setMsg]=useState('')
  async function generateBackup(){
    setLoading(true); setMsg('')
    const backup:any = { generated_at:new Date().toISOString(), version:'garagem-backup-v1', tables:{} }
    for(const table of tables){
      const {data,error}=await supabase.from(table).select('*')
      backup.tables[table]= error ? {error:error.message} : data || []
    }
    const blob = new Blob([JSON.stringify(backup,null,2)],{type:'application/json'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href=url; a.download=`backup-garagem-${new Date().toISOString().slice(0,10)}.json`; a.click()
    URL.revokeObjectURL(url)
    setMsg('Backup gerado. O arquivo JSON foi baixado no seu dispositivo.')
    setLoading(false)
  }
  return <div><h1 className="text-4xl font-black">Backup</h1><p className="mb-6 text-zinc-400">Gere backup do banco de dados e configurações principais do sistema.</p><div className="card max-w-3xl"><h2 className="text-2xl font-black">Backup do Sistema</h2><p className="my-4 text-zinc-400">O arquivo inclui clientes, orçamentos, ordens de serviço, financeiro, estoque, preços e configurações. Arquivos enviados ficam no Supabase Storage/Google Drive e não são baixados dentro deste JSON.</p>{msg&&<div className="mb-4 rounded-xl border border-green-500/30 bg-green-950/40 p-3 text-green-200">{msg}</div>}<button onClick={generateBackup} disabled={loading} className="btn-gold">{loading?'Gerando backup...':'Gerar Backup'}</button></div></div>
}
