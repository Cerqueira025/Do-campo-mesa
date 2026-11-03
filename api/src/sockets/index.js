export function registerSockets(io) {
  io.on('connection', (socket) => {
    socket.on('diagnostico', (nonce, acknowledge) => {
      if (typeof nonce === 'string' && nonce.length <= 64 && typeof acknowledge === 'function') {
        acknowledge(nonce);
      }
    });
  });
}
