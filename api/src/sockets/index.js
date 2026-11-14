import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import Auction from "../models/Auction.js";
import Bid from "../models/Bid.js";
import Product from "../models/Product.js";
import { findPublicAuction } from "../services/publicAuction.js";

const room = (id) =>
  `leilao:${
    typeof id === "string" && mongoose.isObjectIdOrHexString(id)
      ? id.toLowerCase()
      : id
  }`;
const userRoom = (id) => `user:${id}`;

export function registerSockets(io) {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      socket.data.user = null;
      return next();
    }
    try {
      const claims = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ["HS256"],
      });
      if (
        typeof claims?.id !== "string" ||
        !mongoose.isObjectIdOrHexString(claims.id) ||
        typeof claims.exp !== "number"
      )
        throw new Error("Token inválido.");
      const user = await User.findById(claims.id).select(
        "nome papel +sessionVersion",
      );
      if (!user || (claims.sessionVersion ?? 0) !== (user.sessionVersion ?? 0))
        throw new Error("Sessão indisponível.");
      socket.data.user = {
        id: String(user._id),
        nome: user.nome,
        papel: user.papel,
        expiresAt: claims.exp * 1000,
      };
      next();
    } catch {
      next(new Error("Autenticação inválida ou expirada."));
    }
  });

  io.on("connection", (socket) => {
    socket.on("diagnostico", (nonce, acknowledge) => {
      if (
        typeof nonce === "string" &&
        nonce.length <= 64 &&
        typeof acknowledge === "function"
      ) {
        acknowledge(nonce);
      }
    });

    const user = socket.data.user;
    if (user) {
      socket.join(userRoom(user.id));
      const expiry = setTimeout(
        () => socket.disconnect(true),
        Math.max(0, user.expiresAt - Date.now()),
      );
      socket.on("disconnect", () => clearTimeout(expiry));
    }

    function presence(name) {
      io.to(name).emit(
        "presenca",
        io.sockets.adapter.rooms.get(name)?.size ?? 0,
      );
    }

    socket.on("entrar", async (id, acknowledge) => {
      acknowledge = typeof acknowledge === "function" ? acknowledge : undefined;
      try {
        if (!mongoose.isObjectIdOrHexString(id))
          throw new Error("Leilão não encontrado.");
        const auctionId = id.toLowerCase();
        const auction = await findPublicAuction(auctionId);
        if (!auction) throw new Error("Leilão não encontrado.");
        const previous = socket.data.auctionRoom;
        if (previous && previous !== room(id)) {
          socket.leave(previous);
          presence(previous);
        }
        socket.data.auctionRoom = room(id);
        socket.join(room(id));
        const bids = await Bid.find({ leilaoId: auctionId })
          .sort({ createdAt: -1 })
          .limit(20)
          .populate("compradorId", "nome")
          .lean();
        const ownBid =
          user?.papel === "comprador"
            ? await Bid.findOne({ leilaoId: auctionId, compradorId: user.id })
                .sort({ createdAt: -1 })
                .lean()
            : null;
        socket.emit("estado", {
          agora: new Date().toISOString(),
          leilao: auction,
          licitacoes: bids.map((bid) => ({
            _id: String(bid._id),
            valor: bid.valor,
            compradorId: String(bid.compradorId?._id ?? bid.compradorId),
            nome: bid.compradorId?.nome ?? "Comprador",
            createdAt: bid.createdAt,
          })),
          ultimaLicitacaoPropria: ownBid && {
            _id: String(ownBid._id),
            valor: ownBid.valor,
            compradorId: user.id,
            nome: user.nome,
            createdAt: ownBid.createdAt,
          },
        });
        presence(room(id));
        acknowledge?.({ ok: true });
      } catch (error) {
        acknowledge?.({
          ok: false,
          erro:
            error.message === "Leilão não encontrado."
              ? error.message
              : "Não foi possível entrar no leilão.",
        });
      }
    });

    socket.on("sair", (id) => {
      if (
        !mongoose.isObjectIdOrHexString(id) ||
        socket.data.auctionRoom !== room(id)
      )
        return;
      socket.leave(room(id));
      socket.data.auctionRoom = null;
      presence(room(id));
    });

    socket.on("disconnecting", () => {
      const name = socket.data.auctionRoom;
      if (name)
        io.to(name).emit(
          "presenca",
          Math.max(0, (io.sockets.adapter.rooms.get(name)?.size ?? 1) - 1),
        );
    });

    socket.on("licitar", async (input, acknowledge) => {
      acknowledge = typeof acknowledge === "function" ? acknowledge : undefined;
      const refuse = (erro) => acknowledge?.({ ok: false, erro });
      const { leilaoId, valor } = input ?? {};
      if (!user || user.papel !== "comprador" || user.expiresAt <= Date.now())
        return refuse("Inicie sessão como comprador para licitar.");
      if (
        !mongoose.isObjectIdOrHexString(leilaoId) ||
        socket.data.auctionRoom !== room(leilaoId)
      )
        return refuse("Entre no leilão para licitar.");
      const auctionId = leilaoId.toLowerCase();
      if (!Number.isSafeInteger(valor) || valor <= 0)
        return refuse("Indique um lance válido em cêntimos.");
      let session;
      try {
        const currentUser = await User.findOne({
          _id: user.id,
          papel: "comprador",
        }).select("_id");
        const publicLot = currentUser && (await findPublicAuction(auctionId));
        if (!publicLot || publicLot.estado !== "ativo")
          return refuse("O leilão não está ativo.");
        session = await mongoose.startSession();
        let bid = null;
        await session.withTransaction(async () => {
          bid = null;
          // Serialize bids against administrative hiding, just like auction creation.
          for (const line of [...publicLot.produtos].sort((a, b) =>
            String(a.produtoId._id).localeCompare(String(b.produtoId._id)),
          )) {
            const product = await Product.findOneAndUpdate(
              {
                _id: line.produtoId._id,
                publicado: true,
                bloqueado: { $ne: true },
              },
              { $inc: { revisaoLeiloes: 1 } },
              { session, timestamps: false },
            );
            if (!product) throw new Error("Produto indisponível.");
          }
          const now = new Date();
          const updated = await Auction.findOneAndUpdate(
            {
              _id: auctionId,
              estado: "ativo",
              reservaStock: "reservada",
              dataInicio: { $lte: now },
              dataFim: { $gt: now },
              "licitacaoAtual.valor": { $lte: valor - publicLot.incremento },
            },
            { $set: { licitacaoAtual: { valor, compradorId: user.id } } },
            { new: true, session, runValidators: true },
          );
          if (!updated) return;
          [bid] = await Bid.create(
            [{ leilaoId: auctionId, compradorId: user.id, valor }],
            { session, ordered: true },
          );
        });
        if (!bid) {
          const latest = await Auction.findById(auctionId)
            .select("estado reservaStock dataFim licitacaoAtual incremento")
            .lean();
          if (
            !latest ||
            latest.estado !== "ativo" ||
            latest.reservaStock !== "reservada" ||
            new Date(latest.dataFim) <= new Date()
          )
            return refuse("O leilão terminou.");
          return refuse(
            `Licitação mínima: ${((latest.licitacaoAtual.valor + latest.incremento) / 100).toFixed(2)} €.`,
          );
        }
        const payload = {
          _id: String(bid._id),
          valor,
          compradorId: user.id,
          nome: user.nome,
          createdAt: bid.createdAt,
        };
        io.to(room(leilaoId)).emit("nova-licitacao", payload);
        acknowledge?.({ ok: true, valor });
      } catch {
        refuse(
          "Não foi possível confirmar a licitação. Consulte o histórico antes de tentar novamente.",
        );
      } finally {
        await session?.endSession();
      }
    });
  });
}

export function emitAuctionTransition(io, event) {
  if (event.estado === "ativo")
    io.to(room(event.id)).emit("aberto", { id: event.id });
  if (event.estado === "cancelado")
    io.to(room(event.id)).emit("cancelado", {
      id: event.id,
      motivo: event.motivo,
    });
  if (event.estado === "terminado") {
    io.to(room(event.id)).emit("terminado", {
      id: event.id,
      valor: event.valor,
      vencedor: Boolean(event.vencedorId),
    });
    if (event.orderId) {
      io.to(userRoom(event.vencedorId)).emit("leilao-ganho", {
        id: event.id,
        encomendaId: event.orderId,
      });
      io.to(userRoom(event.produtorId)).emit("leilao-terminado", {
        id: event.id,
        encomendaId: event.orderId,
      });
    }
  }
}
