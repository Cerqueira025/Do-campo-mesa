import { Router } from "express";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import jwt from "jsonwebtoken";
import BackofficeCode from "../models/BackofficeCode.js";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { requireObjectBody } from "../middleware/requestBody.js";
import { checkServices } from "../services/serviceChecks.js";

const router = Router();
const validIdentifier = (value) =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
export const hashCode = (value) =>
  createHash("sha256").update(value).digest("hex");

router.post(
  "/admin/backoffice/codes",
  requireAuth("administrador"),
  requireObjectBody,
  async (req, res) => {
    if (!validIdentifier(req.body.state))
      return res.status(400).json({ erro: "Entrada inválida." });
    const secret = process.env.BACKOFFICE_SECRET;
    if (!secret || secret.length < 32)
      return res.status(503).json({ erro: "Backoffice não configurado." });
    const claims = req.authClaims;
    if (claims.exp <= Math.floor(Date.now() / 1000))
      return res.status(401).json({ erro: "Sessão expirada." });
    const code = randomBytes(32).toString("hex");
    const expiresAt = new Date(Math.min(Date.now() + 60000, claims.exp * 1000));
    await BackofficeCode.create({
      hash: hashCode(code),
      userId: req.user.id,
      state: req.body.state,
      expiresAt,
      tokenExpiresAt: claims.exp,
      sessionVersion: claims.sessionVersion ?? 0,
    });
    res.set("Cache-Control", "no-store").status(201).json({ code, expiresAt });
  },
);

router.post(
  "/internal/backoffice/exchange",
  (req, res, next) => {
    const expected = process.env.BACKOFFICE_SECRET;
    const supplied = req.get("X-Backoffice-Secret") || "";
    if (
      !expected ||
      expected.length < 32 ||
      !timingSafeEqual(
        Buffer.from(hashCode(expected)),
        Buffer.from(hashCode(supplied)),
      )
    ) {
      return res.status(401).json({ erro: "Integração não autorizada." });
    }
    next();
  },
  requireObjectBody,
  async (req, res) => {
    const { code, state } = req.body;
    if (!validIdentifier(code) || !validIdentifier(state))
      return res.status(400).json({ erro: "Entrada inválida." });
    const entry = await BackofficeCode.findOneAndDelete({
      hash: hashCode(code),
      state,
      expiresAt: { $gt: new Date() },
      tokenExpiresAt: { $gt: Math.floor(Date.now() / 1000) },
    });
    if (!entry)
      return res
        .status(401)
        .json({ erro: "Entrada expirada ou já utilizada." });
    const user = await User.findById(entry.userId).select("+sessionVersion");
    if (!user || user.papel !== "administrador")
      return res.status(403).json({ erro: "Sem permissão." });
    if ((entry.sessionVersion ?? 0) !== (user.sessionVersion ?? 0))
      return res.status(401).json({ erro: "Sessão revogada." });
    const token = jwt.sign(
      {
        id: user.id,
        papel: user.papel,
        exp: entry.tokenExpiresAt,
        sessionVersion: user.sessionVersion ?? 0,
      },
      process.env.JWT_SECRET,
      { algorithm: "HS256" },
    );
    res.set("Cache-Control", "no-store").json({
      token,
      expiresAt: entry.tokenExpiresAt,
      utilizador: user.publico(),
    });
  },
);

router.get(
  "/admin/services",
  requireAuth("administrador"),
  async (req, res) => {
    const address = req.socket.localPort;
    const results = await checkServices(`http://127.0.0.1:${address}`);
    res.set("Cache-Control", "no-store").json({ results });
  },
);

export default router;
