import SessionActions from "./SessionActions";
import "./SessionNav.scss";

export default function SessionNav({ className = "" }: { className?: string }) {
  return (
    <nav
      className={`session-nav ${className}`.trim()}
      aria-label="Navegação da conta"
    >
      <SessionActions buttonVariant="dark" />
    </nav>
  );
}
