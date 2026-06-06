import { Route,Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Protected from './components/Protected'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import Prices from './pages/Prices'
import PublicQuote from './pages/PublicQuote'
import Leads from './pages/Leads'
import Orders from './pages/Orders'
import Portal from './pages/Portal'
import Finance from './pages/Finance'
import Inventory from './pages/Inventory'
import Deliveries from './pages/Deliveries'
import Goals from './pages/Goals'
import Kanban from './pages/Kanban'
import Settings from './pages/Settings'
import Users from './pages/Users'

export default function App(){
  return <Routes>
    <Route path="/login" element={<Login/>}/>
    <Route path="/orcamento-rapido" element={<PublicQuote/>}/>
    <Route path="/portal-terceiro" element={<Portal/>}/>
    <Route element={<Protected/>}>
      <Route element={<Layout/>}>
        <Route path="/" element={<Dashboard/>}/>
        <Route path="/clientes" element={<Clients/>}/>
        <Route path="/leads" element={<Leads/>}/>
        <Route path="/ordens" element={<Orders/>}/>
        <Route path="/kanban" element={<Kanban/>}/>
        <Route path="/precos" element={<Prices/>}/>
        <Route path="/metas" element={<Goals/>}/>
        <Route path="/financeiro" element={<Finance/>}/>
        <Route path="/estoque" element={<Inventory/>}/>
        <Route path="/entregas" element={<Deliveries/>}/>
        <Route path="/usuarios" element={<Users/>}/>
        <Route path="/configuracoes" element={<Settings/>}/>
      </Route>
    </Route>
  </Routes>
}
