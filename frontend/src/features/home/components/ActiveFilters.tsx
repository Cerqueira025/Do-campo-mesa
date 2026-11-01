import { faXmark } from "@fortawesome/free-solid-svg-icons";
import Button from "../../../components/ui/Button";
import {
  ratingOptions,
  seasons,
  type CatalogFilters,
  type FilterOptions,
} from "../catalogFilters";
import "./ActiveFilters.scss";

interface ActiveFiltersProps {
  value: CatalogFilters;
  options: FilterOptions | null;
  onRemove: (key: keyof CatalogFilters) => void;
}

export default function ActiveFilters({
  value,
  options,
  onRemove,
}: ActiveFiltersProps) {
  const filters: { key: keyof CatalogFilters; name: string; label: string }[] =
    [
      { key: "categoria", name: "categoria", label: value.categoria },
      {
        key: "epoca",
        name: "época",
        label:
          seasons.find((season) => season.value === value.epoca)?.label ?? "",
      },
      {
        key: "bio",
        name: "produção",
        label: value.bio === "true" ? "Biológicos" : "Não biológicos",
      },
      {
        key: "produtorId",
        name: "produtor",
        label:
          options?.produtores.find(
            (producer) => producer.id === value.produtorId,
          )?.nome ?? "Produtor selecionado",
      },
      { key: "localidade", name: "localidade", label: value.localidade },
      {
        key: "avaliacaoMin",
        name: "avaliação",
        label:
          ratingOptions.find((option) => option.value === value.avaliacaoMin)
            ?.label ?? "",
      },
    ];
  const active = filters.filter((filter) => value[filter.key]);

  if (active.length === 0) return null;

  return (
    <ul className="active-filters" aria-label="Filtros ativos">
      {active.map(({ key, name, label }) => (
        <li className="active-filters__item" key={key}>
          <Button
            className="active-filters__remove"
            variant="primary"
            icon={faXmark}
            iconPosition="end"
            aria-label={`Remover filtro de ${name}: ${label}`}
            onClick={() => onRemove(key)}
          >
            {label}
          </Button>
        </li>
      ))}
    </ul>
  );
}
