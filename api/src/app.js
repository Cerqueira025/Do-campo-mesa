import express from "express";
import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";
import producerRoutes from "./routes/producers.js";
import orderRoutes from "./routes/orders.js";
import reviewRoutes from "./routes/reviews.js";
import auctionRoutes from "./routes/auctions.js";
import adminRoutes from "./routes/admin.js";

const app = express();

app.use(
  express.json({
    limit: "100kb",
    // O parser transforma um corpo vazio em {}; preservar a distinção para as rotas.
    verify(request, _response, buffer) {
      request.emptyJsonBody = buffer.length === 0;
    },
  }),
);

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/producers", producerRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/auctions", auctionRoutes);
app.use("/api/admin", adminRoutes);

app.use((error, _request, response, _next) => {
  if (response.headersSent) return _next(error);
  if (error.code === 11000)
    return response
      .status(409)
      .json({ erro: "Já existe um registo com estes dados." });
  if (
    error.name === "ValidationError" ||
    error.name === "CastError" ||
    error.type === "entity.parse.failed" ||
    error.status === 413
  ) {
    return response
      .status(error.status === 413 ? 413 : 400)
      .json({ erro: error.message });
  }
  if (error.status)
    return response.status(error.status).json({ erro: error.message });
  console.error("Erro inesperado na API:", error.name || "Error");
  response.status(500).json({ erro: "Ocorreu um erro interno." });
});

export default app;
