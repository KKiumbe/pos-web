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

const storageKey = "tableflow-session";
const roleOptions = [
  { value: "MANAGER", label: "Manager" },
  { value: "CASHIER", label: "Cashier" },
  { value: "KITCHEN", label: "Kitchen" },
  { value: "DELIVERY", label: "Delivery" }
];

function formatCurrency(amount: number, currency = "KES") {
  return `${currency} ${Number(amount).toLocaleString()}`;
}

function formatPeriodLabel(startDate: string, endDate: string) {
  return startDate === endDate ? startDate : `${startDate} to ${endDate}`;
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
    normalized.includes("saved")
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
      const [menuData, staffData, reportData, overviewData, tenantData] = await Promise.all([
        apiRequest<Category[]>("/menu/categories", {}, activeToken),
        apiRequest<StaffMember[]>("/staff", {}, activeToken),
        apiRequest<DailyReport>(`/reports/daily?date=${activeReportDate}`, {}, activeToken),
        apiRequest<ReportOverview>(`/reports/overview?date=${activeReportDate}`, {}, activeToken),
        apiRequest<TenantProfile>("/tenant/profile", {}, activeToken)
      ]);
      setCategories(menuData);
      setStaff(staffData);
      seedStaffDrafts(staffData);
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

  async function updateMenuItemPrice(itemId: number, currentPrice: number) {
    if (!token) return;

    const nextPriceValue = window.prompt("Enter the new price for this menu item.", String(currentPrice));
    if (nextPriceValue == null) {
      return;
    }

    const nextPrice = Number(nextPriceValue);
    if (Number.isNaN(nextPrice) || nextPrice <= 0) {
      setMessage("Enter a valid price greater than zero.");
      return;
    }

    try {
      await apiRequest(
        `/menu/items/${itemId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ price: nextPrice })
        },
        token
      );
      setMessage("Menu item price updated.");
      await loadManagement(token, reportDate);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update menu item price.");
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
      setMessage(response.message ?? "Menu item removed.");
      await loadManagement(token, reportDate);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to remove menu item.");
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

  const totalItems = categories.reduce((acc, category) => acc + category.items.length, 0);
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
            Menu, employees, and daily reporting in one manager workspace.
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
          <span>Employees</span>
          <strong>{activeStaff} active · {staff.length} total</strong>
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
      </nav>

      <section id="overview" className="metrics-grid">
        {[
          ["Available menu items", categories.flatMap((category) => category.items).filter((item) => item.isAvailable).length],
          ["Active managers", staff.filter((member) => member.role === "MANAGER" && member.isActive).length],
          ["Orders on selected day", dailyReport?.ordersCount ?? "Loading..."],
          ["Payments on selected day", dailyReport?.paymentCount ?? "Loading..."],
          ["Items sold on selected day", dailyReport?.itemsSold ?? "Loading..."],
          ["Current low stock alerts", dailyReport?.lowStockItems.length ?? "Loading..."]
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
            <p>Keep restaurant identity and staff access current from the same screen.</p>
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

        <article id="employees" className="card panel" style={{ gridColumn: "span 3" }}>
          <div className="panel-head">
            <h2>Employee management</h2>
            <p>Create employee profiles, adjust roles, and manage access without leaving this workspace.</p>
          </div>

          <div style={{ display: "grid", gap: 18, gridTemplateColumns: "minmax(280px, 340px) 1fr" }}>
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

                    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))", marginTop: 16 }}>
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
                      <label style={{ justifyContent: "end" }}>
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

        <article id="reports" className="card panel">
          <div className="panel-head">
            <h2>Reports</h2>
            <p>Review daily, weekly, and monthly performance, top-selling items, and stock pressure.</p>
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
                    <p>
                      Most bought · {period.mostBoughtItem
                        ? `${period.mostBoughtItem.name} (${period.mostBoughtItem.quantity})`
                        : "No sales"}
                    </p>
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

              <div className="compact-list" style={{ marginTop: 18 }}>
                <div className="order-card">
                  <strong>Daily sales trend</strong>
                  <p>Last 7 trading days</p>
                  {reportOverview.dailyTrend.map((entry) => (
                    <p key={entry.label}>
                      {entry.startDate} · {formatCurrency(entry.salesTotal, currency)} · {entry.ordersCount} orders · {entry.itemsSold} items
                    </p>
                  ))}
                </div>
                <div className="order-card">
                  <strong>Weekly sales trend</strong>
                  <p>Last 8 trading weeks</p>
                  {reportOverview.weeklyTrend.map((entry) => (
                    <p key={entry.label}>
                      {formatPeriodLabel(entry.startDate, entry.endDate)} · {formatCurrency(entry.salesTotal, currency)} · {entry.ordersCount} orders
                    </p>
                  ))}
                </div>
                <div className="order-card">
                  <strong>Monthly sales trend</strong>
                  <p>Last 6 trading months</p>
                  {reportOverview.monthlyTrend.map((entry) => (
                    <p key={entry.label}>
                      {entry.label} · {formatCurrency(entry.salesTotal, currency)} · {entry.ordersCount} orders
                    </p>
                  ))}
                </div>
              </div>
            </>
          ) : dailyReport ? (
            <div className="compact-list" style={{ marginTop: 18 }}>
              <div className="stat-chip">
                <span>Sales total</span>
                <strong>{formatCurrency(dailyReport.salesTotal, currency)}</strong>
              </div>
              <div className="stat-chip">
                <span>Orders</span>
                <strong>{dailyReport.ordersCount}</strong>
              </div>
              <div className="stat-chip">
                <span>Payments</span>
                <strong>{dailyReport.paymentCount}</strong>
              </div>
              <div className="stat-chip">
                <span>Items sold</span>
                <strong>{dailyReport.itemsSold}</strong>
              </div>
            </div>
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

        <article id="menu" className="card panel">
          <div className="panel-head">
            <h2>New category</h2>
            <p>Keep menu organisation close to staff and reporting workflows.</p>
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

        <article className="card panel" style={{ gridColumn: "span 2" }}>
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
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
                    placeholder="Short description (optional)"
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
                <label style={{ justifyContent: "end" }}>
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
              <p className="helper-text">Required: name, category, and a price greater than zero.</p>
            </form>
          )}
        </article>

        <article className="card panel" style={{ gridColumn: "span 3" }}>
          <div className="panel-head">
            <h2>Menu catalogue</h2>
            <p>
              {totalItems} {totalItems === 1 ? "item" : "items"} across {categories.length}{" "}
              {categories.length === 1 ? "category" : "categories"}
            </p>
          </div>
          {categories.length === 0 ? (
            <div className="empty-state">
              <strong>No menu yet</strong>
              <p>Create a category and add items to build the menu catalogue.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 24 }}>
              {categories.map((category) => (
                <div key={category.id}>
                  <p className="eyebrow" style={{ marginBottom: 10 }}>
                    {category.name} · {category.items.length} {category.items.length === 1 ? "item" : "items"}
                  </p>
                  {category.items.length === 0 ? (
                    <div className="empty-state">
                      <p>No items in this category yet.</p>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                        gap: 12
                      }}
                    >
                      {category.items.map((item) => (
                        <div key={item.id} className="order-card">
                          {item.photoUrl ? (
                            <img
                              src={item.photoUrl}
                              alt={item.name}
                              className="menu-thumb"
                              style={{ width: "100%", height: 120, marginBottom: 10 }}
                            />
                          ) : null}
                          <strong>{item.name}</strong>
                          <p style={{ margin: "4px 0" }}>{formatCurrency(item.price, currency)}</p>
                          {item.description ? <p className="menu-description">{item.description}</p> : null}
                          <p style={{ marginTop: 8 }}>
                            <span
                              style={{
                                color: item.isAvailable ? "var(--success)" : "var(--warning)",
                                fontWeight: 600,
                                fontSize: "0.85rem"
                              }}
                            >
                              {item.isAvailable ? "● Available" : "○ Unavailable"}
                            </span>
                          </p>
                          <div className="inline-actions" style={{ marginTop: 12 }}>
                            <button type="button" onClick={() => void updateMenuItemPrice(item.id, item.price)} disabled={isPending}>
                              Change price
                            </button>
                            <button type="button" onClick={() => void removeMenuItem(item.id, item.name)} disabled={isPending}>
                              Remove item
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
