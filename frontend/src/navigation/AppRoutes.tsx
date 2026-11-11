import CartPage from "../pages/CartPage";
import CheckoutPage from "../pages/CheckoutPage";
import OrdersPage from "../pages/OrdersPage";
import OrderDetailPage from "../pages/OrderDetailPage";
import { useLayoutEffect } from "react";
import HomePage from "../pages/HomePage";
import ProductDetailPage from "../pages/ProductDetailPage";
import ProducerDetailPage from "../pages/ProducerDetailPage";
import AuctionDetailPage from "../pages/AuctionDetailPage";
import {
  auctionIdFromPath,
  orderIdFromPath,
  productIdFromPath,
  producerIdFromPath,
} from "./routePaths";
import NotFoundPage from "../pages/NotFoundPage";
import { useLocation } from "./useLocation";
import { initializeNavigation, restoreNavigation } from "./navigation";
import NavigationAnnouncer from "./NavigationAnnouncer";
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import AccountPage from "../pages/AccountPage";
import ProtectedRoute from "../features/auth/ProtectedRoute";
import AdminPage from "../features/admin/AdminPage";
import BackofficeEntry from "../features/admin/BackofficeEntry";
import ProducerArea, {
  type ProducerSection,
} from "../features/products/ProducerArea";
import ProducerSummary from "../features/orders/ProducerSummary";
import BuyerArea from "../features/account/BuyerArea";
import { useAuth } from "../features/auth/useAuth";
import ProducerProducts from "../features/products/ProducerProducts";
import ProducerProductDetail from "../features/products/ProducerProductDetail";
import ProducerAuctions from "../features/auctions/ProducerAuctions";
import ProductForm from "../features/products/ProductForm";
import AuctionForm from "../features/auctions/AuctionForm";
import ProducerProfile from "../features/producers/ProducerProfile";

function resolvePage(pathname: string, location: string, embedded: boolean) {
  const ownProductId = /^\/produtor\/produtos\/([a-f\d]{24})\/?$/i.exec(
    pathname,
  )?.[1];
  const ownAuctionId = /^\/produtor\/leiloes\/([a-f\d]{24})\/?$/i.exec(
    pathname,
  )?.[1];
  if (ownProductId || ownAuctionId || pathname === "/produtor/leiloes")
    return (
      <ProtectedRoute roles={["produtor"]} approvedProducer>
        {ownProductId ? (
          <ProducerProductDetail key={location} id={ownProductId} />
        ) : (
          <ProducerAuctions key={location} id={ownAuctionId} />
        )}
      </ProtectedRoute>
    );
  const editId = /^\/produtor\/produtos\/([a-f\d]{24})\/editar\/?$/i.exec(
    pathname,
  )?.[1];
  if (
    pathname === "/produtor/produtos" ||
    pathname === "/produtor/produtos/novo" ||
    editId
  )
    return (
      <ProtectedRoute roles={["produtor"]} approvedProducer>
        {pathname === "/produtor/produtos" ? (
          <ProducerProducts key={location} />
        ) : (
          <ProductForm key={pathname} id={editId} />
        )}
      </ProtectedRoute>
    );
  switch (pathname) {
    case "/produtor/perfil":
      return (
        <ProtectedRoute roles={["produtor"]}>
          <ProducerProfile />
        </ProtectedRoute>
      );
    case "/produtor/leiloes/novo":
      return (
        <ProtectedRoute roles={["produtor"]} approvedProducer>
          <AuctionForm />
        </ProtectedRoute>
      );
    case "/":
      return <HomePage />;
    case "/login":
      return <LoginPage key={location} />;
    case "/registo":
      return <RegisterPage key={location} />;
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
          <OrdersPage embedded={embedded} />
        </ProtectedRoute>
      );
    case "/produtor":
      return (
        <ProtectedRoute roles={["produtor"]}>
          <ProducerSummary embedded={embedded} />
        </ProtectedRoute>
      );
    case "/produtor/encomendas":
      return (
        <ProtectedRoute roles={["produtor"]}>
          <OrdersPage producer embedded={embedded} />
        </ProtectedRoute>
      );
    case "/conta":
      return (
        <ProtectedRoute>
          <AccountPage embedded={embedded} />
        </ProtectedRoute>
      );
  }
  if (pathname === "/admin/backoffice")
    return (
      <ProtectedRoute roles={["administrador"]}>
        <BackofficeEntry />
      </ProtectedRoute>
    );
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
        {embedded ? (
          <OrderDetailPage id={orderId} embedded />
        ) : (
          <OrderDetailPage id={orderId} />
        )}
      </ProtectedRoute>
    );
  const auctionId = auctionIdFromPath(pathname);
  if (auctionId) return <AuctionDetailPage key={pathname} id={auctionId} />;
  const productId = productIdFromPath(pathname);
  if (productId) return <ProductDetailPage key={pathname} id={productId} />;
  const producerId = producerIdFromPath(pathname);
  if (producerId) return <ProducerDetailPage key={pathname} id={producerId} />;
  return <NotFoundPage />;
}

