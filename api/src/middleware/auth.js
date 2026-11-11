import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";

export function requireAuth(...roles) {
  return async (request, response, next) => {
    const match = /^Bearer ([^\s]+)$/i.exec(request.get("authorization") || "");
    if (!match) {
      return response.status(401).json({ erro: "Autenticação necessária." });
    }

    let claims;
    try {
      claims = jwt.verify(match[1], process.env.JWT_SECRET, {
        algorithms: ["HS256"],
      });
      if (
        typeof claims !== "object" ||
        typeof claims.exp !== "number" ||
        typeof claims.id !== "string" ||
        !mongoose.isObjectIdOrHexString(claims.id)
      ) {
        throw new Error("Token inválido.");
      }
    } catch {
      return response.status(401).json({ erro: "Token inválido ou expirado." });
    }

    try {
      const user = await User.findById(claims.id).select(
        "nome email papel perfilProdutor.validacao +sessionVersion",
      );
      if (!user)
        return response
          .status(401)
          .json({ erro: "A conta já não está disponível." });
      if ((claims.sessionVersion ?? 0) !== (user.sessionVersion ?? 0))
        return response.status(401).json({ erro: "Sessão revogada." });
      if (roles.length && !roles.includes(user.papel)) {
        return response
          .status(403)
          .json({ erro: "Sem permissão para esta operação." });
      }
      request.user = user;
      request.authClaims = claims;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireApprovedProducer(request, response, next) {
  if (request.user.papel !== "produtor")
    return response
      .status(403)
      .json({ erro: "Apenas produtores podem executar esta operação." });
  if (request.user.perfilProdutor?.validacao !== "aceite") {
    return response
      .status(403)
      .json({ erro: "O produtor precisa de aprovação." });
  }
  next();
}
