import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import PanelLayout from './pages/panel/PanelLayout'
import Dashboard from './pages/panel/Dashboard'
import Overview from './pages/panel/Overview'
import MenuManager from './pages/panel/MenuManager'
import ImportMenu from './pages/panel/ImportMenu'
import QrPage from './pages/panel/QrPage'
import TablesAndCalls from './pages/panel/TablesAndCalls'
import Reservations from './pages/panel/Reservations'
import Orders from './pages/panel/Orders'
import OrderReceipt from './pages/panel/OrderReceipt'
import Customers from './pages/panel/Customers'
import Staff from './pages/panel/Staff'
import Languages from './pages/panel/Languages'
import PublicMenu from './pages/public/PublicMenu'
import PrintMenu from './pages/public/PrintMenu'
import TableRedirect from './pages/public/TableRedirect'
import StaffShifts from './pages/public/StaffShifts'
import KitchenDisplay from './pages/public/KitchenDisplay'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/giris" element={<Login />} />
          <Route path="/kayit" element={<Register />} />
          <Route path="/panel" element={<PanelLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="genel-bakis" element={<Overview />} />
            <Route path="menu" element={<MenuManager />} />
            <Route path="ice-aktar" element={<ImportMenu />} />
            <Route path="qr" element={<QrPage />} />
            <Route path="masalar" element={<TablesAndCalls />} />
            <Route path="rezervasyonlar" element={<Reservations />} />
            <Route path="siparisler" element={<Orders />} />
            <Route path="siparisler/:orderId/adisyon" element={<OrderReceipt />} />
            <Route path="musteriler" element={<Customers />} />
            <Route path="vardiyalar" element={<Staff />} />
            <Route path="diller" element={<Languages />} />
          </Route>
          <Route path="/menu/:slug" element={<PublicMenu />} />
          <Route path="/menu/:slug/yazdir" element={<PrintMenu />} />
          <Route path="/t/:tableId" element={<TableRedirect />} />
          <Route path="/vardiya/:staffId" element={<StaffShifts />} />
          <Route path="/mutfak/:token" element={<KitchenDisplay />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
