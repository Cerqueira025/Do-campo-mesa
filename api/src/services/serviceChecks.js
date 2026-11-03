import mongoose from "mongoose";
import { io } from "socket.io-client";
import { randomUUID } from "node:crypto";

export async function timedCheck(service, operation) {
  const start = performance.now();
  let timer;
  try {
    await Promise.race([
      operation(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), 5000);
      }),
    ]);
    return {
      service,
      status: "ok",
      message: "Serviço respondeu à verificação.",
      durationMs: Math.round(performance.now() - start),
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return {
      service,
      status: "failure",
      message:
        "O serviço não respondeu corretamente no prazo de cinco segundos.",
      durationMs: Math.round(performance.now() - start),
      checkedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timer);
  }
}

export function checkSocket(url) {
  return new Promise((resolve, reject) => {
    const socket = io(url, {
      transports: ["websocket"],
      reconnection: false,
      timeout: 4500,
      autoConnect: false,
    });
    const finish = (error) => {
      clearTimeout(timer);
      socket.disconnect();
      error ? reject(error) : resolve();
    };
    const timer = setTimeout(() => finish(new Error("timeout")), 4800);
    socket.once("connect_error", finish);
    socket.once("connect", () => {
      const nonce = randomUUID();
      socket
        .timeout(4000)
        .emit("diagnostico", nonce, (error, reply) =>
          finish(
            error || (reply !== nonce ? new Error("invalid reply") : null),
          ),
        );
    });
    socket.connect();
  });
}

export async function checkServices(url) {
  return Promise.all([
    timedCheck("mongodb", async () => {
      if (mongoose.connection.readyState !== 1) throw new Error("disconnected");
      await mongoose.connection.db
        .admin()
        .command({ ping: 1 }, { timeoutMS: 4500 });
    }),
    timedCheck("socketio", () => checkSocket(url)),
  ]);
}
