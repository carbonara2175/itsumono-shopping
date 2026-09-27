(() => {
  "use strict";

  const form = document.getElementById("login-form");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const submitButton = document.getElementById("submit-button");
  const status = document.getElementById("status");
  const shoppingLink = document.getElementById("shopping-link");
  let supabaseClient;

  function showStatus(message, type = "") {
    status.textContent = message;
    status.className = `status ${type}`.trim();
  }

  function reportError(message, error) {
    showStatus(message, "error");
    console.error(message, error);
  }

  function configurationIsMissing() {
    return typeof SUPABASE_URL !== "string" || typeof SUPABASE_PUBLISHABLE_KEY !== "string"
      || SUPABASE_URL.includes("YOUR_SUPABASE") || SUPABASE_PUBLISHABLE_KEY.includes("YOUR_SUPABASE");
  }

  async function initialize() {
    if (configurationIsMissing() || !window.supabase?.createClient) {
      reportError("ログイン機能を読み込めませんでした。時間をおいてもう一度お試しください。", new Error("Supabase configuration or library is unavailable"));
      form.hidden = true;
      return;
    }

    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    try {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      if (data.session) {
        form.hidden = true;
        shoppingLink.hidden = false;
        showStatus("すでにログインしています。", "success");
      }
    } catch (error) {
      reportError("ログイン状態を確認できませんでした。接続を確認してください。", error);
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    submitButton.disabled = true;
    showStatus("ログインしています…");
    try {
      const { error } = await supabaseClient.auth.signInWithPassword({
        email: emailInput.value.trim(),
        password: passwordInput.value,
      });
      if (error) throw error;
      passwordInput.value = "";
      window.location.replace("index.html");
    } catch (error) {
      reportError("メールアドレスまたはパスワードを確認してください。", error);
      submitButton.disabled = false;
    }
  });

  initialize();
})();
