export const money = (v:number|null|undefined) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0))

export const brNumber = (v:string) => Number(String(v||'').replace(/\./g,'').replace(',','.')) || 0

export const onlyNumbers = (v:string) => String(v||'').replace(/\D/g,'')

export const today = () => new Date().toISOString().slice(0,10)

export const currentMonth = () => new Date().toISOString().slice(0,7)

export const monthRange = (ym:string) => {
  const [y,m] = ym.split('-').map(Number)
  const start = `${ym}-01`
  const end = new Date(y, m, 0).toISOString().slice(0,10)
  return { start, end }
}

export const finishings = [
  'Sem acabamento',
  'Ilhós',
  'Bastão + corda',
  'Dobrado',
  'Laminado fosco',
  'Laminado brilho',
  'Adesivo recorte eletrônico',
  'Adesivo meio corte',
  'Adesivo corte reto',
  'Aplicação',
  'Refile',
  'Solda',
  'Costura',
  'PVC expandido',
  'Madeira',
  'Estrutura metálica',
  'Com instalação',
  'Sem instalação'
]

export const orderStatuses = ['Entrada','Designer','Produção','Impressão','Acabamento','Pronto','Entregue']

export const priorities = ['Baixa','Média','Alta','Urgente']

export const roles = ['Administrador','Financeiro','Produção','Vendas','Funcionário']

export function statusClass(s:string){
  if(['Recebido','Paga','Pronto','Entregue','Convertido','Concluído'].includes(s)) return 'success'
  if(['Recusado','Cancelado','Vencido','Vencida','Urgente'].includes(s)) return 'danger'
  if(['Produção','Impressão','Acabamento','Em análise','Em rota','Alta','Designer'].includes(s)) return 'info'
  return 'warning'
}

export function osNumber(){
  return 'OS-' + Date.now().toString().slice(-6)
}

export function quoteNumber(){
  return 'QR-' + Date.now().toString().slice(-8)
}

export function weekOfMonth(dateString:string){
  const d = new Date(dateString)
  if (Number.isNaN(d.getTime())) return 1
  return Math.min(5, Math.ceil(d.getDate()/7))
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
