import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useProfile } from '../lib/useProfile'

export default function AdminOnly(){
  const { profile, loading } = useProfile()
  const location = useLocation()
  const role = profile?.role || 'Administrador'

  if(loading) return <div className="p-8">Carregando permissões...</div>
  return role === 'Administrador' ? <Outlet /> : <Navigate to="/ordens" replace state={{ from: location.pathname }} />
}
