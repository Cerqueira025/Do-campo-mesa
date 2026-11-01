import CartPage from "../pages/CartPage";
import CheckoutPage from "../pages/CheckoutPage";
import OrdersPage from "../pages/OrdersPage";
import OrderDetailPage from "../pages/OrderDetailPage";
import { useLayoutEffect } from "react";
import HomePage from "../pages/HomePage";
import ProductDetailPage from "../pages/ProductDetailPage";
import AuctionDetailPage from "../pages/AuctionDetailPage";
import {
  auctionIdFromPath,
  orderIdFromPath,
  productIdFromPath,
} from "./routePaths";
import NotFoundPage from "../pages/NotFoundPage";
import { useLocation } from "./useLocation";
import { initializeNavigation, restoreNavigation } from "./navigation";
import NavigationAnnouncer from "./NavigationAnnouncer";
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import ResetPasswordPage from "../pages/auth/ResetPasswordPage";
import AccountPage from "../pages/AccountPage";
import ProtectedRoute from "../features/auth/ProtectedRoute";
import AdminPage from "../features/admin/AdminPage";

function resolvePage(pathname: string, location: string) {
  switch (pathname) {
    case "/":
      return <HomePage />;
    case "/login":
      return <LoginPage key={location} />;
    case "/registo":
      return <RegisterPage key={location} />;
    case "/recuperar-password":
      return <ResetPasswordPage key={location} />;
    case "/carrinho":
      return <CartPage />;
    case "/finalizar-encomenda":
      return (
        <ProtectedRoute roles={["comprador"]}>
          <CheckoutPage />
        </ProtectedRoute>
      );
    case "/encomendas":
      return (
        <ProtectedRoute roles={["comprador"]}>
          <OrdersPage />
        </ProtectedRoute>
      );
    case "/produtor/encomendas":
      return (
        <ProtectedRoute roles={["produtor"]}>
          <OrdersPage producer />
        </ProtectedRoute>
      );
    case "/conta":
      return (
        <ProtectedRoute>
          <AccountPage />
        </ProtectedRoute>
      );
  }
  if (/^\/admin(?:\/|$)/.test(pathname))
    return (
      <ProtectedRoute roles={["administrador"]}>
        <AdminPage />
      </ProtectedRoute>
    );
  const orderId = orderIdFromPath(pathname);
  if (orderId)
    return (
      <ProtectedRoute roles={["comprador", "produtor"]}>
        <OrderDetailPage id={orderId} />
      </ProtectedRoute>
    );
  const auctionId = auctionIdFromPath(pathname);
  if (auctionId) return <AuctionDetailPage key={pathname} id={auctionId} />;
  const productId = productIdFromPath(pathname);
  if (productId) return <ProductDetailPage key={pathname} id={productId} />;
  return <NotFoundPage />;
}

function AppRoutes() {
  const location = useLocation();
  const pathname = location.split(/[?#]/)[0];
  useLayoutEffect(() => {
    initializeNavigation();
  }, []);
  useLayoutEffect(() => {
    restoreNavigation(
      !document.querySelector('[data-navigation-ready="false"]'),
    );
  }, [location]);
  const page = resolvePage(pathname, location);
  return (
    <>
      <NavigationAnnouncer />
      {page}
    </>
  );
}

export default AppRoutes;
