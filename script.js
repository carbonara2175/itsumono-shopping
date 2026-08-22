// localStorageで使う名前です。将来データ形式を変えたときのためにv1を付けています。
const STORAGE_KEYS = {
  shoppingList: "itsumono-shopping-list-v1",
  itemHistory: "itsumono-item-history-v1",
};

const addItemForm = document.querySelector("#add-item-form");
const itemNameInput = document.querySelector("#item-name");
const itemQuantityInput = document.querySelector("#item-quantity");
const itemUnitInput = document.querySelector("#item-unit");
const formMessage = document.querySelector("#form-message");
const shoppingListElement = document.querySelector("#shopping-list");
const emptyState = document.querySelector("#empty-state");
const itemCount = document.querySelector("#item-count");
const deleteCompletedButton = document.querySelector("#delete-completed");
const frequentItemsElement = document.querySelector("#frequent-items");
const favoritesEmpty = document.querySelector("#favorites-empty");

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
    }];
  }));

function saveData() {
  localStorage.setItem(STORAGE_KEYS.shoppingList, JSON.stringify(shoppingItems));
  localStorage.setItem(STORAGE_KEYS.itemHistory, JSON.stringify(itemHistory));
}

// 読み込んだv1.0データも、以後は数量・単位を持つv1.1形式として保存します。
saveData();

function normalizeItemName(name) {
  return name.trim().replace(/\s+/g, " ");
}

function normalizeQuantity(quantity) {
  if (quantity === null || quantity === undefined || quantity === "") return "";
  const value = String(quantity).trim();
  return value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0 ? value : "";
}

function normalizeUnit(unit) {
  const allowedUnits = ["個", "本", "袋", "パック", "箱", "g", "kg", "mL", "L"];
  return allowedUnits.includes(unit) ? unit : "";
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

// 入力欄からでも「いつもの商品」からでも、この関数を使って追加します。
function addItem(name, quantity = "", unit = "") {
  const cleanName = normalizeItemName(name);
  const cleanQuantity = normalizeQuantity(quantity);
  const cleanUnit = cleanQuantity ? normalizeUnit(unit) : "";
  formMessage.textContent = "";

  if (!cleanName) {
    formMessage.textContent = "商品名を入力してください。";
    return false;
  }
  if (isAlreadyListed(cleanName)) {
    formMessage.textContent = `「${cleanName}」はすでにリストにあります。`;
    return false;
  }

  shoppingItems.push({ id: createItemId(), name: cleanName, quantity: cleanQuantity, unit: cleanUnit, completed: false });
  const previousHistory = itemHistory[cleanName];
  itemHistory[cleanName] = {
    count: (Number(previousHistory?.count) || 0) + 1,
    lastQuantity: cleanQuantity,
    lastUnit: cleanUnit,
  };
  saveData();
  renderApp();
  return true;
}

function toggleItem(itemId) {
  const targetItem = shoppingItems.find((item) => item.id === itemId);
  if (!targetItem) return;
  targetItem.completed = !targetItem.completed;
  saveData();
  renderShoppingList();
  renderFrequentItems();
}

function deleteCompletedItems() {
  shoppingItems = shoppingItems.filter((item) => !item.completed);
  saveData();
  renderApp();
}

function renderShoppingList() {
  shoppingListElement.replaceChildren();

  shoppingItems.forEach((item) => {
    const listItem = document.createElement("li");
    listItem.className = `shopping-item${item.completed ? " completed" : ""}`;

    const label = document.createElement("label");
    label.className = "item-label";
    const checkbox = document.createElement("input");
    checkbox.className = "item-checkbox";
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(item.completed);
    checkbox.setAttribute("aria-label", `${item.name}を購入済みにする`);
    checkbox.addEventListener("change", () => toggleItem(item.id));
    const name = document.createElement("span");
    name.className = "item-name";
    const amount = formatAmount(item.quantity, item.unit);
    name.textContent = amount ? `${item.name}　${amount}` : item.name;

    label.append(checkbox, name);
    listItem.append(label);
    shoppingListElement.append(listItem);
  });

  emptyState.classList.toggle("hidden", shoppingItems.length > 0);
  itemCount.textContent = shoppingItems.length;
  deleteCompletedButton.disabled = !shoppingItems.some((item) => item.completed);
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
    addButton.setAttribute("aria-label", `${name}を買い物リストに追加`);
    addButton.addEventListener("click", () => addItem(name, history.lastQuantity, history.lastUnit));
    listItem.append(itemInfo, addButton);
    frequentItemsElement.append(listItem);
  });

  favoritesEmpty.classList.toggle("hidden", topItems.length > 0);
}

function renderApp() {
  renderShoppingList();
  renderFrequentItems();
}

addItemForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (addItem(itemNameInput.value, itemQuantityInput.value, itemUnitInput.value)) {
    itemNameInput.value = "";
    itemQuantityInput.value = "";
    itemUnitInput.value = "";
  }
  itemNameInput.focus();
});

itemNameInput.addEventListener("input", () => { formMessage.textContent = ""; });
deleteCompletedButton.addEventListener("click", deleteCompletedItems);

// ページを開いたとき、保存済みの内容を画面に表示します。
renderApp();
