(() => {
  "use strict";

  const title = document.getElementById("cloud-status-title");
  const note = document.getElementById("cloud-status-note");
  const loginLink = document.getElementById("login-link");
  const logoutButton = document.getElementById("logout-button");
  let supabaseClient;

  function showLocalMode(message = "ローカルモード") {
    title.textContent = message;
    note.textContent = "買い物データはこの端末に保存されています";
    loginLink.hidden = false;
    logoutButton.hidden = true;
  }

  function showCloudError(message, error) {
    title.textContent = message;
    note.textContent = "通信に失敗しました。ページを再読み込みしてお試しください";
    loginLink.hidden = true;
    logoutButton.hidden = false;
    console.error(message, error);
  }

  function setCloudListStatus(status, householdName, error) {
    logoutButton.hidden = false;
    loginLink.hidden = true;
    if (status === "loading") {
      title.textContent = `${householdName}の買い物リストを読込中…`;
      note.textContent = "クラウドへ接続しています";
    } else if (status === "ready") {
      title.textContent = `${householdName}に接続済み`;
      note.textContent = "買い物リストを家族で共有しています";
    } else {
      showCloudError("買い物リストを読み込めませんでした", error);
    }
  }

  async function initialize() {
    if (typeof SUPABASE_URL !== "string" || typeof SUPABASE_PUBLISHABLE_KEY !== "string"
      || !window.supabase?.createClient) {
      showLocalMode("ローカルモード（接続設定を確認してください）");
      return { mode: "local" };
    }

    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    try {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) throw error;
      if (!data.session) {
        showLocalMode();
        return { mode: "local" };
      }

      logoutButton.hidden = false;
      const userId = data.session.user.id;
      const { data: memberships, error: membershipError } = await supabaseClient
        .from("household_members")
        .select("household_id")
        .eq("user_id", userId)
        .limit(2);
      if (membershipError) throw membershipError;
      if (!memberships?.length) {
        const noHouseholdError = new Error("The user does not belong to a household");
        showCloudError("家族グループが設定されていません", noHouseholdError);
        return { mode: "unavailable" };
      }
      if (memberships.length > 1) {
        console.warn("複数の家族グループが見つかったため、最初のグループを使用します。");
      }

      const householdId = memberships[0].household_id;
      const { data: household, error: householdError } = await supabaseClient
        .from("households")
        .select("name")
        .eq("id", householdId)
        .single();
      if (householdError) throw householdError;

      setCloudListStatus("loading", household.name);
      return { mode: "cloud", client: supabaseClient, householdId, householdName: household.name, userId };
    } catch (error) {
      showCloudError("家族グループを確認できませんでした", error);
      return { mode: "unavailable" };
    }
  }

  const contextPromise = initialize();
  window.shoppingCloud = { getContext: () => contextPromise, setListStatus: setCloudListStatus };

  logoutButton.addEventListener("click", async () => {
    if (!supabaseClient) return;
    logoutButton.disabled = true;
    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;
      window.location.reload();
    } catch (error) {
      showCloudError("ログアウトできませんでした。もう一度お試しください", error);
      logoutButton.disabled = false;
    }
  });
})();
