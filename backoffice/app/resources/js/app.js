const form = document.querySelector("[data-service-check]");
if (form) {
  const button = form.querySelector("button");
  const message = document.querySelector("[data-check-message]");
  let running = false;
  async function verify() {
    if (running) return;
    running = true;
    button.disabled = true;
    message.textContent = "A verificar os serviços…";
    try {
      const response = await fetch(form.action, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "X-CSRF-TOKEN": document.querySelector('meta[name="csrf-token"]')
            .content,
        },
        credentials: "same-origin",
      });
      if (response.redirected || [401, 403].includes(response.status)) {
        window.location.assign(
          response.redirected ? response.url : "/servicos",
        );
        return;
      }
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.message || "Não foi possível concluir a verificação.",
        );
      document.querySelector("[data-check-results]").innerHTML = data.html;
      message.textContent = data.message;
    } catch (error) {
      message.textContent =
        error instanceof Error
          ? error.message
          : "Não foi possível contactar o servidor. Não repetimos a operação automaticamente.";
    } finally {
      running = false;
      button.disabled = false;
    }
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void verify();
  });
  void verify();
}
