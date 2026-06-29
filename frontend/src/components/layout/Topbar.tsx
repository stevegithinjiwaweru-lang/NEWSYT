import React from 'react'
import { BellOutlined, UserOutlined } from '@ant-design/icons'
import { Avatar } from 'antd'

const Topbar: React.FC<{ user: { id: string; name: string; role: string }; onLogout: () => void }> = ({ user, onLogout }) => {
  return (
    <div className="topbar">
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div className="page-title">Dispatch & Operations Dashboard</div>
        <div style={{ color: 'var(--muted)', fontSize: 13 }}>Overview</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <BellOutlined style={{ fontSize: 18 }} />
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700 }}>{user.name}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{user.role.toUpperCase()}</div>
        </div>
        <Avatar
          icon={<UserOutlined />}
          style={{ cursor: 'pointer' }}
          onClick={onLogout}
        />
      </div>
    </div>
  )
}

export default Topbar