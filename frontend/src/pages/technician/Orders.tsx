import React, { useState, useEffect } from 'react';
import {
  List,
  Card,
  Tag,
  Button,
  Empty,
  Typography,
  Modal,
  Form,
  Input,
  Space,
  message,
  Descriptions,
  Divider,
  Spin,
  Alert,
  Radio,
  Row,
  Col
} from 'antd';
import {
  ToolOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  UserOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
  EyeOutlined,
  CarOutlined,
  ShoppingCartOutlined,
  ReloadOutlined,
  WarningOutlined
} from '@ant-design/icons';
import axios from '../../api/axios';
import { RepairOrder, RepairResult, RESULT_OPTIONS } from '../../types';
import {
  getCategoryLabel,
  getCategoryColor,
  getSlotLabel,
  getStatusLabel,
  getStatusColor,
  getResultLabel,
  generateIdempotencyKey
} from '../../utils/helpers';

const { Title, Text } = Typography;
const { TextArea } = Input;

function TechnicianOrders() {
  const [orders, setOrders] = useState<RepairOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailModal, setDetailModal] = useState<{ visible: boolean; order: RepairOrder | null }>({
    visible: false,
    order: null
  });
  const [processModal, setProcessModal] = useState<{ visible: boolean; order: RepairOrder | null }>({
    visible: false,
    order: null
  });
  const [processForm] = Form.useForm();
  const [actionLoading, setActionLoading] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response: any = await axios.get('/technician/orders');
      setOrders(response.orders || []);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleProcess = async () => {
    try {
      const values = await processForm.validateFields();
      if (!processModal.order) return;

      setActionLoading(true);
      const idempotencyKey = generateIdempotencyKey(
        `process_${processModal.order.id}_${values.result}`
      );
      
      await axios.post(`/technician/orders/${processModal.order.id}/process`, {
        result: values.result,
        note: values.note,
        idempotencyKey
      });
      
      message.success('处理结果已提交');
      processForm.resetFields();
      setProcessModal({ visible: false, order: null });
      setDetailModal({ visible: false, order: null });
      fetchOrders();
    } catch (error: any) {
      if (error.response?.data?.code === 'ORDER_ALREADY_CLOSED') {
        Modal.info({
          title: '工单已被关闭',
          icon: <WarningOutlined style={{ color: '#faad14' }} />,
          content: (
            <div>
              <p>{error.response.data.error}</p>
              <p style={{ fontSize: 12, color: '#999', margin: 0 }}>
                这可能是并发操作导致的，住户已先一步确认关单。
              </p>
            </div>
          ),
          onOk: () => {
            fetchOrders();
          }
        });
      }
    } finally {
      setActionLoading(false);
    }
  };

  const getResultIcon = (result: RepairResult) => {
    switch (result) {
      case 'fixed':
        return <CheckOutlined />;
      case 'revisit':
        return <CarOutlined />;
      case 'parts_needed':
        return <ShoppingCartOutlined />;
    }
  };

  const canProcess = (order: RepairOrder) => {
    return ['in_progress', 'rework'].includes(order.status);
  };

  const renderOrderCard = (order: RepairOrder) => {
    const isToday = order.expectedDate === new Date().toISOString().split('T')[0];
    const actionable = canProcess(order);

    return (
      <List.Item key={order.id}>
        <Card
          style={{ 
            width: '100%',
            borderTop: isToday ? '3px solid #52c41a' : undefined
          }}
          bodyStyle={{ padding: 16 }}
          actions={[
            <Button
              key="detail"
              type="link"
              icon={<EyeOutlined />}
              onClick={() => setDetailModal({ visible: true, order })}
            >
              查看详情
            </Button>,
            actionable && (
              <Button
                key="process"
                type="primary"
                icon={<ToolOutlined />}
                onClick={() => setProcessModal({ visible: true, order })}
              >
                处理工单
              </Button>
            )
          ].filter(Boolean)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 10 }}>
                <Space size={8} wrap>
                  <Tag color={getCategoryColor(order.category)}>
                    {getCategoryLabel(order.category)}
                  </Tag>
                  <Tag color={getStatusColor(order.status) as any}>
                    {getStatusLabel(order.status)}
                  </Tag>
                  {order.status === 'rework' && (
                    <Tag color="orange">返修第 {order.rejectCount} 次</Tag>
                  )}
                  {isToday && (
                    <Tag color="green">今日工单</Tag>
                  )}
                  <Text strong>#{order.orderNo}</Text>
                </Space>
              </div>
              <div
                style={{
                  marginBottom: 10,
                  padding: '10px 12px',
                  background: '#fafafa',
                  borderRadius: 6,
                  borderLeft: '3px solid #1677ff'
                }}
              >
                <Text style={{ whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {order.description}
                </Text>
              </div>
              <Row gutter={[16, 8]} style={{ fontSize: 12, color: '#595959' }}>
                <Col xs={12} sm={12}>
                  <EnvironmentOutlined style={{ marginRight: 4, color: '#8c8c8c' }} />
                  {order.building} {order.room}
                </Col>
                <Col xs={12} sm={12}>
                  <UserOutlined style={{ marginRight: 4, color: '#8c8c8c' }} />
                  {order.residentName}
                  {order.residentPhone && (
                    <a
                      href={`tel:${order.residentPhone}`}
                      style={{ marginLeft: 4 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <PhoneOutlined /> {order.residentPhone}
                    </a>
                  )}
                </Col>
                <Col xs={12} sm={12}>
                  <ClockCircleOutlined style={{ marginRight: 4, color: '#8c8c8c' }} />
                  {order.expectedDate} {getSlotLabel(order.expectedSlot).split(' ')[0]}
                </Col>
                <Col xs={12} sm={12}>
                  分派时间：{order.assignedAt?.split('T')[0] || '未分派'}
                </Col>
              </Row>

              {order.lastRejectReason && order.status === 'rework' && (
                <div style={{
                  marginTop: 12,
                  padding: '8px 12px',
                  background: '#fff2e8',
                  borderRadius: 4,
                  border: '1px solid #ffd591',
                  fontSize: 12
                }}>
                  <span style={{ color: '#d46b08', fontWeight: 500 }}>
                    <WarningOutlined style={{ marginRight: 4 }} />
                    上次打回原因（第{order.rejectCount}次）：
                  </span>
                  <span style={{ marginLeft: 4 }}>{order.lastRejectReason}</span>
                </div>
              )}

              {order.repairNote && (
                <div style={{
                  marginTop: 12,
                  padding: '8px 12px',
                  background: '#e6f7ff',
                  borderRadius: 4,
                  border: '1px solid #91d5ff',
                  fontSize: 12
                }}>
                  <Space>
                    <Tag color="blue">
                      {getResultIcon(order.repairResult!)} {getResultLabel(order.repairResult!)}
                    </Tag>
                    <span>{order.repairNote}</span>
                  </Space>
                </div>
              )}
            </div>
          </div>
        </Card>
      </List.Item>
    );
  };

  const pendingCount = orders.filter(o => ['in_progress', 'rework'].includes(o.status)).length;
  const todayCount = orders.filter(o => o.expectedDate === new Date().toISOString().split('T')[0]).length;
  const pendingConfirmCount = orders.filter(o => o.status === 'pending_confirm').length;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <ToolOutlined style={{ color: '#52c41a', marginRight: 8 }} />
            我的维修工单
          </Title>
          <Space size={16} style={{ marginTop: 4 }}>
            <Text type="secondary">共 {orders.length} 单</Text>
            <Tag color="blue">待处理 {pendingCount}</Tag>
            <Tag color="green">今日 {todayCount}</Tag>
            <Tag color="cyan">待确认 {pendingConfirmCount}</Tag>
          </Space>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={fetchOrders}
          loading={loading}
        >
          刷新
        </Button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Spin size="large" tip="加载中..." />
        </div>
      ) : orders.length === 0 ? (
        <Empty
          description={
            <div>
              <p>暂无分配给您的工单</p>
              <p style={{ fontSize: 12, color: '#999' }}>请耐心等待前台分派新的维修任务</p>
            </div>
          }
          style={{ padding: 80 }}
        />
      ) : (
        <List
          grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 2 }}
          dataSource={orders}
          renderItem={renderOrderCard}
        />
      )}

      <Modal
        title={`工单详情 - ${detailModal.order?.orderNo || ''}`}
        open={detailModal.visible}
        onCancel={() => setDetailModal({ visible: false, order: null })}
        footer={[
          canProcess(detailModal.order!) && (
            <Button
              key="process"
              type="primary"
              icon={<ToolOutlined />}
              onClick={() => detailModal.order && setProcessModal({ visible: true, order: detailModal.order })}
            >
              处理工单
            </Button>
          ),
          <Button key="close" onClick={() => setDetailModal({ visible: false, order: null })}>
            关闭
          </Button>
        ].filter(Boolean)}
        width={700}
      >
        {detailModal.order && (
          <div>
            <Space style={{ marginBottom: 16 }}>
              <Tag color={getCategoryColor(detailModal.order.category)}>
                {getCategoryLabel(detailModal.order.category)}
              </Tag>
              <Tag color={getStatusColor(detailModal.order.status) as any}>
                {getStatusLabel(detailModal.order.status)}
              </Tag>
              {detailModal.order.rejectCount > 0 && (
                <Tag color="orange">返修 {detailModal.order.rejectCount} 次</Tag>
              )}
            </Space>

            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="工单编号" span={2}>
                {detailModal.order.orderNo}
              </Descriptions.Item>
              <Descriptions.Item label="住户">
                {detailModal.order.residentName}
                {detailModal.order.residentPhone && (
                  <a href={`tel:${detailModal.order.residentPhone}`} style={{ marginLeft: 8 }}>
                    <PhoneOutlined /> 拨打电话
                  </a>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="地址">
                <EnvironmentOutlined /> {detailModal.order.building} {detailModal.order.room}
              </Descriptions.Item>
              <Descriptions.Item label="期望上门日期">
                {detailModal.order.expectedDate}
              </Descriptions.Item>
              <Descriptions.Item label="期望时间段">
                {getSlotLabel(detailModal.order.expectedSlot)}
              </Descriptions.Item>
              <Descriptions.Item label="分派时间" span={2}>
                {detailModal.order.assignedAt}
              </Descriptions.Item>
              {detailModal.order.repairedAt && (
                <Descriptions.Item label="处理时间" span={2}>
                  {detailModal.order.repairedAt}
                </Descriptions.Item>
              )}
            </Descriptions>

            <Divider orientation="left">问题描述</Divider>
            <div style={{
              background: '#f5f5f5',
              padding: 12,
              borderRadius: 4,
              whiteSpace: 'pre-wrap'
            }}>
              {detailModal.order.description}
            </div>

            {detailModal.order.repairNote && (
              <>
                <Divider orientation="left">维修处理结果</Divider>
                <div style={{
                  background: '#f0f5ff',
                  padding: 12,
                  borderRadius: 4,
                  marginBottom: 8
                }}>
                  <Space>
                    <Tag color="blue">
                      {getResultIcon(detailModal.order.repairResult!)} {getResultLabel(detailModal.order.repairResult!)}
                    </Tag>
                    {detailModal.order.repairedAt && (
                      <Text type="secondary">{detailModal.order.repairedAt}</Text>
                    )}
                  </Space>
                  <div style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
                    {detailModal.order.repairNote}
                  </div>
                </div>
              </>
            )}

            {detailModal.order.lastRejectReason && (
              <>
                <Divider orientation="left">上次打回原因</Divider>
                <div style={{
                  background: '#fff2e8',
                  padding: 12,
                  borderRadius: 4,
                  whiteSpace: 'pre-wrap',
                  border: '1px solid #ffd591'
                }}>
                  <Alert
                    type="warning"
                    showIcon
                    message={`第 ${detailModal.order.rejectCount} 次打回`}
                    description={detailModal.order.lastRejectReason}
                    style={{ background: 'transparent', border: 'none', padding: 0 }}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title={`处理工单 - ${processModal.order?.orderNo || ''}`}
        open={processModal.visible}
        onCancel={() => {
          processForm.resetFields();
          setProcessModal({ visible: false, order: null });
        }}
        onOk={handleProcess}
        confirmLoading={actionLoading}
        okText="提交处理结果"
        width={600}
      >
        {processModal.order && (
          <div>
            <Alert
              type="info"
              showIcon
              message={
                <Space wrap>
                  <span>
                    <strong>{processModal.order.building} {processModal.order.room}</strong>
                  </span>
                  <span>·</span>
                  <span>{getCategoryLabel(processModal.order.category)}</span>
                  <span>·</span>
                  <span>{processModal.order.residentName}</span>
                  {processModal.order.residentPhone && (
                    <a href={`tel:${processModal.order.residentPhone}`}>
                      <PhoneOutlined /> {processModal.order.residentPhone}
                    </a>
                  )}
                </Space>
              }
              description={
                <div style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
                  {processModal.order.description}
                </div>
              }
              style={{ marginBottom: 20 }}
            />

            {processModal.order.rejectCount > 0 && (
              <Alert
                type="warning"
                showIcon
                message={`返修工单（第 ${processModal.order.rejectCount} 次）`}
                description={
                  <div style={{ marginTop: 4 }}>
                    <div><strong>上次打回原因：</strong>{processModal.order.lastRejectReason}</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: '#d46b08' }}>
                      ⚠️ 请仔细阅读打回原因，确保问题彻底解决
                    </div>
                  </div>
                }
                style={{ marginBottom: 20 }}
              />
            )}

            <Form form={processForm} layout="vertical">
              <Form.Item
                name="result"
                label="处理结果"
                rules={[{ required: true, message: '请选择处理结果' }]}
              >
                <Radio.Group>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {RESULT_OPTIONS.map(option => (
                      <Radio.Button
                        key={option.value}
                        value={option.value}
                        style={{
                          width: '100%',
                          height: 'auto',
                          padding: '12px 16px',
                          lineHeight: 1.5,
                          textAlign: 'left'
                        }}
                      >
                        <Space>
                          {getResultIcon(option.value)}
                          <span style={{ fontWeight: 500 }}>{option.label}</span>
                          {option.value === 'fixed' && (
                            <Tag color="green">→ 住户确认关单</Tag>
                          )}
                          {option.value === 'revisit' && (
                            <Tag color="orange">→ 二次上门</Tag>
                          )}
                          {option.value === 'parts_needed' && (
                            <Tag color="purple">→ 采购配件</Tag>
                          )}
                        </Space>
                      </Radio.Button>
                    ))}
                  </Space>
                </Radio.Group>
              </Form.Item>

              <Form.Item
                name="note"
                label="处理说明"
                rules={[
                  { required: true, message: '请填写处理说明' },
                  { min: 5, message: '说明至少5个字符' }
                ]}
                extra="请详细描述处理过程、更换的配件、注意事项等信息，方便住户了解情况"
              >
                <TextArea
                  rows={5}
                  placeholder="请详细描述您的处理过程和结果..."
                  showCount
                  maxLength={500}
                />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default TechnicianOrders;
