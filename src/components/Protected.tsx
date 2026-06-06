import { useEffect,useState } from 'react'
import { Navigate,Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase'
export default function Protected(){
 const [ok,setOk]=useState<boolean|null>(null)
 useEffect(()=>{ supabase.auth.getSession().then(({data})=>setOk(!!data.session)); const {data:l}=supabase.auth.onAuthStateChange((_e,s)=>setOk(!!s)); return()=>l.subscription.unsubscribe() },[])
 if(ok===null) return <div className="p-8">Carregando...</div>
 return ok?<Outlet/>:<Navigate to="/login"/>
}
