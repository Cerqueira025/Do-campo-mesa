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
        ["Pedido", adminDate(item.createdAt)],
      ];
    case "utilizadores":
      return [
        ["Email", item.email],
        ["Papel", item.papel],
        ["Aprovação", item.perfilProdutor?.validacao ?? "—"],
        ["Registo", adminDate(item.createdAt)],
      ];
    case "produtos":
      return [
        ["Produtor", referenceName(item.produtorId)],
        ["Categoria", item.categoria],
        ["Preço", `${adminMoney(item.preco)}/${item.unidade}`],
        ["Stock", item.stock],
        ["Publicação", item.publicado ? "Publicado" : "Despublicado"],
        ["Bloqueio", item.bloqueado ? "Bloqueado" : "Sem bloqueio"],
        ["Visibilidade pública", item.visivel ? "Visível" : "Indisponível"],
      ];
    case "avaliacoes":
      return [
        ["Nota", `${item.classificacao}/5`],
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
        ["Estado", item.estado],
        [
          "Última decisão",
          item.ultimaDecisao
            ? `${referenceName(item.ultimaDecisao.administradorId)} · ${adminDate(item.ultimaDecisao.data)}`
            : "Sem decisão registada",
        ],
      ];
    case "encomendas":
      return [
        ["Comprador", referenceName(item.compradorId)],
        ["Produtor", referenceName(item.produtorId)],
        ["Data", adminDate(item.createdAt)],
        ["Total", adminMoney(item.total)],
        ["Estado", item.estado],
        ["Origem", item.leilaoId ? "Leilão" : "Catálogo"],
      ];
    case "leiloes":
      return [
        ["Produtor", referenceName(item.produtorId)],
        ["Início", adminDate(item.dataInicio)],
        ["Fim", adminDate(item.dataFim)],
        ["Valor atual", adminMoney(item.licitacaoAtual?.valor)],
        ["Estado", item.estado],
        ["Visibilidade pública", item.visivel ? "Visível" : "Indisponível"],
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
  useEffect(() => {
    if (!data || page <= 1 || data.items.length || error) return;
    const last = Math.max(1, Math.ceil(data.total / 24));
    if (page > last) {
      const query = new URLSearchParams(search);
      if (last > 1) query.set("page", String(last));
      else query.delete("page");
      navigate(`/admin/${section}${query.size ? `?${query}` : ""}`, {
        replace: true,
        preserveScroll: true,
      });
    }
  }, [data, page, section, search, error]);

  function select(
    name: string,
    label: string,
    options: { value: string; label: string }[],
  ) {
    const id = `admin-${section}-${name}`;
    return (
      <FormField key={name} id={id} label={label}>
        <select
          id={id}
          value={params.get(name) ?? ""}
          onChange={(event) => update(name, event.target.value)}
        >
          <option value="">Todos</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>
    );
  }
  const options = (values: string[]) =>
    values.map((value) => ({ value, label: value }));
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
      <div className="admin-page__toolbar">
        <SearchBar
          label={`Pesquisar ${title.toLowerCase()}`}
          placeholder={`Pesquisar ${title.toLowerCase()}`}
          value={
            draft.location === location ? draft.value : (params.get("q") ?? "")
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
        <Button variant="cream" onClick={refresh}>
          Atualizar
        </Button>
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
            {select("categoria", "Categoria", options(data?.categorias ?? []))}
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
              A mostrar {data.items.length} de {data.total} registos. Página{" "}
              {data.page} de {Math.max(1, Math.ceil(data.total / 24))}.
            </p>
            {data.items.length === 0 ? (
              <p className="admin-page__panel">
                Não há registos para a pesquisa e os filtros selecionados.
              </p>
            ) : (
              <>
                {section !== "avaliacoes" && (
                  <div className="admin-page__table">
                    <table aria-label={title}>
                      <thead>
                        <tr>
                          <th scope="col">
                            {section === "encomendas" ? "Referência" : "Nome"}
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
                          {...productImages({ nome: item.nome ?? "" })}
                          alt={item.nome ?? "Produto"}
                        />
                      )}
                      <h2>
                        <InternalLink
                          data-navigation-id={`admin-card-${item._id}`}
                          href={link(item)}
                        >
                          {titleOf(item)}
                        </InternalLink>
                      </h2>
                      {item.comentario && (
                        <p className="admin-page__text">{item.comentario}</p>
                      )}
                      <dl className="admin-page__facts">
                        {recordFacts(section, item).map(([label, value]) => (
                          <div key={label}>
                            <dt>{label}</dt>
                            <dd>{value ?? "—"}</dd>
                          </div>
                        ))}
                      </dl>
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
            <nav aria-label="Paginação" className="admin-page__actions">
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
            </nav>
          </>
        )}
      </div>
    </>
  );
}
