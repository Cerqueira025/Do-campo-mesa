import { useId } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faLeaf,
  faRotateRight,
  faStar,
  faStarHalfStroke,
} from "@fortawesome/free-solid-svg-icons";
import Button from "../../../components/ui/Button";
import {
  ratingOptions,
  seasons,
  type CatalogFilters,
  type FilterOptions,
} from "../catalogFilters";
import "./ProductFilters.scss";

interface ProductFiltersProps {
  id: string;
  isOpen: boolean;
  value: CatalogFilters;
  options: FilterOptions | null;
  optionsError: boolean;
  onChange: (value: CatalogFilters) => void;
  onClear: () => void;
  onRetry: () => void;
  onViewResults: () => void;
  onClose: () => void;
}

function ProductFilters({
  id: panelId,
  isOpen,
  value,
  options,
  optionsError,
  onChange,
  onClear,
  onRetry,
  onViewResults,
  onClose,
}: ProductFiltersProps) {
  const id = useId();
  const activeCount = Object.values(value).filter(Boolean).length;
  const categories = options?.categorias ?? [];
  const categoryOptions = [
    { value: "", label: "Todas" },
    ...categories.map((category) => ({ value: category, label: category })),
    ...(value.categoria && !categories.includes(value.categoria)
      ? [{ value: value.categoria, label: value.categoria }]
      : []),
  ];
  const chipGroups = [
    {
      key: "categoria",
      label: "Categoria",
      disabled: !options,
      options: categoryOptions,
    },
    {
      key: "epoca",
      label: "Época",
      disabled: false,
      options: [{ value: "", label: "Todas" }, ...seasons],
    },
    {
      key: "bio",
      label: "Produção",
      disabled: false,
      options: [
        { value: "", label: "Todos" },
        { value: "true", label: "Biológicos" },
        { value: "false", label: "Não biológicos" },
      ],
    },
  ] satisfies {
    key: keyof CatalogFilters;
    label: string;
    disabled: boolean;
    options: { value: string; label: string }[];
  }[];
  const selectFields = [
    {
      key: "produtorId",
      label: "Produtor",
      all: "Todos os produtores",
      options:
        options?.produtores.map((producer) => ({
          value: producer.id,
          label: producer.nome,
        })) ?? [],
    },
    {
      key: "localidade",
      label: "Localidade",
      all: "Todas as localidades",
      options:
        options?.localidades.map((location) => ({
          value: location,
          label: location,
        })) ?? [],
    },
  ] satisfies {
    key: keyof CatalogFilters;
    label: string;
    all: string;
    options: { value: string; label: string }[];
  }[];

  return (
    <aside
      id={panelId}
      hidden={!isOpen}
      className="product-filters"
      aria-label="Filtros do catálogo"
    >
      <div className="product-filters__panel">
        <header className="product-filters__header">
          <div>
            <h3>
              <FontAwesomeIcon icon={faLeaf} aria-hidden="true" /> Filtrar
              produtos
            </h3>
            <p>Encontre o melhor da nossa região</p>
          </div>
        </header>

        {chipGroups.map((group) => (
          <fieldset
            className="product-filters__section"
            key={group.key}
            disabled={group.disabled}
          >
            <legend>{group.label}</legend>
            <div className="product-filters__chips">
              {group.options.map((option) => (
                <label className="product-filters__choice" key={option.value}>
                  <input
                    className="product-filters__choice-input"
                    type="radio"
                    name={`${id}-${group.key}`}
                    value={option.value}
                    checked={value[group.key] === option.value}
                    onChange={() =>
                      onChange({ ...value, [group.key]: option.value })
                    }
                  />
                  <span className="product-filters__chip">
                    {group.key === "bio" && option.value === "true" && (
                      <FontAwesomeIcon icon={faLeaf} aria-hidden="true" />
                    )}
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        <fieldset className="product-filters__section">
          <legend>Avaliações</legend>
          <div className="product-filters__ratings">
            {ratingOptions.map((option) => (
              <label className="product-filters__rating" key={option.value}>
                <span className="product-filters__stars" aria-hidden="true">
                  {Array.from({ length: 5 }, (_, index) => (
                    <FontAwesomeIcon
                      key={index}
                      className={
                        option.rating > 0 && index >= Math.ceil(option.rating)
                          ? "product-filters__star--empty"
                          : undefined
                      }
                      icon={
                        option.rating > index && option.rating < index + 1
                          ? faStarHalfStroke
                          : faStar
                      }
                    />
                  ))}
                </span>
                <span>{option.label}</span>
                <input
                  className="product-filters__radio"
                  type="radio"
                  name={`${id}-avaliacaoMin`}
                  value={option.value}
                  checked={value.avaliacaoMin === option.value}
                  onChange={() =>
                    onChange({ ...value, avaliacaoMin: option.value })
                  }
                />
              </label>
            ))}
          </div>
        </fieldset>

        {selectFields.map((field) => (
          <div className="product-filters__section" key={field.key}>
            <label
              className="product-filters__label"
              htmlFor={`${id}-${field.key}`}
            >
              {field.label}
            </label>
            <select
              id={`${id}-${field.key}`}
              className="form-select product-filters__select"
              value={value[field.key]}
              disabled={!options}
              onChange={(event) =>
                onChange({ ...value, [field.key]: event.currentTarget.value })
              }
            >
              <option value="">{field.all}</option>
              {value[field.key] &&
                !field.options.some(
                  (option) => option.value === value[field.key],
                ) && (
                  <option value={value[field.key]}>{value[field.key]}</option>
                )}
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ))}
        {optionsError ? (
          <div className="product-filters__message" role="alert">
            <p>
              {options
                ? "Não foi possível atualizar os filtros. A mostrar as opções anteriores."
                : "Não foi possível carregar as categorias, os produtores e as localidades."}
            </p>
            <Button
              className="product-filters__action"
              icon={faRotateRight}
              onClick={onRetry}
            >
              Tentar novamente
            </Button>
          </div>
        ) : (
          !options && (
            <p className="product-filters__message" role="status">
              A carregar opções dos filtros…
            </p>
          )
        )}
        <footer className="product-filters__footer">
          <Button
            className="product-filters__action product-filters__clear"
            variant="cream"
            onClick={onClear}
            disabled={!activeCount}
          >
            Limpar filtros
          </Button>
          <Button
            className="product-filters__action product-filters__results"
            icon={faArrowRight}
            iconPosition="end"
            onClick={() => {
              onClose();
              window.requestAnimationFrame(onViewResults);
            }}
          >
            Ver resultados
          </Button>
        </footer>
      </div>
    </aside>
  );
}

export default ProductFilters;
