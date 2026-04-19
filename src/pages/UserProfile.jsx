import './UserProfile.css';
import { useState } from 'react';

const initialUser = {
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane.doe@posstore.com',
  phone: '+1 (555) 234-5678',
  role: 'Store Manager',
  store: 'Downtown Branch',
  storeId: 'STR-001',
  joinDate: '2022-03-15',
  lastLogin: '2026-04-19 08:45 AM',
  avatarInitials: 'JD',
  permissions: ['Sales', 'Inventory Management', 'Reports', 'Customer Management', 'Refunds'],
};

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function UserProfile() {
  const [user, setUser] = useState(initialUser);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...initialUser });
  const [saved, setSaved] = useState(false);

  function handleEdit() {
    setForm({ ...user });
    setEditing(true);
    setSaved(false);
  }

  function handleCancel() {
    setEditing(false);
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSave(e) {
    e.preventDefault();
    const initials =
      (form.firstName?.[0] ?? '') + (form.lastName?.[0] ?? '');
    setUser({ ...form, avatarInitials: initials.toUpperCase() });
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="profile-page">
      <div className="profile-header-bar">
        <h1 className="profile-title">My Profile</h1>
        {!editing && (
          <button className="btn btn-primary" onClick={handleEdit}>
            ✏️ Edit Profile
          </button>
        )}
      </div>

      {saved && (
        <div className="profile-toast">✅ Profile updated successfully!</div>
      )}

      <div className="profile-layout">
        {/* Left: Avatar card */}
        <aside className="profile-card profile-avatar-card">
          <div className="profile-avatar">{user.avatarInitials}</div>
          <h2 className="profile-name">
            {user.firstName} {user.lastName}
          </h2>
          <span className="profile-role-badge">{user.role}</span>
          <div className="profile-meta">
            <div className="profile-meta-row">
              <span className="profile-meta-icon">🏪</span>
              <span>{user.store}</span>
            </div>
            <div className="profile-meta-row">
              <span className="profile-meta-icon">🆔</span>
              <span>{user.storeId}</span>
            </div>
            <div className="profile-meta-row">
              <span className="profile-meta-icon">📅</span>
              <span>Joined {formatDate(user.joinDate)}</span>
            </div>
            <div className="profile-meta-row">
              <span className="profile-meta-icon">🕐</span>
              <span>Last login: {user.lastLogin}</span>
            </div>
          </div>
        </aside>

        {/* Right: Details */}
        <div className="profile-main">
          {editing ? (
            <form className="profile-card profile-form" onSubmit={handleSave}>
              <h3 className="profile-section-title">Edit Personal Information</h3>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="firstName">First Name</label>
                  <input
                    id="firstName"
                    name="firstName"
                    value={form.firstName}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="lastName">Last Name</label>
                  <input
                    id="lastName"
                    name="lastName"
                    value={form.lastName}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="phone">Phone Number</label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="store">Store / Branch</label>
                <input
                  id="store"
                  name="store"
                  value={form.store}
                  onChange={handleChange}
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="profile-card">
                <h3 className="profile-section-title">Personal Information</h3>
                <div className="profile-info-grid">
                  <div className="profile-info-item">
                    <span className="profile-info-label">First Name</span>
                    <span className="profile-info-value">{user.firstName}</span>
                  </div>
                  <div className="profile-info-item">
                    <span className="profile-info-label">Last Name</span>
                    <span className="profile-info-value">{user.lastName}</span>
                  </div>
                  <div className="profile-info-item">
                    <span className="profile-info-label">Email Address</span>
                    <span className="profile-info-value">{user.email}</span>
                  </div>
                  <div className="profile-info-item">
                    <span className="profile-info-label">Phone Number</span>
                    <span className="profile-info-value">{user.phone}</span>
                  </div>
                  <div className="profile-info-item">
                    <span className="profile-info-label">Role</span>
                    <span className="profile-info-value">{user.role}</span>
                  </div>
                  <div className="profile-info-item">
                    <span className="profile-info-label">Store / Branch</span>
                    <span className="profile-info-value">{user.store}</span>
                  </div>
                </div>
              </div>

              <div className="profile-card">
                <h3 className="profile-section-title">Permissions & Access</h3>
                <div className="permissions-list">
                  {user.permissions.map((perm) => (
                    <span key={perm} className="permission-tag">
                      ✔ {perm}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
