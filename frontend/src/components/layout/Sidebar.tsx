import React from "react";
import { NavLink } from "react-router-dom";

const Sidebar: React.FC = () => {
  return (
    <aside className="sidebar" role="navigation" aria-label="Main navigation">
      <div>
        <div className="brand">
          <img src="/logo192.png" alt="NEWSYT logo" />
          <div className="title">NEWSYT</div>
        </div>

        <nav className="nav">
          <NavLink to="/" className={({ isActive }) => (isActive ? "active" : "")}>
            Dashboard
          </NavLink>
          <NavLink to="/orders" className={({ isActive }) => (isActive ? "active" : "")}>Orders</NavLink>
          <NavLink to="/riders" className={({ isActive }) => (isActive ? "active" : "")}>Riders</NavLink>
          <NavLink to="/reports" className={({ isActive }) => (isActive ? "active" : "")}>Reports</NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? "active" : "")}>Settings</NavLink>
        </nav>
      </div>

      <div>
        <a className="logout" href="#" onClick={(e) => { e.preventDefault(); localStorage.removeItem('accessToken'); localStorage.removeItem('refreshToken'); localStorage.removeItem('user'); window.location.href = '/login'; }}>Logout</a>
      </div>
    </aside>
  );
};

export default Sidebar;