function buyerPageFromPath(pathname: string): {
  title: string;
  section: "account" | "orders";
} | null {
  if (pathname === "/conta")
    return { title: "A minha conta", section: "account" };
  if (pathname === "/encomendas")
    return { title: "As minhas encomendas", section: "orders" };
  if (orderIdFromPath(pathname))
    return { title: "Detalhe da encomenda", section: "orders" };
  return null;
}

function producerPageFromPath(pathname: string): {
  title: string;
  section: ProducerSection;
  approved?: boolean;
} | null {
  if (pathname === "/produtor")
    return { title: "Resumo", section: "summary" };
  if (pathname === "/conta")
    return { title: "A minha conta", section: "account" };
  if (pathname === "/produtor/perfil")
    return { title: "Perfil da exploração", section: "profile" };
  if (pathname === "/produtor/encomendas" || orderIdFromPath(pathname))
    return {
      title:
        pathname === "/produtor/encomendas"
          ? "Encomendas recebidas"
          : "Detalhe da encomenda",
      section: "orders",
    };
  if (
    pathname === "/produtor/leiloes" ||
    /^\/produtor\/leiloes\/([a-f\d]{24})\/?$/i.test(pathname)
  )
    return {
      title:
        pathname === "/produtor/leiloes"
          ? "Os meus leilões"
          : "Detalhe do leilão",
      section: "auction",
      approved: true,
    };
  if (/^\/produtor\/produtos\/([a-f\d]{24})\/?$/i.test(pathname))
    return { title: "Detalhe do produto", section: "products", approved: true };
  if (pathname === "/produtor/leiloes/novo")
    return { title: "Novo leilão", section: "auction-create", approved: true };
  if (
    pathname === "/produtor/produtos" ||
    pathname === "/produtor/produtos/novo" ||
    /^\/produtor\/produtos\/([a-f\d]{24})\/editar\/?$/i.test(pathname)
  )
    return {
      title:
        pathname === "/produtor/produtos"
          ? "Os meus produtos"
          : pathname.endsWith("/novo")
            ? "Novo produto"
            : "Editar produto",
      section:
        pathname === "/produtor/produtos/novo" ? "product-create" : "products",
      approved: true,
    };
  return null;
}

function AppRoutes() {
  const { utilizador, estado } = useAuth();
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
  const producerPage =
    utilizador?.papel === "produtor" ? producerPageFromPath(pathname) : null;
  const buyerPage =
    utilizador?.papel === "comprador" ? buyerPageFromPath(pathname) : null;
  const embedded = Boolean(
    estado === "autenticado" &&
    (buyerPage ||
      (producerPage &&
        (!producerPage.approved || utilizador?.validacao === "aceite"))),
  );
  const page = resolvePage(pathname, location, embedded);
  return (
    <>
      <NavigationAnnouncer />
      {producerPage && embedded ? (
        <ProducerArea title={producerPage.title} section={producerPage.section}>
          {page}
        </ProducerArea>
      ) : buyerPage && embedded ? (
        <BuyerArea title={buyerPage.title} section={buyerPage.section}>
          {page}
        </BuyerArea>
      ) : (
        page
      )}
    </>
  );
}

export default AppRoutes;
