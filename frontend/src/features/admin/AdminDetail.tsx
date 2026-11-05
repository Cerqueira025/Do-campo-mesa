import type { ReactNode } from "react";
import Button from "../../components/ui/Button";
import LoadingPlaceholder from "../../components/ui/LoadingPlaceholder";
import ImageWithFallback from "../../components/ui/ImageWithFallback";
import InternalLink from "../../navigation/InternalLink";
import { productImages } from "../products/product";
import {
  adminSections,
  adminDate,
  adminMoney,
  referenceName,
  type AdminRecord,
  type AdminSection,
} from "./admin";
import { useAdminData } from "./useAdminData";
import DecisionPanel from "./DecisionPanel";
import AdminStatus from "./AdminStatus";
import AdminOrderStatus from "./AdminOrderStatus";

function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="admin-page__facts">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function AdminDetail({
  section,
  id,
  backUrl,
}: {
  section: AdminSection;
  id: string;
  backUrl: string;
}) {
  const {
    data: item,
    error,
    loading,
    refresh,
  } = useAdminData<AdminRecord>(
    `/admin/${adminSections[section].resource}/${id}`,
    section === "leiloes",
  );
  const user = section === "produtores" || section === "utilizadores";
  const hasDecision =
    section === "produtos" ||
    section === "avaliacoes" ||
    (user && item?.papel === "produtor");
  return (
    <>
      <div className="admin-page__actions">
        <InternalLink href={backUrl}>← Voltar à lista</InternalLink>
      </div>
      {error && (
        <div className="admin-page__error" role="alert">
          <p>
            {error}
            {item && " A mostrar os dados anteriores."}
          </p>
          <Button variant="cream" onClick={refresh}>
            Tentar novamente
          </Button>
        </div>
      )}
      {loading && !item && <LoadingPlaceholder label="A carregar detalhe…" />}
      {item && (
        <div
          className={`admin-page__detail${hasDecision ? " admin-page__detail--with-decision" : ""}`}
        >
          <section className="admin-page__panel admin-page__detail-info">
            <div className="admin-page__detail-heading">
              <h2>{item.nome || item.lote || "Avaliação"}</h2>
              {section === "encomendas" ? (
                <AdminOrderStatus value={item.estado} />
              ) : (
                (item.estado || item.perfilProdutor) && (
                  <AdminStatus
                    value={item.estado || item.perfilProdutor?.validacao}
                  />
                )
              )}
              {section === "produtos" && (
                <AdminStatus
                  value={item.visivel ? "Visível" : "Indisponível"}
                />
              )}
            </div>
            <p className="admin-page__reference">Referência: {item._id}</p>
            {user && (
              <>
                <Facts
                  items={[
                    ["Email", item.email],
                    ["Papel", item.papel],
                    ["Registo", adminDate(item.createdAt)],
                  ]}
                />
                {item.perfilProdutor && (
                  <>
                    <h3>Perfil do produtor</h3>
                    <p className="admin-page__text">
                      {item.perfilProdutor.descricao || "Sem descrição."}
                    </p>
                    <Facts
                      items={[
                        [
                          "Aprovação",
                          <AdminStatus value={item.perfilProdutor.validacao} />,
                        ],
                        ["Localidade", item.perfilProdutor.localidade],
                        ["Morada", item.perfilProdutor.morada],
                        [
                          "Coordenadas",
                          `${item.perfilProdutor.coordenadas.latitude} · ${item.perfilProdutor.coordenadas.longitude}`,
                        ],
                      ]}
                    />
                  </>
                )}
              </>
            )}
            {section === "produtos" && (
              <>
                <ImageWithFallback
                  className="admin-page__image"
                  {...productImages({
                    nome: item.nome ?? "",
                    fotografia: item.fotografia,
                  })}
                  alt={item.nome ?? "Produto"}
                />
                <p className="admin-page__text">{item.descricao}</p>
                <Facts
                  items={[
                    ["Categoria", item.categoria],
                    ["Preço", `${adminMoney(item.preco)}/${item.unidade}`],
                    ["Stock", `${item.stock} ${item.unidade}`],
                    [
                      "Publicação do produtor",
                      <AdminStatus
                        value={item.publicado ? "Publicado" : "Despublicado"}
                      />,
                    ],
                    [
                      "Bloqueio administrativo",
                      <AdminStatus
                        value={item.bloqueado ? "Bloqueado" : "Sem bloqueio"}
                      />,
                    ],
                    [
                      "Visibilidade pública",
                      <AdminStatus
                        value={item.visivel ? "Visível" : "Indisponível"}
                      />,
                    ],
                    ["Épocas", item.epoca?.join(", ") || "—"],
                    ["Biológico", item.biologico ? "Sim" : "Não"],
                    ["Validade", adminDate(item.dataValidade)],
                  ]}
                />
              </>
            )}
            {section === "avaliacoes" && (
              <>
                <p className="admin-page__rating">
                  Classificação: <strong>{item.classificacao}/5</strong>
                </p>
                <p className="admin-page__text">
                  {item.comentario || "Sem comentário."}
                </p>
                <Facts
                  items={[
                    [
                      "Autor",
                      item.autorId ? (
                        <InternalLink
                          href={`/admin/utilizadores/${item.autorId._id}`}
                        >
                          {referenceName(item.autorId)}
                        </InternalLink>
                      ) : (
                        "Indisponível"
                      ),
                    ],
                    [
                      "Alvo",
                      item.produtoId ? (
                        <InternalLink
                          href={`/admin/produtos/${item.produtoId._id}`}
                        >
                          {referenceName(item.produtoId)}
                        </InternalLink>
                      ) : item.produtorId ? (
                        <InternalLink
                          href={`/admin/utilizadores/${item.produtorId._id}`}
                        >
                          {referenceName(item.produtorId)}
                        </InternalLink>
                      ) : (
                        "Indisponível"
                      ),
                    ],
                    [
                      "Encomenda",
                      item.encomendaId ? (
                        <InternalLink
                          href={`/admin/encomendas/${item.encomendaId}`}
                        >
                          {item.encomendaId}
                        </InternalLink>
                      ) : (
                        "Indisponível"
                      ),
                    ],
                    ["Estado", <AdminStatus value={item.estado} />],
                    ["Data", adminDate(item.createdAt)],
                  ]}
                />
                <section
                  className="admin-page__reports"
                  aria-labelledby="admin-reports-title"
                >
                  <h3 id="admin-reports-title">
                    Denúncias ({item.totalDenuncias ?? 0})
                  </h3>
                  {item.denuncias?.length ? (
                    <ul>
                      {item.denuncias.map((report, index) => (
                        <li
                          key={`${report.autorId?._id ?? "removed"}-${index}`}
                        >
                          <p>
                            <strong>{referenceName(report.autorId)}</strong> ·{" "}
                            {adminDate(report.data)}
                          </p>
                          <p className="admin-page__text">{report.motivo}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>Sem denúncias registadas.</p>
                  )}
                </section>
              </>
            )}
            {section === "leiloes" && (
              <Facts
                items={[
                  ["Estado", <AdminStatus value={item.estado} />],
                  [
                    "Visibilidade pública",
                    <AdminStatus
                      value={item.visivel ? "Visível" : "Indisponível"}
                    />,
                  ],
                  ["Início", adminDate(item.dataInicio)],
                  ["Fim", adminDate(item.dataFim)],
                  ["Preço base", adminMoney(item.precoBase)],
                  ["Incremento", adminMoney(item.incremento)],
                  ["Valor atual", adminMoney(item.licitacaoAtual?.valor)],
                  [
                    "Comprador do lance atual",
                    item.licitacaoAtual?.compradorId ? (
                      <InternalLink
                        href={`/admin/utilizadores/${item.licitacaoAtual.compradorId._id}`}
                      >
                        {referenceName(item.licitacaoAtual.compradorId)}
                      </InternalLink>
                    ) : (item.licitacaoAtual?.valor ?? 0) >
                      (item.precoBase ?? 0) ? (
                      "Comprador indisponível"
                    ) : (
                      "Sem licitações"
                    ),
                  ],
                  ["Reserva", item.reservaStock],
                  ...(item.motivoCancelamento
                    ? [
                        ["Motivo do cancelamento", item.motivoCancelamento] as [
                          string,
                          ReactNode,
                        ],
                      ]
                    : []),
                ]}
              />
            )}
          </section>
          {hasDecision && (
            <div className="admin-page__detail-decision">
              {user && item.papel === "produtor" && (
                <DecisionPanel
                  item={item}
                  path={`/producers/${id}/validacao`}
                  onSaved={refresh}
                  actions={
                    item.perfilProdutor?.validacao === "pendente"
                      ? [
                          {
                            label: "Aprovar produtor",
                            body: { validacao: "aceite" },
                            reason: false,
                          },
                          {
                            label: "Rejeitar produtor",
                            body: { validacao: "rejeitado" },
                            reason: true,
                          },
                        ]
                      : []
                  }
                />
              )}
              {section === "produtos" && (
                <DecisionPanel
                  item={item}
                  path={`/admin/products/${id}/moderacao`}
                  onSaved={refresh}
                  actions={[
                    {
                      label: item.bloqueado
                        ? "Repor produto"
                        : "Ocultar produto",
                      body: { bloqueado: !item.bloqueado },
                      reason: !item.bloqueado,
                    },
                  ]}
                />
              )}
              {section === "avaliacoes" && (
                <DecisionPanel
                  item={item}
                  path={`/reviews/${id}/moderacao`}
                  onSaved={refresh}
                  actions={[
                    ...(item.estado !== "oculta"
                      ? [
                          {
                            label: "Ocultar avaliação",
                            body: { estado: "oculta" },
                            reason: true,
                          },
                        ]
                      : []),
                    ...(item.estado !== "publicada"
                      ? [
                          {
                            label: "Republicar avaliação",
                            body: { estado: "publicada" },
                            reason: false,
                          },
                        ]
                      : []),
                  ]}
                />
              )}
            </div>
          )}
          {(user || item.produtorId || section === "leiloes") && (
            <div className="admin-page__detail-related">
              {(user || item.produtorId) && (
                <section className="admin-page__panel">
                  <h2>Atividade relacionada</h2>
                  {item.produtorId && (
                    <p>
                      Produtor:{" "}
                      <InternalLink
                        href={`/admin/utilizadores/${item.produtorId._id}`}
                      >
                        {referenceName(item.produtorId)}
                      </InternalLink>
                    </p>
                  )}
                  {user && (
                    <div className="admin-page__related-links">
                      {item.papel === "produtor" && (
                        <>
                          <InternalLink
                            href={`/admin/produtos?produtorId=${item._id}`}
                          >
                            Produtos do produtor →
                          </InternalLink>
                          <InternalLink
                            href={`/admin/leiloes?estado=&produtorId=${item._id}`}
                          >
                            Leilões do produtor →
                          </InternalLink>
                        </>
                      )}
                      {item.papel !== "administrador" && (
                        <InternalLink
                          href={`/admin/encomendas?${item.papel === "produtor" ? "produtorId" : "compradorId"}=${item._id}`}
                        >
                          Encomendas do utilizador →
                        </InternalLink>
                      )}
                    </div>
                  )}
                </section>
              )}
              {section === "leiloes" && (
                <>
                  <section className="admin-page__panel">
                    <h2>Produtos do lote</h2>
                    <ul className="admin-page__related-list">
                      {item.produtos?.map((line, index) => (
                        <li key={line.produtoId?._id ?? index}>
                          {line.produtoId ? (
                            <InternalLink
                              href={`/admin/produtos/${line.produtoId._id}`}
                            >
                              {line.produtoId.nome}
                            </InternalLink>
                          ) : (
                            "Produto indisponível"
                          )}
                          <span>
                            {line.quantidade} {line.unidade}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                  <section className="admin-page__panel">
                    <h2>Últimas 20 licitações</h2>
                    {item.licitacoes?.length ? (
                      <ol className="admin-page__bids">
                        {item.licitacoes.map((bid) => (
                          <li key={bid._id}>
                            <strong>{adminMoney(bid.valor)}</strong>
                            <span>
                              {referenceName(bid.compradorId)} ·{" "}
                              {adminDate(bid.createdAt)}
                            </span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p>Sem licitações.</p>
                    )}
                  </section>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
