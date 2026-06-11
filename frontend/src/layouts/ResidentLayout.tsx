import React from 'react';
import { Layout, Menu, Avatar, Dropdown, Button, Badge } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  HomeOutlined,
  FileAddOutlined,
  UnorderedListOutlined,
  UserOutlined,
  LogoutOutlined,
  BellOutlined
} from '@ant-design/icons';

const { Header, Sider, Content } = Layout;

function ResidentLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const selectedKey = location.pathname.includes('submit') ? 'submit' : 'orders';

  const menuItems = [
    {
      key: 'orders',
      icon: <UnorderedListOutlined />,
      label: '我的报修单',
      onClick: () => navigate('/resident/orders')
    },
    {
      key: 'submit',
      icon: <FileAddOutlined />,
      label: '提交报修',
      onClick: () => navigate('/resident/submit')
    }
  ];

  const userMenu = {
    items: [
      {
        key: 'info',
        icon: <UserOutlined />,
        label: (
          <div>
            <div><strong>{user?.realName}</strong></div>
            <div style={{ fontSize: 12, color: '#999' }}>
              {user?.building} {user?.room}
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
          🏠 住户端
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
            <HomeOutlined style={{ marginRight: 8, color: '#1677ff' }} />
            物业报修调度系统
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Badge count={0} size="small">
              <Button type="text" icon={<BellOutlined />} />
            </Badge>
            <Dropdown menu={userMenu} placement="bottomRight">
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar icon={<UserOutlined />} />
                <span>{user?.realName}</span>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: '#fff', borderRadius: 8 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

export default ResidentLayout;
