export const money = (v:number|null|undefined) =>
  new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0))

export const brNumber = (v:string|number) =>
  Number(String(v||'').replace(/\./g,'').replace(',','.')) || 0

export const cmToM = (v:string|number) => brNumber(v) / 100

export const onlyNumbers = (v:string) => String(v||'').replace(/\D/g,'')

export const today = () => new Date().toISOString().slice(0,10)
export const currentMonth = () => new Date().toISOString().slice(0,7)

export const roles = ['Administrador','Orçamento','Financeiro','Produção','Vendas','Funcionário']

export const finishings = [
  'Sem acabamento','Ilhós','Bastão + corda','Dobrado','Laminado fosco','Laminado brilho',
  'Adesivo recorte eletrônico','Adesivo meio corte','Adesivo corte reto','Aplicação','Refile',
  'Solda','Costura','PVC expandido','Madeira','Estrutura metálica','Com instalação','Sem instalação'
]

export const orderStatuses = ['Orçamento','Entrada','Designer','Produção','Impressão','Acabamento','Pronto','Entregue','Cancelado']
export const priorities = ['Baixa','Média','Alta','Urgente']

export function statusClass(s:string){
  if(['Recebido','Paga','Pronto','Entregue','Convertido','Concluído','Visualizada','Ativo'].includes(s)) return 'success'
  if(['Recusado','Cancelado','Vencido','Vencida','Urgente','Excluído'].includes(s)) return 'danger'
  if(['Produção','Impressão','Acabamento','Em análise','Em rota','Alta','Designer','Nova'].includes(s)) return 'info'
  return 'warning'
}

export function monthRange(ym:string){
  const [y,m] = ym.split('-').map(Number)
  const start = `${ym}-01`
  const end = new Date(y, m, 0).toISOString().slice(0,10)
  return { start, end }
}

export function quoteNumber(){
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth()+1).padStart(2,'0')
  const d = String(now.getDate()).padStart(2,'0')
  const rand = Math.floor(Math.random()*99999).toString().padStart(5,'0')
  return `ORC-${y}${m}${d}-${rand}`
}

export function formatDateBR(date?: string | null){
  if(!date) return '-'
  const [y,m,d] = date.slice(0,10).split('-')
  if(!y || !m || !d) return '-'
  return `${d}/${m}/${y}`
}

export function safeFileName(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_')
}

export function whatsappLink(phone?:string|null, text=''){
  const number = onlyNumbers(phone || '')
  return `https://wa.me/55${number}?text=${encodeURIComponent(text)}`
}

export function downloadText(filename:string, content:string, mime='text/plain;charset=utf-8'){
  const blob = new Blob([content], {type:mime})
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function toCSV(rows:any[]){
  if(!rows.length) return ''
  const headers = Array.from(new Set(rows.flatMap(r=>Object.keys(r))))
  const escape = (v:any) => {
    if(v === null || v === undefined) return ''
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    return `"${s.replace(/"/g,'""')}"`
  }
  return [headers.join(';'), ...rows.map(r=>headers.map(h=>escape(r[h])).join(';'))].join('\n')
}

export async function imageToDataURL(url:string){
  const response = await fetch(url)
  const blob = await response.blob()
  return await new Promise<string>((resolve,reject)=>{
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
