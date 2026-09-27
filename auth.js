(() => {
  "use strict";

  const status = document.getElementById("status");
  const form = document.getElementById("password-form");
  const passwordInput = document.getElementById("password");
  const confirmationInput = document.getElementById("password-confirmation");
  const submitButton = document.getElementById("submit-button");
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

  function hasMissingConfiguration() {
    return !SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY
      || SUPABASE_URL === "YOUR_SUPABASE_URL"
      || SUPABASE_PUBLISHABLE_KEY === "YOUR_SUPABASE_PUBLISHABLE_KEY";
  }

  function invitationErrorFromUrl() {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const code = query.get("error_code") || hash.get("error_code");
    const description = query.get("error_description") || hash.get("error_description");

    if (code === "otp_expired" || /expired/i.test(description || "")) {
      return "招待リンクの有効期限が切れています。新しい招待メールを送ってもらってください。";
    }
    if (query.has("error") || hash.has("error")) {
      return "招待リンクが無効です。招待メールのリンクをもう一度確認してください。";
    }
    return "";
  }

  async function initialize() {
    const linkError = invitationErrorFromUrl();
    if (linkError) {
      reportError(linkError, new Error("Supabase returned an invalid invitation link"));
      return;
    }

    if (hasMissingConfiguration()) {
      reportError(
        "Supabase設定が未入力です。supabase-config.jsにProject URLとPublishable keyを設定してください。",
        new Error("Supabase configuration is missing")
      );
      return;
    }

    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      reportError("通信エラーが発生しました。接続を確認して、もう一度読み込んでください。", new Error("Supabase library failed to load"));
      return;
    }

    try {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      if (!data.session) {
        reportError(
          "認証セッションを取得できません。招待メールに記載された有効なリンクから開いてください。",
          new Error("Invitation session was not found")
        );
        return;
      }

      showStatus("招待を確認できました。新しいパスワードを入力してください。");
      form.hidden = false;
      passwordInput.focus();
    } catch (error) {
      reportError("通信エラーが発生しました。接続を確認して、もう一度お試しください。", error);
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = passwordInput.value;
    const confirmation = confirmationInput.value;

    if (password.length < 6) {
      showStatus("パスワードは6文字以上で入力してください。", "error");
      return;
    }
    if (password !== confirmation) {
      showStatus("パスワードとパスワード確認が一致しません。", "error");
      return;
    }

    submitButton.disabled = true;
    try {
      const { error } = await supabaseClient.auth.updateUser({ password });
      if (error) throw error;
      passwordInput.value = "";
      confirmationInput.value = "";
      form.hidden = true;
      showStatus("パスワードを設定しました", "success");
      shoppingLink.hidden = false;
      shoppingLink.focus();
    } catch (error) {
      const message = /password/i.test(error?.message || "")
        ? "パスワードを設定できませんでした。6文字以上の別のパスワードをお試しください。"
        : "通信エラーが発生しました。接続を確認して、もう一度お試しください。";
      reportError(message, error);
      submitButton.disabled = false;
    }
  });

  initialize();
})();
