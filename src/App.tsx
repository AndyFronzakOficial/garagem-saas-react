import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Protected from './components/Protected'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import Prices from './pages/Prices'
import PublicQuote from './pages/PublicQuote'
import Leads from './pages/Leads'
import Quotes from './pages/Quotes'
import Orders from './pages/Orders'
import Portal from './pages/Portal'
import Finance from './pages/Finance'
import Inventory from './pages/Inventory'
import Deliveries from './pages/Deliveries'
import Kanban from './pages/Kanban'
import Users from './pages/Users'
import Settings from './pages/Settings'
import CustomerHistory from './pages/CustomerHistory'
import Backup from './pages/Backup'
import AdminOnly from './components/AdminOnly'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/orcamento-rapido" element={<PublicQuote />} />
      <Route path="/portal-terceiro" element={<Portal />} />
      <Route element={<Protected />}>
        <Route element={<Layout />}>
          <Route element={<AdminOnly />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/financeiro" element={<Finance />} />
            <Route path="/configuracoes" element={<Settings />} />
            <Route path="/usuarios" element={<Users />} />
            <Route path="/backup" element={<Backup />} />
          </Route>
          <Route path="/clientes" element={<Clients />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/orcamentos" element={<Quotes />} />
          <Route path="/ordens" element={<Orders />} />
          <Route path="/precos" element={<Prices />} />
          <Route path="/estoque" element={<Inventory />} />
          <Route path="/entregas" element={<Deliveries />} />
          <Route path="/kanban" element={<Kanban />} />
          <Route path="/historico-clientes" element={<CustomerHistory />} />
        </Route>
      </Route>
    </Routes>
  )
}
