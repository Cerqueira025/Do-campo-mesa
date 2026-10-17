import { useLayoutEffect } from 'react'
import HomePage from './pages/HomePage'
import ProductDetailPage from './pages/ProductDetailPage'
import AuctionDetailPage from './pages/AuctionDetailPage'
import { auctionIdFromPath } from './features/auctions/auction'
import { productIdFromPath } from './features/products/product'
import { useLocation } from './navigation/useLocation'
import { initializeNavigation, restoreNavigation } from './navigation/navigation'
import NavigationAnnouncer from './navigation/NavigationAnnouncer'

function App() {
  const location = useLocation()
  const pathname = location.split(/[?#]/)[0]
  useLayoutEffect(() => { initializeNavigation() }, [])
  useLayoutEffect(() => { restoreNavigation(!document.querySelector('[data-navigation-ready="false"]')) }, [location])
  const page = /^\/leiloes(?:\/|$)/.test(pathname)
    ? <AuctionDetailPage key={pathname} id={auctionIdFromPath(pathname)} />
    : pathname === '/' ? <HomePage /> : <ProductDetailPage key={pathname} id={productIdFromPath(pathname)} />
  return <><NavigationAnnouncer />{page}</>
}

export default App
