import React from 'react';
import { Layout, Menu, Avatar, Dropdown, Button, Badge } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  DashboardOutlined,
  AppstoreOutlined,
  UserOutlined,
  LogoutOutlined,
  BellOutlined,
  FundOutlined
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;

function FrontdeskLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const selectedKey = location.pathname.includes('dashboard') ? 'dashboard' : 'kanban';

  const menuItems = [
    {
      key: 'kanban',
      icon: <AppstoreOutlined />,
      label: '工单看板',
      onClick: () => navigate('/frontdesk/kanban')
    },
    {
      key: 'dashboard',
      icon: <FundOutlined />,
      label: '数据仪表盘',
      onClick: () => navigate('/frontdesk/dashboard')
    }
  ];

  const userMenu = {
    items: [
      {
        key: 'info',
        icon: <UserOutlined />,
        label: (
          <div>
            <div><strong>物业前台 · {user?.realName}</strong></div>
            <div style={{ fontSize: 12, color: '#999' }}>
              {user?.phone}
            </div>
          </div>
        ),
        disabled: true
      },
      { type: 'divider' as const },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: '退出登录',
        onClick: handleLogout
      }
    ]
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth="0" theme="dark">
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: 18,
          fontWeight: 'bold',
          background: 'rgba(255,255,255,0.1)'
        }}>
          👨‍💼 前台端
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 1px 4px rgba(0,21,41,.08)'
        }}>
          <div style={{ fontSize: 16, fontWeight: 500 }}>
            <DashboardOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            物业报修调度系统 · 管理后台
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Badge count={0} size="small">
              <Button type="text" icon={<BellOutlined />} />
            </Badge>
            <Dropdown menu={userMenu} placement="bottomRight">
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar icon={<UserOutlined />} style={{ background: '#722ed1' }} />
                <span>{user?.realName}</span>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content style={{ margin: 24, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

export default FrontdeskLayout;
