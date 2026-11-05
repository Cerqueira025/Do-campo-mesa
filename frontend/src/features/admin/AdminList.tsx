import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Button from "../../components/ui/Button";
import SearchBar from "../../components/ui/input/SearchBar";
import FormField from "../../components/ui/input/FormField";
import Select from "../../components/ui/input/Select";
import LoadingPlaceholder from "../../components/ui/LoadingPlaceholder";
import ImageWithFallback from "../../components/ui/ImageWithFallback";
import InternalLink from "../../navigation/InternalLink";
import { navigate, restoreNavigation } from "../../navigation/navigation";
import { useLocation } from "../../navigation/useLocation";
import { productImages } from "../products/product";
import {
  adminSections,
  readAdminLocation,
  adminDetailHref,
  adminDate,
  adminMoney,
  referenceName,
  type AdminSection,
  type AdminRecord,
  type AdminListResponse,
} from "./admin";
import { useAdminData } from "./useAdminData";
import AdminStatus from "./AdminStatus";
import AdminOrderStatus from "./AdminOrderStatus";

const states = {
  avaliacoes: ["publicada", "denunciada", "oculta"],
  encomendas: ["pendente", "confirmada", "pronta", "entregue"],
  leiloes: ["agendado", "ativo", "terminado", "cancelado"],
};

function recordFacts(
  section: AdminSection,
  item: AdminRecord,
): [string, ReactNode][] {
  switch (section) {
    case "produtores":
      return [
        ["Email", item.email],
        ["Localidade", item.perfilProdutor?.localidade],
        ["Data do pedido", adminDate(item.createdAt)],
      ];
    case "utilizadores":
      return [
        ["Email", item.email],
        ["Papel", item.papel],
        ["Aprovação", <AdminStatus value={item.perfilProdutor?.validacao} />],
        ["Registo", adminDate(item.createdAt)],
      ];
    case "produtos":
      return [
        ["Produtor", referenceName(item.produtorId)],
        ["Categoria", item.categoria],
        [
          "Preço e stock",
          <div className="admin-page__cell-lines">
            <span>
              Preço: {adminMoney(item.preco)}/{item.unidade}
            </span>
            <span>
              Stock: {item.stock} {item.unidade}
            </span>
          </div>,
        ],
        [
          "Publicação e visibilidade",
          <div className="admin-page__cell-lines">
            <span>
              Publicação:{" "}
              <AdminStatus
                value={item.publicado ? "Publicado" : "Despublicado"}
              />
            </span>
            <span>
              Bloqueio:{" "}
              <AdminStatus
                value={item.bloqueado ? "Bloqueado" : "Sem bloqueio"}
              />
            </span>
            <span>
              Visibilidade:{" "}
              <AdminStatus value={item.visivel ? "Visível" : "Indisponível"} />
            </span>
          </div>,
        ],
      ];
    case "avaliacoes":
      return [
        ["Denúncias", item.totalDenuncias ?? 0],
        ["Autor", referenceName(item.autorId)],
        ["Alvo", referenceName(item.produtoId ?? item.produtorId)],
        [
          "Encomenda",
          item.encomendaId ? (
            <InternalLink href={`/admin/encomendas/${item.encomendaId}`}>
              {item.encomendaId}
            </InternalLink>
          ) : (
            "Indisponível"
          ),
        ],
        ["Data", adminDate(item.createdAt)],
        [
          "Última decisão",
          item.ultimaDecisao
            ? `${referenceName(item.ultimaDecisao.administradorId)} · ${adminDate(item.ultimaDecisao.data)}`
            : "Sem decisão registada",
        ],
      ];
    case "encomendas":
      return [
        [
          "Comprador e produtor",
          <div className="admin-page__cell-lines">
            <span>Comprador: {referenceName(item.compradorId)}</span>
            <span>Produtor: {referenceName(item.produtorId)}</span>
          </div>,
        ],
        ["Data", adminDate(item.createdAt)],
        ["Total", adminMoney(item.total)],
        ["Estado", <AdminOrderStatus value={item.estado} />],
        ["Origem", item.leilaoId ? "Leilão" : "Catálogo"],
      ];
    case "leiloes":
      return [
        ["Produtor", referenceName(item.produtorId)],
        [
          "Início e fim",
          <div className="admin-page__cell-lines">
            <span>Início: {adminDate(item.dataInicio)}</span>
            <span>Fim: {adminDate(item.dataFim)}</span>
          </div>,
        ],
        ["Valor atual", adminMoney(item.licitacaoAtual?.valor)],
        [
          "Estado e visibilidade",
          <div className="admin-page__cell-lines">
            <span>
              Estado: <AdminStatus value={item.estado} />
            </span>
            <span>
              Visibilidade:{" "}
              <AdminStatus value={item.visivel ? "Visível" : "Indisponível"} />
            </span>
          </div>,
        ],
      ];
  }
}

