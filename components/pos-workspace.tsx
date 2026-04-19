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

type InventoryItem = {
  id: number;
  name: string;
  unit: string;
  quantity: number;
  reorderLevel: number;
  lowStock: boolean;
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
  type: "DINE_IN" | "TAKEAWAY";
  status: string;
  table: { id: number; label: string } | null;
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

const storageKey = "tableflow-session";
const loginPresets = [
  { label: "Owner", sub: "Jua Kali Grill", email: "0702550190", password: "123" },
  { label: "Manager", sub: "Demo Restaurant", email: "manager@demo.tableflow.app", password: "Admin@1234" },
  { label: "Cashier", sub: "Demo Restaurant", email: "cashier@demo.tableflow.app", password: "Admin@1234" },
  { label: "Kitchen", sub: "Demo Restaurant", email: "kitchen@demo.tableflow.app", password: "Admin@1234" },
  { label: "Delivery", sub: "Demo Restaurant", email: "delivery@demo.tableflow.app", password: "Admin@1234" }
];

function formatCurrency(amount: number | null | undefined) {
  return `KES ${Number(amount ?? 0).toLocaleString()}`;
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

export function PosWorkspace() {
  const [session, setSession] = useState<LoginResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tables, setTables] = useState<TableItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [smsMessages, setSmsMessages] = useState<SmsMessage[]>([]);
  const [mpesaTransactions, setMpesaTransactions] = useState<MpesaTransaction[]>([]);
  const [message, setMessage] = useState<string>("");
  const [staff, setStaff] = useState<StaffMember[]>([]);
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
  const [paymentOrderId, setPaymentOrderId] = useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [tableLabel, setTableLabel] = useState("");
  const [tableCapacity, setTableCapacity] = useState("4");
  const [stockName, setStockName] = useState("");
  const [stockUnit, setStockUnit] = useState("");
  const [stockQuantity, setStockQuantity] = useState("");
  const [stockReorderLevel, setStockReorderLevel] = useState("");
  const [recipeMenuItemId, setRecipeMenuItemId] = useState("");
  const [recipeStockItemId, setRecipeStockItemId] = useState("");
  const [recipeQuantity, setRecipeQuantity] = useState("");
  const [smsRecipient, setSmsRecipient] = useState("");
  const [smsText, setSmsText] = useState("");
  const [staffFirstName, setStaffFirstName] = useState("");
  const [staffLastName, setStaffLastName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffRole, setStaffRole] = useState("CASHIER");
  const [editingStaffId, setEditingStaffId] = useState<string>("");
  const [tenantName, setTenantName] = useState("");
  const [tenantAddress, setTenantAddress] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [tenantContactEmail, setTenantContactEmail] = useState("");
  const [tenantLogoUrl, setTenantLogoUrl] = useState("");
  const [tenantBrandColor, setTenantBrandColor] = useState("#a64b2a");
  const [invoiceOrderId, setInvoiceOrderId] = useState("");
  const [smsBalance, setSmsBalance] = useState<number | null>(null);
  const [forgotMode, setForgotMode] = useState<"off" | "phone" | "otp">("off");
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotMessage, setForgotMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement | null>(null);

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

      const requests: Promise<any>[] = [
        apiRequest<DashboardSummary>("/dashboard/summary", {}, activeToken),
        apiRequest<Category[]>("/menu/categories", {}, activeToken),
        canSeeTables ? apiRequest<TableItem[]>("/tables", {}, activeToken) : Promise.resolve([]),
        apiRequest<Order[]>("/orders", {}, activeToken),
        canSeeInventory ? apiRequest<InventoryItem[]>("/inventory/items", {}, activeToken) : Promise.resolve([]),
        canSeeReports ? apiRequest<Report>("/reports/daily", {}, activeToken) : Promise.resolve(null),
        canManageRestaurant ? apiRequest<SmsMessage[]>("/integrations/sms/messages", {}, activeToken) : Promise.resolve([]),
        canManageRestaurant ? apiRequest<MpesaTransaction[]>("/integrations/mpesa/transactions", {}, activeToken) : Promise.resolve([]),
        canManageRestaurant ? apiRequest<StaffMember[]>("/staff", {}, activeToken) : Promise.resolve([]),
        canManageRestaurant ? apiRequest<TenantProfile>("/tenant/profile", {}, activeToken) : Promise.resolve(null)
      ];

      const [summaryData, menuData, tablesData, ordersData, inventoryData, reportData, smsData, mpesaData, staffData, tenantData] =
        await Promise.all(requests);

      setSummary(summaryData);
      setCategories(menuData);
      setTables(tablesData);
      setOrders(ordersData);
      setInventory(inventoryData);
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
    setMessage("Signing in...");

    startTransition(async () => {
      try {
        const login = await apiRequest<LoginResponse>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password })
        });

        setSession(login);
        setToken(login.token);
        window.localStorage.setItem(storageKey, JSON.stringify({ ...login, token: login.token }));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Sign in failed.");
      }
    });
  }

  async function handleForgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!forgotIdentifier.trim()) return;
    setForgotMessage("Sending OTP...");
    try {
      await apiRequest("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ identifier: forgotIdentifier.trim().toLowerCase() })
      });
      setForgotMessage("OTP sent via SMS. Enter it below.");
      setForgotMode("otp");
    } catch (error) {
      setForgotMessage(error instanceof Error ? error.message : "Unable to send OTP.");
    }
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!forgotOtp.trim() || !forgotNewPassword) return;
    setForgotMessage("Resetting...");
    try {
      await apiRequest("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ identifier: forgotIdentifier.trim().toLowerCase(), otp: forgotOtp.trim(), newPassword: forgotNewPassword })
      });
      setForgotMessage("Password reset! You can now sign in.");
      setTimeout(() => {
        setForgotMode("off");
        setForgotIdentifier("");
        setForgotOtp("");
        setForgotNewPassword("");
        setForgotMessage("");
      }, 2500);
    } catch (error) {
      setForgotMessage(error instanceof Error ? error.message : "Reset failed.");
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

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedMenuItemId) {
      return;
    }

    const menuItem = categories.flatMap((category) => category.items).find((item) => item.id === Number(selectedMenuItemId));
    if (!menuItem) {
      setMessage("Select a valid menu item.");
      return;
    }

    try {
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
            items: [{ menuItemId: menuItem.id, quantity: Number(quantity) }]
          })
        },
        token
      );

      setMessage("Order created.");
      setSelectedMenuItemId("");
      setQuantity("1");
      setCustomerName("");
      setCustomerPhone("");
      setDeliveryLocation("");
      setDeliveryAddress("");
      setPaymentAmount("");
      await loadWorkspace(token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create order.");
    }
  }

  async function updateKitchenStatus(orderId: number, itemId: number, status: string) {
    if (!token) {
      return;
    }

    try {
      await apiRequest(
        `/orders/${orderId}/items/${itemId}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status })
        },
        token
      );

      setMessage("Kitchen status updated.");
      await loadWorkspace(token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update kitchen status.");
    }
  }

  async function updateOrderStatus(orderId: number, status: string) {
    if (!token) {
      return;
    }

    try {
      await apiRequest(
        `/orders/${orderId}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status })
        },
        token
      );

      setMessage("Order status updated.");
      await loadWorkspace(token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update order status.");
    }
  }

  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !paymentOrderId || !paymentAmount) {
      return;
    }

    try {
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

      setMessage("Payment recorded.");
      setPaymentAmount("");
      await loadWorkspace(token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to record payment.");
    }
  }

  async function createTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !tableLabel) {
      return;
    }

    try {
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
      setMessage("Table created.");
      await loadWorkspace(token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create table.");
    }
  }

  async function createStockItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !stockName || !stockUnit || !stockQuantity) {
      return;
    }

    try {
      await apiRequest(
        "/inventory/items",
        {
          method: "POST",
          body: JSON.stringify({
            name: stockName,
            unit: stockUnit,
            quantity: Number(stockQuantity),
            reorderLevel: Number(stockReorderLevel || 0)
          })
        },
        token
      );

      setStockName("");
      setStockUnit("");
      setStockQuantity("");
      setStockReorderLevel("");
      setMessage("Stock item created.");
      await loadWorkspace(token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create stock item.");
    }
  }

  async function createRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !recipeMenuItemId || !recipeStockItemId || !recipeQuantity) {
      return;
    }

    try {
      await apiRequest(
        "/inventory/recipes",
        {
          method: "POST",
          body: JSON.stringify({
            menuItemId: Number(recipeMenuItemId),
            items: [{ stockItemId: Number(recipeStockItemId), quantity: Number(recipeQuantity) }]
          })
        },
        token
      );

      setRecipeQuantity("");
      setMessage("Recipe saved.");
      await loadWorkspace(token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save recipe.");
    }
  }

  async function sendSms(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !smsRecipient || !smsText) {
      return;
    }

    try {
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
      setMessage("SMS sent through mock provider.");
      await loadWorkspace(token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to send SMS.");
    }
  }

  async function createStaffMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    try {
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
      setMessage("Staff member created.");
      await loadWorkspace(token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create staff member.");
    }
  }

  async function updateStaffMember(memberId: number, isActive: boolean) {
    if (!token) {
      return;
    }

    try {
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
      setMessage("Staff status updated.");
      await loadWorkspace(token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update staff member.");
    }
  }

  async function resetStaffPassword(memberId: number) {
    if (!token || !staffPassword) {
      return;
    }

    try {
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
      setMessage("Staff password updated.");
      await loadWorkspace(token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to reset password.");
    }
  }

  async function updateTenantProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    try {
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
      setMessage("Restaurant profile updated.");
      await loadWorkspace(token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update restaurant profile.");
    }
  }

  function signOut() {
    window.localStorage.removeItem(storageKey);
    setIsMenuOpen(false);
    setToken(null);
    setSession(null);
    setSummary(null);
    setOrders([]);
    setSmsMessages([]);
    setMpesaTransactions([]);
    setStaff([]);
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
    category.items.map((item) => ({
      id: item.id,
      label: `${category.name} · ${item.name} · KES ${item.price}`
    }))
  );
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
  const sectionLinks = [
    canCreateOrders ? { id: "new-order", label: "New Order" } : null,
    canTakePayments ? { id: "payments", label: "Payments" } : null,
    { id: "orders", label: "Orders" },
    { id: "menu", label: "Menu" },
    canSeeInventory ? { id: "inventory", label: "Inventory" } : null,
    canSeeReports ? { id: "reports", label: "Reports" } : null,
    canManageRestaurant ? { id: "restaurant-admin", label: "Restaurant Admin" } : null,
    canManageRestaurant ? { id: "tables-alerts", label: "Tables" } : null,
    canManageRestaurant ? { id: "staff", label: "Staff" } : null,
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
                  <button type="submit" disabled={isPending} className="auth-submit-btn">
                    {isPending ? "Signing in..." : "Enter workspace"}
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
                  <button type="submit" className="auth-submit-btn">Send OTP</button>
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
                  <button type="submit" className="auth-submit-btn">Reset password</button>
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
        {canManageRestaurant ? (
          <a href="/menu" className="section-chip" style={{ color: "var(--primary)", fontWeight: 600 }}>
            Menu Management →
          </a>
        ) : null}
      </nav>

      <section className="metrics-grid">
        {[
          ["Open Orders", summary?.openOrders ?? 0],
          ["Ready Orders", summary?.readyOrders ?? 0],
          ["Today Sales", summary?.todaySales == null ? "Restricted" : formatCurrency(summary.todaySales)],
          ["Low Stock", summary?.lowStockItems ?? 0],
          ["Active Tables", summary?.activeTables ?? 0],
          ["Menu Items", summary?.menuItems ?? 0]
        ].map(([label, value]) => (
          <article key={label} className="card metric-card">
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="workspace-grid">
        {canCreateOrders ? <article id="new-order" className="card panel">
          <div className="panel-head">
            <h2>New order</h2>
            <p>Capture dine-in and takeaway orders from one operator panel.</p>
          </div>
          <form className="stack" onSubmit={createOrder}>
            <label>
              Order type
              <select value={orderMode} onChange={(event) => setOrderMode(event.target.value as "DINE_IN" | "TAKEAWAY")}>
                <option value="DINE_IN">Dine In</option>
                <option value="TAKEAWAY">Takeaway</option>
              </select>
            </label>
            <label>
              Table
              <select value={selectedTableId} onChange={(event) => setSelectedTableId(event.target.value)}>
                <option value="">Select table</option>
                {tables.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.label} · {table.capacity} pax
                  </option>
                ))}
              </select>
            </label>
            <label>
              Menu item
              <select value={selectedMenuItemId} onChange={(event) => setSelectedMenuItemId(event.target.value)}>
                <option value="">Select item</option>
                {menuOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Quantity
              <input inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            </label>
            <label>
              Customer name
              <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
            </label>
            <label>
              Customer phone
              <input type="tel" autoComplete="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} />
            </label>
            {orderMode === "TAKEAWAY" ? (
              <>
                <label>
                  Delivery location
                  <input value={deliveryLocation} onChange={(event) => setDeliveryLocation(event.target.value)} />
                </label>
                <label>
                  Delivery address
                  <input value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} />
                </label>
              </>
            ) : null}
            <button type="submit">Create order</button>
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
                {orders.map((order) => (
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
            <button type="submit">Record payment</button>
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
            <button type="submit">Save restaurant profile</button>
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
            <button type="submit">Add staff member</button>
          </form>
        </article> : null}

        <article id="orders" className="card panel orders-panel">
          <div className="panel-head">
            <h2>Orders</h2>
            <p>Monitor live order flow, advance service state, and act on kitchen items.</p>
          </div>
          <div className="order-list">
            {orders.length === 0 ? (
              <div className="empty-state">
                <strong>No orders yet</strong>
                <p>Create the first order to activate kitchen, payment, and dispatch flows.</p>
              </div>
            ) : orders.map((order) => (
              <div key={order.id} className="order-card">
                <div className="order-head">
                  <div>
                    <strong>{order.orderNumber}</strong>
                    <p>
                      {order.type} · {order.status} {order.table ? `· ${order.table.label}` : ""}
                    </p>
                    {order.type === "TAKEAWAY" ? (
                      <p>
                        {order.deliveryLocation ?? "-"} · {order.deliveryAddress ?? "-"}
                      </p>
                    ) : null}
                  </div>
                  {canCreateOrders && order.status === "OPEN" ? (
                    <button onClick={() => void updateOrderStatus(order.id, "SENT_TO_KITCHEN")}>Send to kitchen</button>
                  ) : null}
                </div>
                <ul>
                  {order.items.map((item) => (
                    <li key={item.id}>
                      <span>
                        {item.quantity} x {item.menuItem.name} · {item.status}
                      </span>
                      {canKitchenUpdate ? (
                        <div className="inline-actions">
                          <button onClick={() => void updateKitchenStatus(order.id, item.id, "PREPARING")}>Prep</button>
                          <button onClick={() => void updateKitchenStatus(order.id, item.id, "READY")}>Ready</button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <p className="order-total">{formatCurrency(order.totals.subtotal)}</p>
              </div>
            ))}
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
                  <div key={item.id} className="menu-item-row">
                    {item.photoUrl ? (
                      <img src={item.photoUrl} alt={item.name} className="menu-thumb" />
                    ) : null}
                    <div>
                      <p>
                        {item.name} · {formatCurrency(item.price)}
                      </p>
                      {item.description ? <p className="menu-description">{item.description}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </article>

        {canSeeInventory ? <article id="inventory" className="card panel">
          <div className="panel-head">
            <h2>Inventory</h2>
            <p>Surface low stock risks early and keep recipe mapping close to stock operations.</p>
          </div>
          <div className="compact-list">
            {inventory.length === 0 ? (
              <div className="empty-state">
                <strong>No stock items</strong>
                <p>Add stock items before linking recipes or relying on payment-triggered deductions.</p>
              </div>
            ) : inventory.map((item) => (
              <p key={item.id} className={item.lowStock ? "alert" : ""}>
                {item.name} · {item.quantity} {item.unit}
              </p>
            ))}
          </div>
          <form className="stack form-block" onSubmit={createStockItem}>
            <label>
              Stock item
              <input value={stockName} onChange={(event) => setStockName(event.target.value)} />
            </label>
            <label>
              Unit
              <input value={stockUnit} onChange={(event) => setStockUnit(event.target.value)} />
            </label>
            <label>
              Quantity
              <input inputMode="decimal" value={stockQuantity} onChange={(event) => setStockQuantity(event.target.value)} />
            </label>
            <label>
              Reorder level
              <input inputMode="decimal" value={stockReorderLevel} onChange={(event) => setStockReorderLevel(event.target.value)} />
            </label>
            <button type="submit">Add stock item</button>
          </form>
          <form className="stack form-block" onSubmit={createRecipe}>
            <label>
              Recipe menu item
              <select value={recipeMenuItemId} onChange={(event) => setRecipeMenuItemId(event.target.value)}>
                <option value="">Select item</option>
                {menuOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Stock ingredient
              <select value={recipeStockItemId} onChange={(event) => setRecipeStockItemId(event.target.value)}>
                <option value="">Select stock</option>
                {inventory.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Quantity per item
              <input inputMode="decimal" value={recipeQuantity} onChange={(event) => setRecipeQuantity(event.target.value)} />
            </label>
            <button type="submit">Save recipe</button>
          </form>
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
            <button type="submit">Add table</button>
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
            <button type="submit">Send SMS</button>
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
                  {member.email} · {member.role} · {member.isActive ? "Active" : "Inactive"}
                </p>
                <div className="inline-actions">
                  <button onClick={() => setEditingStaffId(String(member.id))}>Set password</button>
                  <button onClick={() => void updateStaffMember(member.id, member.isActive)}>
                    {member.isActive ? "Deactivate" : "Activate"}
                  </button>
                </div>
                {editingStaffId === String(member.id) ? (
                  <div className="form-block">
                    <label>
                      New password
                      <input type="password" autoComplete="new-password" value={staffPassword} onChange={(event) => setStaffPassword(event.target.value)} />
                    </label>
                    <button onClick={() => void resetStaffPassword(member.id)}>Save password</button>
                  </div>
                ) : null}
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
