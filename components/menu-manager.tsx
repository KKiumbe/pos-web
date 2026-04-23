"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";

import { apiBaseUrl, apiRequest, type LoginResponse } from "../lib/api";

type MenuItem = {
  id: number;
  name: string;
  description: string | null;
  photoUrl?: string | null;
  price: number;
  isAvailable: boolean;
  categoryId?: number;
};

type Category = {
  id: number;
  name: string;
  items: MenuItem[];
};

type StaffMember = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
};

type StaffDraft = {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  password: string;
  isActive: boolean;
};

type StockUnit = "KILOGRAM" | "GRAM" | "LITER" | "MILLILITER" | "CARTON" | "SLICE" | "PIECE" | "BOTTLE" | "PACKET";

type InventoryItem = {
  id: number;
  type: "MENU" | "CONSUMABLE";
  menuItemId?: number | null;
  menuItem?: { id: number; name: string } | null;
  name: string;
  unit: StockUnit;
  quantity: number;
  reorderLevel: number;
  lowStock: boolean;
};

type RecipeDefinition = {
  id: number;
  menuItem: {
    id: number;
    name: string;
  };
  items: Array<{
    id: number;
    quantity: number;
    unit: StockUnit;
    stockItem: {
      id: number;
      name: string;
      unit: StockUnit;
    };
  }>;
};

type StockDraft = {
  name: string;
  unit: StockUnit;
  quantity: string;
  reorderLevel: string;
  type: "MENU" | "CONSUMABLE";
  menuItemId: string;
};

type RecipeDraftItem = {
  stockItemId: string;
  quantity: string;
  unit: StockUnit;
};

type ReportPeriod = {
  label: string;
  startDate: string;
  endDate: string;
  salesTotal: number;
  paymentCount: number;
  ordersCount: number;
  itemsSold: number;
  averageOrderValue: number;
  mostBoughtItem: {
    menuItemId: number;
    name: string;
    quantity: number;
    revenue: number;
  } | null;
};

type StockSnapshotItem = {
  id: number;
  name: string;
  quantity: number;
  reorderLevel: number;
  unit: string;
};

type ReportOverview = {
  anchorDate: string;
  tenantName: string | null;
  currency: string;
  timezone: string;
  daily: ReportPeriod;
  weekly: ReportPeriod;
  monthly: ReportPeriod;
  stockSnapshot: {
    totalTrackedItems: number;
    lowStockCount: number;
    lowStockItems: StockSnapshotItem[];
  };
  dailyTrend: Array<{
    label: string;
    startDate: string;
    endDate: string;
    salesTotal: number;
    ordersCount: number;
    itemsSold: number;
  }>;
  weeklyTrend: Array<{
    label: string;
    startDate: string;
    endDate: string;
    salesTotal: number;
    ordersCount: number;
    itemsSold: number;
  }>;
  monthlyTrend: Array<{
    label: string;
    startDate: string;
    endDate: string;
    salesTotal: number;
    ordersCount: number;
    itemsSold: number;
  }>;
};

type DailyReport = {
  date: string;
  salesTotal: number;
  paymentCount: number;
  ordersCount: number;
  itemsSold: number;
  mostBoughtItem: ReportPeriod["mostBoughtItem"];
  lowStockItems: Array<{
    id: number;
    name: string;
    quantity: number;
    reorderLevel: number;
    unit: string;
  }>;
};

type TenantProfile = {
  id: number;
  name: string;
};

type MenuDraft = {
  name: string;
  description: string;
  photoUrl: string;
  price: string;
  isAvailable: boolean;
  categoryId: string;
};

const storageKey = "tableflow-session";
const roleOptions = [
  { value: "MANAGER", label: "Manager" },
  { value: "CASHIER", label: "Cashier" },
  { value: "KITCHEN", label: "Kitchen" },
  { value: "DELIVERY", label: "Delivery" }
];
const stockUnits: Array<{ value: StockUnit; label: string }> = [
  { value: "KILOGRAM", label: "Kilos" },
  { value: "GRAM", label: "Grams" },
  { value: "LITER", label: "Liters" },
  { value: "MILLILITER", label: "Milliliters" },
  { value: "CARTON", label: "Cartons" },
  { value: "SLICE", label: "Slices" },
  { value: "PIECE", label: "Pieces" },
  { value: "BOTTLE", label: "Bottles" },
  { value: "PACKET", label: "Packets" }
];

function formatCurrency(amount: number, currency = "KES") {
  return `${currency} ${Number(amount).toLocaleString()}`;
}

function formatPeriodLabel(startDate: string, endDate: string) {
  return startDate === endDate ? startDate : `${startDate} to ${endDate}`;
}

function normalizeSearch(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function getMessageTone(message: string): "success" | "warning" | "info" {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("unable") ||
    normalized.includes("failed") ||
    normalized.includes("required") ||
    normalized.includes("restricted")
  ) {
    return "warning";
  }
  if (
    normalized.includes("created") ||
    normalized.includes("loaded") ||
    normalized.includes("updated") ||
    normalized.includes("saved") ||
    normalized.includes("removed")
  ) {
    return "success";
  }
  return "info";
}

function createEmptyStaffDraft(): StaffDraft {
  return {
    firstName: "",
    lastName: "",
    email: "",
    role: "CASHIER",
    password: "",
    isActive: true
  };
}

function createMenuDraft(item?: MenuItem): MenuDraft {
  return {
    name: item?.name ?? "",
    description: item?.description ?? "",
    photoUrl: item?.photoUrl ?? "",
    price: item ? String(item.price) : "",
    isAvailable: item?.isAvailable ?? true,
    categoryId: item?.categoryId ? String(item.categoryId) : ""
  };
}

function createStockDraft(item?: InventoryItem): StockDraft {
  return {
    name: item?.name ?? "",
    unit: item?.unit ?? "KILOGRAM",
    quantity: item ? String(item.quantity) : "",
    reorderLevel: item ? String(item.reorderLevel) : "0",
    type: item?.type ?? "CONSUMABLE",
    menuItemId: item?.menuItemId ? String(item.menuItemId) : item?.menuItem?.id ? String(item.menuItem.id) : ""
  };
}

function createRecipeDraftItem(): RecipeDraftItem {
  return { stockItemId: "", quantity: "", unit: "GRAM" };
}

