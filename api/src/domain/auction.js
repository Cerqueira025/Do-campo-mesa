export function auctionState(auction, now) {
  if (auction.estado === "cancelado") return "cancelado";
  if (
    auction.estado === "terminado" ||
    now >= new Date(auction.dataFim).getTime()
  )
    return "terminado";
  return auction.estado === "ativo" &&
    auction.reservaStock === "reservada" &&
    now >= new Date(auction.dataInicio).getTime()
    ? "ativo"
    : "agendado";
}

export function auctionStateFilter(state, now) {
  const date = new Date(now);
  if (state === "cancelado") return { estado: "cancelado" };
  if (state === "terminado")
    return {
      estado: { $ne: "cancelado" },
      $or: [{ estado: "terminado" }, { dataFim: { $lte: date } }],
    };
  if (state === "agendado")
    return { estado: "agendado", dataFim: { $gt: date } };
  if (state === "ativo")
    return {
      estado: "ativo",
      reservaStock: "reservada",
      dataInicio: { $lte: date },
      dataFim: { $gt: date },
    };
  return {};
}
