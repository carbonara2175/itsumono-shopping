// localStorageで使う名前です。将来データ形式を変えたときのためにv1を付けています。
const STORAGE_KEYS = {
  shoppingList: "itsumono-shopping-list-v1",
  itemHistory: "itsumono-item-history-v1",
};

// 将来、売り場順を変更しやすいよう、選択肢と表示に使う順番をここで一元管理します。
const CATEGORIES = [
  "野菜・果物",
  "肉類",
  "魚介類",
  "卵・乳製品",
  "パン・麺・穀類",
  "調味料・乾物",
  "冷凍・加工食品",
  "飲料・嗜好品",
  "日用品",
  "その他",
];
const DEFAULT_CATEGORY = "その他";

const addItemForm = document.querySelector("#add-item-form");
const itemNameInput = document.querySelector("#item-name");
const itemQuantityInput = document.querySelector("#item-quantity");
const itemUnitInput = document.querySelector("#item-unit");
const itemCategoryInput = document.querySelector("#item-category");
const formMessage = document.querySelector("#form-message");
const shoppingListElement = document.querySelector("#shopping-list");
const emptyState = document.querySelector("#empty-state");
const itemCount = document.querySelector("#item-count");
const deleteCompletedButton = document.querySelector("#delete-completed");
const frequentItemsElement = document.querySelector("#frequent-items");
const favoritesEmpty = document.querySelector("#favorites-empty");

CATEGORIES.forEach((category) => {
  const option = document.createElement("option");
  option.value = category;
  option.textContent = category;
  itemCategoryInput.append(option);
});

// 保存済みデータを読み込みます。初回利用時や不正なデータの場合は初期値を返します。
function loadFromStorage(key, defaultValue) {
  try {
    const savedValue = localStorage.getItem(key);
    return savedValue === null ? defaultValue : JSON.parse(savedValue);
  } catch (error) {
    console.warn("保存データを読み込めませんでした。", error);
    return defaultValue;
  }
}

let shoppingItems = loadFromStorage(STORAGE_KEYS.shoppingList, []);
let itemHistory = loadFromStorage(STORAGE_KEYS.itemHistory, {});
let dataContext = { mode: "initializing" };

// 古い・壊れた保存データがあってもアプリを使えるよう、必要な形かを確認します。
if (!Array.isArray(shoppingItems)) shoppingItems = [];
if (!itemHistory || Array.isArray(itemHistory) || typeof itemHistory !== "object") itemHistory = {};

// v1.0のデータに不足している項目を補い、履歴の回数も新形式へ移行します。
shoppingItems = shoppingItems
  .filter((item) => item && typeof item.name === "string" && normalizeItemName(item.name))
  .map((item) => ({
    id: typeof item.id === "string" ? item.id : createItemId(),
    name: normalizeItemName(item.name),
    quantity: normalizeQuantity(item.quantity),
    unit: normalizeQuantity(item.quantity) ? normalizeUnit(item.unit) : "",
    category: normalizeCategory(item.category),
    completed: Boolean(item.completed),
  }));
itemHistory = Object.fromEntries(Object.entries(itemHistory)
  .filter(([name]) => normalizeItemName(name))
  .map(([name, history]) => {
    const data = history && typeof history === "object" ? history : { count: history };
    const lastQuantity = normalizeQuantity(data.lastQuantity);
    return [normalizeItemName(name), {
      count: Number(data.count) || 0,
      lastQuantity,
      lastUnit: lastQuantity ? normalizeUnit(data.lastUnit) : "",
      lastCategory: normalizeCategory(data.lastCategory),
    }];
  }));
const localShoppingItems = shoppingItems;

function saveShoppingList() {
  localStorage.setItem(STORAGE_KEYS.shoppingList, JSON.stringify(shoppingItems));
}

function saveItemHistory() {
  localStorage.setItem(STORAGE_KEYS.itemHistory, JSON.stringify(itemHistory));
}

// 「いつもの商品」はログイン状態にかかわらず、この端末の履歴を使用します。
saveItemHistory();

function normalizeItemName(name) {
  return name.trim().replace(/\s+/g, " ");
}

function normalizeQuantity(quantity) {
  if (quantity === null || quantity === undefined || quantity === "") return "";
  const value = String(quantity).trim();
  return value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0 ? value : "";
}

function normalizeUnit(unit) {
  const allowedUnits = ["個", "本", "袋", "パック", "箱", "切", "g", "kg", "mL", "L"];
  return allowedUnits.includes(unit) ? unit : "";
}

function normalizeCategory(category) {
  return CATEGORIES.includes(category) ? category : DEFAULT_CATEGORY;
}

function formatAmount(quantity, unit) {
  return quantity ? `${quantity}${unit || ""}` : "";
}

function isAlreadyListed(name) {
  return shoppingItems.some((item) => item.name.toLocaleLowerCase("ja") === name.toLocaleLowerCase("ja"));
}

