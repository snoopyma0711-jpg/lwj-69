import React, { useState, useEffect } from 'react';
import {
  Row,
  Col,
  Card,
  Statistic,
  Typography,
  Table,
  Tag,
  Spin,
  Button,
  Tooltip,
  Empty,
  Alert,
  Space
} from 'antd';
import {
  FundOutlined,
  FileAddOutlined,
  ClockCircleOutlined,
  PieChartOutlined,
  WarningOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip, Legend } from 'recharts';
import axios from '../../api/axios';
import { getSlotLabel, getStatusColor, getStatusLabel } from '../../utils/helpers';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

interface DashboardData {
  weekNewCount: number;
  avgDurationHours: number;
  categoryDistribution: { name: string; value: number }[];
  overdueOrders: any[];
  overdueCount: number;
}

const COLORS = ['#1677ff', '#52c41a', '#faad14', '#722ed1', '#eb2f96'];

function FrontdeskDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response: any = await axios.get('/frontdesk/dashboard');
      setData(response);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const overdueColumns = [
    {
      title: '工单编号',
      dataIndex: 'orderNo',
      key: 'orderNo',
      width: 160,
      render: (text: string) => <Text strong>{text}</Text>
    },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      width: 100
    },
    {
      title: '住户信息',
      key: 'resident',
      width: 180,
      render: (_: any, record: any) => (
        <div>
          <div>{record.residentName}</div>
          <div style={{ fontSize: 12, color: '#999' }}>
            {record.building} {record.room}
          </div>
        </div>
      )
    },
    {
      title: '当前状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={getStatusColor(status as any) as any}>{getStatusLabel(status as any)}</Tag>
      )
    },
    {
      title: '维修师傅',
      dataIndex: 'technicianName',
      key: 'technicianName',
      width: 100,
      render: (text: string) => text || <Text type="secondary">待分派</Text>
    },
    {
      title: '超时时长',
      dataIndex: 'overdueHours',
      key: 'overdueHours',
      width: 120,
      render: (hours: number) => (
        <Tag color="red" icon={<WarningOutlined />}>
          {hours} 小时
        </Tag>
      )
    },
    {
      title: '提交时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180
    },
    {
      title: '问题描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          {text}
        </Tooltip>
      )
    }
  ];

  const renderCustomPieLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
    name,
    value
  }: any) => {
    if (percent < 0.05) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fontWeight={500}
      >
        {value}
      </text>
    );
  };

  return (
    <div>
      <div className="page-header" style={{
        padding: 16,
        background: '#fff',
        borderRadius: 8,
        marginBottom: 24
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>
              <FundOutlined style={{ color: '#722ed1', marginRight: 8 }} />
              数据仪表盘
            </Title>
            <Text type="secondary">实时统计数据 · 加载时间：{new Date().toLocaleString()}</Text>
          </div>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchData}
              loading={loading}
            >
              刷新数据
            </Button>
            <Button
              type="primary"
              onClick={() => navigate('/frontdesk/kanban')}
            >
              去看板视图
            </Button>
          </Space>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, background: '#fff', borderRadius: 8 }}>
          <Spin size="large" tip="数据加载中，实时计算统计结果..." />
        </div>
      ) : data ? (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card
                style={{
                  borderRadius: 8,
                  border: 'none',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white'
                }}
                bodyStyle={{ padding: 24 }}
              >
                <Statistic
                  title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>本周新增报修</span>}
                  value={data.weekNewCount}
                  prefix={<FileAddOutlined />}
                  valueStyle={{ color: 'white', fontSize: 32, fontWeight: 'bold' }}
                  suffix="单"
                />
                <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                  最近7天新增的报修工单数量
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <Card
                style={{
                  borderRadius: 8,
                  border: 'none',
                  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  color: 'white'
                }}
                bodyStyle={{ padding: 24 }}
              >
                <Statistic
                  title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>平均处理时长</span>}
                  value={data.avgDurationHours}
                  prefix={<ClockCircleOutlined />}
                  valueStyle={{ color: 'white', fontSize: 32, fontWeight: 'bold' }}
                  suffix="小时"
                  precision={1}
                />
                <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                  从工单提交到关单的平均耗时
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <Card
                style={{
                  borderRadius: 8,
                  border: 'none',
                  background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                  color: 'white'
                }}
                bodyStyle={{ padding: 24 }}
              >
                <Statistic
                  title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>超时工单数</span>}
                  value={data.overdueCount}
                  prefix={<WarningOutlined />}
                  valueStyle={{ color: 'white', fontSize: 32, fontWeight: 'bold' }}
                  suffix="单"
                  valueRender={(node) => (
                    <span style={{ color: data.overdueCount > 0 ? '#fff176' : 'white' }}>{node}</span>
                  )}
                />
                <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                  超过48小时仍未关闭的工单
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <Card
                style={{
                  borderRadius: 8,
                  border: 'none',
                  background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                  color: 'white'
                }}
                bodyStyle={{ padding: 24 }}
              >
                <Statistic
                  title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>报修类别数</span>}
                  value={data.categoryDistribution.length}
                  prefix={<PieChartOutlined />}
                  valueStyle={{ color: 'white', fontSize: 32, fontWeight: 'bold' }}
                  suffix="类"
                />
                <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                  涉及的报修类别覆盖度
                </div>
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={10}>
              <Card
                title={
                  <Space>
                    <PieChartOutlined />
                    各类别报修占比
                  </Space>
                }
                style={{ borderRadius: 8, height: '100%' }}
                extra={
                  <Text type="secondary">
                    总计 {data.categoryDistribution.reduce((s, i) => s + i.value, 0)} 单
                  </Text>
                }
              >
                {data.categoryDistribution.length === 0 ? (
                  <Empty description="暂无数据" style={{ padding: 40 }} />
                ) : (
                  <div style={{ width: '100%', height: 350 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.categoryDistribution}
                          cx="50%"
                          cy="45%"
                          labelLine={false}
                          label={renderCustomPieLabel}
                          outerRadius={120}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {data.categoryDistribution.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <ReTooltip />
                        <Legend
                          verticalAlign="bottom"
                          height={36}
                          formatter={(value, entry: any) => {
                            const percent = data.categoryDistribution.length > 0
                              ? `(${(
                                  (entry.payload.value /
                                    data.categoryDistribution.reduce((s, i) => s + i.value, 0)
                                  ) * 100
                                ).toFixed(1)}%)`
                              : '';
                            return `${value} ${percent}`;
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>
            </Col>

            <Col xs={24} lg={14}>
              <Card
                title={
                  <Space>
                    <WarningOutlined style={{ color: '#ff4d4f' }} />
                    超48小时未关闭工单
                    <Tag color="red" style={{ marginLeft: 8 }}>
                      {data.overdueCount} 单
                    </Tag>
                  </Space>
                }
                style={{ borderRadius: 8, height: '100%' }}
                extra={
                  <Button
                    type="link"
                    size="small"
                    onClick={() => navigate('/frontdesk/kanban')}
                  >
                    去看板处理 →
                  </Button>
                }
              >
                {data.overdueCount === 0 ? (
                  <div style={{ padding: '60px 0' }}>
                    <Empty
                      description={
                        <div>
                          <div style={{ fontSize: 16, marginBottom: 4 }}>🎉 太棒了！</div>
                          <div style={{ color: '#999' }}>暂无超时工单，处理效率很高</div>
                        </div>
                      }
                    />
                  </div>
                ) : (
                  <Table
                    dataSource={data.overdueOrders}
                    columns={overdueColumns}
                    rowKey="id"
                    size="small"
                    pagination={{
                      pageSize: 5,
                      showSizeChanger: false,
                      showTotal: (total) => `共 ${total} 条超时工单`
                    }}
                    scroll={{ x: 1000 }}
                  />
                )}
              </Card>
            </Col>
          </Row>

          {data.overdueCount > 0 && (
            <Alert
              type="warning"
              showIcon
              icon={<WarningOutlined />}
              message={`注意：有 ${data.overdueCount} 个工单已超过48小时未关闭，请尽快安排处理`}
              description="长时间未处理的工单可能导致住户满意度下降，请优先关注看板中的红色超时卡片"
              style={{ marginTop: 24, borderRadius: 8 }}
              action={
                <Button
                  type="primary"
                  size="small"
                  danger
                  onClick={() => navigate('/frontdesk/kanban')}
                >
                  立即处理
                </Button>
              }
            />
          )}
        </>
      ) : null}
    </div>
  );
}

export default FrontdeskDashboard;
