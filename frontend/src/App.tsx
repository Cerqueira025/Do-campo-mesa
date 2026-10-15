import HomePage from './pages/HomePage'
import ProductDetailPage from './pages/ProductDetailPage'
import { productIdFromPath } from './features/products/product'

function App() {
  return window.location.pathname === '/' ? <HomePage /> : <ProductDetailPage id={productIdFromPath(window.location.pathname)} />
}

export default App
