import { useEffect,useState } from 'react'
import { supabase } from '../lib/supabase'
import { currentMonth, money } from '../lib/utils'

export default function Goals(){
  const [month,setMonth]=useState(currentMonth())
  const [amount,setAmount]=useState('35000')
  const [saved,setSaved]=useState('')

  useEffect(()=>{load()},[month])

  async function load(){
    const {data}=await supabase.from('monthly_goals').select('*').eq('month',month).maybeSingle()
    setAmount(data?.goal_amount ? String(data.goal_amount) : '35000')
  }

  async function save(e:React.FormEvent){
    e.preventDefault()
    await supabase.from('monthly_goals').upsert({month,goal_amount:Number(amount.replace(',','.'))},{onConflict:'month'})
    setSaved('Meta salva.')
  }

  return <div>
    <h1 className="text-4xl font-black">Metas</h1>
    <p className="mb-6 text-zinc-400">Configure a meta de vendas mês a mês.</p>
    <form onSubmit={save} className="card max-w-xl space-y-4">
      <div>
        <label className="text-sm text-zinc-400">Mês</label>
        <input type="month" className="input mt-1" value={month} onChange={e=>setMonth(e.target.value)}/>
      </div>
      <div>
        <label className="text-sm text-zinc-400">Meta</label>
        <input className="input mt-1" value={amount} onChange={e=>setAmount(e.target.value)}/>
      </div>
      <div className="price-preview"><div className="text-zinc-400">Valor configurado</div><strong>{money(Number(amount.replace(',','.')||0))}</strong></div>
      <button className="btn-gold">Salvar meta</button>
      {saved&&<p className="text-green-300">{saved}</p>}
    </form>
  </div>
}
