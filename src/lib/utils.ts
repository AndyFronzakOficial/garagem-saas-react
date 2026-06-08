export const money = (v:number|null|undefined) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0))
export const brNumber = (v:string) => Number(String(v||'').replace(/\./g,'').replace(',','.')) || 0
export const finishings = ['Sem acabamento','Ilhós','Bastão + corda','Dobrado','Laminado fosco','Laminado brilho','Adesivo recorte eletrônico','Adesivo meio corte','Adesivo corte reto','Aplicação','Refile','Solda','Costura','PVC expandido','Madeira','Estrutura metálica','Com instalação','Sem instalação']
export function statusClass(s:string){ if(['Recebido','Paga','Pronto','Entregue','Convertido'].includes(s)) return 'success'; if(['Recusado','Cancelado','Vencido'].includes(s)) return 'danger'; if(['Produção','Impressão','Acabamento','Em análise'].includes(s)) return 'info'; return 'warning' }

export function safeFileName(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_')
}
