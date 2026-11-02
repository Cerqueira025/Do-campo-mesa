import mongoose from "mongoose";
import Product from "../models/Product.js";
import User from "../models/User.js";
import Review from "../models/Review.js";

export const publicReviewFields = "autorId classificacao comentario createdAt";

export function ratingSummary(rating) {
  return {
    media: rating?.total ? Math.round(rating.media * 100) / 100 : null,
    total: rating?.total || 0,
  };
}

export async function withProductRatings(products) {
  if (!products.length) return [];
  const ratings = await Review.aggregate([
    {
      $match: {
        produtoId: {
          $in: products.map(
            (product) => new mongoose.Types.ObjectId(product._id),
          ),
        },
        estado: "publicada",
      },
    },
    {
      $group: {
        _id: "$produtoId",
        media: { $avg: "$classificacao" },
        total: { $sum: 1 },
      },
    },
  ]);
  const summaries = new Map(ratings.map((item) => [String(item._id), item]));
  return products.map((product) => ({
    ...(product.toObject ? product.toObject() : product),
    avaliacao: ratingSummary(summaries.get(String(product._id))),
  }));
}

export async function publicReviewTarget({ produtoId, produtorId }) {
  if (produtoId) {
    const product = await Product.findOne({
      _id: produtoId,
      publicado: true,
      bloqueado: { $ne: true },
    })
      .select("produtorId")
      .populate({
        path: "produtorId",
        select: "_id",
        match: { papel: "produtor", "perfilProdutor.validacao": "aceite" },
      })
      .lean();
    return Boolean(product?.produtorId);
  }
  return Boolean(
    produtorId &&
    (await User.exists({
      _id: produtorId,
      papel: "produtor",
      "perfilProdutor.validacao": "aceite",
    })),
  );
}
