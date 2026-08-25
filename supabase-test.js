const form = document.querySelector("#cloud-item-form");
const nameInput = document.querySelector("#cloud-item-name");
const saveButton = document.querySelector("#save-button");
const reloadButton = document.querySelector("#reload-button");
const itemList = document.querySelector("#cloud-items");
const loadingMessage = document.querySelector("#loading-message");
const emptyMessage = document.querySelector("#empty-message");
const statusMessage = document.querySelector("#status-message");

let supabaseClient = null;

function showStatus(message, type = "error") {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
}

function hasValidConfiguration() {
  return SUPABASE_URL !== "YOUR_SUPABASE_URL"
    && SUPABASE_PUBLISHABLE_KEY !== "YOUR_SUPABASE_PUBLISHABLE_KEY"
    && SUPABASE_URL.startsWith("https://")
    && SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_");
}

function setBusy(isBusy) {
  saveButton.disabled = isBusy;
  reloadButton.disabled = isBusy;
}

function renderItems(items) {
  itemList.replaceChildren();
  items.forEach((item) => {
    const listItem = document.createElement("li");
    const itemName = document.createElement("span");
    itemName.className = "item-name";
    itemName.textContent = item.name;

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-button";
    deleteButton.type = "button";
    deleteButton.textContent = "削除";
    deleteButton.setAttribute("aria-label", `${item.name}を削除`);
    deleteButton.addEventListener("click", () => deleteItem(item.id));
    listItem.append(itemName, deleteButton);
    itemList.append(listItem);
  });
  emptyMessage.hidden = items.length !== 0;
}

async function loadItems() {
  if (!supabaseClient) return;
  setBusy(true);
  loadingMessage.hidden = false;
  emptyMessage.hidden = true;
  const { data, error } = await supabaseClient
    .from("phase1_test_items")
    .select("id, name, created_at")
    .order("created_at", { ascending: false });
  setBusy(false);
  loadingMessage.hidden = true;

  if (error) {
    console.error("Supabaseからの商品取得に失敗しました。", error);
    showStatus("Supabaseから商品を取得できませんでした。設定やテーブルを確認してください。");
    return;
  }
  renderItems(data ?? []);
}

async function deleteItem(id) {
  setBusy(true);
  const { error } = await supabaseClient.from("phase1_test_items").delete().eq("id", id);
  setBusy(false);
  if (error) {
    console.error("Supabaseの商品削除に失敗しました。", error);
    showStatus("Supabaseから商品の削除に失敗しました。");
    return;
  }
  showStatus("テスト商品を削除しました。", "success");
  await loadItems();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  if (!name) {
    showStatus("商品名を入力してください。");
    return;
  }

  setBusy(true);
  const { error } = await supabaseClient.from("phase1_test_items").insert({ name });
  setBusy(false);
  if (error) {
    console.error("Supabaseへの商品保存に失敗しました。", error);
    showStatus("Supabaseへの保存に失敗しました。設定やテーブルを確認してください。");
    return;
  }
  nameInput.value = "";
  showStatus("クラウドへ保存しました。", "success");
  await loadItems();
  nameInput.focus();
});

reloadButton.addEventListener("click", loadItems);
nameInput.addEventListener("input", () => showStatus("", ""));

if (!hasValidConfiguration()) {
  setBusy(true);
  loadingMessage.hidden = true;
  showStatus("Supabase設定が未入力です。supabase-config.jsにProject URLとPublishable keyを設定してください。");
  console.error("Supabase設定が未入力、または形式が正しくありません。supabase-config.jsを確認してください。");
} else if (!window.supabase) {
  setBusy(true);
  loadingMessage.hidden = true;
  showStatus("Supabaseライブラリを読み込めませんでした。インターネット接続を確認してください。");
  console.error("supabase-js v2をCDNから読み込めませんでした。");
} else {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  loadItems();
}
