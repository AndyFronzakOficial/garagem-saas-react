import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import jsPDF from 'jspdf'
import { supabase } from '../lib/supabase'
import { brNumber, money } from '../lib/utils'

type Product={id:string;name:string;product_code:string|null;barcode:string|null;stock:number;sale_price:number;cost_price:number}
type CartItem=Product & {quantity:number}

const fmt=(v:any)=>brNumber(v)
const receiptMoney=(v:number)=>money(v)

export default function RetailPOS(){
  const [products,setProducts]=useState<Product[]>([])
  const [search,setSearch]=useState('')
  const [cart,setCart]=useState<CartItem[]>([])
  const [discount,setDiscount]=useState('')
  const [showDiscount,setShowDiscount]=useState(false)
  const [showPay,setShowPay]=useState(false)
  const [payment,setPayment]=useState('Dinheiro')
  const [cashGiven,setCashGiven]=useState('')
  const [loading,setLoading]=useState(false)
  const [msg,setMsg]=useState('')
  const [company,setCompany]=useState<any>(null)

  useEffect(()=>{ loadProducts(); loadCompany() },[])
  async function loadProducts(){
    const {data,error}=await supabase.from('retail_products').select('*').eq('active',true).order('name')
    if(error) setMsg(error.message)
    setProducts((data||[]) as Product[])
  }
  async function loadCompany(){
    const {data}=await supabase.from('company_settings').select('*').eq('id',1).maybeSingle()
    setCompany(data||{})
  }

  const found=useMemo(()=>{
    const q=search.trim().toLowerCase()
    if(!q) return products.slice(0,30)
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      String(p.product_code||'').toLowerCase().includes(q) ||
      String(p.barcode||'').toLowerCase().includes(q)
    ).slice(0,30)
  },[products,search])

  const subtotal=cart.reduce((a,p)=>a+p.quantity*fmt(p.sale_price),0)
  const discountValue=Math.min(Math.max(fmt(discount),0),subtotal)
  const total=Math.max(subtotal-discountValue,0)
  const change=Math.max(fmt(cashGiven)-total,0)

  function add(p:Product){
    if(p.stock<=0){ setMsg('Produto sem estoque.'); return }
    setCart(c=>{
      const old=c.find(x=>x.id===p.id)
      if(old) return c.map(x=>x.id===p.id?{...x,quantity:Math.min(x.quantity+1,p.stock)}:x)
      return [...c,{...p,quantity:1}]
    })
    setSearch('')
    setMsg('')
  }
  function setQty(id:string,v:string){
    const q=Math.max(1,Math.floor(fmt(v)))
    setCart(c=>c.map(x=>x.id===id?{...x,quantity:Math.min(q,x.stock)}:x))
  }
  function remove(id:string){ setCart(c=>c.filter(x=>x.id!==id)) }
  function cancel(){ setCart([]); setDiscount(''); setCashGiven(''); setShowPay(false); setShowDiscount(false); setMsg('Venda cancelada.') }

  async function finish(){
    if(!cart.length){ setMsg('Adicione produtos ao carrinho.'); return }
    if(payment==='Dinheiro' && fmt(cashGiven)<total){ setMsg('O valor recebido é menor que o total.'); return }
    setLoading(true); setMsg('')
    const {data:userData}=await supabase.auth.getUser()
    const uid=userData.user?.id
    if(!uid){ setMsg('Sessão expirada. Faça login novamente.'); setLoading(false); return }

    const profit=cart.reduce((a,p)=>a+(p.sale_price-p.cost_price)*p.quantity,0)-discountValue
    const {data:sale,error:saleError}=await supabase.from('retail_sales').insert({
      user_id:uid, subtotal, discount:discountValue,total, payment_method:payment,
      status:'finalizada', profit
    }).select().single()
    if(saleError || !sale){ setMsg(saleError?.message||'Não foi possível registrar a venda.'); setLoading(false); return }

    const items=cart.map(p=>({user_id:uid,sale_id:sale.id,product_id:p.id,product_name:p.name,product_code:p.product_code,barcode:p.barcode,quantity:p.quantity,unit_price:p.sale_price,cost_price:p.cost_price,total:p.quantity*p.sale_price,profit:(p.sale_price-p.cost_price)*p.quantity}))
    const {error:itemError}=await supabase.from('retail_sale_items').insert(items)
    if(itemError){ setMsg(itemError.message); await supabase.from('retail_sales').delete().eq('id',sale.id); setLoading(false); return }

    for(const p of cart){
      const newStock=Math.max(fmt(p.stock)-p.quantity,0)
      const {error:e}=await supabase.from('retail_products').update({stock:newStock,updated_at:new Date().toISOString()}).eq('id',p.id)
      if(!e) await supabase.from('retail_stock_movements').insert({user_id:uid,product_id:p.id,movement_type:'saida_venda',quantity:p.quantity,reason:`Venda ${sale.sale_number||sale.id}`})
    }

    await supabase.from('financial_entries').insert({
      user_id:uid,description:`Venda varejo ${sale.sale_number||sale.id}`,type:'receita',
      payment_method:payment,amount:total,paid_at:new Date().toISOString()
    })

    await makeReceipt(sale,cart,discountValue,total)
    await loadProducts()
    setCart([]); setDiscount(''); setCashGiven(''); setShowPay(false); setLoading(false)
    setMsg('Venda finalizada com sucesso.')
  }

  async function makeReceipt(sale:any,items:CartItem[],disc:number,tot:number){
    const pdf=new jsPDF({unit:'mm',format:[80,Math.max(160,70+items.length*9+80)]})
    let y=10
    const center=(text:string,size=10)=>{pdf.setFontSize(size); pdf.setFont('helvetica','bold'); pdf.text(text,40,y,{align:'center'}); y+=5}
    center(company?.company_name||'Garagem Comunicação Visual',12)
    pdf.setFont('helvetica','normal'); pdf.setFontSize(8)
    ;[company?.cnpj,company?.address,company?.phone].filter(Boolean).forEach((x:string)=>{pdf.text(String(x),40,y,{align:'center'});y+=4})
    pdf.line(5,y,75,y); y+=5
    pdf.setFont('helvetica','bold'); pdf.text(`CUPOM DE VENDA ${sale.sale_number||''}`,5,y); y+=5
    pdf.setFont('helvetica','normal'); pdf.text(new Date().toLocaleString('pt-BR'),5,y); y+=5
    pdf.line(5,y,75,y); y+=5
    items.forEach(p=>{
      pdf.setFont('helvetica','bold'); pdf.text(p.name.slice(0,30),5,y); y+=4
      pdf.setFont('helvetica','normal'); pdf.text(`${p.quantity} x ${receiptMoney(p.sale_price)}`,5,y)
      pdf.text(receiptMoney(p.quantity*p.sale_price),75,y,{align:'right'}); y+=5
    })
    if(disc>0){pdf.line(5,y,75,y);y+=5;pdf.text('Desconto',5,y);pdf.text(receiptMoney(disc),75,y,{align:'right'});y+=5}
    pdf.line(5,y,75,y);y+=6
    pdf.setFont('helvetica','bold'); pdf.setFontSize(12); pdf.text('TOTAL',5,y);pdf.text(receiptMoney(tot),75,y,{align:'right'});y+=6
    pdf.setFontSize(8);pdf.setFont('helvetica','normal');pdf.text(`Pagamento: ${payment}`,5,y);y+=5
    if(payment==='Dinheiro'){pdf.text(`Recebido: ${receiptMoney(fmt(cashGiven))}`,5,y);y+=4;pdf.text(`Troco: ${receiptMoney(change)}`,5,y);y+=5}
    pdf.text('Obrigado pela preferência!',40,y,{align:'center'})
    pdf.save(`cupom-${sale.sale_number||sale.id}.pdf`)
  }

  return <div className="page-fade">
    <header className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div><p className="text-sm font-black uppercase tracking-[.3em] text-gold/80">Varejo</p><h1 className="text-4xl font-black">PDV Varejo</h1><p className="text-zinc-400">Venda produtos físicos separados do estoque de comunicação visual.</p></div>
      <Link to="/estoque-varejo" className="btn-gold">Entrar no estoque</Link>
    </header>
    {msg&&<div className="mb-4 rounded-xl border border-white/10 bg-black/30 p-3 text-sm">{msg}</div>}
    <div className="grid gap-5 xl:grid-cols-[1fr_1.15fr]">
      <section className="card">
        <h2 className="mb-3 text-lg font-black">Pesquisar produto</h2>
        <input autoFocus className="input mb-3" placeholder="Nome, código ou código de barras..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <div className="max-h-[58vh] space-y-2 overflow-y-auto pr-1">
          {found.map(p=><button key={p.id} onClick={()=>add(p)} className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-left transition hover:border-gold/50 hover:bg-gold/5">
            <div className="flex items-center justify-between gap-3"><div><strong>{p.name}</strong><div className="text-xs text-zinc-400">Código: {p.product_code||'-'} · Barras: {p.barcode||'-'}</div></div><div className="text-right"><strong>{money(p.sale_price)}</strong><div className={`text-xs ${p.stock<=0?'text-red-300':'text-zinc-400'}`}>Estoque: {p.stock}</div></div></div>
          </button>)}
          {!found.length&&<p className="py-8 text-center text-zinc-500">Nenhum produto encontrado.</p>}
        </div>
      </section>
      <section className="card flex min-h-[60vh] flex-col">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-black">Carrinho</h2><span className="badge">{cart.reduce((a,p)=>a+p.quantity,0)} itens</span></div>
        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {cart.map(p=><div key={p.id} className="rounded-xl border border-white/10 p-3"><div className="flex justify-between gap-2"><div><strong>{p.name}</strong><div className="text-xs text-zinc-400">Código de barras: {p.barcode||'-'}</div></div><button className="btn-red px-2 py-1" onClick={()=>remove(p.id)}>X</button></div><div className="mt-2 flex items-center justify-between gap-3"><input className="input max-w-28" type="number" min="1" max={p.stock} value={p.quantity} onChange={e=>setQty(p.id,e.target.value)}/><span>{money(p.sale_price)} x {p.quantity}</span><strong>{money(p.sale_price*p.quantity)}</strong></div></div>)}
          {!cart.length&&<div className="grid h-full min-h-56 place-items-center text-zinc-500">O carrinho está vazio.</div>}
        </div>
        <div className="mt-4 border-t border-white/10 pt-4">
          <div className="flex justify-between text-sm"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
          <div className="flex justify-between text-sm"><span>Desconto</span><strong>{money(discountValue)}</strong></div>
          <div className="mt-2 flex justify-between text-2xl font-black"><span>Total</span><span className="text-gold">{money(total)}</span></div>
          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            <button className="btn" onClick={()=>setShowDiscount(v=>!v)}>Desconto</button>
            <button className="btn" onClick={cancel}>Cancelar</button>
            <button className="btn" onClick={()=>setCart([])}>Limpar</button>
            <button className="btn-gold" disabled={!cart.length} onClick={()=>setShowPay(true)}>Finalizar</button>
          </div>
          {showDiscount&&<div className="mt-3 flex gap-2"><input className="input" placeholder="Desconto em R$" value={discount} onChange={e=>setDiscount(e.target.value)}/><button className="btn" onClick={()=>setShowDiscount(false)}>Aplicar</button></div>}
        </div>
      </section>
    </div>
    {showPay&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><div className="card w-full max-w-md">
      <h2 className="text-2xl font-black">Finalizar venda</h2><p className="my-2 text-zinc-400">Total da venda</p><div className="mb-5 text-4xl font-black text-gold">{money(total)}</div>
      <div className="grid grid-cols-2 gap-2">{['Dinheiro','Pix','Débito','Crédito'].map(m=><button key={m} onClick={()=>setPayment(m)} className={`rounded-xl border p-3 ${payment===m?'border-gold bg-gold/10':'border-white/10'}`}>{m}</button>)}</div>
      {payment==='Dinheiro'&&<div className="mt-4"><label className="text-sm text-zinc-400">Valor recebido</label><input className="input mt-1" inputMode="decimal" value={cashGiven} onChange={e=>setCashGiven(e.target.value)} placeholder="R$ 0,00"/><div className="mt-3 rounded-xl bg-black/20 p-3"><span className="text-zinc-400">Troco</span><strong className="ml-2 text-xl text-gold">{money(change)}</strong></div></div>}
      <div className="mt-5 flex gap-2"><button className="btn flex-1" onClick={()=>setShowPay(false)}>Voltar</button><button className="btn-gold flex-1" disabled={loading} onClick={finish}>{loading?'Finalizando...':'Finalizar venda'}</button></div>
    </div></div>}
  </div>
}
