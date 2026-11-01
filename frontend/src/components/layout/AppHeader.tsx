import {
  faTractor,
  faRightFromBracket,
  faTruckFast,
  faUser,
  faUserShield,
  faAngleLeft,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCart } from "../../features/cart/cartContext";
import CartLink from "../ui/CartLink";
import IconButton from "../ui/IconButton";
import InternalLink from "../../navigation/InternalLink";
import { navigate } from "../../navigation/navigation";
import { useAuth } from "../../features/auth/useAuth";
import BrandMark from "../brand/BrandMark";
import "./AppHeader.scss";

interface AppHeaderProps {
  variant?: "default" | "overlay";
  onBack?: () => void;
}

export default function AppHeader({
  variant = "default",
  onBack,
}: AppHeaderProps) {
  const { estado, utilizador, sair } = useAuth();
  const { canBuy } = useCart();
  const buttonVariant = variant === "overlay" ? "dark" : "cream";

  return (
    <header className={`app-header app-header--${variant}`}>
      <div className="app-header__brand-group">
        {onBack && (
          <IconButton
            className="app-header__back"
            variant="plain"
            aria-label="Voltar ao catálogo"
            icon={<FontAwesomeIcon icon={faAngleLeft} aria-hidden="true" />}
            onClick={onBack}
          />
        )}
        <InternalLink
          className="app-header__brand"
          href="/"
          aria-label="Do campo à mesa: voltar ao catálogo"
        >
          <BrandMark variant="header" />
        </InternalLink>
      </div>
      <nav className="app-header__actions" aria-label="Navegação da conta">
        {canBuy && <CartLink />}
        {estado === "a-validar" ? (
          <span role="status">A validar sessão…</span>
        ) : utilizador ? (
          <>
            <IconButton
              href={
                utilizador.papel === "administrador"
                  ? "/admin"
                  : utilizador.papel === "produtor"
                    ? "/produtor/encomendas"
                    : "/conta"
              }
              icon={
                <FontAwesomeIcon
                  icon={
                    utilizador.papel === "administrador"
                      ? faUserShield
                      : utilizador.papel === "produtor"
                        ? faTractor
                        : faUser
                  }
                  aria-hidden="true"
                />
              }
              aria-label={
                utilizador.papel === "administrador"
                  ? "Administração"
                  : utilizador.papel === "produtor"
                    ? "Encomendas recebidas"
                    : "A minha conta"
              }
              variant="primary"
            />
            {utilizador.papel === "comprador" && (
              <IconButton
                href="/encomendas"
                icon={<FontAwesomeIcon icon={faTruckFast} aria-hidden="true" />}
                aria-label="Encomendas"
                variant="primary"
              />
            )}
            {utilizador.papel === "produtor" && (
              <InternalLink href="/produtor/encomendas">
                Encomendas recebidas
              </InternalLink>
            )}
            <IconButton
              variant={buttonVariant}
              icon={
                <FontAwesomeIcon icon={faRightFromBracket} aria-hidden="true" />
              }
              aria-label="Sair"
              onClick={() => {
                sair();
                navigate("/");
              }}
            />
          </>
        ) : estado === "erro" ? (
          <InternalLink href="/conta">Recuperar sessão</InternalLink>
        ) : (
          <IconButton
            href="/login"
            icon={<FontAwesomeIcon icon={faUser} aria-hidden="true" />}
            aria-label="Iniciar sessão"
            variant="primary"
          />
        )}
      </nav>
    </header>
  );
}
