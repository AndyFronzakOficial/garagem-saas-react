export const money = (v:number|null|undefined) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0))
export const brNumber = (v:string) => Number(String(v||'').replace(/\./g,'').replace(',','.')) || 0
export const onlyNumbers = (v:string) => String(v||'').replace(/\D/g,'')
export const today = () => new Date().toISOString().slice(0,10)
export const currentMonth = () => new Date().toISOString().slice(0,7)
export const finishings = ['Sem acabamento','Ilhós','Bastão + corda','Dobrado','Laminado fosco','Laminado brilho','Adesivo recorte eletrônico','Adesivo meio corte','Adesivo corte reto','Aplicação','Refile','Solda','Costura','PVC expandido','Madeira','Estrutura metálica','Com instalação','Sem instalação']
export function statusClass(s:string){ if(['Recebido','Paga','Pronto','Entregue','Convertido'].includes(s)) return 'success'; if(['Recusado','Cancelado','Vencido'].includes(s)) return 'danger'; if(['Produção','Impressão','Acabamento','Em análise','Designer'].includes(s)) return 'info'; return 'warning' }
export function safeFileName(name: string) { return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_') }
export function quoteNumber(){ const d=new Date(); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); const rand=String(Math.floor(Math.random()*99999)).padStart(5,'0'); return `ORC-${y}${m}${day}-${rand}` }
export function formatDateBR(date?: string | null){ if(!date)return '-'; const [y,m,d]=date.slice(0,10).split('-'); return y&&m&&d ? `${d}/${m}/${y}` : '-' }
