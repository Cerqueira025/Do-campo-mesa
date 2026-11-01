export function prepareDecision(body, administratorId, reasonRequired) {
  const motivo = body.motivo ?? "";
  if (
    typeof motivo !== "string" ||
    motivo.trim().length > 500 ||
    (reasonRequired && !motivo.trim())
  ) {
    throw Object.assign(
      new Error("Indique um motivo com até 500 caracteres."),
      { status: 400 },
    );
  }
  const previous = body.decisaoAnterior ?? null;
  if (
    previous !== null &&
    (typeof previous !== "string" || !Number.isFinite(Date.parse(previous)))
  ) {
    throw Object.assign(new Error("Referência da decisão anterior inválida."), {
      status: 400,
    });
  }
  return {
    filter: {
      "ultimaDecisao.data": previous === null ? null : new Date(previous),
    },
    value: {
      administradorId: administratorId,
      data: new Date(
        Math.max(Date.now(), previous ? Date.parse(previous) + 1 : 0),
      ),
      motivo: motivo.trim(),
    },
  };
}

export function decisionConflict(response) {
  return response.status(409).json({
    erro: "A decisão já foi alterada. Atualize os dados e confirme novamente.",
  });
}
