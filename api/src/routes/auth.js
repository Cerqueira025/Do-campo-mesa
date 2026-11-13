import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { requireObjectBody } from "../middleware/requestBody.js";

const router = Router();
const validPassword = (password) =>
  typeof password === "string" &&
  password.length >= 8 &&
  Buffer.byteLength(password, "utf8") <= 72;
const passwordMessage =
  "A password deve ter pelo menos 8 caracteres e não ultrapassar 72 bytes em UTF-8.";
const tokenFor = (user) =>
  jwt.sign(
    {
      id: user.id,
      papel: user.papel,
      sessionVersion: user.sessionVersion ?? 0,
    },
    process.env.JWT_SECRET,
    { expiresIn: "2h" },
  );

router.post("/registo", requireObjectBody, async (request, response, next) => {
  try {
    const {
      nome,
      email,
      password,
      papel = "comprador",
      perfilProdutor,
    } = request.body || {};
    if (!validPassword(password)) {
      return response.status(400).json({ erro: passwordMessage });
    }
    if (
      typeof email !== "string" ||
      typeof nome !== "string" ||
      nome.trim().length < 2 ||
      nome.trim().length > 100
    ) {
      return response
        .status(400)
        .json({ erro: "Nome e email válidos são obrigatórios." });
    }
    if (!["comprador", "produtor"].includes(papel)) {
      return response
        .status(400)
        .json({ erro: "O papel deve ser comprador ou produtor." });
    }

    const producerProfile =
      papel === "produtor"
        ? {
            descricao: perfilProdutor?.descricao || "",
            localidade: perfilProdutor?.localidade,
            morada: perfilProdutor?.morada,
            coordenadas: perfilProdutor?.coordenadas,
            validacao: "pendente",
          }
        : undefined;

    const user = await User.create({
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      papel,
      passwordHash: await bcrypt.hash(password, 12),
      perfilProdutor: producerProfile,
    });
    response.status(201).json(user.publico());
  } catch (error) {
    next(error);
  }
});

router.post("/login", requireObjectBody, async (request, response, next) => {
  try {
    const { email, password } = request.body || {};
    if (typeof email !== "string" || typeof password !== "string") {
      return response
        .status(400)
        .json({ erro: "Email e password são obrigatórios." });
    }
    if (Buffer.byteLength(password, "utf8") > 72) {
      return response.status(401).json({ erro: "Credenciais inválidas." });
    }
    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select("+passwordHash +sessionVersion");
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return response.status(401).json({ erro: "Credenciais inválidas." });
    }
    response.json({ token: tokenFor(user), utilizador: user.publico() });
  } catch (error) {
    next(error);
  }
});

router.get("/eu", requireAuth(), (request, response) => {
  response.set("Cache-Control", "no-store").json(request.user.publico());
});

export default router;
