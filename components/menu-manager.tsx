"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";

import { apiRequest, type LoginResponse } from "../lib/api";

type MenuItem = {
  id: number;
  name: string;
  description: string | null;
  photoUrl?: string | null;
  price: number;
  isAvailable: boolean;
};

type Category = {
  id: number;
  name: string;
  items: MenuItem[];
};

const storageKey = "tableflow-session";

function formatCurrency(amount: number) {
  return `KES ${Number(amount).toLocaleString()}`;
}

function getMessageTone(message: string): "success" | "warning" | "info" {
  const normalized = message.toLowerCase();
  if (normalized.includes("unable") || normalized.includes("failed")) return "warning";
  if (normalized.includes("created") || normalized.includes("loaded")) return "success";
  return "info";
}

export function MenuManager() {
  const [session, setSession] = useState<LoginResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [message, setMessage] = useState("Loading menu catalogue...");
  const [categoryName, setCategoryName] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemPhotoUrl, setItemPhotoUrl] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemCategoryId, setItemCategoryId] = useState("");
  const [itemAvailable, setItemAvailable] = useState(true);
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
    startTransition(() => { void loadMenu(token); });
  }, [token]);

  async function loadMenu(activeToken: string) {
    try {
      const data = await apiRequest<Category[]>("/menu/categories", {}, activeToken);
      setCategories(data);
      setMessage("Menu catalogue loaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load menu.");
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
      await loadMenu(token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create category.");
    }
  }

  async function createMenuItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    if (!itemName.trim()) { setMessage("Item name is required."); return; }
    if (!itemCategoryId) { setMessage("Select a category."); return; }
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
      await loadMenu(token);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create menu item.");
    }
  }

  function canCreateMenuItem() {
    const parsedPrice = Number(itemPrice);
    return Boolean(
      token && itemName.trim() && itemCategoryId &&
      itemPrice && !Number.isNaN(parsedPrice) && parsedPrice > 0
    );
  }

  const totalItems = categories.reduce((acc, c) => acc + c.items.length, 0);

  if (!session || !token) {
    return (
      <main className="page-shell">
        <section className="hero card">
          <div>
            <p className="eyebrow">Menu Management</p>
            <h1>Sign in required.</h1>
            <p className="lede">You must be signed in as a Manager to access menu authoring.</p>
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
            <p className="eyebrow">Menu Management</p>
            <h1>Access restricted.</h1>
            <p className="lede">Only Managers can author menu categories and items.</p>
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
          <p className="eyebrow">Menu Management · {session.tenant.name}</p>
          <h1>Menu catalogue</h1>
          <p className="lede">
            {session.user.firstName} {session.user.lastName} · Manager
          </p>
        </div>
        <div className="topbar-actions">
          <button onClick={() => token && void loadMenu(token)} disabled={isPending}>
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
        <span className="status-pill">{isPending ? "Saving" : "Ready"}</span>
      </section>

      <section className="stat-strip" style={{ marginBottom: 18 }}>
        <div className="stat-chip">
          <span>Categories</span>
          <strong>{categories.length}</strong>
        </div>
        <div className="stat-chip">
          <span>Total items</span>
          <strong>{totalItems}</strong>
        </div>
        <div className="stat-chip">
          <span>Available items</span>
          <strong>{categories.flatMap((c) => c.items).filter((i) => i.isAvailable).length}</strong>
        </div>
      </section>

      <section className="workspace-grid">
        <article className="card panel">
          <div className="panel-head">
            <h2>New category</h2>
            <p>Group related items under a named category to organise the menu.</p>
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
            <h2>New item</h2>
            <p>Add a priced menu item and assign it to an existing category.</p>
          </div>
          {categories.length === 0 ? (
            <div className="empty-state">
              <strong>Create a category first</strong>
              <p>The item form stays blocked until at least one category exists.</p>
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
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Price (KES) *
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
              <p className="helper-text">* Required: name, category, and a price greater than zero.</p>
            </form>
          )}
        </article>

        <article className="card panel" style={{ gridColumn: "span 3" }}>
          <div className="panel-head">
            <h2>Catalogue</h2>
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
                  <p
                    className="eyebrow"
                    style={{ marginBottom: 10 }}
                  >
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
                          <p style={{ margin: "4px 0" }}>{formatCurrency(item.price)}</p>
                          {item.description ? (
                            <p className="menu-description">{item.description}</p>
                          ) : null}
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
