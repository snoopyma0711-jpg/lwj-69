import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, Select, message, Spin } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';

const { Title, Text } = Typography;
const { Option } = Select;

const testAccounts = [
  { role: 'resident', username: 'resident1', password: '123456', label: '住户 - 张先生 (1号楼101)' },
  { role: 'resident', username: 'resident2', password: '123456', label: '住户 - 李女士 (2号楼302)' },
  { role: 'frontdesk', username: 'admin', password: '123456', label: '物业前台 - 王主管' },
  { role: 'technician', username: 'tech1', password: '123456', label: '维修师傅 - 张师傅' },
  { role: 'technician', username: 'tech2', password: '123456', label: '维修师傅 - 李师傅' }
];

function LoginPage() {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  React.useEffect(() => {
    if (user) {
      navigate(`/${user.role}`, { replace: true });
    }
  }, [user, navigate]);

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
      message.success('登录成功');
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (account: typeof testAccounts[0]) => {
    form.setFieldsValue({
      username: account.username,
      password: account.password
    });
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏢</div>
          <Title level={2} style={{ margin: 0, color: '#1677ff' }}>
            物业报修调度系统
          </Title>
          <Text type="secondary">便捷报修 · 高效调度 · 贴心服务</Text>
        </div>

        <Form
          form={form}
          name="login"
          onFinish={onFinish}
          size="large"
          layout="vertical"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="请输入用户名"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入密码"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              icon={<LoginOutlined />}
              loading={loading}
              disabled={loading}
            >
              {loading ? '登录中...' : '登录'}
            </Button>
          </Form.Item>
        </Form>

        <Card size="small" title={<span>🎯 快速登录测试账号</span>} style={{ marginTop: 20 }}>
          <Select
            placeholder="选择测试账号"
            style={{ width: '100%' }}
            onChange={(_, option: any) => {
              if (option && option.username) {
                handleQuickLogin({
                  username: option.username,
                  password: '123456',
                  role: option.role,
                  label: ''
                });
              }
            }}
          >
            {testAccounts.map((account, index) => (
              <Option
                key={index}
                value={account.username}
                username={account.username}
                role={account.role}
              >
                {account.label}
              </Option>
            ))}
          </Select>
          <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
            所有测试账号密码均为: <code>123456</code>
          </Text>
        </Card>
      </div>
    </div>
  );
}

export default LoginPage;