function createItemId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// 「いつもの商品」の前回値をフォームへ戻し、今回の数量を確認できるようにします。
function prepareFrequentItem(name, quantity = "", unit = "", category = DEFAULT_CATEGORY) {
  const cleanQuantity = normalizeQuantity(quantity);
  itemNameInput.value = name;
  itemQuantityInput.value = cleanQuantity;
  itemUnitInput.value = cleanQuantity ? normalizeUnit(unit) : "";
  itemCategoryInput.value = normalizeCategory(category);
  formMessage.textContent = "";

  addItemForm.scrollIntoView({ behavior: "smooth", block: "center" });
  itemQuantityInput.focus({ preventScroll: true });
}

// 商品追加フォームで確定した内容を買い物リストへ追加します。
function updateItemHistory(name, quantity, unit, category) {
  const previousHistory = itemHistory[name];
  itemHistory[name] = {
    count: (Number(previousHistory?.count) || 0) + 1,
    lastQuantity: quantity,
    lastUnit: unit,
    lastCategory: category,
  };
  saveItemHistory();
}

async function addItem(name, quantity = "", unit = "", category = DEFAULT_CATEGORY) {
  const cleanName = normalizeItemName(name);
  const cleanQuantity = normalizeQuantity(quantity);
  const cleanUnit = cleanQuantity ? normalizeUnit(unit) : "";
  const cleanCategory = normalizeCategory(category);
  formMessage.textContent = "";

  if (!cleanName) {
    formMessage.textContent = "商品名を入力してください。";
    return false;
  }
  if (cleanName.length > 50) {
    formMessage.textContent = "商品名は50文字以内で入力してください。";
    return false;
  }
  if (isAlreadyListed(cleanName)) {
    formMessage.textContent = `「${cleanName}」はすでにリストにあります。`;
    return false;
  }

  if (dataContext.mode === "cloud") {
    const { data, error } = await dataContext.client
      .from("shopping_items")
      .insert({
        household_id: dataContext.householdId,
        name: cleanName,
        quantity: cleanQuantity === "" ? null : Number(cleanQuantity),
        unit: cleanUnit,
        category: cleanCategory,
        completed: false,
        created_by: dataContext.userId,
      })
      .select()
      .single();
    if (error) throw error;
    shoppingItems.push(normalizeCloudItem(data));
  } else {
    shoppingItems.push({ id: createItemId(), name: cleanName, quantity: cleanQuantity, unit: cleanUnit, category: cleanCategory, completed: false });
    saveShoppingList();
  }
  updateItemHistory(cleanName, cleanQuantity, cleanUnit, cleanCategory);
  renderApp();
  return true;
}

async function toggleItem(itemId) {
  const targetItem = shoppingItems.find((item) => item.id === itemId);
  if (!targetItem) return;
  const completed = !targetItem.completed;
  if (dataContext.mode === "cloud") {
    const { data, error } = await dataContext.client
      .from("shopping_items")
      .update({ completed })
      .eq("household_id", dataContext.householdId)
      .eq("id", itemId)
      .select()
      .single();
    if (error) throw error;
    targetItem.completed = Boolean(data.completed);
  } else {
    targetItem.completed = completed;
    saveShoppingList();
  }
  renderShoppingList();
  renderFrequentItems();
}

async function deleteCompletedItems() {
  if (dataContext.mode === "cloud") {
    const { error } = await dataContext.client
      .from("shopping_items")
      .delete()
      .eq("household_id", dataContext.householdId)
      .eq("completed", true);
    if (error) throw error;
  }
  shoppingItems = shoppingItems.filter((item) => !item.completed);
  if (dataContext.mode === "local") saveShoppingList();
  renderApp();
}

function normalizeCloudItem(item) {
  const quantity = normalizeQuantity(item.quantity);
  return {
    id: item.id,
    name: normalizeItemName(item.name),
    quantity,
    unit: quantity ? normalizeUnit(item.unit) : "",
    category: normalizeCategory(item.category),
    completed: Boolean(item.completed),
  };
}

function renderShoppingList() {
  shoppingListElement.replaceChildren();

  CATEGORIES.forEach((category) => {
    const categoryItems = shoppingItems.filter((item) => item.category === category);
    if (categoryItems.length === 0) return;

    const categoryGroup = document.createElement("li");
    categoryGroup.className = "category-group";
    const categoryHeading = document.createElement("h3");
    categoryHeading.className = "category-heading";
    categoryHeading.textContent = category;
    const categoryList = document.createElement("ul");
    categoryList.className = "category-items";

    categoryItems.forEach((item) => {
      const listItem = document.createElement("li");
      listItem.className = `shopping-item${item.completed ? " completed" : ""}`;

      const label = document.createElement("label");
      label.className = "item-label";
      const checkbox = document.createElement("input");
      checkbox.className = "item-checkbox";
      checkbox.type = "checkbox";
      checkbox.checked = Boolean(item.completed);
      checkbox.setAttribute("aria-label", `${item.name}を購入済みにする`);
      checkbox.disabled = dataContext.mode === "initializing" || dataContext.mode === "unavailable";
      checkbox.addEventListener("change", async () => {
        checkbox.disabled = true;
        try {
          await toggleItem(item.id);
        } catch (error) {
          console.error("購入済み状態を更新できませんでした。", error);
          formMessage.textContent = "購入済み状態を更新できませんでした。もう一度お試しください。";
          renderShoppingList();
        }
      });
      const name = document.createElement("span");
      name.className = "item-name";
      const amount = formatAmount(item.quantity, item.unit);
      name.textContent = amount ? `${item.name}　${amount}` : item.name;

      label.append(checkbox, name);
      listItem.append(label);
      categoryList.append(listItem);
    });

    categoryGroup.append(categoryHeading, categoryList);
    shoppingListElement.append(categoryGroup);
  });

  emptyState.classList.toggle("hidden", shoppingItems.length > 0);
  itemCount.textContent = shoppingItems.length;
  deleteCompletedButton.disabled = dataContext.mode === "initializing"
    || dataContext.mode === "unavailable"
    || !shoppingItems.some((item) => item.completed);
}

