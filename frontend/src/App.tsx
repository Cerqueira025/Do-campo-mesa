import { useLayoutEffect } from 'react'
import HomePage from './pages/HomePage'
import ProductDetailPage from './pages/ProductDetailPage'
import AuctionDetailPage from './pages/AuctionDetailPage'
import { auctionIdFromPath } from './features/auctions/auction'
import { productIdFromPath } from './features/products/product'
import { useLocation } from './navigation/useLocation'
import { initializeNavigation, restoreNavigation } from './navigation/navigation'
import NavigationAnnouncer from './navigation/NavigationAnnouncer'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import AccountPage from './pages/AccountPage'
import ProtectedRoute from './features/auth/ProtectedRoute'
import ProducerApprovalPage from './pages/ProducerApprovalPage'

function resolvePage(pathname: string, location: string) {
  switch (pathname) {
    case '/': return <HomePage />
    case '/login': return <LoginPage key={location} />
    case '/registo': return <RegisterPage key={location} />
    case '/recuperar-password': return <ResetPasswordPage key={location} />
    case '/conta': return <ProtectedRoute><AccountPage /></ProtectedRoute>
    case '/admin/produtores': return <ProtectedRoute roles={['administrador']}><ProducerApprovalPage /></ProtectedRoute>
  }
  if (/^\/leiloes(?:\/|$)/.test(pathname)) {
    return <AuctionDetailPage key={pathname} id={auctionIdFromPath(pathname)} />
  }
  return <ProductDetailPage key={pathname} id={productIdFromPath(pathname)} />
}

function App() {
  const location = useLocation()
  const pathname = location.split(/[?#]/)[0]
  useLayoutEffect(() => { initializeNavigation() }, [])
  useLayoutEffect(() => { restoreNavigation(!document.querySelector('[data-navigation-ready="false"]')) }, [location])
  const page = resolvePage(pathname, location)
  return <><NavigationAnnouncer />{page}</>
}

export default App
