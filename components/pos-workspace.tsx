"use client";

import { FormEvent, useEffect, useRef, useState, useTransition } from "react";

import { apiRequest, type LoginResponse } from "../lib/api";

type Category = {
  id: number;
  name: string;
  items: Array<{
    id: number;
    name: string;
    description: string | null;
    photoUrl?: string | null;
    price: number;
    isAvailable: boolean;
  }>;
};

type TableItem = {
  id: number;
  label: string;
  capacity: number;
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

type RecipeDraftItem = {
  stockItemId: string;
  quantity: string;
  unit: StockUnit;
};

type DashboardSummary = {
  openOrders: number;
  readyOrders: number;
  lowStockItems: number;
  todaySales: number | null;
  activeTables: number;
  menuItems: number;
};

type Order = {
  id: number;
  orderNumber: string;
  createdAt: string;
  type: "DINE_IN" | "TAKEAWAY";
  status: string;
  table: { id: number; label: string } | null;
  deliveryAgentId?: number | null;
  deliveryAgent?: DeliveryAgent | null;
  dispatchSmsRequested?: boolean;
  dispatchSmsSentAt?: string | null;
  customerName: string | null;
  customerPhone?: string | null;
  deliveryLocation?: string | null;
  deliveryAddress?: string | null;
  items: Array<{
    id: number;
    quantity: number;
    status: string;
    lineTotal: number;
    menuItem: { id: number; name: string };
  }>;
  totals: {
    subtotal: number;
    itemCount: number;
  };
};

type DeliveryAgent = {
  id: number;
  firstName: string;
  lastName: string;
  phone: string;
  notes: string | null;
  isActive: boolean;
};

type Report = {
  date: string;
  salesTotal: number;
  paymentCount: number;
  ordersCount: number;
  itemsSold: number;
  lowStockItems: Array<{
    id: number;
    name: string;
    quantity: number;
    reorderLevel: number;
    unit: string;
  }>;
};

type SmsMessage = {
  id: number;
  recipient: string;
  message: string;
  status: string;
  createdAt: string;
};

type MpesaTransaction = {
  id: number;
  checkoutRequestId: string;
  phoneNumber: string;
  amount: number;
  reference: string | null;
  status: string;
  createdAt: string;
};

type StaffMember = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
};

type TenantProfile = {
  id: number;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  contactEmail: string | null;
  logoUrl?: string | null;
  brandColor?: string | null;
};

type ActivityNotice = {
  id: number;
  tone: "success" | "warning" | "info";
  text: string;
};

