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
  const producerLink =
    item?.produtorId && `/admin/utilizadores/${item.produtorId._id}`;
  return (
    <>
      <div className="admin-page__actions">
        <Button href={backUrl} variant="cream">
          Voltar à lista
        </Button>
        <Button variant="cream" onClick={refresh}>
          Atualizar
        </Button>
      </div>
      {error && (
        <div className="admin-page__error" role="alert">
          <p>
            {error}
            {item && " A mostrar os dados anteriores."}
          </p>
          <Button onClick={refresh}>Tentar novamente</Button>
        </div>
      )}
      {loading && !item && <LoadingPlaceholder label="A carregar detalhe…" />}
      {item && (
        <>
          <section className="admin-page__panel">
            <h2>{item.nome || item.lote || "Avaliação"}</h2>
            <p className="admin-page__reference">Referência: {item._id}</p>
            {user && (
              <>
                <dl className="admin-page__facts">
                  <div>
                    <dt>Email</dt>
                    <dd>{item.email}</dd>
                  </div>
                  <div>
                    <dt>Papel</dt>
                    <dd>{item.papel}</dd>
                  </div>
                  <div>
                    <dt>Registo</dt>
                    <dd>{adminDate(item.createdAt)}</dd>
                  </div>
                </dl>
                {item.perfilProdutor && (
                  <>
                    <h3>Perfil do produtor</h3>
                    <p className="admin-page__text">
                      {item.perfilProdutor.descricao || "Sem descrição."}
                    </p>
                    <dl className="admin-page__facts">
                      <div>
                        <dt>Aprovação</dt>
                        <dd>{item.perfilProdutor.validacao}</dd>
                      </div>
                      <div>
                        <dt>Localidade</dt>
                        <dd>{item.perfilProdutor.localidade}</dd>
                      </div>
                      <div>
                        <dt>Morada</dt>
                        <dd>{item.perfilProdutor.morada}</dd>
                      </div>
                      <div>
                        <dt>Coordenadas</dt>
                        <dd>
                          {item.perfilProdutor.coordenadas.latitude} ·{" "}
                          {item.perfilProdutor.coordenadas.longitude}
                        </dd>
                      </div>
                    </dl>
                  </>
                )}
                <div className="admin-page__actions">
                  {item.papel === "produtor" && (
                    <>
                      <Button
                        variant="cream"
                        href={`/admin/produtos?produtorId=${item._id}`}
                      >
                        Produtos do produtor
                      </Button>
                      <Button
                        variant="cream"
                        href={`/admin/leiloes?estado=&produtorId=${item._id}`}
                      >
                        Leilões do produtor
                      </Button>
                    </>
                  )}
                  {item.papel !== "administrador" && (
                    <Button
                      variant="cream"
                      href={`/admin/encomendas?${item.papel === "produtor" ? "produtorId" : "compradorId"}=${item._id}`}
                    >
                      Encomendas do utilizador
                    </Button>
                  )}
                </div>
              </>
            )}
            {section === "produtos" && (
              <>
                <ImageWithFallback
                  className="admin-page__image"
                  {...productImages({ nome: item.nome ?? "" })}
                  alt={item.nome ?? "Produto"}
                />
                <p className="admin-page__text">{item.descricao}</p>
                <dl className="admin-page__facts">
                  <div>
                    <dt>Categoria</dt>
                    <dd>{item.categoria}</dd>
                  </div>
                  <div>
                    <dt>Preço</dt>
                    <dd>
                      {adminMoney(item.preco)}/{item.unidade}
                    </dd>
                  </div>
                  <div>
                    <dt>Stock</dt>
                    <dd>
                      {item.stock} {item.unidade}
                    </dd>
                  </div>
                  <div>
                    <dt>Publicação do produtor</dt>
                    <dd>{item.publicado ? "Publicado" : "Despublicado"}</dd>
                  </div>
                  <div>
                    <dt>Bloqueio administrativo</dt>
                    <dd>{item.bloqueado ? "Bloqueado" : "Sem bloqueio"}</dd>
                  </div>
                  <div>
                    <dt>Visibilidade pública</dt>
                    <dd>{item.visivel ? "Visível" : "Indisponível"}</dd>
                  </div>
                  <div>
                    <dt>Épocas</dt>
                    <dd>{item.epoca?.join(", ") || "—"}</dd>
                  </div>
                  <div>
                    <dt>Biológico</dt>
                    <dd>{item.biologico ? "Sim" : "Não"}</dd>
                  </div>
                  <div>
                    <dt>Validade</dt>
                    <dd>{adminDate(item.dataValidade)}</dd>
                  </div>
                </dl>
              </>
            )}
            {section === "avaliacoes" && (
              <>
                <h3>Denúncias ({item.totalDenuncias ?? 0})</h3>
                {item.denuncias?.length ? (
                  <ul>
                    {item.denuncias.map((report, index) => (
                      <li key={`${report.autorId?._id ?? "removed"}-${index}`}>
                        <p>
                          {referenceName(report.autorId)} ·{" "}
                          {adminDate(report.data)}
                        </p>
                        <p className="admin-page__text">{report.motivo}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Sem denúncias registadas.</p>
                )}
                <p className="admin-page__text">{item.comentario}</p>
                <dl className="admin-page__facts">
                  <div>
                    <dt>Classificação</dt>
                    <dd>{item.classificacao}/5</dd>
                  </div>
                  <div>
                    <dt>Autor</dt>
                    <dd>
                      {item.autorId ? (
                        <InternalLink
                          href={`/admin/utilizadores/${item.autorId._id}`}
                        >
                          {referenceName(item.autorId)}
                        </InternalLink>
                      ) : (
                        "Indisponível"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Alvo</dt>
                    <dd>
                      {item.produtoId ? (
                        <InternalLink
                          href={`/admin/produtos/${item.produtoId._id}`}
                        >
                          {referenceName(item.produtoId)}
                        </InternalLink>
                      ) : (
                        referenceName(item.produtorId)
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Encomenda</dt>
                    <dd>
                      {item.encomendaId ? (
                        <InternalLink
                          href={`/admin/encomendas/${item.encomendaId}`}
                        >
                          {item.encomendaId}
                        </InternalLink>
                      ) : (
                        "Indisponível"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Estado</dt>
                    <dd>{item.estado}</dd>
                  </div>
                  <div>
                    <dt>Data</dt>
                    <dd>{adminDate(item.createdAt)}</dd>
                  </div>
                </dl>
              </>
            )}
            {section === "leiloes" && (
              <>
                <dl className="admin-page__facts">
                  <div>
                    <dt>Estado</dt>
                    <dd>{item.estado}</dd>
                  </div>
                  <div>
                    <dt>Visibilidade pública</dt>
                    <dd>{item.visivel ? "Visível" : "Indisponível"}</dd>
                  </div>
                  <div>
                    <dt>Início</dt>
                    <dd>{adminDate(item.dataInicio)}</dd>
                  </div>
                  <div>
                    <dt>Fim</dt>
                    <dd>{adminDate(item.dataFim)}</dd>
                  </div>
                  <div>
                    <dt>Preço base</dt>
                    <dd>{adminMoney(item.precoBase)}</dd>
                  </div>
                  <div>
                    <dt>Incremento</dt>
                    <dd>{adminMoney(item.incremento)}</dd>
                  </div>
                  <div>
                    <dt>Valor atual</dt>
                    <dd>{adminMoney(item.licitacaoAtual?.valor)}</dd>
                  </div>
                  <div>
                    <dt>Comprador do lance atual</dt>
                    <dd>
                      {item.licitacaoAtual?.compradorId ? (
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
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Reserva</dt>
                    <dd>{item.reservaStock}</dd>
                  </div>
                  {item.motivoCancelamento && (
                    <div>
                      <dt>Motivo do cancelamento</dt>
                      <dd>{item.motivoCancelamento}</dd>
                    </div>
                  )}
                </dl>
                <h3>Produtos do lote</h3>
                <ul>
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
                      )}{" "}
                      · {line.quantidade} {line.unidade}
                    </li>
                  ))}
                </ul>
                <h3>Últimas 20 licitações</h3>
                {item.licitacoes?.length ? (
                  <ol>
                    {item.licitacoes.map((bid) => (
                      <li key={bid._id}>
                        {adminMoney(bid.valor)} ·{" "}
                        {referenceName(bid.compradorId)} ·{" "}
                        {adminDate(bid.createdAt)}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>Sem licitações.</p>
                )}
              </>
            )}
            {producerLink && (
              <p>
                Produtor:{" "}
                <InternalLink href={producerLink}>
                  {referenceName(item.produtorId)}
                </InternalLink>
              </p>
            )}
          </section>
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
                  label: item.bloqueado ? "Repor produto" : "Ocultar produto",
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
        </>
      )}
    </>
  );
}
