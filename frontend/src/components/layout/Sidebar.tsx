import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import logo from "../../assets/logo.svg";

const Sidebar: React.FC = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    navigate("/login", { replace: true });
  };

  const linkClass = ({ isActive }: any) =>
    isActive ? "active nav-link" : "nav-link";

  return (
    <aside className="sidebar" role="navigation" aria-label="Main navigation">
      <div>
        <div className="brand">
          <img src={logo} alt="Easybox logo" />
          <div className="title">
            EASYBOX
            <br />
            <span style={{ fontWeight: 400, fontSize: 12 }}>
              LOGISTICS
            </span>
          </div>
        </div>

        <nav className="nav">
          <NavLink to="/dashboard" className={linkClass}>
            Dashboard
          </NavLink>

          <NavLink to="/orders" className={linkClass}>
            Orders
          </NavLink>

          <NavLink to="/dispatch" className={linkClass}>
            Dispatch
          </NavLink>

          <NavLink to="/riders" className={linkClass}>
            Riders
          </NavLink>

          <NavLink to="/tracking" className={linkClass}>
            Tracking
          </NavLink>

          <NavLink to="/merchants" className={linkClass}>
            Merchants
          </NavLink>

          <NavLink to="/reports" className={linkClass}>
            Reports
          </NavLink>

          <NavLink to="/settings" className={linkClass}>
            Settings
          </NavLink>
        </nav>
      </div>

      <div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 700 }}>Admin</div>
          <div style={{ color: "rgba(255,255,255,0.9)", fontSize: 12 }}>
            Super Admin
          </div>
        </div>

        <button className="logout" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;