const storageKey = "tableflow-session";
const loginPresets = [
  { label: "Owner", sub: "Jua Kali Grill", email: "0702550190", password: "123" },
  { label: "Manager", sub: "Demo Restaurant", email: "manager@demo.tableflow.app", password: "Admin@1234" },
  { label: "Cashier", sub: "Demo Restaurant", email: "cashier@demo.tableflow.app", password: "Admin@1234" },
  { label: "Kitchen", sub: "Demo Restaurant", email: "kitchen@demo.tableflow.app", password: "Admin@1234" },
  { label: "Delivery", sub: "Demo Restaurant", email: "delivery@demo.tableflow.app", password: "Admin@1234" }
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

function formatCurrency(amount: number | null | undefined) {
  return `KES ${Number(amount ?? 0).toLocaleString()}`;
}

function formatOrderTime(iso: string | null | undefined) {
  if (!iso) {
    return "Time unavailable";
  }

  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getMessageTone(message: string): "success" | "warning" | "info" {
  const normalized = message.toLowerCase();

  if (normalized.includes("unable") || normalized.includes("failed")) {
    return "warning";
  }

  if (normalized.includes("synced") || normalized.includes("created") || normalized.includes("updated") || normalized.includes("recorded") || normalized.includes("saved")) {
    return "success";
  }

  return "info";
}

function canCancelOrder(status: string) {
  return !["READY", "PAID", "VOIDED"].includes(status);
}

export function PosWorkspace() {
  const [session, setSession] = useState<LoginResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tables, setTables] = useState<TableItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [recipes, setRecipes] = useState<RecipeDefinition[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [smsMessages, setSmsMessages] = useState<SmsMessage[]>([]);
  const [mpesaTransactions, setMpesaTransactions] = useState<MpesaTransaction[]>([]);
  const [message, setMessage] = useState<string>("");
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [deliveryAgents, setDeliveryAgents] = useState<DeliveryAgent[]>([]);
  const [tenantProfile, setTenantProfile] = useState<TenantProfile | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orderMode, setOrderMode] = useState<"DINE_IN" | "TAKEAWAY">("DINE_IN");
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string>("");
  const [quantity, setQuantity] = useState("1");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [selectedDeliveryAgentId, setSelectedDeliveryAgentId] = useState("");
  const [sendDispatchSms, setSendDispatchSms] = useState(true);
  const [paymentOrderId, setPaymentOrderId] = useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [tableLabel, setTableLabel] = useState("");
  const [tableCapacity, setTableCapacity] = useState("4");
  const [stockName, setStockName] = useState("");
  const [stockUnit, setStockUnit] = useState<StockUnit>("KILOGRAM");
  const [stockQuantity, setStockQuantity] = useState("");
  const [stockReorderLevel, setStockReorderLevel] = useState("");
  const [stockType, setStockType] = useState<"MENU" | "CONSUMABLE">("CONSUMABLE");
  const [stockMenuItemId, setStockMenuItemId] = useState("");
  const [recipeMenuItemId, setRecipeMenuItemId] = useState("");
  const [recipeDraftItems, setRecipeDraftItems] = useState<RecipeDraftItem[]>([{ stockItemId: "", quantity: "", unit: "GRAM" }]);
  const [stockDrafts, setStockDrafts] = useState<Record<number, { quantity: string; reorderLevel: string }>>({});
  const [smsRecipient, setSmsRecipient] = useState("");
  const [smsText, setSmsText] = useState("");
  const [staffFirstName, setStaffFirstName] = useState("");
  const [staffLastName, setStaffLastName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffRole, setStaffRole] = useState("CASHIER");
  const [editingStaffId, setEditingStaffId] = useState<string>("");
  const [editingMenuItemId, setEditingMenuItemId] = useState<string>("");
  const [editMenuName, setEditMenuName] = useState("");
  const [editMenuPrice, setEditMenuPrice] = useState("");
  const [editMenuDescription, setEditMenuDescription] = useState("");
  const [editMenuIsAvailable, setEditMenuIsAvailable] = useState(true);
  const [deliveryAgentFirstName, setDeliveryAgentFirstName] = useState("");
  const [deliveryAgentLastName, setDeliveryAgentLastName] = useState("");
  const [deliveryAgentPhone, setDeliveryAgentPhone] = useState("");
  const [deliveryAgentNotes, setDeliveryAgentNotes] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [tenantAddress, setTenantAddress] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [tenantContactEmail, setTenantContactEmail] = useState("");
  const [tenantLogoUrl, setTenantLogoUrl] = useState("");
  const [tenantBrandColor, setTenantBrandColor] = useState("#a64b2a");
  const [invoiceOrderId, setInvoiceOrderId] = useState("");
  const [smsBalance, setSmsBalance] = useState<number | null>(null);
  const [orderCart, setOrderCart] = useState<Array<{ menuItemId: number; name: string; price: number; quantity: number }>>([]);
  const [menuSearch, setMenuSearch] = useState("");
  const [ordersFilter, setOrdersFilter] = useState<"today" | "open" | "history">("today");
  const [forgotMode, setForgotMode] = useState<"off" | "phone" | "otp">("off");
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotMessage, setForgotMessage] = useState("");
  const [notices, setNotices] = useState<ActivityNotice[]>([]);
  const [busyActions, setBusyActions] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const lowStockAlertKeyRef = useRef("");

  function showNotice(text: string, tone: "success" | "warning" | "info") {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setNotices((current) => [...current.slice(-3), { id, text, tone }]);
    window.setTimeout(() => {
      setNotices((current) => current.filter((notice) => notice.id !== id));
    }, 3600);
  }

  function startAction(actionKey: string, text: string) {
    setBusyActions((current) => ({ ...current, [actionKey]: true }));
    setMessage(text);
    showNotice(text, "info");
  }

  function seedStockDrafts(items: InventoryItem[]) {
    setStockDrafts(
      items.reduce<Record<number, { quantity: string; reorderLevel: string }>>((accumulator, item) => {
        accumulator[item.id] = {
          quantity: String(item.quantity),
          reorderLevel: String(item.reorderLevel)
        };
        return accumulator;
      }, {})
    );
  }

  function notifyLowStock(items: InventoryItem[]) {
    const lowItems = items.filter((item) => item.lowStock || item.quantity <= item.reorderLevel);
    if (lowItems.length === 0) {
      lowStockAlertKeyRef.current = "";
      return;
    }

    const alertKey = lowItems
      .map((item) => `${item.id}:${item.quantity}:${item.reorderLevel}`)
      .sort()
      .join("|");

    if (alertKey === lowStockAlertKeyRef.current) {
      return;
    }

    lowStockAlertKeyRef.current = alertKey;
    const preview = lowItems
      .slice(0, 3)
      .map((item) => `${item.name} (${item.quantity} ${item.unit})`)
      .join(", ");
    showNotice(`Low stock: ${preview}${lowItems.length > 3 ? ` and ${lowItems.length - 3} more` : ""}.`, "warning");
  }

  function createEmptyRecipeDraftItem(): RecipeDraftItem {
    return { stockItemId: "", quantity: "", unit: "GRAM" };
  }

  function finishAction(actionKey: string, text: string, tone: "success" | "warning" | "info") {
    setBusyActions((current) => {
      const next = { ...current };
      delete next[actionKey];
      return next;
    });
    setMessage(text);
    showNotice(text, tone);
  }

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) {
      return;
    }

    const parsed = JSON.parse(stored) as LoginResponse & { token: string };
    setToken(parsed.token);
    setSession(parsed);
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    startTransition(() => {
      void loadWorkspace(token);
    });
  }, [token]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);


  async function loadWorkspace(activeToken: string) {
    try {
      const role = session?.user.role;
      const canSeePayments = role === "SUPER_ADMIN" || role === "MANAGER" || role === "CASHIER";
      const canSeeReports = canSeePayments;
      const canManageRestaurant = role === "MANAGER";
      const canSeeInventory = role === "MANAGER" || role === "CASHIER";
      const canSeeTables = role !== "DELIVERY";
      const canCreateOrders = role === "MANAGER" || role === "CASHIER";

      const requests: Promise<any>[] = [
        apiRequest<DashboardSummary>("/dashboard/summary", {}, activeToken),
        apiRequest<Category[]>("/menu/categories", {}, activeToken),
        canSeeTables ? apiRequest<TableItem[]>("/tables", {}, activeToken) : Promise.resolve([]),
        apiRequest<Order[]>("/orders", {}, activeToken),
        apiRequest<Order[]>("/orders?scope=all", {}, activeToken),
        canCreateOrders ? apiRequest<DeliveryAgent[]>("/delivery-agents?activeOnly=true", {}, activeToken) : Promise.resolve([]),
        canSeeInventory ? apiRequest<InventoryItem[]>("/inventory/items", {}, activeToken) : Promise.resolve([]),
        canSeeInventory ? apiRequest<RecipeDefinition[]>("/inventory/recipes", {}, activeToken) : Promise.resolve([]),
        canSeeReports ? apiRequest<Report>("/reports/daily", {}, activeToken) : Promise.resolve(null),
        canManageRestaurant ? apiRequest<SmsMessage[]>("/integrations/sms/messages", {}, activeToken) : Promise.resolve([]),
        canManageRestaurant ? apiRequest<MpesaTransaction[]>("/integrations/mpesa/transactions", {}, activeToken) : Promise.resolve([]),
        canManageRestaurant ? apiRequest<StaffMember[]>("/staff", {}, activeToken) : Promise.resolve([]),
        canManageRestaurant ? apiRequest<TenantProfile>("/tenant/profile", {}, activeToken) : Promise.resolve(null),
        canManageRestaurant ? apiRequest<DeliveryAgent[]>("/delivery-agents", {}, activeToken) : Promise.resolve([])
      ];

      const [
        summaryData,
        menuData,
        tablesData,
        ordersData,
        allOrdersData,
        activeDeliveryAgentsData,
        inventoryData,
        recipeData,
        reportData,
        smsData,
        mpesaData,
        staffData,
        tenantData,
        managedDeliveryAgentsData
      ] =
        await Promise.all(requests);

      setSummary(summaryData);
      setCategories(menuData);
      setTables(tablesData);
      setOrders(ordersData);
      setAllOrders(allOrdersData);
      setDeliveryAgents(canManageRestaurant ? managedDeliveryAgentsData : activeDeliveryAgentsData);
      setInventory(inventoryData);
      setRecipes(recipeData);
      seedStockDrafts(inventoryData);
      notifyLowStock(inventoryData);
      setReport(reportData);
      setSmsMessages(smsData);
      setMpesaTransactions(mpesaData);
      setStaff(staffData);
      setTenantProfile(tenantData);
      setTenantName(tenantData?.name ?? session?.tenant.name ?? "");
      setTenantAddress(tenantData?.address ?? "");
      setTenantPhone(tenantData?.phone ?? "");
      setTenantContactEmail(tenantData?.contactEmail ?? "");
      setTenantLogoUrl(tenantData?.logoUrl ?? "");
      setTenantBrandColor(tenantData?.brandColor ?? "#a64b2a");
      setMessage("Workspace synced.");
      if (canManageRestaurant) void fetchSmsBalance(activeToken);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to sync workspace.");
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyActions.login) {
      return;
    }
    startAction("login", "Signing in...");

    startTransition(async () => {
      try {
        const login = await apiRequest<LoginResponse>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password })
        });

        setSession(login);
        setToken(login.token);
        window.localStorage.setItem(storageKey, JSON.stringify({ ...login, token: login.token }));
        finishAction("login", "Signed in successfully.", "success");
      } catch (error) {
        finishAction("login", error instanceof Error ? error.message : "Sign in failed.", "warning");
      }
    });
  }

  async function handleForgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!forgotIdentifier.trim()) return;
    if (busyActions.forgotPassword) {
      return;
    }
    startAction("forgotPassword", "Sending OTP...");
    setForgotMessage("Sending OTP...");
    try {
      await apiRequest("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ identifier: forgotIdentifier.trim().toLowerCase() })
      });
      setForgotMessage("OTP sent via SMS. Enter it below.");
      setForgotMode("otp");
      finishAction("forgotPassword", "OTP sent via SMS.", "success");
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "Unable to send OTP.";
      setForgotMessage(nextMessage);
      finishAction("forgotPassword", nextMessage, "warning");
    }
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!forgotOtp.trim() || !forgotNewPassword) return;
    if (busyActions.resetPassword) {
      return;
    }
    startAction("resetPassword", "Resetting password...");
    setForgotMessage("Resetting...");
    try {
      await apiRequest("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ identifier: forgotIdentifier.trim().toLowerCase(), otp: forgotOtp.trim(), newPassword: forgotNewPassword })
      });
      setForgotMessage("Password reset! You can now sign in.");
      finishAction("resetPassword", "Password reset successfully.", "success");
      setTimeout(() => {
        setForgotMode("off");
        setForgotIdentifier("");
        setForgotOtp("");
        setForgotNewPassword("");
        setForgotMessage("");
      }, 2500);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "Reset failed.";
      setForgotMessage(nextMessage);
      finishAction("resetPassword", nextMessage, "warning");
    }
  }

  async function fetchSmsBalance(activeToken: string) {
    try {
      const data = await apiRequest<{ balance: number; currency: string }>("/integrations/sms/balance", {}, activeToken);
      setSmsBalance(data.balance);
    } catch {
      // Non-critical, silently ignore
    }
  }

  function addToCart() {
    if (!selectedMenuItemId) return;
    const menuItem = menuOptions.find((item) => item.id === Number(selectedMenuItemId));
    if (!menuItem) return;
    const qty = Math.max(1, Number(quantity) || 1);
    setOrderCart((prev) => {
      const existing = prev.find((entry) => entry.menuItemId === menuItem.id);
      if (existing) {
        return prev.map((entry) => entry.menuItemId === menuItem.id ? { ...entry, quantity: entry.quantity + qty } : entry);
      }
      return [...prev, { menuItemId: menuItem.id, name: `${menuItem.category} · ${menuItem.name}`, price: menuItem.price, quantity: qty }];
    });
    setSelectedMenuItemId("");
    setMenuSearch("");
    setQuantity("1");
  }

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || orderCart.length === 0) {
      setMessage("Add at least one item to the order.");
      showNotice("Add at least one item to the order.", "warning");
      return;
    }
    if (busyActions.createOrder) {
      return;
    }

    try {
      startAction("createOrder", "Creating order...");
      await apiRequest(
        "/orders",
        {
          method: "POST",
          body: JSON.stringify({
            type: orderMode,
            tableId: orderMode === "DINE_IN" && selectedTableId ? Number(selectedTableId) : null,
            customerName: customerName || null,
            customerPhone: customerPhone || null,
            deliveryLocation: orderMode === "TAKEAWAY" ? deliveryLocation || null : null,
            deliveryAddress: orderMode === "TAKEAWAY" ? deliveryAddress || null : null,
            deliveryAgentId: orderMode === "TAKEAWAY" && selectedDeliveryAgentId ? Number(selectedDeliveryAgentId) : null,
            dispatchSmsRequested: orderMode === "TAKEAWAY" && selectedDeliveryAgentId ? sendDispatchSms : false,
            items: orderCart.map((entry) => ({ menuItemId: entry.menuItemId, quantity: entry.quantity }))
          })
        },
        token
      );

      setOrderCart([]);
      setSelectedMenuItemId("");
      setMenuSearch("");
      setQuantity("1");
      setCustomerName("");
      setCustomerPhone("");
      setDeliveryLocation("");
      setDeliveryAddress("");
      setSelectedDeliveryAgentId("");
      setSendDispatchSms(true);
      setPaymentAmount("");
      await loadWorkspace(token);
      finishAction("createOrder", "Order created successfully.", "success");
    } catch (error) {
      finishAction("createOrder", error instanceof Error ? error.message : "Unable to create order.", "warning");
    }
  }

  async function updateKitchenStatus(orderId: number, itemId: number, status: string) {
    if (!token) {
      return;
    }
    const actionKey = `kitchen-${orderId}-${itemId}-${status}`;
    if (busyActions[actionKey]) {
      return;
    }

    try {
      startAction(actionKey, "Updating kitchen status...");
      await apiRequest(
        `/orders/${orderId}/items/${itemId}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status })
        },
        token
      );

      await loadWorkspace(token);
      finishAction(actionKey, "Kitchen status updated.", "success");
    } catch (error) {
      finishAction(actionKey, error instanceof Error ? error.message : "Unable to update kitchen status.", "warning");
    }
  }

  async function updateOrderStatus(orderId: number, status: string) {
    if (!token) {
      return;
    }
    const actionKey = `order-${orderId}-${status}`;
    if (busyActions[actionKey]) {
      return;
    }

    try {
      startAction(actionKey, "Updating order...");
      await apiRequest(
        `/orders/${orderId}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status })
        },
        token
      );

      await loadWorkspace(token);
      finishAction(actionKey, "Order status updated.", "success");
    } catch (error) {
      finishAction(actionKey, error instanceof Error ? error.message : "Unable to update order status.", "warning");
    }
  }

  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !paymentOrderId || !paymentAmount) {
      return;
    }
    if (busyActions.recordPayment) {
      return;
    }

    try {
      startAction("recordPayment", "Recording payment...");
      await apiRequest(
        "/payments",
        {
          method: "POST",
          body: JSON.stringify({
            orderId: Number(paymentOrderId),
            amount: Number(paymentAmount),
            method: paymentMethod
          })
        },
        token
      );

      setPaymentAmount("");
      await loadWorkspace(token);
      finishAction("recordPayment", "Payment received and recorded.", "success");
    } catch (error) {
      finishAction("recordPayment", error instanceof Error ? error.message : "Unable to record payment.", "warning");
    }
  }

  async function createTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !tableLabel) {
      return;
    }

    if (busyActions.createTable) {
      return;
    }
    try {
      startAction("createTable", "Creating table...");
      await apiRequest(
        "/tables",
        {
          method: "POST",
          body: JSON.stringify({
            label: tableLabel,
            capacity: Number(tableCapacity)
          })
        },
        token
      );

      setTableLabel("");
      setTableCapacity("4");
      await loadWorkspace(token);
      finishAction("createTable", "Table created successfully.", "success");
    } catch (error) {
      finishAction("createTable", error instanceof Error ? error.message : "Unable to create table.", "warning");
    }
  }

  async function createStockItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !stockName || !stockUnit || !stockQuantity || (stockType === "MENU" && !stockMenuItemId)) {
      setMessage("Stock item name, unit, and quantity are required.");
      return;
    }

    if (busyActions.createStockItem) {
      return;
    }
    try {
      startAction("createStockItem", "Saving stock item...");
      await apiRequest(
        "/inventory/items",
        {
          method: "POST",
          body: JSON.stringify({
            name: stockName,
            type: stockType,
            menuItemId: stockType === "MENU" ? Number(stockMenuItemId) : null,
            unit: stockUnit,
            quantity: Number(stockQuantity),
            reorderLevel: Number(stockReorderLevel || 0)
          })
        },
        token
      );

      setStockName("");
      setStockUnit("KILOGRAM");
      setStockQuantity("");
      setStockReorderLevel("");
      setStockType("CONSUMABLE");
      setStockMenuItemId("");
      await loadWorkspace(token);
      finishAction("createStockItem", "Stock item created successfully.", "success");
    } catch (error) {
      finishAction("createStockItem", error instanceof Error ? error.message : "Unable to create stock item.", "warning");
    }
  }

  async function updateMenuItem(itemId: number) {
    if (!token) return;
    try {
      await apiRequest(
        `/menu/items/${itemId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: editMenuName,
            price: Number(editMenuPrice),
            description: editMenuDescription || null,
            isAvailable: editMenuIsAvailable
          })
        },
        token
      );
      setEditingMenuItemId("");
      setMessage("Menu item updated.");
      await loadWorkspace(token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update menu item.");
    }
  }

  function updateStockDraft(itemId: number, patch: Partial<{ quantity: string; reorderLevel: string }>) {
    setStockDrafts((current) => ({
      ...current,
      [itemId]: {
        quantity: current[itemId]?.quantity ?? "",
        reorderLevel: current[itemId]?.reorderLevel ?? "",
        ...patch
      }
    }));
  }

  async function saveStockItem(itemId: number) {
    if (!token) {
      return;
    }

    const draft = stockDrafts[itemId];
    if (!draft) {
      return;
    }

    const actionKey = `stock-item-${itemId}`;
    if (busyActions[actionKey]) {
      return;
    }

    try {
      startAction(actionKey, "Updating stock item...");
      await apiRequest(
        `/inventory/items/${itemId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            quantity: Number(draft.quantity),
            reorderLevel: Number(draft.reorderLevel)
          })
        },
        token
      );

      await loadWorkspace(token);
      finishAction(actionKey, "Stock item updated.", "success");
    } catch (error) {
      finishAction(actionKey, error instanceof Error ? error.message : "Unable to update stock item.", "warning");
    }
  }

  function addRecipeDraftItem() {
    setRecipeDraftItems((current) => [...current, createEmptyRecipeDraftItem()]);
  }

  function updateRecipeDraftItem(index: number, patch: Partial<RecipeDraftItem>) {
    setRecipeDraftItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
    );
  }

  function removeRecipeDraftItem(index: number) {
    setRecipeDraftItems((current) =>
      current.length === 1 ? [createEmptyRecipeDraftItem()] : current.filter((_, itemIndex) => itemIndex !== index)
    );
  }

  async function createRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !recipeMenuItemId) {
      return;
    }

    const recipeItems = recipeDraftItems
      .filter((item) => item.stockItemId && item.quantity)
      .map((item) => ({
        stockItemId: Number(item.stockItemId),
        quantity: Number(item.quantity),
        unit: item.unit
      }));

    if (recipeItems.length === 0) {
      return;
    }

    if (busyActions.createRecipe) {
      return;
    }
    try {
      startAction("createRecipe", "Saving recipe...");
      await apiRequest(
        "/inventory/recipes",
        {
          method: "POST",
          body: JSON.stringify({
            menuItemId: Number(recipeMenuItemId),
            items: recipeItems
          })
        },
        token
      );

      await loadWorkspace(token);
      finishAction("createRecipe", "Recipe saved successfully.", "success");
    } catch (error) {
      finishAction("createRecipe", error instanceof Error ? error.message : "Unable to save recipe.", "warning");
    }
  }

  async function sendSms(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !smsRecipient || !smsText) {
      return;
    }

    if (busyActions.sendSms) {
      return;
    }
    try {
      startAction("sendSms", "Sending SMS...");
      await apiRequest(
        "/integrations/sms/messages",
        {
          method: "POST",
          body: JSON.stringify({
            recipient: smsRecipient,
            message: smsText
          })
        },
        token
      );

      setSmsRecipient("");
      setSmsText("");
      await loadWorkspace(token);
      finishAction("sendSms", "SMS sent successfully.", "success");
    } catch (error) {
      finishAction("sendSms", error instanceof Error ? error.message : "Unable to send SMS.", "warning");
    }
  }

  async function createStaffMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }
    if (busyActions.createStaffMember) {
      return;
    }

    try {
      startAction("createStaffMember", "Creating staff member...");
      await apiRequest(
        "/staff",
        {
          method: "POST",
          body: JSON.stringify({
            firstName: staffFirstName,
            lastName: staffLastName,
            email: staffEmail,
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
      await loadWorkspace(token);
      finishAction("createStaffMember", "Staff member created successfully.", "success");
    } catch (error) {
      finishAction("createStaffMember", error instanceof Error ? error.message : "Unable to create staff member.", "warning");
    }
  }

  async function createDeliveryAgent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }
    if (busyActions.createDeliveryAgent) {
      return;
    }

    try {
      startAction("createDeliveryAgent", "Creating delivery profile...");
      await apiRequest(
        "/delivery-agents",
        {
          method: "POST",
          body: JSON.stringify({
            firstName: deliveryAgentFirstName,
            lastName: deliveryAgentLastName,
            phone: deliveryAgentPhone,
            notes: deliveryAgentNotes || null
          })
        },
        token
      );

      setDeliveryAgentFirstName("");
      setDeliveryAgentLastName("");
      setDeliveryAgentPhone("");
      setDeliveryAgentNotes("");
      await loadWorkspace(token);
      finishAction("createDeliveryAgent", "Delivery profile created successfully.", "success");
    } catch (error) {
      finishAction("createDeliveryAgent", error instanceof Error ? error.message : "Unable to create delivery profile.", "warning");
    }
  }

  async function updateDeliveryAgent(agentId: number, isActive: boolean) {
    if (!token) {
      return;
    }
    const actionKey = `delivery-agent-${agentId}`;
    if (busyActions[actionKey]) {
      return;
    }

    try {
      startAction(actionKey, "Updating delivery profile...");
      await apiRequest(
        `/delivery-agents/${agentId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            isActive: !isActive
          })
        },
        token
      );
      await loadWorkspace(token);
      finishAction(actionKey, "Delivery profile updated.", "success");
    } catch (error) {
      finishAction(actionKey, error instanceof Error ? error.message : "Unable to update delivery profile.", "warning");
    }
  }

  async function updateStaffRole(memberId: number, role: string) {
    if (!token) return;
    const actionKey = `staff-role-${memberId}`;
    if (busyActions[actionKey]) return;

    try {
      startAction(actionKey, "Updating role...");
      await apiRequest(
        `/staff/${memberId}`,
        { method: "PATCH", body: JSON.stringify({ role }) },
        token
      );
      await loadWorkspace(token);
      finishAction(actionKey, "Role updated.", "success");
    } catch (error) {
      finishAction(actionKey, error instanceof Error ? error.message : "Unable to update role.", "warning");
    }
  }

  async function updateStaffMember(memberId: number, isActive: boolean) {
    if (!token) {
      return;
    }
    const actionKey = `staff-status-${memberId}`;
    if (busyActions[actionKey]) {
      return;
    }

    try {
      startAction(actionKey, "Updating staff status...");
      await apiRequest(
        `/staff/${memberId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            isActive: !isActive
          })
        },
        token
      );
      await loadWorkspace(token);
      finishAction(actionKey, "Staff status updated.", "success");
    } catch (error) {
      finishAction(actionKey, error instanceof Error ? error.message : "Unable to update staff member.", "warning");
    }
  }

  async function resetStaffPassword(memberId: number) {
    if (!token || !staffPassword) {
      return;
    }
    const actionKey = `staff-password-${memberId}`;
    if (busyActions[actionKey]) {
      return;
    }

    try {
      startAction(actionKey, "Updating password...");
      await apiRequest(
        `/staff/${memberId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            password: staffPassword
          })
        },
        token
      );
      setStaffPassword("");
      await loadWorkspace(token);
      finishAction(actionKey, "Staff password updated.", "success");
    } catch (error) {
      finishAction(actionKey, error instanceof Error ? error.message : "Unable to reset password.", "warning");
    }
  }

  async function updateTenantProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }
    if (busyActions.updateTenantProfile) {
      return;
    }

    try {
      startAction("updateTenantProfile", "Saving restaurant profile...");
      await apiRequest(
        "/tenant/profile",
        {
          method: "PATCH",
          body: JSON.stringify({
            name: tenantName,
            address: tenantAddress,
            phone: tenantPhone,
            contactEmail: tenantContactEmail
            ,
            logoUrl: tenantLogoUrl,
            brandColor: tenantBrandColor
          })
        },
        token
      );
      await loadWorkspace(token);
      finishAction("updateTenantProfile", "Restaurant profile updated.", "success");
    } catch (error) {
      finishAction("updateTenantProfile", error instanceof Error ? error.message : "Unable to update restaurant profile.", "warning");
    }
  }

  function signOut() {
    window.localStorage.removeItem(storageKey);
    setIsMenuOpen(false);
    setToken(null);
    setSession(null);
    setSummary(null);
    setOrders([]);
    setAllOrders([]);
    setSmsMessages([]);
    setMpesaTransactions([]);
    setStaff([]);
    setDeliveryAgents([]);
    setTenantProfile(null);
    setMessage("Signed out.");
  }

  function printInvoice() {
    const order = orders.find((entry) => entry.id === Number(invoiceOrderId));
    if (!order) {
      setMessage("Select an order invoice to print.");
      return;
    }

    const invoiceWindow = window.open("", "_blank", "width=800,height=900");
    if (!invoiceWindow) {
      setMessage("Popup blocked. Allow popups to print invoices.");
      return;
    }

    const restaurantName = tenantProfile?.name ?? session?.tenant.name ?? "Restaurant";
    const brandColor = tenantProfile?.brandColor ?? "#a64b2a";
    const logoMarkup = tenantProfile?.logoUrl
      ? `<img src="${tenantProfile.logoUrl}" alt="${restaurantName}" style="width:72px;height:72px;border-radius:18px;object-fit:cover;border:1px solid #ddd;" />`
      : "";

    invoiceWindow.document.write(`
      <html>
        <head>
          <title>${order.orderNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #1f1a16; }
            h1, h2 { margin: 0 0 12px; }
            .accent { color: ${brandColor}; }
            .block { margin-bottom: 18px; }
            .hero { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; }
            .dispatch { background:#f7f2ea; border:1px solid #eadcca; border-radius:14px; padding:14px; }
            table { width: 100%; border-collapse: collapse; }
            td, th { border-bottom: 1px solid #ddd; padding: 8px 0; text-align: left; }
          </style>
        </head>
        <body>
          <div class="block hero">
            <div>
              <h1 class="accent">${restaurantName}</h1>
              <p>${tenantProfile?.address ?? ""}</p>
              <p>${tenantProfile?.phone ?? ""}</p>
              <p>${tenantProfile?.contactEmail ?? ""}</p>
            </div>
            <div>${logoMarkup}</div>
          </div>
          <div class="block">
            <h2>Order ${order.orderNumber}</h2>
            <p>Type: ${order.type}</p>
            <p>Customer: ${order.customerName ?? "-"}</p>
            <p>Phone: ${order.customerPhone ?? "-"}</p>
          </div>
          ${
            order.type === "TAKEAWAY"
              ? `<div class="block dispatch">
                  <h2 class="accent">Dispatch Details</h2>
                  <p><strong>Location:</strong> ${order.deliveryLocation ?? "-"}</p>
                  <p><strong>Address:</strong> ${order.deliveryAddress ?? "-"}</p>
                  <p><strong>Customer Phone:</strong> ${order.customerPhone ?? "-"}</p>
                  <p><strong>Delivery Person:</strong> ${order.deliveryAgent ? `${order.deliveryAgent.firstName} ${order.deliveryAgent.lastName} · ${order.deliveryAgent.phone}` : "-"}</p>
                </div>`
              : ""
          }
          <table>
            <thead><tr><th>Item</th><th>Qty</th><th>Total</th></tr></thead>
            <tbody>
              ${order.items
                .map(
                  (item) =>
                    `<tr><td>${item.menuItem.name}</td><td>${item.quantity}</td><td>KES ${item.lineTotal}</td></tr>`
                )
                .join("")}
            </tbody>
          </table>
          <div class="block"><h2>Total: KES ${order.totals.subtotal}</h2></div>
        </body>
      </html>
    `);
    invoiceWindow.document.close();
    invoiceWindow.focus();
    invoiceWindow.print();
  }

  const menuOptions = categories.flatMap((category) =>
    category.items.filter((item) => item.isAvailable).map((item) => ({
      id: item.id,
      name: item.name,
      category: category.name,
      price: item.price,
      description: item.description ?? "",
      label: `${category.name} · ${item.name} · KES ${item.price}`
    }))
  );
  const normalizedMenuSearch = menuSearch.toLowerCase().replace(/\s+/g, " ").trim();
  const filteredOrderMenuOptions = normalizedMenuSearch
    ? menuOptions
        .filter((item) => `${item.name} ${item.category} ${item.description}`.toLowerCase().includes(normalizedMenuSearch))
        .sort((a, b) => {
          const aName = a.name.toLowerCase();
          const bName = b.name.toLowerCase();
          const aStarts = aName.startsWith(normalizedMenuSearch) ? 0 : 1;
          const bStarts = bName.startsWith(normalizedMenuSearch) ? 0 : 1;
          return aStarts === bStarts ? aName.localeCompare(bName) : aStarts - bStarts;
        })
        .slice(0, 12)
    : [];
  const role = session?.user.role;
  const canCreateOrders = role === "MANAGER" || role === "CASHIER";
  const canTakePayments = canCreateOrders;
  const canSeeReports = role === "MANAGER" || role === "CASHIER";
  const canManageRestaurant = role === "MANAGER";
  const canSeeInventory = role === "MANAGER" || role === "CASHIER";
  const canKitchenUpdate = role === "MANAGER" || role === "KITCHEN";
  const canDispatchDelivery = role === "MANAGER" || role === "DELIVERY";
  const openTakeawayOrders = orders.filter((order) => order.type === "TAKEAWAY" && order.status !== "PAID").length;
  const activeLowStockItems = inventory.filter((item) => item.lowStock).length;
  const latestTransactions = mpesaTransactions.slice(0, 3);
  const selectedRecipe = recipes.find((recipe) => recipe.menuItem.id === Number(recipeMenuItemId)) ?? null;
  const managementLinks = [
    canSeeReports ? { id: "reports", label: "Reports" } : null,
    canManageRestaurant ? { id: "restaurant-admin", label: "Restaurant Admin" } : null,
    canManageRestaurant ? { id: "staff", label: "Staff" } : null
  ].filter(Boolean) as Array<{ id: string; label: string }>;
  const sectionLinks = [
    canCreateOrders ? { id: "new-order", label: "New Order" } : null,
    canTakePayments ? { id: "payments", label: "Payments" } : null,
    { id: "orders", label: "Orders" },
    { id: "menu", label: "Menu" },
    canSeeInventory ? { id: "inventory", label: "Inventory" } : null,
    canManageRestaurant ? { id: "tables-alerts", label: "Tables" } : null,
    { id: "print-invoice", label: "Print Invoice" }
  ].filter(Boolean) as Array<{ id: string; label: string }>;

  if (!session || !token) {
    return (
      <div className="auth-page">
        <div className="auth-brand">
          <div className="auth-brand-inner">
            <div>
              <p className="auth-eyebrow">TableFlow POS</p>
              <h1 className="auth-headline">Kenya-first restaurant operations.</h1>
              <p className="auth-tagline">
                From the kitchen to the table — orders, payments, inventory, and staff access in one
                workspace built for Nairobi restaurants.
              </p>
            </div>
            <div className="auth-feature-list">
              <div className="auth-feature">
                <span className="auth-feature-icon">🧾</span>
                <div>
                  <strong>Orders & kitchen</strong>
                  <p>Dine-in, takeaway, kitchen queue, dispatch</p>
                </div>
              </div>
              <div className="auth-feature">
                <span className="auth-feature-icon">💳</span>
                <div>
                  <strong>Payments</strong>
                  <p>Cash & M-Pesa STK push integrated</p>
                </div>
              </div>
              <div className="auth-feature">
                <span className="auth-feature-icon">📦</span>
                <div>
                  <strong>Inventory</strong>
                  <p>Live stock tracking with recipe linkage</p>
                </div>
              </div>
              <div className="auth-feature">
                <span className="auth-feature-icon">👥</span>
                <div>
                  <strong>Staff roles</strong>
                  <p>Manager, cashier, kitchen, delivery</p>
                </div>
              </div>
            </div>
          </div>
          <div className="auth-brand-deco auth-deco-1" />
          <div className="auth-brand-deco auth-deco-2" />
          <div className="auth-brand-deco auth-deco-3" />
        </div>

        <div className="auth-form-side">
          <div className="auth-form-card card">
            <div className="auth-form-head">
              <p className="eyebrow">Welcome back</p>
              <h2>Sign in to your workspace</h2>
              <p className="helper-text">Quick-fill an account or enter your credentials below.</p>
            </div>

            <div className="quick-fill-grid">
              {loginPresets.map((preset) => (
                <button
                  key={preset.email}
                  type="button"
                  className="quick-fill-btn"
                  onClick={() => { setEmail(preset.email); setPassword(preset.password); }}
                >
                  <strong>{preset.label}</strong>
                  <small>{preset.sub}</small>
                </button>
              ))}
            </div>

            {forgotMode === "off" ? (
              <>
                <form className="stack" onSubmit={handleLogin}>
                  <label>
                    Phone or email
                    <input
                      type="text"
                      autoComplete="username"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="phone number or email"
                    />
                  </label>
                  <label>
                    Password
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="••••••••"
                    />
                  </label>
                  <button type="submit" disabled={isPending || busyActions.login} className="auth-submit-btn">
                    {isPending || busyActions.login ? "Signing in..." : "Enter workspace"}
                  </button>
                </form>
                <button
                  type="button"
                  className="forgot-link"
                  onClick={() => setForgotMode("phone")}
                >
                  Forgot password?
                </button>
              </>
            ) : forgotMode === "phone" ? (
              <>
                <div className="auth-form-head">
                  <h2>Reset password</h2>
                  <p className="helper-text">Enter your phone number to receive a one-time OTP via SMS.</p>
                </div>
                <form className="stack" onSubmit={handleForgotPassword}>
                  <label>
                    Your phone number
                    <input
                      type="text"
                      autoComplete="tel"
                      value={forgotIdentifier}
                      onChange={(e) => setForgotIdentifier(e.target.value)}
                      placeholder="e.g. 0702550190"
                    />
                  </label>
                  <button type="submit" className="auth-submit-btn" disabled={busyActions.forgotPassword}>
                    {busyActions.forgotPassword ? "Sending..." : "Send OTP"}
                  </button>
                </form>
                {forgotMessage ? <p className="auth-status" data-tone={getMessageTone(forgotMessage)}>{forgotMessage}</p> : null}
                <button type="button" className="forgot-link" onClick={() => { setForgotMode("off"); setForgotMessage(""); }}>← Back to sign in</button>
              </>
            ) : (
              <>
                <div className="auth-form-head">
                  <h2>Enter OTP</h2>
                  <p className="helper-text">Check your SMS for the 6-digit code.</p>
                </div>
                <form className="stack" onSubmit={handleResetPassword}>
                  <label>
                    OTP code
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={forgotOtp}
                      onChange={(e) => setForgotOtp(e.target.value)}
                      placeholder="6-digit code"
                    />
                  </label>
                  <label>
                    New password
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      placeholder="new password"
                    />
                  </label>
                  <button type="submit" className="auth-submit-btn" disabled={busyActions.resetPassword}>
                    {busyActions.resetPassword ? "Resetting..." : "Reset password"}
                  </button>
                </form>
                {forgotMessage ? <p className="auth-status" data-tone={getMessageTone(forgotMessage)}>{forgotMessage}</p> : null}
                <button type="button" className="forgot-link" onClick={() => { setForgotMode("phone"); setForgotMessage(""); }}>← Resend OTP</button>
              </>
            )}

            {forgotMode === "off" && message ? (
              <p className="auth-status" data-tone={getMessageTone(message)}>{message}</p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="page-shell" style={{ ["--primary" as string]: tenantProfile?.brandColor ?? "#a64b2a" }}>
      <section className="topbar">
        <div>
          <p className="eyebrow">{tenantProfile?.name ?? session.tenant.name}</p>
          {tenantProfile?.logoUrl ? (
            <img
              src={tenantProfile.logoUrl}
              alt={tenantProfile.name}
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                objectFit: "cover",
                marginTop: 10,
                border: "1px solid var(--line)"
              }}
            />
          ) : null}
          <h1>Service workspace</h1>
          <p className="lede">
            {session.user.firstName} {session.user.lastName} · {session.user.role} · {session.tenant.currency}
          </p>
        </div>
        <div className="topbar-actions">
          {canManageRestaurant && smsBalance !== null ? (
            <span className="sms-balance-chip">
              SMS · KES {smsBalance.toLocaleString()}
            </span>
          ) : null}
          <div className="profile-menu" ref={menuRef}>
            <button
              type="button"
              className="menu-trigger"
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              aria-label="Open user menu"
              onClick={() => setIsMenuOpen((open) => !open)}
            >
              <span />
              <span />
              <span />
            </button>
            {isMenuOpen ? (
              <div className="menu-dropdown" role="menu" aria-label="User menu">
                <div className="menu-profile">
                  <strong>{session.user.firstName} {session.user.lastName}</strong>
                  <span>{session.user.role} · {session.tenant.name}</span>
                  <span>{session.user.email}</span>
                </div>
                <button
                  type="button"
                  className="menu-item-button"
                  role="menuitem"
                  onClick={() => {
                    setIsMenuOpen(false);
                    if (token) void loadWorkspace(token);
                  }}
                  disabled={isPending}
                >
                  {isPending ? "Refreshing..." : "Refresh"}
                </button>
                <button
                  type="button"
                  className="menu-item-button menu-item-danger"
                  role="menuitem"
                  onClick={signOut}
                >
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="status-banner" data-tone={getMessageTone(message)} aria-live="polite">
        <div>
          <strong>Workspace status</strong>
          <p>{message}</p>
        </div>
        <span className="status-pill">{isPending ? "Refreshing" : "Ready"}</span>
      </section>

      {notices.length ? (
        <section className="activity-stack" aria-live="polite" aria-label="Recent activity">
          {notices.map((notice) => (
            <div key={notice.id} className="activity-toast" data-tone={notice.tone}>
              <strong>{notice.tone === "info" ? "Working" : notice.tone === "success" ? "Success" : "Attention"}</strong>
              <p>{notice.text}</p>
            </div>
          ))}
        </section>
      ) : null}

      <section className="stat-strip">
        <div className="stat-chip">
          <span>Takeaway pipeline</span>
          <strong>{openTakeawayOrders} active takeaway orders</strong>
        </div>
        <div className="stat-chip">
          <span>Kitchen watch</span>
          <strong>{summary?.readyOrders ?? 0} ready for pickup or service</strong>
        </div>
        <div className="stat-chip">
          <span>Inventory watch</span>
          <strong>{activeLowStockItems} items need attention</strong>
        </div>
      </section>

      <nav className="section-nav" aria-label="Workspace sections">
        {sectionLinks.map((section) => (
          <a key={section.id} href={`#${section.id}`} className="section-chip">
            {section.label}
          </a>
        ))}
        {managementLinks.length ? (
          <details className="section-menu">
            <summary className="section-chip">Management</summary>
            <div className="section-menu-dropdown">
              {managementLinks.map((section) => (
                <a key={section.id} href={`#${section.id}`} className="section-menu-item">
                  {section.label}
                </a>
              ))}
              {canManageRestaurant ? (
                <a href="/management" className="section-menu-item section-menu-link">
                  Open management workspace
                </a>
              ) : null}
            </div>
          </details>
        ) : null}
      </nav>

      <section className="metrics-grid">
        {[
          ["Open Orders", summary?.openOrders ?? 0, "#orders"],
          ["Ready Orders", summary?.readyOrders ?? 0, "#orders"],
          ["Today Sales", summary?.todaySales == null ? "Restricted" : formatCurrency(summary.todaySales), "#reports"],
          ["Low Stock", summary?.lowStockItems ?? 0, "#inventory"],
          ["Active Tables", summary?.activeTables ?? 0, "#tables-alerts"],
          ["Menu Items", summary?.menuItems ?? 0, "#menu"]
        ].map(([label, value, href]) => (
          <a key={label as string} href={href as string} className="card metric-card metric-card-link">
            <span>{label as string}</span>
            <strong>{value as string | number}</strong>
          </a>
        ))}
      </section>

      <section className="workspace-grid">
        {canCreateOrders ? <article id="new-order" className="card panel">
          <div className="panel-head">
            <h2>New order</h2>
            <p>Fill in the steps below to place a new order.</p>
          </div>
          <form className="stack" onSubmit={createOrder}>

            {/* Step 1 — Order type */}
            <div className="order-step">
              <p className="order-step-label">1 · Order type</p>
              <div className="order-type-toggle">
                <button
                  type="button"
                  className={orderMode === "DINE_IN" ? "toggle-active" : "toggle-inactive"}
                  onClick={() => { setOrderMode("DINE_IN"); setSelectedTableId(""); }}
                >
                  Dine In
                </button>
                <button
                  type="button"
                  className={orderMode === "TAKEAWAY" ? "toggle-active" : "toggle-inactive"}
                  onClick={() => setOrderMode("TAKEAWAY")}
                >
                  Takeaway
                </button>
              </div>
            </div>

            {/* Step 2 — Table or customer */}
            <div className="order-step">
              <p className="order-step-label">2 · {orderMode === "DINE_IN" ? "Table" : "Customer"}</p>
              {orderMode === "DINE_IN" ? (
                <select value={selectedTableId} onChange={(event) => setSelectedTableId(event.target.value)}>
                  <option value="">Select table</option>
                  {tables.map((table) => (
                    <option key={table.id} value={table.id}>
                      {table.label} · {table.capacity} pax
                    </option>
                  ))}
                </select>
              ) : (
                <div className="stack">
                  <label>
                    Customer name
                    <input placeholder="e.g. Jane" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
                  </label>
                  <label>
                    Phone
                    <input type="tel" autoComplete="tel" placeholder="e.g. 0712 345 678" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} />
                  </label>
                  <label>
                    Delivery location
                    <input placeholder="e.g. Gate B" value={deliveryLocation} onChange={(event) => setDeliveryLocation(event.target.value)} />
                  </label>
                  <label>
                    Delivery address
                    <input placeholder="e.g. Westlands, Nairobi" value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} />
                  </label>
                  <label>
                    Delivery person
                    <select value={selectedDeliveryAgentId} onChange={(event) => setSelectedDeliveryAgentId(event.target.value)}>
                      <option value="">Select delivery person</option>
                      {deliveryAgents.filter((agent) => agent.isActive).map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.firstName} {agent.lastName} · {agent.phone}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={sendDispatchSms}
                      onChange={(event) => setSendDispatchSms(event.target.checked)}
                      disabled={!selectedDeliveryAgentId}
                    />
                    <span>Send pickup SMS now</span>
                  </label>
                </div>
              )}
            </div>

            {/* Step 3 — Add items */}
            <div className="order-step">
              <p className="order-step-label">3 · Add items</p>
              <div className="item-search-row">
                <div className="item-search-wrap">
                  <input
                    placeholder="Search menu…"
                    value={menuSearch}
                    onChange={(event) => { setMenuSearch(event.target.value); setSelectedMenuItemId(""); }}
                    autoComplete="off"
                  />
                  {menuSearch.trim() && !selectedMenuItemId && (
                    <ul className="menu-search-results">
                      {filteredOrderMenuOptions.length === 0 ? (
                        <li className="search-empty">No matching available menu items</li>
                      ) : null}
                      {filteredOrderMenuOptions.map((item) => (
                        <li key={item.id} onClick={() => { setSelectedMenuItemId(String(item.id)); setMenuSearch(item.name); }}>
                          <span className="search-item-name">{item.name}</span>
                          <span className="search-item-meta">{item.category} · KES {item.price.toLocaleString()}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <input
                  className="qty-input"
                  inputMode="numeric"
                  placeholder="Qty"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
                <button type="button" className="add-item-btn" onClick={addToCart} disabled={!selectedMenuItemId}>+ Add</button>
              </div>

              {orderCart.length > 0 && (
                <div className="cart-list">
                  {orderCart.map((entry) => (
                    <div key={entry.menuItemId} className="cart-row">
                      <span className="cart-name">{entry.name}</span>
                      <span className="cart-qty">× {entry.quantity}</span>
                      <span className="cart-total">KES {(entry.price * entry.quantity).toLocaleString()}</span>
                      <button type="button" className="cart-remove" onClick={() => setOrderCart((prev) => prev.filter((e) => e.menuItemId !== entry.menuItemId))}>✕</button>
                    </div>
                  ))}
                  <div className="cart-subtotal">
                    <span>Subtotal</span>
                    <strong>KES {orderCart.reduce((sum, e) => sum + e.price * e.quantity, 0).toLocaleString()}</strong>
                  </div>
                </div>
              )}
            </div>

            <button type="submit" disabled={busyActions.createOrder || orderCart.length === 0}>
              {busyActions.createOrder
                ? "Creating order..."
                : `Place order${orderCart.length > 0 ? ` · ${orderCart.reduce((n, e) => n + e.quantity, 0)} item${orderCart.reduce((n, e) => n + e.quantity, 0) !== 1 ? "s" : ""}` : ""}`}
            </button>
          </form>
        </article> : null}

        {canTakePayments ? <article id="payments" className="card panel">
          <div className="panel-head">
            <h2>Payments</h2>
            <p>Record cash or M-Pesa against open tickets with minimal friction.</p>
          </div>
          <form className="stack" onSubmit={recordPayment}>
            <label>
              Order
              <select value={paymentOrderId} onChange={(event) => setPaymentOrderId(event.target.value)}>
                <option value="">Select order</option>
                {orders.filter((o) => o.status !== "PAID" && o.status !== "VOIDED").map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.orderNumber} · KES {order.totals.subtotal}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Method
              <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                <option value="CASH">Cash</option>
                <option value="MPESA">M-Pesa</option>
              </select>
            </label>
            <label>
              Amount
              <input inputMode="decimal" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} />
            </label>
            <button type="submit" disabled={busyActions.recordPayment}>
              {busyActions.recordPayment ? "Recording..." : "Record payment"}
            </button>
          </form>
        </article> : null}

        {canManageRestaurant ? <article id="restaurant-admin" className="card panel">
          <div className="panel-head">
            <h2>Restaurant admin</h2>
            <p>Keep restaurant identity and staff access current from the same screen.</p>
          </div>
          <form className="stack" onSubmit={updateTenantProfile}>
            <label>
              Restaurant name
              <input value={tenantName} onChange={(event) => setTenantName(event.target.value)} />
            </label>
            <label>
              Address
              <input value={tenantAddress} onChange={(event) => setTenantAddress(event.target.value)} />
            </label>
            <label>
              Phone
              <input type="tel" autoComplete="tel" value={tenantPhone} onChange={(event) => setTenantPhone(event.target.value)} />
            </label>
            <label>
              Contact email
              <input type="email" autoComplete="email" value={tenantContactEmail} onChange={(event) => setTenantContactEmail(event.target.value)} />
            </label>
            <label>
              Logo URL
              <input value={tenantLogoUrl} onChange={(event) => setTenantLogoUrl(event.target.value)} />
            </label>
            <label>
              Brand color
              <input value={tenantBrandColor} onChange={(event) => setTenantBrandColor(event.target.value)} />
            </label>
            <button type="submit" disabled={busyActions.updateTenantProfile}>
              {busyActions.updateTenantProfile ? "Saving..." : "Save restaurant profile"}
            </button>
          </form>
          <form className="stack form-block" onSubmit={createStaffMember}>
            <label>
              Staff first name
              <input value={staffFirstName} onChange={(event) => setStaffFirstName(event.target.value)} />
            </label>
            <label>
              Staff last name
              <input value={staffLastName} onChange={(event) => setStaffLastName(event.target.value)} />
            </label>
            <label>
              Staff email
              <input type="email" autoComplete="email" value={staffEmail} onChange={(event) => setStaffEmail(event.target.value)} />
            </label>
            <label>
              Initial password
              <input type="password" autoComplete="new-password" value={staffPassword} onChange={(event) => setStaffPassword(event.target.value)} />
            </label>
            <label>
              Role
              <select value={staffRole} onChange={(event) => setStaffRole(event.target.value)}>
                <option value="MANAGER">Manager</option>
                <option value="CASHIER">Cashier</option>
                <option value="KITCHEN">Kitchen</option>
                <option value="DELIVERY">Delivery</option>
              </select>
            </label>
            <button type="submit" disabled={busyActions.createStaffMember}>
              {busyActions.createStaffMember ? "Creating..." : "Add staff member"}
            </button>
          </form>
          <form className="stack form-block" onSubmit={createDeliveryAgent}>
            <label>
              Delivery first name
              <input value={deliveryAgentFirstName} onChange={(event) => setDeliveryAgentFirstName(event.target.value)} />
            </label>
            <label>
              Delivery last name
              <input value={deliveryAgentLastName} onChange={(event) => setDeliveryAgentLastName(event.target.value)} />
            </label>
            <label>
              Delivery phone
              <input type="tel" autoComplete="tel" value={deliveryAgentPhone} onChange={(event) => setDeliveryAgentPhone(event.target.value)} />
            </label>
            <label>
              Notes
              <input value={deliveryAgentNotes} onChange={(event) => setDeliveryAgentNotes(event.target.value)} placeholder="Coverage area, bike, availability..." />
            </label>
            <button type="submit" disabled={busyActions.createDeliveryAgent}>
              {busyActions.createDeliveryAgent ? "Creating..." : "Add delivery profile"}
            </button>
          </form>
        </article> : null}

        <article id="orders" className="card panel orders-panel">
          <div className="panel-head">
            <h2>Orders</h2>
            <p>Monitor live order flow, advance service state, and act on kitchen items.</p>
          </div>
          <div className="tab-bar">
            <button type="button" className={`tab-btn${ordersFilter === "today" ? " tab-active" : ""}`} onClick={() => setOrdersFilter("today")}>Today</button>
            <button type="button" className={`tab-btn${ordersFilter === "open" ? " tab-active" : ""}`} onClick={() => setOrdersFilter("open")}>Open</button>
            <button type="button" className={`tab-btn${ordersFilter === "history" ? " tab-active" : ""}`} onClick={() => setOrdersFilter("history")}>History</button>
          </div>
          <div className="order-list">
            {(() => {
              const isKitchenOnly = canKitchenUpdate && !canCreateOrders;
              const visible = ordersFilter === "history"
                ? allOrders
                : ordersFilter === "open"
                  ? orders.filter((o) => {
                    if (o.status === "PAID" || o.status === "VOIDED") return false;
                    if (isKitchenOnly && o.status === "READY") return false;
                    return true;
                  })
                  : orders;
              if (visible.length === 0) return (
                <div className="empty-state">
                  <strong>{ordersFilter === "open" ? "No open orders today" : ordersFilter === "history" ? "No order history" : "No orders today"}</strong>
                  <p>{ordersFilter === "open" ? "All current-day orders are closed or voided." : ordersFilter === "history" ? "Past and current orders will appear here after service activity." : "Create the first order to activate today’s kitchen, payment, and dispatch flows."}</p>
                </div>
              );
              return visible.map((order) => (
              <div key={order.id} className={`order-card${order.status === "READY" ? " order-ready" : order.status === "VOIDED" ? " order-voided" : ""}`}>
                <div className="order-head">
                  <div>
                    <strong>{order.orderNumber}</strong>
                    <p>
                      {order.type} · {order.status} · Placed {formatOrderTime(order.createdAt)} {order.table ? `· ${order.table.label}` : ""}
                    </p>
                    {order.type === "TAKEAWAY" ? (
                      <>
                        <p>
                          {order.deliveryLocation ?? "-"} · {order.deliveryAddress ?? "-"}
                        </p>
                        <p>
                          Courier: {order.deliveryAgent ? `${order.deliveryAgent.firstName} ${order.deliveryAgent.lastName}` : "Unassigned"} · Dispatch SMS: {order.dispatchSmsRequested ? (order.dispatchSmsSentAt ? "Sent" : "Queued") : "Off"}
                        </p>
                      </>
                    ) : null}
                  </div>
                  {canCreateOrders && order.status === "OPEN" ? (
                    <button disabled={busyActions[`order-${order.id}-SENT_TO_KITCHEN`]} onClick={() => void updateOrderStatus(order.id, "SENT_TO_KITCHEN")}>
                      {busyActions[`order-${order.id}-SENT_TO_KITCHEN`] ? "Sending..." : "Send to kitchen"}
                    </button>
                  ) : null}
                </div>
                {canCreateOrders && canCancelOrder(order.status) ? (
                  <div className="inline-actions" style={{ marginTop: 12 }}>
                    <button
                      disabled={busyActions[`order-${order.id}-VOIDED`]}
                      onClick={() => void updateOrderStatus(order.id, "VOIDED")}
                    >
                      {busyActions[`order-${order.id}-VOIDED`] ? "Cancelling..." : "Cancel order"}
                    </button>
                  </div>
                ) : null}
                <ul>
                  {order.items.map((item) => (
                    <li key={item.id}>
                      <span>
                        {item.quantity} x {item.menuItem.name} · {item.status}
                      </span>
                      {canKitchenUpdate ? (
                        <div className="inline-actions">
                          <button disabled={busyActions[`kitchen-${order.id}-${item.id}-PREPARING`]} onClick={() => void updateKitchenStatus(order.id, item.id, "PREPARING")}>
                            {busyActions[`kitchen-${order.id}-${item.id}-PREPARING`] ? "Saving..." : "Prep"}
                          </button>
                          <button disabled={busyActions[`kitchen-${order.id}-${item.id}-READY`]} onClick={() => void updateKitchenStatus(order.id, item.id, "READY")}>
                            {busyActions[`kitchen-${order.id}-${item.id}-READY`] ? "Saving..." : "Ready"}
                          </button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <p className="order-total">{formatCurrency(order.totals.subtotal)}</p>
              </div>
              ));
            })()}
          </div>
        </article>

        <article id="menu" className="card panel">
          <div className="panel-head">
            <h2>Menu</h2>
            <p>Operators can verify pricing and item availability without leaving service view.</p>
          </div>
          <div className="compact-list">
            {categories.length === 0 ? (
              <div className="empty-state">
                <strong>No menu categories</strong>
                <p>Managers can create categories and items to make the POS operational.</p>
              </div>
            ) : categories.map((category) => (
              <div key={category.id}>
                <strong>{category.name}</strong>
                {category.items.map((item) => (
                  <div key={item.id} className="order-card">
                    <div className="menu-item-row">
                      {item.photoUrl ? (
                        <img src={item.photoUrl} alt={item.name} className="menu-thumb" />
                      ) : null}
                      <div>
                        <p>
                          {item.name} · {formatCurrency(item.price)}{!item.isAvailable ? " · Unavailable" : ""}
                        </p>
                        {item.description ? <p className="menu-description">{item.description}</p> : null}
                      </div>
                    </div>
                    {canManageRestaurant ? (
                      <div className="inline-actions">
                        <button onClick={() => {
                          setEditingMenuItemId(String(item.id));
                          setEditMenuName(item.name);
                          setEditMenuPrice(String(item.price));
                          setEditMenuDescription(item.description ?? "");
                          setEditMenuIsAvailable(item.isAvailable);
                        }}>Edit</button>
                      </div>
                    ) : null}
                    {editingMenuItemId === String(item.id) ? (
                      <div className="form-block stack">
                        <label>Name<input value={editMenuName} onChange={(e) => setEditMenuName(e.target.value)} /></label>
                        <label>Price<input inputMode="decimal" value={editMenuPrice} onChange={(e) => setEditMenuPrice(e.target.value)} /></label>
                        <label>Description<input value={editMenuDescription} onChange={(e) => setEditMenuDescription(e.target.value)} /></label>
                        <label className="checkbox-label">
                          <input type="checkbox" checked={editMenuIsAvailable} onChange={(e) => setEditMenuIsAvailable(e.target.checked)} />
                          Available on menu
                        </label>
                        <div className="inline-actions">
                          <button onClick={() => void updateMenuItem(item.id)}>Save</button>
                          <button onClick={() => setEditingMenuItemId("")}>Cancel</button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </article>

        {canSeeInventory ? <article id="inventory" className="card panel">
          <div className="panel-head">
            <h2>Inventory</h2>
            <p>Set stock, reorder thresholds, and ingredient recipes so ready orders deduct inventory automatically.</p>
          </div>
          <div className="compact-list">
            {inventory.length === 0 ? (
              <div className="empty-state">
                <strong>No stock items</strong>
                <p>Add stock items before linking recipes or relying on payment-triggered deductions.</p>
              </div>
            ) : inventory.map((item) => (
              <div key={item.id} className="order-card">
                <strong className={item.lowStock ? "alert" : ""}>{item.name}</strong>
                <p>
                  {item.type === "MENU" ? "Menu item" : "Consumable"} · On hand: {item.quantity} {item.unit}
                  {item.menuItem ? ` · Linked to ${item.menuItem.name}` : ""}
                </p>
                <div className="inline-fields">
                  <label>
                    Quantity
                    <input
                      inputMode="decimal"
                      value={stockDrafts[item.id]?.quantity ?? ""}
                      onChange={(event) => updateStockDraft(item.id, { quantity: event.target.value })}
                    />
                  </label>
                  <label>
                    Reorder level
                    <input
                      inputMode="decimal"
                      value={stockDrafts[item.id]?.reorderLevel ?? ""}
                      onChange={(event) => updateStockDraft(item.id, { reorderLevel: event.target.value })}
                    />
                  </label>
                </div>
                <div className="inline-actions">
                  {canManageRestaurant ? (
                    <button type="button" disabled={busyActions[`stock-item-${item.id}`]} onClick={() => void saveStockItem(item.id)}>
                      {busyActions[`stock-item-${item.id}`] ? "Saving..." : "Save stock settings"}
                    </button>
                  ) : null}
                  {item.lowStock ? <span className="helper-text">Low stock</span> : null}
                </div>
              </div>
            ))}
          </div>
          {canManageRestaurant ? <form className="stack form-block" onSubmit={createStockItem}>
            <label>
              Inventory type
              <select value={stockType} onChange={(event) => setStockType(event.target.value as "MENU" | "CONSUMABLE")}>
                <option value="CONSUMABLE">Consumable ingredient</option>
                <option value="MENU">Menu item stock</option>
              </select>
            </label>
            {stockType === "MENU" ? (
              <label>
                Linked menu item
                <select value={stockMenuItemId} onChange={(event) => setStockMenuItemId(event.target.value)}>
                  <option value="">Select menu item</option>
                  {menuOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label>
              Stock item
              <input value={stockName} onChange={(event) => setStockName(event.target.value)} />
            </label>
            <label>
              Unit
              <select value={stockUnit} onChange={(event) => setStockUnit(event.target.value as StockUnit)}>
                {stockUnits.map((unit) => (
                  <option key={unit.value} value={unit.value}>
                    {unit.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Quantity
              <input inputMode="decimal" value={stockQuantity} onChange={(event) => setStockQuantity(event.target.value)} />
            </label>
            <label>
              Reorder level
              <input inputMode="decimal" value={stockReorderLevel} onChange={(event) => setStockReorderLevel(event.target.value)} />
            </label>
            <button type="submit" disabled={busyActions.createStockItem}>
              {busyActions.createStockItem ? "Saving..." : "Add stock item"}
            </button>
          </form> : null}
          {canManageRestaurant ? <form className="stack form-block" onSubmit={createRecipe}>
            <div className="panel-head">
              <h2>Recipe setup</h2>
              <p>Define what is needed to prepare one menu item and how much of each ingredient is consumed.</p>
            </div>
            <label>
              Recipe menu item
              <select value={recipeMenuItemId} onChange={(event) => {
                const newId = event.target.value;
                setRecipeMenuItemId(newId);
                if (!newId) {
                  setRecipeDraftItems([createEmptyRecipeDraftItem()]);
                  return;
                }
                const existingRecipe = recipes.find((recipe) => recipe.menuItem.id === Number(newId));
                setRecipeDraftItems(
                  existingRecipe
                    ? existingRecipe.items.map((item) => ({
                        stockItemId: String(item.stockItem.id),
                        quantity: String(item.quantity),
                        unit: item.unit as StockUnit
                      }))
                    : [createEmptyRecipeDraftItem()]
                );
              }}>
                <option value="">Select item</option>
                {menuOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            {selectedRecipe ? (
              <div className="empty-state">
                <strong>Current recipe</strong>
                <p>
                  {selectedRecipe.items.map((item) => `${item.stockItem.name} ${item.quantity} ${item.unit}`).join(" · ")}
                </p>
              </div>
            ) : null}
            <div className="compact-list">
              {recipeDraftItems.map((item, index) => (
                <div key={index} className="order-card">
                  <div className="inline-fields">
                    <label>
                      Stock ingredient
                      <select
                        value={item.stockItemId}
                        onChange={(event) => updateRecipeDraftItem(index, { stockItemId: event.target.value })}
                      >
                        <option value="">Select stock</option>
                        {inventory.filter((stockItem) => stockItem.type !== "MENU").map((stockItem) => (
                          <option key={stockItem.id} value={stockItem.id}>
                            {stockItem.name} · {stockItem.unit}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Quantity per menu item
                      <input
                        inputMode="decimal"
                        value={item.quantity}
                        onChange={(event) => updateRecipeDraftItem(index, { quantity: event.target.value })}
                      />
                    </label>
                    <label>
                      Recipe unit
                      <select value={item.unit} onChange={(event) => updateRecipeDraftItem(index, { unit: event.target.value as StockUnit })}>
                        {stockUnits.map((unit) => (
                          <option key={unit.value} value={unit.value}>
                            {unit.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="inline-actions">
                    <button type="button" onClick={() => removeRecipeDraftItem(index)}>
                      Remove ingredient
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="inline-actions">
              <button type="button" onClick={addRecipeDraftItem}>
                Add ingredient
              </button>
            </div>
            <button type="submit" disabled={busyActions.createRecipe}>
              {busyActions.createRecipe ? "Saving..." : "Save recipe"}
            </button>
          </form> : null}
          <div className="compact-list form-block">
            <div className="panel-head">
              <h2>Saved recipes</h2>
              <p>Review the ingredient list that will be deducted when an order is ready.</p>
            </div>
            {recipes.length === 0 ? (
              <div className="empty-state">
                <strong>No recipes saved</strong>
                <p>Choose a menu item above and add its ingredients to activate automatic stock deductions.</p>
              </div>
            ) : recipes.map((recipe) => (
              <div key={recipe.id} className="order-card">
                <strong>{recipe.menuItem.name}</strong>
                <p>
                  {recipe.items.map((item) => `${item.stockItem.name} ${item.quantity} ${item.unit}`).join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </article> : null}

        {canSeeReports ? <article id="reports" className="card panel">
          <div className="panel-head">
            <h2>Daily report</h2>
            <p>Quick leadership view for revenue, payment volume, and stock exceptions.</p>
          </div>
          <div className="compact-list">
            <p>Date · {report?.date ?? "-"}</p>
            <p>Sales · {formatCurrency(report?.salesTotal ?? 0)}</p>
            <p>Payments · {report?.paymentCount ?? 0}</p>
            <p>Orders · {report?.ordersCount ?? 0}</p>
            <p>Items sold · {report?.itemsSold ?? 0}</p>
            <strong>Low stock watch</strong>
            {report?.lowStockItems.length ? report.lowStockItems.map((item) => (
              <p key={item.id} className="alert">
                {item.name} · {item.quantity}/{item.reorderLevel} {item.unit}
              </p>
            )) : <div className="empty-state"><strong>No current low stock flags</strong><p>Daily report is clear on stock exceptions.</p></div>}
          </div>
        </article> : null}

        {canManageRestaurant ? <article id="tables-alerts" className="card panel">
          <div className="panel-head">
            <h2>Tables and alerts</h2>
            <p>Manage floor capacity and outbound service communication in one place.</p>
          </div>
          <div className="compact-list">
            {tables.length === 0 ? (
              <div className="empty-state">
                <strong>No tables configured</strong>
                <p>Add floor labels and capacity to streamline dine-in order assignment.</p>
              </div>
            ) : tables.map((table) => (
              <p key={table.id}>
                {table.label} · {table.capacity} pax
              </p>
            ))}
          </div>
          <form className="stack form-block" onSubmit={createTable}>
            <label>
              Table label
              <input value={tableLabel} onChange={(event) => setTableLabel(event.target.value)} />
            </label>
            <label>
              Capacity
              <input value={tableCapacity} onChange={(event) => setTableCapacity(event.target.value)} />
            </label>
            <button type="submit" disabled={busyActions.createTable}>
              {busyActions.createTable ? "Creating..." : "Add table"}
            </button>
          </form>
          <form className="stack form-block" onSubmit={sendSms}>
            <label>
              SMS recipient
              <input type="tel" autoComplete="tel" value={smsRecipient} onChange={(event) => setSmsRecipient(event.target.value)} />
            </label>
            <label>
              Message
              <input value={smsText} onChange={(event) => setSmsText(event.target.value)} />
            </label>
            <button type="submit" disabled={busyActions.sendSms}>
              {busyActions.sendSms ? "Sending..." : "Send SMS"}
            </button>
          </form>
          <div className="compact-list">
            {smsMessages.length === 0 ? (
              <div className="empty-state">
                <strong>No SMS history yet</strong>
                <p>Outbound alert activity will appear here after the first message is sent.</p>
              </div>
            ) : smsMessages.map((item) => (
              <p key={item.id}>
                {item.recipient} · {item.status}
              </p>
            ))}
          </div>
        </article> : null}

        {canManageRestaurant ? <article className="card panel">
          <div className="panel-head">
            <h2>M-Pesa activity</h2>
            <p>Inspect the latest recorded M-Pesa transaction activity.</p>
          </div>
          <div className="compact-list">
            {latestTransactions.length === 0 ? (
              <div className="empty-state">
                <strong>No M-Pesa transactions yet</strong>
                <p>Latest transaction records will appear here when live M-Pesa events are available.</p>
              </div>
            ) : latestTransactions.map((transaction) => (
              <p key={transaction.id}>
                {transaction.reference ?? transaction.checkoutRequestId.slice(0, 8)} · {formatCurrency(transaction.amount)}
              </p>
            ))}
          </div>
        </article> : null}

        {canManageRestaurant ? <article id="staff" className="card panel">
          <div className="panel-head">
            <h2>Staff</h2>
            <p>Control activation and credential resets without leaving restaurant administration.</p>
          </div>
          <div className="compact-list">
            {staff.length === 0 ? (
              <div className="empty-state">
                <strong>No staff accounts yet</strong>
                <p>Add operators before expecting role-based access across cashier, kitchen, or delivery.</p>
              </div>
            ) : staff.map((member) => (
              <div key={member.id} className="order-card">
                <strong>
                  {member.firstName} {member.lastName}
                </strong>
                <p>
                  {member.email} · {member.isActive ? "Active" : "Inactive"}
                </p>
                <label style={{ marginTop: 8, display: "block" }}>
                  Role
                  <select
                    value={member.role}
                    disabled={!!busyActions[`staff-role-${member.id}`]}
                    onChange={(event) => void updateStaffRole(member.id, event.target.value)}
                  >
                    <option value="MANAGER">Manager</option>
                    <option value="CASHIER">Cashier</option>
                    <option value="KITCHEN">Kitchen</option>
                    <option value="DELIVERY">Delivery</option>
                  </select>
                </label>
                <div className="inline-actions" style={{ marginTop: 8 }}>
                  <button onClick={() => setEditingStaffId(String(member.id))}>Set password</button>
                  <button disabled={busyActions[`staff-status-${member.id}`]} onClick={() => void updateStaffMember(member.id, member.isActive)}>
                    {busyActions[`staff-status-${member.id}`] ? "Saving..." : member.isActive ? "Deactivate" : "Activate"}
                  </button>
                </div>
                {editingStaffId === String(member.id) ? (
                  <div className="form-block">
                    <label>
                      New password
                      <input type="password" autoComplete="new-password" value={staffPassword} onChange={(event) => setStaffPassword(event.target.value)} />
                    </label>
                    <button disabled={busyActions[`staff-password-${member.id}`]} onClick={() => void resetStaffPassword(member.id)}>
                      {busyActions[`staff-password-${member.id}`] ? "Saving..." : "Save password"}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <div className="panel-head" style={{ marginTop: 18 }}>
            <h2>Delivery profiles</h2>
            <p>Manage independent riders separately from staff logins.</p>
          </div>
          <div className="compact-list">
            {deliveryAgents.length === 0 ? (
              <div className="empty-state">
                <strong>No delivery profiles yet</strong>
                <p>Add contractor riders here so cashiers can assign them on takeaway orders.</p>
              </div>
            ) : deliveryAgents.map((agent) => (
              <div key={agent.id} className="order-card">
                <strong>
                  {agent.firstName} {agent.lastName}
                </strong>
                <p>
                  {agent.phone} · {agent.isActive ? "Active" : "Inactive"}
                </p>
                {agent.notes ? <p>{agent.notes}</p> : null}
                <div className="inline-actions">
                  <button disabled={busyActions[`delivery-agent-${agent.id}`]} onClick={() => void updateDeliveryAgent(agent.id, agent.isActive)}>
                    {busyActions[`delivery-agent-${agent.id}`] ? "Saving..." : agent.isActive ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article> : null}

        <article id="print-invoice" className="card panel">
          <div className="panel-head">
            <h2>Print invoice</h2>
            <p>Generate a customer-ready printable order summary directly from the service workspace.</p>
          </div>
          <label>
            Order
            <select value={invoiceOrderId} onChange={(event) => setInvoiceOrderId(event.target.value)}>
              <option value="">Select order</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.orderNumber} · {order.customerName ?? order.type}
                </option>
              ))}
            </select>
          </label>
          <button onClick={printInvoice}>Print order invoice</button>
          {canDispatchDelivery ? (
            <p className="status" style={{ marginTop: 12 }}>
              Print takeaway invoices for dispatch with location and address details for the rider.
            </p>
          ) : null}
        </article>
      </section>
    </main>
  );
}