function renderFrequentItems() {
  frequentItemsElement.replaceChildren();
  const topItems = Object.entries(itemHistory)
    .filter(([name, history]) => name && Number(history.count) > 0)
    .sort((first, second) => second[1].count - first[1].count || first[0].localeCompare(second[0], "ja"))
    .slice(0, 5);

  topItems.forEach(([name, history]) => {
    const listItem = document.createElement("li");
    listItem.className = "frequent-item";
    const itemInfo = document.createElement("div");
    itemInfo.className = "frequent-info";
    const itemName = document.createElement("span");
    itemName.className = "frequent-name";
    itemName.textContent = name;
    itemInfo.append(itemName);
    const lastAmount = formatAmount(history.lastQuantity, history.lastUnit);
    if (lastAmount) {
      const lastUsed = document.createElement("span");
      lastUsed.className = "frequent-last";
      lastUsed.textContent = `前回 ${lastAmount}`;
      itemInfo.append(lastUsed);
    }
    const addButton = document.createElement("button");
    addButton.className = "add-frequent-button";
    addButton.type = "button";
    addButton.textContent = "+";
    addButton.disabled = isAlreadyListed(name);
    addButton.setAttribute("aria-label", `${name}を商品追加フォームに入力`);
    addButton.addEventListener("click", () => prepareFrequentItem(name, history.lastQuantity, history.lastUnit, history.lastCategory));
    listItem.append(itemInfo, addButton);
    frequentItemsElement.append(listItem);
  });

  favoritesEmpty.classList.toggle("hidden", topItems.length > 0);
}

function renderApp() {
  renderShoppingList();
  renderFrequentItems();
}

function setControlsDisabled(disabled) {
  Array.from(addItemForm.elements).forEach((element) => { element.disabled = disabled; });
  if (disabled) deleteCompletedButton.disabled = true;
}

addItemForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setControlsDisabled(true);
  try {
    if (await addItem(itemNameInput.value, itemQuantityInput.value, itemUnitInput.value, itemCategoryInput.value)) {
      itemNameInput.value = "";
      itemQuantityInput.value = "";
      itemUnitInput.value = "";
      itemCategoryInput.value = "";
    }
  } catch (error) {
    console.error("商品を追加できませんでした。", error);
    formMessage.textContent = "商品を追加できませんでした。通信状態を確認してもう一度お試しください。";
  } finally {
    setControlsDisabled(false);
    renderShoppingList();
    itemNameInput.focus();
  }
});

itemNameInput.addEventListener("input", () => { formMessage.textContent = ""; });
deleteCompletedButton.addEventListener("click", async () => {
  setControlsDisabled(true);
  try {
    await deleteCompletedItems();
  } catch (error) {
    console.error("購入済みの商品を削除できませんでした。", error);
    formMessage.textContent = "購入済みの商品を削除できませんでした。もう一度お試しください。";
  } finally {
    setControlsDisabled(false);
    renderShoppingList();
  }
});

async function initializeApp() {
  setControlsDisabled(true);
  shoppingItems = [];
  renderApp();

  const context = await window.shoppingCloud.getContext();
  dataContext = context;
  if (context.mode === "local") {
    shoppingItems = localShoppingItems;
    // ローカルモードでのみ、旧形式を現在の形式へ整えて保存します。
    saveShoppingList();
  } else if (context.mode === "cloud") {
    try {
      const { data, error } = await context.client
        .from("shopping_items")
        .select("id, name, quantity, unit, category, completed, created_at")
        .eq("household_id", context.householdId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      shoppingItems = (data || []).map(normalizeCloudItem);
      window.shoppingCloud.setListStatus("ready", context.householdName);
    } catch (error) {
      dataContext = { mode: "unavailable" };
      window.shoppingCloud.setListStatus("error", context.householdName, error);
    }
  }

  setControlsDisabled(dataContext.mode === "unavailable");
  renderApp();
}

// 認証状態を確認してから、ローカルまたは家族共有のリストを表示します。
initializeApp().catch((error) => {
  dataContext = { mode: "unavailable" };
  setControlsDisabled(true);
  console.error("買い物リストを初期化できませんでした。", error);
});
