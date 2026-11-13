import { Router } from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Review from "../models/Review.js";
import { requireAuth } from "../middleware/auth.js";
import { requireObjectBody } from "../middleware/requestBody.js";
import { prepareDecision, decisionConflict } from "../services/moderation.js";
import { publicReviewFields, withProductRatings } from "../services/reviews.js";

const router = Router();
const publicFields =
  "nome perfilProdutor.descricao perfilProdutor.localidade perfilProdutor.coordenadas createdAt";
const profileFields = ["descricao", "localidade", "morada", "coordenadas"];
const privateFields = profileFields
  .map((field) => `perfilProdutor.${field}`)
  .join(" ");
const ownProfile = (producer) =>
  Object.fromEntries(
    profileFields.map((field) => [field, producer.perfilProdutor[field]]),
  );

router.get("/me", requireAuth("produtor"), async (request, response, next) => {
  try {
    const producer = await User.findOne({
      _id: request.user.id,
      papel: "produtor",
    }).select(privateFields);
    if (!producer)
      return response.status(404).json({ erro: "Produtor não encontrado." });
    response.set("Cache-Control", "no-store").json(ownProfile(producer));
  } catch (error) {
    next(error);
  }
});

router.patch(
  "/me",
  requireAuth("produtor"),
  requireObjectBody,
  async (request, response, next) => {
    try {
      const entries = Object.entries(request.body);
      if (
        !entries.length ||
        entries.some(([field]) => !profileFields.includes(field))
      )
        return response
          .status(400)
          .json({ erro: "Indique apenas os dados da exploração a alterar." });
      for (const [field, value] of entries) {
        if (field === "coordenadas") {
          if (
            !value ||
            typeof value !== "object" ||
            Array.isArray(value) ||
            Object.keys(value).some(
              (key) => !["latitude", "longitude"].includes(key),
            ) ||
            !Number.isFinite(value.latitude) ||
            !Number.isFinite(value.longitude) ||
            Math.abs(value.latitude) > 90 ||
            Math.abs(value.longitude) > 180
          )
            return response
              .status(400)
              .json({ erro: "Indique latitude e longitude válidas." });
        } else if (
          typeof value !== "string" ||
          (field !== "descricao" && !value.trim())
        ) {
          return response.status(400).json({
            erro: "A localidade e a morada são obrigatórias; a descrição deve ser texto.",
          });
        }
      }
      const producer = await User.findOneAndUpdate(
        { _id: request.user.id, papel: "produtor" },
        {
          $set: Object.fromEntries(
            entries.map(([field, value]) => [
              `perfilProdutor.${field}`,
              typeof value === "string" ? value.trim() : value,
            ]),
          ),
        },
        { new: true, runValidators: true },
      ).select(privateFields);
      if (!producer)
        return response.status(404).json({ erro: "Produtor não encontrado." });
      response.set("Cache-Control", "no-store").json(ownProfile(producer));
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/pendentes",
  requireAuth("administrador"),
  async (_request, response, next) => {
    try {
      const producers = await User.find({
        papel: "produtor",
        "perfilProdutor.validacao": "pendente",
      })
        .select("nome email perfilProdutor createdAt")
        .sort({ createdAt: 1 })
        .lean();
      response.json(producers);
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  "/:id/validacao",
  requireAuth("administrador"),
  requireObjectBody,
  async (request, response, next) => {
    try {
      const { validacao } = request.body || {};
      if (!["aceite", "rejeitado"].includes(validacao)) {
        return response
          .status(400)
          .json({ erro: "A validação deve ser aceite ou rejeitado." });
      }
      if (!mongoose.isValidObjectId(request.params.id))
        return response.status(404).json({ erro: "Produtor não encontrado." });
      const decision = prepareDecision(
        request.body,
        request.user.id,
        validacao === "rejeitado",
      );
      const producer = await User.findOneAndUpdate(
        {
          _id: request.params.id,
          papel: "produtor",
          "perfilProdutor.validacao": "pendente",
          ...decision.filter,
        },
        {
          $set: {
            "perfilProdutor.validacao": validacao,
            ultimaDecisao: decision.value,
          },
        },
        { new: true, runValidators: true },
      );
      if (!producer) {
        if (!(await User.exists({ _id: request.params.id, papel: "produtor" })))
          return response
            .status(404)
            .json({ erro: "Produtor não encontrado." });
        return decisionConflict(response);
      }
      response.json(producer.publico());
    } catch (error) {
      next(error);
    }
  },
);

router.get("/", async (_request, response, next) => {
  try {
    const producers = await User.find({
      papel: "produtor",
      "perfilProdutor.validacao": "aceite",
    })
      .select(publicFields)
      .sort({ nome: 1 })
      .lean();
    const ids = producers.map((producer) => producer._id);
    const [products, ratings] = await Promise.all([
      Product.aggregate([
        {
          $match: {
            produtorId: { $in: ids },
            publicado: true,
            bloqueado: { $ne: true },
          },
        },
        { $group: { _id: "$produtorId", total: { $sum: 1 } } },
      ]),
      Review.aggregate([
        { $match: { produtorId: { $in: ids }, estado: "publicada" } },
        {
          $group: {
            _id: "$produtorId",
            media: { $avg: "$classificacao" },
            total: { $sum: 1 },
          },
        },
      ]),
    ]);
    const counts = new Map(
      products.map((item) => [String(item._id), item.total]),
    );
    const averages = new Map(
      ratings.map((item) => [
        String(item._id),
        { media: Math.round(item.media * 100) / 100, total: item.total },
      ]),
    );
    response.json(
      producers.map((producer) => ({
        ...producer,
        produtos: counts.get(String(producer._id)) || 0,
        avaliacao: averages.get(String(producer._id)) || {
          media: null,
          total: 0,
        },
      })),
    );
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.id))
      return response.status(404).json({ erro: "Produtor não encontrado." });
    const producer = await User.findOne({
      _id: request.params.id,
      papel: "produtor",
      "perfilProdutor.validacao": "aceite",
    })
      .select(publicFields)
      .lean();
    if (!producer)
      return response.status(404).json({ erro: "Produtor não encontrado." });
    const [products, reviews] = await Promise.all([
      Product.find({
        produtorId: producer._id,
        publicado: true,
        bloqueado: { $ne: true },
      })
        .select("-imagens")
        .sort({ nome: 1 }),
      Review.find({ produtorId: producer._id, estado: "publicada" })
        .select(publicReviewFields)
        .sort({ createdAt: -1, _id: -1 })
        .populate("autorId", "nome"),
    ]);
    const rating = reviews.length
      ? Math.round(
          (reviews.reduce((sum, review) => sum + review.classificacao, 0) /
            reviews.length) *
            100,
        ) / 100
      : null;
    response.json({
      ...producer,
      produtos: await withProductRatings(products),
      avaliacoes: { media: rating, total: reviews.length, items: reviews },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
