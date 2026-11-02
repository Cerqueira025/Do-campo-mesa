import { Router } from "express";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import Review from "../models/Review.js";
import { requireAuth } from "../middleware/auth.js";
import { requireObjectBody } from "../middleware/requestBody.js";
import { prepareDecision, decisionConflict } from "../services/moderation.js";
import {
  publicReviewFields,
  publicReviewTarget,
  ratingSummary,
} from "../services/reviews.js";

const router = Router();

async function publicReviews(filter, response) {
  const [items, summary] = await Promise.all([
    Review.find({ ...filter, estado: "publicada" })
      .select(publicReviewFields)
      .sort({ createdAt: -1, _id: -1 })
      .populate("autorId", "nome"),
    Review.aggregate([
      { $match: { ...filter, estado: "publicada" } },
      {
        $group: {
          _id: null,
          media: { $avg: "$classificacao" },
          total: { $sum: 1 },
        },
      },
    ]),
  ]);
  response.json({
    items,
    ...ratingSummary(summary[0]),
  });
}

router.post(
  "/",
  requireAuth("comprador"),
  requireObjectBody,
  async (request, response, next) => {
    try {
      const { encomendaId, produtoId, produtorId, classificacao, comentario } =
        request.body || {};
      if (
        !mongoose.isValidObjectId(encomendaId) ||
        Boolean(produtoId) === Boolean(produtorId)
      ) {
        return response.status(400).json({
          erro: "Indica uma encomenda e um único produto ou produtor.",
        });
      }
      const order = await Order.findOne({
        _id: encomendaId,
        compradorId: request.user.id,
        estado: "entregue",
      });
      if (!order)
        return response.status(400).json({
          erro: "Só podes avaliar encomendas entregues que te pertencem.",
        });
      if (
        produtoId &&
        (!mongoose.isValidObjectId(produtoId) ||
          !order.linhas.some((line) => String(line.produtoId) === produtoId))
      ) {
        return response
          .status(400)
          .json({ erro: "O produto não pertence à encomenda." });
      }
      if (
        produtorId &&
        (!mongoose.isValidObjectId(produtorId) ||
          String(order.produtorId) !== produtorId)
      ) {
        return response
          .status(400)
          .json({ erro: "O produtor não pertence à encomenda." });
      }
      const review = await Review.create({
        autorId: request.user.id,
        encomendaId: order.id,
        ...(produtoId ? { produtoId } : { produtorId }),
        classificacao,
        comentario,
        estado: "publicada",
      });
      await review.populate("autorId", "nome");
      response.status(201).location(`/api/reviews/${review.id}`).json(review);
    } catch (error) {
      if (
        error.code === 11000 &&
        Object.keys(error.keyPattern || {}).length === 4 &&
        ["autorId", "encomendaId", "produtoId", "produtorId"].every(
          (field) => error.keyPattern[field] === 1,
        )
      ) {
        return response
          .status(409)
          .json({ erro: "Já avaliou este alvo nesta encomenda." });
      }
      next(error);
    }
  },
);

router.post(
  "/:id/denuncias",
  requireAuth("comprador", "produtor"),
  requireObjectBody,
  async (request, response, next) => {
    try {
      const { motivo } = request.body;
      if (
        typeof motivo !== "string" ||
        !motivo.trim() ||
        motivo.trim().length > 500
      )
        return response
          .status(400)
          .json({ erro: "Indique um motivo com até 500 caracteres." });
      if (!mongoose.isObjectIdOrHexString(request.params.id))
        return response.status(404).json({ erro: "Avaliação não encontrada." });
      const review = await Review.findById(request.params.id);
      if (!review || !(await publicReviewTarget(review)))
        return response.status(404).json({ erro: "Avaliação não encontrada." });
      if (String(review.autorId) === request.user.id)
        return response
          .status(403)
          .json({ erro: "Não pode denunciar a sua própria avaliação." });
      // A revisão temporal cresce mesmo quando duas escritas ocorrem no mesmo milissegundo.
      const updated = await Review.findOneAndUpdate(
        {
          _id: review._id,
          estado: { $in: ["publicada", "denunciada"] },
          "denuncias.autorId": { $ne: request.user.id },
        },
        [
          {
            $set: {
              estado: "denunciada",
              denuncias: {
                $concatArrays: [
                  { $ifNull: ["$denuncias", []] },
                  [
                    {
                      autorId: new mongoose.Types.ObjectId(request.user.id),
                      motivo: { $literal: motivo.trim() },
                      data: "$$NOW",
                    },
                  ],
                ],
              },
              updatedAt: {
                $max: [
                  "$$NOW",
                  { $add: [{ $ifNull: ["$updatedAt", new Date(0)] }, 1] },
                ],
              },
            },
          },
        ],
        { new: true, timestamps: false, updatePipeline: true },
      );
      if (!updated)
        return response.status(409).json({
          erro: "Já denunciou esta avaliação ou o seu estado foi alterado. Atualize os dados.",
        });
      response.status(201).json({ mensagem: "Denúncia registada." });
    } catch (error) {
      next(error);
    }
  },
);

router.get("/products/:id", async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.id))
      return response.status(404).json({ erro: "Produto não encontrado." });
    if (!(await publicReviewTarget({ produtoId: request.params.id })))
      return response.status(404).json({ erro: "Produto não encontrado." });
    await publicReviews(
      { produtoId: new mongoose.Types.ObjectId(request.params.id) },
      response,
    );
  } catch (error) {
    next(error);
  }
});

router.get("/producers/:id", async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.id))
      return response.status(404).json({ erro: "Produtor não encontrado." });
    if (!(await publicReviewTarget({ produtorId: request.params.id })))
      return response.status(404).json({ erro: "Produtor não encontrado." });
    await publicReviews(
      { produtorId: new mongoose.Types.ObjectId(request.params.id) },
      response,
    );
  } catch (error) {
    next(error);
  }
});

router.patch(
  "/:id/moderacao",
  requireAuth("administrador"),
  requireObjectBody,
  async (request, response, next) => {
    try {
      const { estado } = request.body;
      if (!["publicada", "oculta"].includes(estado))
        return response
          .status(400)
          .json({ erro: "A moderação deve publicar ou ocultar a avaliação." });
      if (!mongoose.isObjectIdOrHexString(request.params.id))
        return response.status(404).json({ erro: "Avaliação não encontrada." });
      const decision = prepareDecision(
        request.body,
        request.user.id,
        estado === "oculta",
      );
      if (request.body.atualizadoEm !== undefined) {
        const value = request.body.atualizadoEm;
        if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
          return response
            .status(400)
            .json({ erro: "Referência da avaliação inválida." });
        decision.filter.updatedAt = new Date(value);
      }
      const review = await Review.findOneAndUpdate(
        { _id: request.params.id, ...decision.filter },
        { $set: { estado, ultimaDecisao: decision.value } },
        { new: true, runValidators: true },
      ).populate("autorId", "nome");
      if (!review) {
        if (!(await Review.exists({ _id: request.params.id })))
          return response
            .status(404)
            .json({ erro: "Avaliação não encontrada." });
        return decisionConflict(response);
      }
      response.json(review);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