export default function AdminList({ section }: { section: AdminSection }) {
  const location = useLocation();
  const search = location.includes("?")
    ? location.slice(location.indexOf("?")).split("#")[0]
    : "";
  const params = readAdminLocation(section, search);
  const { resource, title } = adminSections[section];
  const { data, error, loading, refresh } = useAdminData<AdminListResponse>(
    `/admin/${resource}?${params}`,
    section === "encomendas" || section === "leiloes",
  );
  const [draft, setDraft] = useState({
    location,
    value: params.get("q") ?? "",
  });
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const results = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    restoreNavigation(!loading);
  }, [loading, location]);
  useEffect(() => () => clearTimeout(searchTimer.current), [location]);
  function update(name: string, value: string, page = 1, replace = false) {
    const next = new URLSearchParams(search);
    if (value || (section === "leiloes" && name === "estado"))
      next.set(name, value);
    else next.delete(name);
    if (page > 1) next.set("page", String(page));
    else next.delete("page");
    const query = next.toString();
    navigate(`/admin/${section}${query ? `?${query}` : ""}`, {
      replace,
      preserveScroll: true,
    });
  }
  const page = Number(params.get("page"));
  const filtered = [...params].some(
    ([key, value]) =>
      value &&
      !["page", "limit"].includes(key) &&
      !(section === "produtores" && ["papel", "validacao"].includes(key)),
  );
  function clearFilters() {
    clearTimeout(searchTimer.current);
    setDraft({ location, value: "" });
    const destination = `/admin/${section}${section === "leiloes" ? "?estado=" : ""}`;
    if (location !== destination)
      navigate(destination, { preserveScroll: true });
  }
  useEffect(() => {
    if (!data || error || data.page === page) return;
    const query = new URLSearchParams(search);
    if (data.page > 1) query.set("page", String(data.page));
    else query.delete("page");
    navigate(`/admin/${section}${query.size ? `?${query}` : ""}`, {
      replace: true,
      preserveScroll: true,
    });
  }, [data, page, section, search, error]);

  function select(
    name: string,
    label: string,
    options: { value: string; label: string }[],
  ) {
    const id = `admin-${section}-${name}`;
    return (
      <FormField key={name} id={id} label={label} unframed compact={false}>
        <Select
          id={id}
          value={params.get(name) ?? ""}
          onValueChange={(value) => update(name, value)}
          options={[{ value: "", label: "Todos" }, ...options]}
        />
      </FormField>
    );
  }
  const options = (values: string[]) =>
    values.map((value) => ({
      value,
      label: value.charAt(0).toUpperCase() + value.slice(1),
    }));
  const columns = data?.items[0]
    ? recordFacts(section, data.items[0]).map(([label]) => label)
    : [];
  function titleOf(item: AdminRecord) {
    return (
      item.nome ||
      item.lote ||
      (section === "avaliacoes" ? "Avaliação" : `Encomenda ${item._id}`)
    );
  }
  function link(item: AdminRecord) {
    return adminDetailHref(section, item._id, location);
  }
  function changePage(next: number) {
    update("page", String(next), next);
    requestAnimationFrame(() => {
      results.current?.focus();
      results.current?.scrollIntoView({ block: "start" });
    });
  }
  return (
    <>
      <section
        className="admin-page__panel admin-page__query"
        aria-label="Pesquisa e filtros"
      >
        <div className="admin-page__toolbar">
          <SearchBar
            label={`Pesquisar ${title.toLowerCase()}`}
            placeholder={`Pesquisar ${title.toLowerCase()}`}
            value={
              draft.location === location
                ? draft.value
                : (params.get("q") ?? "")
            }
            onChange={(value) => {
              const text = value.slice(0, 100);
              setDraft({ location, value: text });
              clearTimeout(searchTimer.current);
              searchTimer.current = setTimeout(
                () => update("q", text.trim(), 1, true),
                250,
              );
            }}
          />
        </div>
        <div className="admin-page__filters">
          {section in states &&
            select(
              "estado",
              "Estado",
              options(states[section as keyof typeof states]),
            )}
          {section === "avaliacoes" &&
            select("alvo", "Tipo de alvo", [
              { value: "produto", label: "Produto" },
              { value: "produtor", label: "Produtor" },
            ])}
          {section === "utilizadores" && (
            <>
              {select(
                "papel",
                "Papel",
                options(["comprador", "produtor", "administrador"]),
              )}
              {select(
                "validacao",
                "Aprovação do produtor",
                options(["pendente", "aceite", "rejeitado"]),
              )}
            </>
          )}
          {section === "produtos" && (
            <>
              {select(
                "categoria",
                "Categoria",
                options(data?.categorias ?? []),
              )}
              {select("visibilidade", "Visibilidade", [
                { value: "publica", label: "Visível publicamente" },
                { value: "despublicado", label: "Despublicado pelo produtor" },
                { value: "bloqueado", label: "Bloqueado pelo administrador" },
                {
                  value: "produtor-indisponivel",
                  label: "Produtor indisponível",
                },
              ])}
            </>
          )}
          {section === "encomendas" &&
            select("origem", "Origem", [
              { value: "catalogo", label: "Catálogo" },
              { value: "leilao", label: "Leilão" },
            ])}
        </div>
        {(params.get("produtorId") || params.get("compradorId")) && (
          <p>
            Atividade filtrada por utilizador.{" "}
            <Button
              variant="cream"
              onClick={() => {
                const next = new URLSearchParams(search);
                next.delete("produtorId");
                next.delete("compradorId");
                next.delete("page");
                navigate(`/admin/${section}${next.size ? `?${next}` : ""}`);
              }}
            >
              Remover filtro de utilizador
            </Button>
          </p>
        )}
        <div className="admin-page__query-actions">
          <Button
            variant="cream"
            onClick={clearFilters}
            disabled={!filtered && !draft.value}
          >
            Limpar filtros
          </Button>
        </div>
      </section>
      <div
        ref={results}
        tabIndex={-1}
        className="admin-page__results"
        aria-busy={loading}
        data-navigation-ready={!loading}
      >
        {error && (
          <div className="admin-page__error" role="alert">
            <p>
              {error}
              {data && " A mostrar os dados anteriores."}
            </p>
            <Button onClick={refresh}>Tentar novamente</Button>
          </div>
        )}
        {loading && !data && (
          <LoadingPlaceholder label="A carregar registos…" />
        )}
        {data && (
          <>
            <p role="status">
              {data.total} {data.total === 1 ? "registo" : "registos"} · A
              mostrar {data.items.length}
            </p>
            {data.items.length === 0 ? (
              <div className="admin-page__panel admin-page__empty">
                <h2>{filtered ? "Sem resultados" : "Sem registos"}</h2>
                <p>
                  {filtered
                    ? "Não há registos para a pesquisa e os filtros selecionados."
                    : section === "produtores"
                      ? "Não há pedidos de produtores pendentes."
                      : "Ainda não há registos nesta lista."}
                </p>
                {filtered && (
                  <Button variant="cream" onClick={clearFilters}>
                    Limpar filtros
                  </Button>
                )}
              </div>
            ) : (
              <>
                {section !== "avaliacoes" && (
                  <div
                    className="admin-page__table"
                    role="region"
                    aria-label={`Tabela de ${title.toLowerCase()}`}
                    tabIndex={0}
                  >
                    <table aria-label={title}>
                      <thead>
                        <tr>
                          <th scope="col">
                            {section === "encomendas"
                              ? "Referência"
                              : section === "produtos"
                                ? "Produto"
                                : section === "leiloes"
                                  ? "Lote"
                                  : "Nome"}
                          </th>
                          {columns.map((column) => (
                            <th scope="col" key={column}>
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.items.map((item) => (
                          <tr key={item._id}>
                            <th scope="row">
                              <div
                                className={
                                  section === "produtos"
                                    ? "admin-page__product-name"
                                    : undefined
                                }
                              >
                                {section === "produtos" && (
                                  <ImageWithFallback
                                    className="admin-page__image"
                                    {...productImages({
                                      nome: item.nome ?? "",
                                      fotografia: item.fotografia,
                                    })}
                                    alt={item.nome ?? "Produto"}
                                  />
                                )}
                                <InternalLink
                                  data-navigation-id={`admin-${item._id}`}
                                  href={link(item)}
                                >
                                  {titleOf(item)}
                                </InternalLink>
                              </div>
                            </th>
                            {recordFacts(section, item).map(
                              ([label, value]) => (
                                <td key={label}>{value ?? "—"}</td>
                              ),
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <ul
                  className={`admin-page__cards${section === "avaliacoes" ? " admin-page__cards--always" : ""}`}
                >
                  {data.items.map((item) => (
                    <li key={item._id} className="admin-page__panel">
                      {section === "produtos" && (
                        <ImageWithFallback
                          className="admin-page__image"
                          {...productImages({
                            nome: item.nome ?? "",
                            fotografia: item.fotografia,
                          })}
                          alt={item.nome ?? "Produto"}
                        />
                      )}
                      <div className="admin-page__record-heading">
                        <h2>
                          <InternalLink
                            data-navigation-id={`admin-card-${item._id}`}
                            href={link(item)}
                          >
                            {section === "avaliacoes"
                              ? `Avaliação de ${referenceName(item.autorId)}`
                              : titleOf(item)}
                          </InternalLink>
                        </h2>
                        {section === "avaliacoes" && (
                          <div className="admin-page__review-state">
                            <AdminStatus value={item.estado} />
                            <strong>{item.classificacao}/5</strong>
                          </div>
                        )}
                      </div>
                      {item.comentario && (
                        <p className="admin-page__text">{item.comentario}</p>
                      )}
                      <dl className="admin-page__facts">
                        {recordFacts(section, item)
                          .filter(
                            ([label]) =>
                              section !== "avaliacoes" ||
                              label !== "Última decisão",
                          )
                          .map(([label, value]) => (
                            <div key={label}>
                              <dt>{label}</dt>
                              <dd>{value ?? "—"}</dd>
                            </div>
                          ))}
                      </dl>
                      {section === "avaliacoes" && (
                        <div className="admin-page__review-decision">
                          <h3>Última decisão</h3>
                          <p>
                            {item.ultimaDecisao
                              ? `${referenceName(item.ultimaDecisao.administradorId)} · ${adminDate(item.ultimaDecisao.data)}`
                              : "Sem decisão registada"}
                          </p>
                        </div>
                      )}
                      {section === "avaliacoes" &&
                        item.ultimaDecisao?.motivo && (
                          <p className="admin-page__text">
                            Motivo: {item.ultimaDecisao.motivo}
                          </p>
                        )}
                      <Button href={link(item)} variant="cream">
                        Consultar{section === "avaliacoes" ? " e moderar" : ""}
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <nav aria-label="Paginação" className="admin-page__pagination">
              <p>
                Página {data.page} de {Math.max(1, Math.ceil(data.total / 24))}
              </p>
              <div className="admin-page__actions">
                <Button
                  variant="cream"
                  disabled={page <= 1}
                  onClick={() => changePage(page - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="cream"
                  disabled={page * 24 >= data.total}
                  onClick={() => changePage(page + 1)}
                >
                  Seguinte
                </Button>
              </div>
            </nav>
          </>
        )}
      </div>
    </>
  );
}
