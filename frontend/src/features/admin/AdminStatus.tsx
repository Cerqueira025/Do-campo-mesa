const positive = new Set([
  "aceite",
  "publicada",
  "confirmada",
  "pronta",
  "entregue",
  "ativo",
  "Publicado",
  "Visível",
]);
const warning = new Set(["pendente", "denunciada", "agendado"]);
const negative = new Set(["rejeitado", "oculta", "cancelado", "Bloqueado"]);

export default function AdminStatus({ value }: { value?: string }) {
  const tone =
    value && positive.has(value)
      ? "positive"
      : value && warning.has(value)
        ? "warning"
        : value && negative.has(value)
          ? "negative"
          : "neutral";
  return (
    <span className={`admin-status admin-status--${tone}`}>
      {value ? value.charAt(0).toUpperCase() + value.slice(1) : "—"}
    </span>
  );
}
