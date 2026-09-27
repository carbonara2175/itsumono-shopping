(() => {
  "use strict";

  const title = document.getElementById("cloud-status-title");
  const loginLink = document.getElementById("login-link");
  const logoutButton = document.getElementById("logout-button");
  let supabaseClient;

  function showLocalMode(message = "ローカルモード") {
    title.textContent = message;
    loginLink.hidden = false;
    logoutButton.hidden = true;
  }

  function reportConnectionError(message, error) {
    title.textContent = message;
    loginLink.hidden = true;
    logoutButton.hidden = false;
    console.error(message, error);
  }

  async function loadHousehold(userId) {
    const { data: memberships, error: membershipError } = await supabaseClient
      .from("household_members")
      .select("household_id")
      .eq("user_id", userId)
      .limit(2);
    if (membershipError) throw membershipError;
    if (!memberships?.length) {
      title.textContent = "家族グループが設定されていません";
      logoutButton.hidden = false;
      return;
    }
    if (memberships.length > 1) {
      console.warn("複数の家族グループが見つかったため、最初のグループを表示します。");
    }

    const { data: households, error: householdError } = await supabaseClient
      .from("households")
      .select("name")
      .eq("id", memberships[0].household_id)
      .limit(2);
    if (householdError) throw householdError;
    if (!households?.length) throw new Error("Household was not found");
    if (households.length > 1) console.warn("同じIDの家族グループが複数見つかりました。");

    title.textContent = `${households[0].name}に接続済み`;
    logoutButton.hidden = false;
  }

  async function initialize() {
    if (typeof SUPABASE_URL !== "string" || typeof SUPABASE_PUBLISHABLE_KEY !== "string"
      || !window.supabase?.createClient) {
      showLocalMode("ローカルモード（接続設定を確認してください）");
      return;
    }

    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    try {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      if (!data.session) {
        showLocalMode();
        return;
      }
      await loadHousehold(data.session.user.id);
    } catch (error) {
      reportConnectionError("家族グループを確認できませんでした", error);
    }
  }

  logoutButton.addEventListener("click", async () => {
    logoutButton.disabled = true;
    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;
      window.location.reload();
    } catch (error) {
      reportConnectionError("ログアウトできませんでした。もう一度お試しください", error);
      logoutButton.disabled = false;
    }
  });

  initialize();
})();
