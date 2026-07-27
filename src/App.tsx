import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import PanelLayout from './pages/panel/PanelLayout'
import Dashboard from './pages/panel/Dashboard'
import MenuManager from './pages/panel/MenuManager'
import ImportMenu from './pages/panel/ImportMenu'
import QrPage from './pages/panel/QrPage'
import PublicMenu from './pages/public/PublicMenu'
import PrintMenu from './pages/public/PrintMenu'

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
            <Route path="menu" element={<MenuManager />} />
            <Route path="ice-aktar" element={<ImportMenu />} />
            <Route path="qr" element={<QrPage />} />
          </Route>
          <Route path="/menu/:slug" element={<PublicMenu />} />
          <Route path="/menu/:slug/yazdir" element={<PrintMenu />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
