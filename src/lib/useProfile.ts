import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export function useProfile(){
  const [profile,setProfile] = useState<any>(null)
  const [loading,setLoading] = useState(true)

  useEffect(()=>{load()},[])

  async function load(){
    setLoading(true)
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if(!user){ setProfile(null); setLoading(false); return }

    let { data } = await supabase.from('profiles').select('*').eq('email',user.email).maybeSingle()
    if(!data){
      const created = { id:user.id, email:user.email, name:user.email?.split('@')[0] || 'Usuário', role:'Administrador' }
      await supabase.from('profiles').upsert(created,{onConflict:'email'})
      data = created
    }
    setProfile(data)
    setLoading(false)
  }

  return { profile, loading, reload: load }
}
