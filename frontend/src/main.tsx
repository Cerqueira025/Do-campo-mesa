import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/main.scss";
import App from "./App.tsx";
import CartProvider from "./features/cart/CartProvider";
import AuthProvider from "./features/auth/AuthProvider";
import SocketProvider from "./features/realtime/SocketProvider";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <SocketProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </SocketProvider>
    </AuthProvider>
  </StrictMode>,
);
