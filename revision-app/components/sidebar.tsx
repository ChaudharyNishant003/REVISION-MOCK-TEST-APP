import Link from "next/link";

import { signOutAction } from "@/lib/actions/auth";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: "⌂" },
  { label: "Revision", href: "/revision", icon: "↻" },
  { label: "Mock Tests", href: "/mock-tests", icon: "◫" },
  { label: "Question Bank", href: "/question-bank", icon: "□" },
  { label: "Analytics", href: "/analytics", icon: "◌" },
];

export default function Sidebar({
  activeHref,
  userName,
}: {
  activeHref: string;
  userName: string;
}) {
  const initial = userName.trim().charAt(0).toUpperCase() || "?";

  return (
    <aside className="sidebar">
      <div className="brand-lockup">
        <div className="brand-mark">R</div>
        <div>
          <strong>Revision Room</strong>
          <span>Accountant prep</span>
        </div>
      </div>
      <nav className="main-nav" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => (
          <Link
            className={item.href === activeHref ? "nav-item active" : "nav-item"}
            href={item.href}
            key={item.href}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <Link className="nav-item" href="/settings">
          <span className="nav-icon">⚙</span>
          Settings
        </Link>
        <form action={signOutAction}>
          <button className="profile-chip" type="submit" style={{ width: "100%", border: 0, background: "transparent", cursor: "pointer" }}>
            <div className="avatar">{initial}</div>
            <div style={{ textAlign: "left" }}>
              <strong>{userName}</strong>
              <span>Log out</span>
            </div>
            <span className="more">···</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
