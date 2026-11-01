export function requireObjectBody(request, response, next) {
  if (
    request.emptyJsonBody ||
    !request.body ||
    typeof request.body !== "object" ||
    Array.isArray(request.body)
  ) {
    return response
      .status(400)
      .json({ erro: "O corpo do pedido deve ser um objeto JSON." });
  }
  next();
}