function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = `${today.getMonth() + 1}`.padStart(2, "0");
  const day = `${today.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function MenuManager() {
  const [session, setSession] = useState<LoginResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffDrafts, setStaffDrafts] = useState<Record<number, StaffDraft>>({});
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [recipes, setRecipes] = useState<RecipeDefinition[]>([]);
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [reportOverview, setReportOverview] = useState<ReportOverview | null>(null);
  const [tenantProfile, setTenantProfile] = useState<TenantProfile | null>(null);
  const [reportDate, setReportDate] = useState(getTodayDate());
  const [message, setMessage] = useState("Loading management workspace...");
  const [restaurantName, setRestaurantName] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemPhotoUrl, setItemPhotoUrl] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemCategoryId, setItemCategoryId] = useState("");
  const [itemAvailable, setItemAvailable] = useState(true);
  const [menuSearch, setMenuSearch] = useState("");
  const [editingMenuItemId, setEditingMenuItemId] = useState<number | null>(null);
  const [editingMenuDraft, setEditingMenuDraft] = useState<MenuDraft>(createMenuDraft());
  const [stockName, setStockName] = useState("");
  const [stockUnit, setStockUnit] = useState<StockUnit>("KILOGRAM");
  const [stockQuantity, setStockQuantity] = useState("");
  const [stockReorderLevel, setStockReorderLevel] = useState("0");
  const [stockType, setStockType] = useState<"MENU" | "CONSUMABLE">("CONSUMABLE");
  const [stockMenuItemId, setStockMenuItemId] = useState("");
  const [inventorySearch, setInventorySearch] = useState("");
  const [selectedStockItemId, setSelectedStockItemId] = useState<number | null>(null);
  const [stockDrafts, setStockDrafts] = useState<Record<number, StockDraft>>({});
  const [recipeMenuItemId, setRecipeMenuItemId] = useState("");
  const [recipeMenuSearch, setRecipeMenuSearch] = useState("");
  const [recipeIngredientSearch, setRecipeIngredientSearch] = useState("");
  const [recipeDraftItems, setRecipeDraftItems] = useState<RecipeDraftItem[]>([createRecipeDraftItem()]);
  const [staffFirstName, setStaffFirstName] = useState("");
  const [staffLastName, setStaffLastName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffRole, setStaffRole] = useState("CASHIER");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return;
    const parsed = JSON.parse(stored) as LoginResponse & { token: string };
    setToken(parsed.token);
    setSession(parsed);
  }, []);

  useEffect(() => {
    if (!token) return;
    startTransition(() => {
      void loadManagement(token, reportDate);
    });
  }, [token]);

  function seedStaffDrafts(members: StaffMember[]) {
    setStaffDrafts(
      Object.fromEntries(
        members.map((member) => [
          member.id,
          {
            firstName: member.firstName,
            lastName: member.lastName,
            email: member.email,
            role: member.role,
            password: "",
            isActive: member.isActive
          }
        ])
      )
    );
  }

  async function loadManagement(activeToken: string, activeReportDate = reportDate) {
    try {
      const [menuData, staffData, inventoryData, recipeData, reportData, overviewData, tenantData] = await Promise.all([
        apiRequest<Category[]>("/menu/categories", {}, activeToken),
        apiRequest<StaffMember[]>("/staff", {}, activeToken),
        apiRequest<InventoryItem[]>("/inventory/items", {}, activeToken),
        apiRequest<RecipeDefinition[]>("/inventory/recipes", {}, activeToken),
        apiRequest<DailyReport>(`/reports/daily?date=${activeReportDate}`, {}, activeToken),
        apiRequest<ReportOverview>(`/reports/overview?date=${activeReportDate}`, {}, activeToken),
        apiRequest<TenantProfile>("/tenant/profile", {}, activeToken)
      ]);
      setCategories(menuData);
      setStaff(staffData);
      seedStaffDrafts(staffData);
      setInventory(inventoryData);
      setRecipes(recipeData);
      setDailyReport(reportData);
      setReportOverview(overviewData);
      setTenantProfile(tenantData);
      setRestaurantName(tenantData.name);
      setMessage("Management workspace loaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load management workspace.");
    }
  }

  async function refreshReport(activeDate: string) {
    if (!token) return;
    setReportDate(activeDate);
    startTransition(() => {
      void loadManagement(token, activeDate);
    });
  }

  async function exportDailyReportPdf() {
    if (!token || !reportDate) {
      setMessage("Load a report before exporting.");
      return;
    }
    try {
      const response = await fetch(`${apiBaseUrl}/reports/daily/pdf?date=${reportDate}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("PDF export failed.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `daily-report-${reportDate}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "PDF export failed.");
    }
  }

  async function exportOverviewPdf() {
    if (!token || !reportDate) {
      setMessage("Load a report before exporting.");
      return;
    }
    try {
      const response = await fetch(`${apiBaseUrl}/reports/overview/pdf?date=${reportDate}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("PDF export failed.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `overview-report-${reportDate}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "PDF export failed.");
    }
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !categoryName.trim()) return;
    try {
      const created = await apiRequest<Category>(
        "/menu/categories",
        { method: "POST", body: JSON.stringify({ name: categoryName.trim() }) },
        token
      );
      setCategoryName("");
      setItemCategoryId(String(created.id));
      setMessage("Category created.");
      await loadManagement(token, reportDate);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create category.");
    }
  }

  async function createMenuItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    if (!itemName.trim()) {
      setMessage("Item name is required.");
      return;
    }
    if (!itemCategoryId) {
      setMessage("Select a category.");
      return;
    }
    const parsedPrice = Number(itemPrice);
    if (!itemPrice || Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      setMessage("Enter a valid price greater than zero.");
      return;
    }

    try {
      await apiRequest(
        "/menu/items",
        {
          method: "POST",
          body: JSON.stringify({
            name: itemName.trim(),
            categoryId: Number(itemCategoryId),
            description: itemDescription || null,
            photoUrl: itemPhotoUrl || null,
            price: parsedPrice,
            isAvailable: itemAvailable
          })
        },
        token
      );
      setItemName("");
      setItemDescription("");
      setItemPhotoUrl("");
      setItemPrice("");
      setItemAvailable(true);
      setMessage("Menu item created.");
      await loadManagement(token, reportDate);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create menu item.");
    }
  }

  function beginMenuEdit(item: MenuItem) {
    setEditingMenuItemId(item.id);
    setEditingMenuDraft(createMenuDraft(item));
    document.getElementById("menu-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveMenuItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || editingMenuItemId == null) return;

    const parsedPrice = Number(editingMenuDraft.price);
    const categoryId = Number(editingMenuDraft.categoryId);

    if (!editingMenuDraft.name.trim()) {
      setMessage("Item name is required.");
      return;
    }
    if (!editingMenuDraft.categoryId || Number.isNaN(categoryId)) {
      setMessage("Select a valid category.");
      return;
    }
    if (Number.isNaN(parsedPrice) || parsedPrice <= 0) {
      setMessage("Enter a valid price greater than zero.");
      return;
    }

    try {
      await apiRequest(
        `/menu/items/${editingMenuItemId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: editingMenuDraft.name.trim(),
            categoryId,
            description: editingMenuDraft.description || null,
            photoUrl: editingMenuDraft.photoUrl || null,
            price: parsedPrice,
            isAvailable: editingMenuDraft.isAvailable
          })
        },
        token
      );
      setMessage("Menu item updated.");
      await loadManagement(token, reportDate);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update menu item.");
    }
  }

  async function removeMenuItem(itemId: number, itemName: string) {
    if (!token) return;

    const confirmed = window.confirm(`Remove ${itemName} from the menu?`);
    if (!confirmed) {
      return;
    }

    try {
      const response = await apiRequest<{ message?: string }>(
        `/menu/items/${itemId}`,
        {
          method: "DELETE"
        },
        token
      );
      if (editingMenuItemId === itemId) {
        setEditingMenuItemId(null);
        setEditingMenuDraft(createMenuDraft());
      }
      setMessage(response.message ?? "Menu item removed.");
      await loadManagement(token, reportDate);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to remove menu item.");
    }
  }

  async function createStockItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    const parsedQuantity = Number(stockQuantity);
    const parsedReorderLevel = Number(stockReorderLevel || 0);
    const parsedMenuItemId = stockMenuItemId ? Number(stockMenuItemId) : null;

    if (!stockName.trim() || Number.isNaN(parsedQuantity)) {
      setMessage("Stock name and quantity are required.");
      return;
    }

    if (stockType === "MENU" && (!stockMenuItemId || parsedMenuItemId == null || Number.isNaN(parsedMenuItemId))) {
      setMessage("Pick a linked menu item for menu stock.");
      return;
    }

    try {
      await apiRequest(
        "/inventory/items",
        {
          method: "POST",
          body: JSON.stringify({
            name: stockName.trim(),
            unit: stockUnit,
            quantity: parsedQuantity,
            reorderLevel: Number.isNaN(parsedReorderLevel) ? 0 : parsedReorderLevel,
            type: stockType,
            menuItemId: stockType === "MENU" ? parsedMenuItemId : null
          })
        },
        token
      );
      setStockName("");
      setStockUnit("KILOGRAM");
      setStockQuantity("");
      setStockReorderLevel("0");
      setStockType("CONSUMABLE");
      setStockMenuItemId("");
      setMessage("Stock item created.");
      await loadManagement(token, reportDate);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create stock item.");
    }
  }

  function beginStockEdit(item: InventoryItem) {
    setSelectedStockItemId(item.id);
    setStockDrafts((current) => ({
      ...current,
      [item.id]: current[item.id] ?? createStockDraft(item)
    }));
    document.getElementById("stock-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function updateStockDraft(itemId: number, patch: Partial<StockDraft>) {
    setStockDrafts((current) => ({
      ...current,
      [itemId]: {
        ...(current[itemId] ?? createStockDraft(inventory.find((entry) => entry.id === itemId))),
        ...patch
      }
    }));
  }

  async function saveStockItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || selectedStockItemId == null) return;

    const draft = stockDrafts[selectedStockItemId];
    if (!draft) return;

    const quantity = Number(draft.quantity);
    const reorderLevel = Number(draft.reorderLevel);
    const menuItemId = draft.menuItemId ? Number(draft.menuItemId) : null;

    if (!draft.name.trim() || Number.isNaN(quantity) || Number.isNaN(reorderLevel)) {
      setMessage("Name, quantity, and reorder level are required.");
      return;
    }

    if (draft.type === "MENU" && (menuItemId == null || Number.isNaN(menuItemId))) {
      setMessage("Menu stock must be linked to a menu item.");
      return;
    }

    try {
      await apiRequest(
        `/inventory/items/${selectedStockItemId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: draft.name.trim(),
            unit: draft.unit,
            quantity,
            reorderLevel,
            type: draft.type,
            menuItemId: draft.type === "MENU" ? menuItemId : null
          })
        },
        token
      );
      setMessage("Stock item updated.");
      await loadManagement(token, reportDate);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update stock item.");
    }
  }

  function updateRecipeDraftItem(index: number, patch: Partial<RecipeDraftItem>) {
    setRecipeDraftItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function addRecipeDraftItem() {
    setRecipeDraftItems((current) => [...current, createRecipeDraftItem()]);
  }

  function removeRecipeDraftItem(index: number) {
    setRecipeDraftItems((current) => (current.length === 1 ? [createRecipeDraftItem()] : current.filter((_, itemIndex) => itemIndex !== index)));
  }

  function startRecipeEdit(recipe: RecipeDefinition) {
    setRecipeMenuItemId(String(recipe.menuItem.id));
    setRecipeMenuSearch(recipe.menuItem.name);
    setRecipeDraftItems(
      recipe.items.length > 0
        ? recipe.items.map((item) => ({
            stockItemId: String(item.stockItem.id),
            quantity: String(item.quantity),
            unit: item.unit
          }))
        : [createRecipeDraftItem()]
    );
    document.getElementById("recipe-builder")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;

    const menuItemId = Number(recipeMenuItemId);
    const items = recipeDraftItems
      .filter((item) => item.stockItemId && item.quantity)
      .map((item) => ({
        stockItemId: Number(item.stockItemId),
        quantity: Number(item.quantity),
        unit: item.unit
      }));

    if (Number.isNaN(menuItemId) || items.length === 0) {
      setMessage("Choose a menu item and at least one ingredient.");
      return;
    }

    if (items.some((item) => Number.isNaN(item.stockItemId) || Number.isNaN(item.quantity) || item.quantity <= 0)) {
      setMessage("Each recipe line needs a valid ingredient and quantity.");
      return;
    }

    try {
      await apiRequest(
        "/inventory/recipes",
        {
          method: "POST",
          body: JSON.stringify({ menuItemId, items })
        },
        token
      );
      setMessage("Recipe saved.");
      await loadManagement(token, reportDate);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save recipe.");
    }
  }

  async function createStaffMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    if (!staffFirstName.trim() || !staffLastName.trim() || !staffEmail.trim() || !staffPassword.trim()) {
      setMessage("First name, last name, email, password, and role are required.");
      return;
    }

    try {
      await apiRequest(
        "/staff",
        {
          method: "POST",
          body: JSON.stringify({
            firstName: staffFirstName.trim(),
            lastName: staffLastName.trim(),
            email: staffEmail.trim(),
            password: staffPassword,
            role: staffRole
          })
        },
        token
      );
      setStaffFirstName("");
      setStaffLastName("");
      setStaffEmail("");
      setStaffPassword("");
      setStaffRole("CASHIER");
      setMessage("Employee profile created.");
      await loadManagement(token, reportDate);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create employee profile.");
    }
  }

  async function updateRestaurantProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    if (!restaurantName.trim()) {
      setMessage("Restaurant name is required.");
      return;
    }

    try {
      const updated = await apiRequest<TenantProfile>(
        "/tenant/profile",
        {
          method: "PATCH",
          body: JSON.stringify({
            name: restaurantName.trim()
          })
        },
        token
      );

      setTenantProfile(updated);
      setRestaurantName(updated.name);
      setSession((current) => {
        if (!current) return current;
        const next = {
          ...current,
          tenant: {
            ...current.tenant,
            name: updated.name
          }
        };
        window.localStorage.setItem(storageKey, JSON.stringify({ ...next, token }));
        return next;
      });
      setMessage("Restaurant profile updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update restaurant profile.");
    }
  }

  function updateStaffDraft(memberId: number, patch: Partial<StaffDraft>) {
    setStaffDrafts((current) => ({
      ...current,
      [memberId]: {
        ...(current[memberId] ?? createEmptyStaffDraft()),
        ...patch
      }
    }));
  }

  async function saveStaffProfile(memberId: number) {
    if (!token) return;
    const draft = staffDrafts[memberId];
    if (!draft) return;

    try {
      await apiRequest(
        `/staff/${memberId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            firstName: draft.firstName.trim(),
            lastName: draft.lastName.trim(),
            email: draft.email.trim(),
            role: draft.role,
            isActive: draft.isActive,
            ...(draft.password ? { password: draft.password } : {})
          })
        },
        token
      );
      updateStaffDraft(memberId, { password: "" });
      setMessage("Employee profile updated.");
      await loadManagement(token, reportDate);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update employee profile.");
    }
  }

  function canCreateMenuItem() {
    const parsedPrice = Number(itemPrice);
    return Boolean(
      token &&
      itemName.trim() &&
      itemCategoryId &&
      itemPrice &&
      !Number.isNaN(parsedPrice) &&
      parsedPrice > 0
    );
  }

  const allMenuItems = categories.flatMap((category) =>
    category.items.map((item) => ({ ...item, categoryName: category.name }))
  );
  const filteredMenuItems = allMenuItems.filter((item) =>
    normalizeSearch(`${item.name} ${item.categoryName} ${item.description ?? ""}`).includes(normalizeSearch(menuSearch))
  );
  const filteredInventory = inventory.filter((item) =>
    normalizeSearch(`${item.name} ${item.type} ${item.unit} ${item.menuItem?.name ?? ""}`).includes(normalizeSearch(inventorySearch))
  );
  const consumableItems = inventory.filter((item) => item.type === "CONSUMABLE");
  const filteredRecipeMenuItems = allMenuItems.filter((item) =>
    normalizeSearch(`${item.name} ${item.categoryName}`).includes(normalizeSearch(recipeMenuSearch))
  );
  const filteredRecipeIngredients = consumableItems.filter((item) =>
    normalizeSearch(`${item.name} ${item.unit}`).includes(normalizeSearch(recipeIngredientSearch))
  );
  const selectedStockItem = selectedStockItemId == null ? null : inventory.find((item) => item.id === selectedStockItemId) ?? null;
  const selectedStockDraft = selectedStockItemId == null ? null : stockDrafts[selectedStockItemId] ?? createStockDraft(selectedStockItem ?? undefined);
  const totalItems = allMenuItems.length;
  const activeStaff = staff.filter((member) => member.isActive).length;
  const currency = session?.tenant.currency ?? "KES";

  if (!session || !token) {
    return (
      <main className="page-shell">
        <section className="hero card">
          <div>
            <p className="eyebrow">Management</p>
            <h1>Sign in required.</h1>
            <p className="lede">You must be signed in as a Manager to access restaurant management.</p>
          </div>
          <div>
            <a href="/" className="section-chip" style={{ display: "inline-block" }}>← Back to POS</a>
          </div>
        </section>
      </main>
    );
  }

  if (session.user.role !== "MANAGER") {
    return (
      <main className="page-shell">
        <section className="hero card">
          <div>
            <p className="eyebrow">Management</p>
            <h1>Access restricted.</h1>
            <p className="lede">Only Managers can access restaurant management.</p>
          </div>
          <div>
            <a href="/" className="section-chip" style={{ display: "inline-block" }}>← Back to POS</a>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Management · {session.tenant.name}</p>
          <h1>Restaurant management</h1>
          <p className="lede">
            Phone-first menu, inventory, recipes, employees, and reporting in one manager workspace.
          </p>
        </div>
        <div className="topbar-actions">
          <button onClick={() => token && void loadManagement(token, reportDate)} disabled={isPending}>
            Refresh
          </button>
          <a href="/" className="section-chip">← Back to POS</a>
        </div>
      </section>

      <section className="status-banner" data-tone={getMessageTone(message)} aria-live="polite">
        <div>
          <strong>Status</strong>
          <p>{message}</p>
        </div>
        <span className="status-pill">{isPending ? "Working" : "Ready"}</span>
      </section>

      <section className="stat-strip" style={{ marginBottom: 18 }}>
        <div className="stat-chip">
          <span>Menu catalogue</span>
          <strong>{categories.length} categories · {totalItems} items</strong>
        </div>
        <div className="stat-chip">
          <span>Inventory</span>
          <strong>{inventory.length} stock items · {recipes.length} recipes</strong>
        </div>
        <div className="stat-chip">
          <span>Daily sales</span>
          <strong>{dailyReport ? formatCurrency(dailyReport.salesTotal, currency) : "Loading..."}</strong>
        </div>
      </section>

      <nav className="section-nav" aria-label="Management sections">
        <a href="#overview" className="section-chip">Overview</a>
        <a href="#restaurant-admin" className="section-chip">Restaurant admin</a>
        <a href="#employees" className="section-chip">Employees</a>
        <a href="#reports" className="section-chip">Reports</a>
        <a href="#menu" className="section-chip">Menu</a>
        <a href="#inventory" className="section-chip">Inventory & recipes</a>
      </nav>

      <section id="overview" className="metrics-grid">
        {[
          ["Available menu items", allMenuItems.filter((item) => item.isAvailable).length],
          ["Recipes mapped", recipes.length],
          ["Consumables tracked", inventory.filter((item) => item.type === "CONSUMABLE").length],
          ["Orders on selected day", dailyReport?.ordersCount ?? "Loading..."],
          ["Payments on selected day", dailyReport?.paymentCount ?? "Loading..."],
          ["Current low stock alerts", reportOverview?.stockSnapshot.lowStockCount ?? "Loading..."]
        ].map(([label, value]) => (
          <article key={label} className="card metric-card">
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="workspace-grid">
        <article id="restaurant-admin" className="card panel">
          <div className="panel-head">
            <h2>Restaurant admin</h2>
            <p>Keep restaurant identity current from the same screen.</p>
          </div>
          <form className="stack" onSubmit={updateRestaurantProfile}>
            <label>
              Restaurant name
              <input
                value={restaurantName}
                onChange={(event) => setRestaurantName(event.target.value)}
                placeholder="Enter restaurant name"
              />
            </label>
            <button type="submit" disabled={isPending || !restaurantName.trim() || restaurantName.trim() === (tenantProfile?.name ?? "").trim()}>
              Save restaurant profile
            </button>
          </form>
        </article>

        <article id="reports" className="card panel">
          <div className="panel-head">
            <h2>Reports</h2>
            <p>Review sales, top items, and stock pressure from one mobile-friendly panel.</p>
          </div>
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              void refreshReport(reportDate);
            }}
          >
            <label>
              Report date
              <input
                type="date"
                value={reportDate}
                onChange={(event) => setReportDate(event.target.value)}
              />
            </label>
            <div className="inline-actions">
              <button type="submit" disabled={isPending}>Load report</button>
              <button type="button" onClick={() => void exportDailyReportPdf()} disabled={!reportDate || isPending}>
                Export daily PDF
              </button>
              <button type="button" onClick={() => void exportOverviewPdf()} disabled={!reportDate || isPending}>
                Export overview PDF
              </button>
            </div>
          </form>

          {reportOverview ? (
            <>
              <div className="compact-list" style={{ marginTop: 18 }}>
                {[reportOverview.daily, reportOverview.weekly, reportOverview.monthly].map((period) => (
                  <div key={period.label} className="order-card">
                    <strong>{period.label}</strong>
                    <p>{formatPeriodLabel(period.startDate, period.endDate)}</p>
                    <p>Sales · {formatCurrency(period.salesTotal, currency)}</p>
                    <p>Orders · {period.ordersCount}</p>
                    <p>Payments · {period.paymentCount}</p>
                    <p>Items sold · {period.itemsSold}</p>
                    <p>Average order · {formatCurrency(period.averageOrderValue, currency)}</p>
                  </div>
                ))}
              </div>

              <div className="compact-list" style={{ marginTop: 18 }}>
                <div className="stat-chip">
                  <span>Tracked stock items</span>
                  <strong>{reportOverview.stockSnapshot.totalTrackedItems}</strong>
                </div>
                <div className="stat-chip">
                  <span>Low stock now</span>
                  <strong>{reportOverview.stockSnapshot.lowStockCount}</strong>
                </div>
                <div className="stat-chip">
                  <span>Daily top item revenue</span>
                  <strong>
                    {dailyReport?.mostBoughtItem
                      ? formatCurrency(dailyReport.mostBoughtItem.revenue, currency)
                      : formatCurrency(0, currency)}
                  </strong>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ marginTop: 18 }}>
              <p>Daily report data will appear here.</p>
            </div>
          )}
        </article>

        <article className="card panel">
          <div className="panel-head">
            <h2>Stock alerts</h2>
            <p>Current low stock signals from the report snapshot.</p>
          </div>
          {!reportOverview || reportOverview.stockSnapshot.lowStockItems.length === 0 ? (
            <div className="empty-state">
              <strong>No low stock alerts</strong>
              <p>Inventory levels are healthy for the selected date.</p>
            </div>
          ) : (
            <div className="compact-list">
              {reportOverview.stockSnapshot.lowStockItems.map((item) => (
                <div key={item.id} className="order-card">
                  <strong>{item.name}</strong>
                  <p>{item.quantity} {item.unit} left · reorder at {item.reorderLevel}</p>
                </div>
              ))}
            </div>
          )}
        </article>

        <article id="employees" className="card panel" style={{ gridColumn: "1 / -1" }}>
          <div className="panel-head">
            <h2>Employee management</h2>
            <p>Create employee profiles, adjust roles, and manage access without leaving this workspace.</p>
          </div>

          <div className="management-subgrid">
            <form className="stack" onSubmit={createStaffMember}>
              <label>
                First name
                <input value={staffFirstName} onChange={(event) => setStaffFirstName(event.target.value)} />
              </label>
              <label>
                Last name
                <input value={staffLastName} onChange={(event) => setStaffLastName(event.target.value)} />
              </label>
              <label>
                Email
                <input
                  type="email"
                  autoComplete="email"
                  value={staffEmail}
                  onChange={(event) => setStaffEmail(event.target.value)}
                />
              </label>
              <label>
                Initial password
                <input
                  type="password"
                  autoComplete="new-password"
                  value={staffPassword}
                  onChange={(event) => setStaffPassword(event.target.value)}
                />
              </label>
              <label>
                Role
                <select value={staffRole} onChange={(event) => setStaffRole(event.target.value)}>
                  {roleOptions.map((role) => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </label>
              <button type="submit" disabled={isPending}>
                Add employee
              </button>
            </form>

            <div className="order-list">
              {staff.length === 0 ? (
                <div className="empty-state">
                  <strong>No employees yet</strong>
                  <p>Create the first employee profile to start assigning roles.</p>
                </div>
              ) : staff.map((member) => {
                const draft = staffDrafts[member.id] ?? createEmptyStaffDraft();

                return (
                  <div key={member.id} className="order-card">
                    <div className="order-head">
                      <div>
                        <strong>{member.firstName} {member.lastName}</strong>
                        <p>{member.email}</p>
                      </div>
                      <span
                        className="status-pill"
                        style={{
                          background: member.isActive ? "rgba(47, 107, 61, 0.12)" : "rgba(161, 107, 0, 0.12)",
                          color: member.isActive ? "var(--success)" : "var(--warning)"
                        }}
                      >
                        {member.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <div className="field-grid" style={{ marginTop: 16 }}>
                      <label>
                        First name
                        <input
                          value={draft.firstName}
                          onChange={(event) => updateStaffDraft(member.id, { firstName: event.target.value })}
                        />
                      </label>
                      <label>
                        Last name
                        <input
                          value={draft.lastName}
                          onChange={(event) => updateStaffDraft(member.id, { lastName: event.target.value })}
                        />
                      </label>
                      <label>
                        Email
                        <input
                          type="email"
                          value={draft.email}
                          onChange={(event) => updateStaffDraft(member.id, { email: event.target.value })}
                        />
                      </label>
                      <label>
                        Role
                        <select
                          value={draft.role}
                          onChange={(event) => updateStaffDraft(member.id, { role: event.target.value })}
                        >
                          {roleOptions.map((role) => (
                            <option key={role.value} value={role.value}>{role.label}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Reset password
                        <input
                          type="password"
                          placeholder="Leave blank to keep current"
                          value={draft.password}
                          onChange={(event) => updateStaffDraft(member.id, { password: event.target.value })}
                        />
                      </label>
                      <label className="checkbox-label">
                        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <input
                            type="checkbox"
                            checked={draft.isActive}
                            onChange={(event) => updateStaffDraft(member.id, { isActive: event.target.checked })}
                            style={{ width: "auto", padding: 0, borderRadius: 4 }}
                          />
                          Employee can access the system
                        </span>
                      </label>
                    </div>

                    <div className="inline-actions" style={{ marginTop: 16 }}>
                      <button type="button" onClick={() => void saveStaffProfile(member.id)} disabled={isPending}>
                        Save profile
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </article>

        <article id="menu" className="card panel">
          <div className="panel-head">
            <h2>New category</h2>
            <p>Create categories without leaving the manager screen.</p>
          </div>
          <form className="stack" onSubmit={createCategory}>
            <label>
              Category name
              <input
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                placeholder="e.g. Starters, Mains, Drinks"
              />
            </label>
            <button type="submit" disabled={!categoryName.trim() || isPending}>
              Create category
            </button>
          </form>
        </article>

        <article className="card panel">
          <div className="panel-head">
            <h2>New menu item</h2>
            <p>Add a priced item and attach it to the right category.</p>
          </div>
          {categories.length === 0 ? (
            <div className="empty-state">
              <strong>Create a category first</strong>
              <p>The item form becomes available once at least one category exists.</p>
            </div>
          ) : (
            <form className="stack" onSubmit={createMenuItem}>
              <div className="field-grid">
                <label>
                  Item name *
                  <input
                    value={itemName}
                    onChange={(event) => setItemName(event.target.value)}
                    placeholder="e.g. Chicken Wings"
                  />
                </label>
                <label>
                  Category *
                  <select value={itemCategoryId} onChange={(event) => setItemCategoryId(event.target.value)}>
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Price ({currency}) *
                  <input
                    inputMode="decimal"
                    value={itemPrice}
                    onChange={(event) => setItemPrice(event.target.value)}
                    placeholder="e.g. 450"
                  />
                </label>
                <label>
                  Description
                  <input
                    value={itemDescription}
                    onChange={(event) => setItemDescription(event.target.value)}
                    placeholder="Short description"
                  />
                </label>
                <label>
                  Image URL
                  <input
                    value={itemPhotoUrl}
                    onChange={(event) => setItemPhotoUrl(event.target.value)}
                    placeholder="https://..."
                  />
                </label>
                <label className="checkbox-label">
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={itemAvailable}
                      onChange={(event) => setItemAvailable(event.target.checked)}
                      style={{ width: "auto", padding: 0, borderRadius: 4 }}
                    />
                    Available on menu
                  </span>
                </label>
              </div>
              <button type="submit" disabled={!canCreateMenuItem() || isPending}>
                Create menu item
              </button>
            </form>
          )}
        </article>

        <article id="menu-editor" className="card panel" style={{ gridColumn: "1 / -1" }}>
          <div className="panel-head">
            <h2>Edit menu item</h2>
            <p>Search, edit, and remove menu items without prompt dialogs or desktop-only layouts.</p>
          </div>
          <div className="stack">
            <label>
              Search menu
              <input
                value={menuSearch}
                onChange={(event) => setMenuSearch(event.target.value)}
                placeholder="Search by item, category, or description"
              />
            </label>
            <div className="selection-grid">
              {filteredMenuItems.length === 0 ? (
                <div className="empty-state">
                  <p>No menu items match your search.</p>
                </div>
              ) : filteredMenuItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`selection-card ${editingMenuItemId === item.id ? "selection-card-active" : ""}`}
                  onClick={() => beginMenuEdit(item)}
                >
                  <span>{item.categoryName}</span>
                  <strong>{item.name}</strong>
                  <small>{formatCurrency(item.price, currency)} · {item.isAvailable ? "Available" : "Unavailable"}</small>
                </button>
              ))}
            </div>

            {editingMenuItemId == null ? (
              <div className="empty-state">
                <strong>Select an item</strong>
                <p>Tap any menu card above to edit it or remove it from sale.</p>
              </div>
            ) : (
              <form className="stack" onSubmit={saveMenuItem}>
                <div className="field-grid">
                  <label>
                    Item name
                    <input
                      value={editingMenuDraft.name}
                      onChange={(event) => setEditingMenuDraft((current) => ({ ...current, name: event.target.value }))}
                    />
                  </label>
                  <label>
                    Category
                    <select
                      value={editingMenuDraft.categoryId}
                      onChange={(event) => setEditingMenuDraft((current) => ({ ...current, categoryId: event.target.value }))}
                    >
                      <option value="">Select category</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Price ({currency})
                    <input
                      inputMode="decimal"
                      value={editingMenuDraft.price}
                      onChange={(event) => setEditingMenuDraft((current) => ({ ...current, price: event.target.value }))}
                    />
                  </label>
                  <label>
                    Image URL
                    <input
                      value={editingMenuDraft.photoUrl}
                      onChange={(event) => setEditingMenuDraft((current) => ({ ...current, photoUrl: event.target.value }))}
                    />
                  </label>
                  <label style={{ gridColumn: "1 / -1" }}>
                    Description
                    <textarea
                      rows={3}
                      value={editingMenuDraft.description}
                      onChange={(event) => setEditingMenuDraft((current) => ({ ...current, description: event.target.value }))}
                    />
                  </label>
                  <label className="checkbox-label">
                    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input
                        type="checkbox"
                        checked={editingMenuDraft.isAvailable}
                        onChange={(event) => setEditingMenuDraft((current) => ({ ...current, isAvailable: event.target.checked }))}
                        style={{ width: "auto", padding: 0, borderRadius: 4 }}
                      />
                      Available on menu
                    </span>
                  </label>
                </div>
                <div className="inline-actions">
                  <button type="submit" disabled={isPending}>Save menu item</button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => void removeMenuItem(editingMenuItemId, editingMenuDraft.name || "this item")}
                    disabled={isPending}
                  >
                    Remove item
                  </button>
                </div>
              </form>
            )}
          </div>
        </article>

        <article id="inventory" className="card panel" style={{ gridColumn: "1 / -1" }}>
          <div className="panel-head">
            <h2>Inventory and recipes</h2>
            <p>Search ingredients, edit consumables, map recipes to menu items, and keep the whole flow usable on phones.</p>
          </div>

          <div className="touch-grid">
            <div className="stat-chip">
              <span>Stock items</span>
              <strong>{inventory.length}</strong>
            </div>
            <div className="stat-chip">
              <span>Consumables</span>
              <strong>{consumableItems.length}</strong>
            </div>
            <div className="stat-chip">
              <span>Recipes</span>
              <strong>{recipes.length}</strong>
            </div>
            <div className="stat-chip">
              <span>Low stock</span>
              <strong>{inventory.filter((item) => item.lowStock || item.quantity <= item.reorderLevel).length}</strong>
            </div>
          </div>

          <div className="management-subgrid" style={{ marginTop: 18 }}>
            <section className="inventory-panel">
              <div className="panel-head">
                <h2>Add stock item</h2>
                <p>Create consumables or menu-linked stock from the same compact form.</p>
              </div>
              <form className="stack" onSubmit={createStockItem}>
                <div className="chip-toggle">
                  {(["CONSUMABLE", "MENU"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={stockType === option ? "toggle-active" : "toggle-inactive"}
                      onClick={() => setStockType(option)}
                    >
                      {option === "MENU" ? "Menu stock" : "Consumable"}
                    </button>
                  ))}
                </div>
                <div className="field-grid">
                  <label>
                    Stock item name
                    <input value={stockName} onChange={(event) => setStockName(event.target.value)} placeholder="e.g. Cooking oil" />
                  </label>
                  <label>
                    Unit
                    <select value={stockUnit} onChange={(event) => setStockUnit(event.target.value as StockUnit)}>
                      {stockUnits.map((unit) => (
                        <option key={unit.value} value={unit.value}>{unit.label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Quantity
                    <input value={stockQuantity} onChange={(event) => setStockQuantity(event.target.value)} inputMode="decimal" />
                  </label>
                  <label>
                    Reorder level
                    <input value={stockReorderLevel} onChange={(event) => setStockReorderLevel(event.target.value)} inputMode="decimal" />
                  </label>
                  {stockType === "MENU" ? (
                    <label style={{ gridColumn: "1 / -1" }}>
                      Linked menu item
                      <select value={stockMenuItemId} onChange={(event) => setStockMenuItemId(event.target.value)}>
                        <option value="">Select menu item</option>
                        {allMenuItems.map((item) => (
                          <option key={item.id} value={item.id}>{item.categoryName} · {item.name}</option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>
                <button type="submit" disabled={isPending}>Create stock item</button>
              </form>
            </section>

            <section id="stock-editor" className="inventory-panel">
              <div className="panel-head">
                <h2>Edit stock item</h2>
                <p>Change names, units, quantities, reorder levels, or linked menu items.</p>
              </div>
              <div className="stack">
                <label>
                  Search stock
                  <input
                    value={inventorySearch}
                    onChange={(event) => setInventorySearch(event.target.value)}
                    placeholder="Search by name, unit, or linked item"
                  />
                </label>
                <div className="selection-grid">
                  {filteredInventory.length === 0 ? (
                    <div className="empty-state">
                      <p>No stock items match your search.</p>
                    </div>
                  ) : filteredInventory.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`selection-card ${selectedStockItemId === item.id ? "selection-card-active" : ""}`}
                      onClick={() => beginStockEdit(item)}
                    >
                      <span>{item.type === "MENU" ? "Menu stock" : "Consumable"}</span>
                      <strong>{item.name}</strong>
                      <small>
                        {item.quantity} {item.unit} · reorder at {item.reorderLevel}
                        {item.menuItem ? ` · ${item.menuItem.name}` : ""}
                      </small>
                    </button>
                  ))}
                </div>

                {!selectedStockItem || !selectedStockDraft ? (
                  <div className="empty-state">
                    <strong>Select a stock item</strong>
                    <p>Tap any stock card above to edit units, quantities, or linked menu details.</p>
                  </div>
                ) : (
                  <form className="stack" onSubmit={saveStockItem}>
                    <div className="field-grid">
                      <label>
                        Stock item name
                        <input
                          value={selectedStockDraft.name}
                          onChange={(event) => updateStockDraft(selectedStockItem.id, { name: event.target.value })}
                        />
                      </label>
                      <label>
                        Unit
                        <select
                          value={selectedStockDraft.unit}
                          onChange={(event) => updateStockDraft(selectedStockItem.id, { unit: event.target.value as StockUnit })}
                        >
                          {stockUnits.map((unit) => (
                            <option key={unit.value} value={unit.value}>{unit.label}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Quantity
                        <input
                          value={selectedStockDraft.quantity}
                          onChange={(event) => updateStockDraft(selectedStockItem.id, { quantity: event.target.value })}
                          inputMode="decimal"
                        />
                      </label>
                      <label>
                        Reorder level
                        <input
                          value={selectedStockDraft.reorderLevel}
                          onChange={(event) => updateStockDraft(selectedStockItem.id, { reorderLevel: event.target.value })}
                          inputMode="decimal"
                        />
                      </label>
                      <label>
                        Stock type
                        <select
                          value={selectedStockDraft.type}
                          onChange={(event) => updateStockDraft(selectedStockItem.id, { type: event.target.value as "MENU" | "CONSUMABLE" })}
                        >
                          <option value="CONSUMABLE">Consumable</option>
                          <option value="MENU">Menu stock</option>
                        </select>
                      </label>
                      {selectedStockDraft.type === "MENU" ? (
                        <label>
                          Linked menu item
                          <select
                            value={selectedStockDraft.menuItemId}
                            onChange={(event) => updateStockDraft(selectedStockItem.id, { menuItemId: event.target.value })}
                          >
                            <option value="">Select menu item</option>
                            {allMenuItems.map((item) => (
                              <option key={item.id} value={item.id}>{item.categoryName} · {item.name}</option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                    </div>
                    <button type="submit" disabled={isPending}>Save stock item</button>
                  </form>
                )}
              </div>
            </section>
          </div>

          <div className="management-subgrid" style={{ marginTop: 18 }}>
            <section id="recipe-builder" className="inventory-panel">
              <div className="panel-head">
                <h2>Recipe builder</h2>
                <p>Pick a menu item, search ingredients, and save recipe changes without scrolling through every stock record.</p>
              </div>
              <form className="stack" onSubmit={saveRecipe}>
                <label>
                  Search menu item
                  <input
                    value={recipeMenuSearch}
                    onChange={(event) => setRecipeMenuSearch(event.target.value)}
                    placeholder="Search menu item"
                  />
                </label>
                <div className="selection-grid">
                  {filteredRecipeMenuItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`selection-card ${recipeMenuItemId === String(item.id) ? "selection-card-active" : ""}`}
                      onClick={() => setRecipeMenuItemId(String(item.id))}
                    >
                      <span>{item.categoryName}</span>
                      <strong>{item.name}</strong>
                      <small>{formatCurrency(item.price, currency)}</small>
                    </button>
                  ))}
                </div>

                <label>
                  Search ingredients
                  <input
                    value={recipeIngredientSearch}
                    onChange={(event) => setRecipeIngredientSearch(event.target.value)}
                    placeholder="Search consumables"
                  />
                </label>

                {recipeDraftItems.map((item, index) => {
                  const selectedIngredient = consumableItems.find((entry) => entry.id === Number(item.stockItemId));
                  const ingredientOptions = selectedIngredient && !filteredRecipeIngredients.some((entry) => entry.id === selectedIngredient.id)
                    ? [selectedIngredient, ...filteredRecipeIngredients]
                    : filteredRecipeIngredients;

                  return (
                    <div key={index} className="list-card">
                      <div className="field-grid">
                        <label>
                          Ingredient
                          <select
                            value={item.stockItemId}
                            onChange={(event) => {
                              const selected = consumableItems.find((entry) => entry.id === Number(event.target.value));
                              updateRecipeDraftItem(index, {
                                stockItemId: event.target.value,
                                unit: selected?.unit ?? item.unit
                              });
                            }}
                          >
                            <option value="">Select ingredient</option>
                            {ingredientOptions.map((entry) => (
                              <option key={entry.id} value={entry.id}>
                                {entry.name} · {entry.quantity} {entry.unit}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Quantity used
                          <input
                            value={item.quantity}
                            onChange={(event) => updateRecipeDraftItem(index, { quantity: event.target.value })}
                            inputMode="decimal"
                          />
                        </label>
                        <label>
                          Unit
                          <select
                            value={item.unit}
                            onChange={(event) => updateRecipeDraftItem(index, { unit: event.target.value as StockUnit })}
                          >
                            {stockUnits.map((unit) => (
                              <option key={unit.value} value={unit.value}>{unit.label}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <button type="button" className="ghost-button" onClick={() => removeRecipeDraftItem(index)}>
                        Remove ingredient
                      </button>
                    </div>
                  );
                })}

                <div className="inline-actions">
                  <button type="button" className="ghost-button" onClick={addRecipeDraftItem}>Add ingredient</button>
                  <button type="submit" disabled={isPending}>Save recipe</button>
                </div>
              </form>
            </section>

            <section className="inventory-panel">
              <div className="panel-head">
                <h2>Recipe coverage</h2>
                <p>Edit any existing recipe directly from the list below.</p>
              </div>
              <div className="order-list">
                {recipes.length === 0 ? (
                  <div className="empty-state">
                    <strong>No recipes yet</strong>
                    <p>Build the first recipe to connect menu sales to ingredient deduction.</p>
                  </div>
                ) : recipes.map((recipe) => (
                  <div key={recipe.id} className="order-card">
                    <div className="order-head">
                      <div>
                        <strong>{recipe.menuItem.name}</strong>
                        <p>{recipe.items.length} ingredient{recipe.items.length === 1 ? "" : "s"}</p>
                      </div>
                      <button type="button" className="ghost-button" onClick={() => startRecipeEdit(recipe)}>
                        Edit recipe
                      </button>
                    </div>
                    <div className="compact-list" style={{ marginTop: 14 }}>
                      {recipe.items.map((item) => (
                        <div key={item.id} className="list-card">
                          <strong>{item.stockItem.name}</strong>
                          <p>{item.quantity} {item.unit}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </article>
      </section>
    </main>
  );
}
