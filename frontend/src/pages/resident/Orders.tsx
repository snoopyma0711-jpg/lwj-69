import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Tooltip,
  Descriptions,
  Divider,
  Spin,
  Rate,
  Alert
} from 'antd';
import {
  UnorderedListOutlined,
  PlusOutlined,
  CheckOutlined,
  CloseOutlined,
  ClockCircleOutlined,
  UserOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
  EyeOutlined,
  StarOutlined
} from '@ant-design/icons';
import axios from '../../api/axios';
import { RepairOrder } from '../../types';
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

function ResidentOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<RepairOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailModal, setDetailModal] = useState<{ visible: boolean; order: RepairOrder | null }>({
    visible: false,
    order: null
  });
  const [rejectModal, setRejectModal] = useState<{ visible: boolean; order: RepairOrder | null }>({
    visible: false,
    order: null
  });
  const [confirmModal, setConfirmModal] = useState<{ visible: boolean; order: RepairOrder | null }>({
    visible: false,
    order: null
  });
  const [confirmRating, setConfirmRating] = useState(0);
  const [confirmComment, setConfirmComment] = useState('');
  const [rejectForm] = Form.useForm();
  const [actionLoading, setActionLoading] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response: any = await axios.get('/resident/orders');
      setOrders(response.orders || []);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleConfirm = async () => {
    if (!confirmModal.order) return;
    if (confirmRating === 0) {
      message.warning('请为本次维修打分后再关单');
      return;
    }

    setActionLoading(true);
    try {
      const idempotencyKey = generateIdempotencyKey(`confirm_${confirmModal.order.id}`);
      await axios.post(`/resident/orders/${confirmModal.order.id}/confirm`, {
        rating: confirmRating,
        ratingComment: confirmComment || undefined,
        idempotencyKey
      });
      message.success('确认成功，工单已关闭');
      setConfirmModal({ visible: false, order: null });
      setConfirmRating(0);
      setConfirmComment('');
      fetchOrders();
      setDetailModal({ visible: false, order: null });
    } catch {
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSubmit = async () => {
    try {
      const values = await rejectForm.validateFields();
      if (!rejectModal.order) return;

      setActionLoading(true);
      const idempotencyKey = generateIdempotencyKey(`reject_${rejectModal.order.id}`);
      await axios.post(`/resident/orders/${rejectModal.order.id}/reject`, {
        reason: values.reason,
        idempotencyKey
      });
      message.success('已打回维修师傅');
      rejectForm.resetFields();
      setRejectModal({ visible: false, order: null });
      setDetailModal({ visible: false, order: null });
      fetchOrders();
    } catch {
    } finally {
      setActionLoading(false);
    }
  };

  const showConfirmModal = (order: RepairOrder) => {
    setConfirmRating(0);
    setConfirmComment('');
    setConfirmModal({ visible: true, order });
  };

  const renderOrderCard = (order: RepairOrder) => {
    const isPendingConfirm = order.status === 'pending_confirm';

    return (
      <List.Item key={order.id}>
        <Card
          style={{ width: '100%' }}
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
            isPendingConfirm ? (
              <Space key="actions">
                <Button
                  type="primary"
                  size="small"
                  icon={<CheckOutlined />}
                  style={{ background: '#52c41a', borderColor: '#52c41a' }}
                  onClick={() => showConfirmModal(order)}
                >
                  满意关单
                </Button>
                <Button
                  danger
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={() => setRejectModal({ visible: true, order })}
                >
                  不满意打回
                </Button>
              </Space>
            ) : null
          ].filter(Boolean)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: 8 }}>
                <Space size={8} wrap>
                  <Tag color={getCategoryColor(order.category)}>
                    {getCategoryLabel(order.category)}
                  </Tag>
                  <Tag color={getStatusColor(order.status) as any}>
                    {getStatusLabel(order.status)}
                  </Tag>
                  {order.rejectCount > 0 && (
                    <Tag color="orange">返修 {order.rejectCount} 次</Tag>
                  )}
                  <Text strong>#{order.orderNo}</Text>
                </Space>
              </div>
              <Text
                type="secondary"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  marginBottom: 8
                }}
              >
                {order.description}
              </Text>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 12, color: '#8c8c8c' }}>
                <span>
                  <ClockCircleOutlined style={{ marginRight: 4 }} />
                  {order.expectedDate} {getSlotLabel(order.expectedSlot)}
                </span>
                {order.technicianName && (
                  <span>
                    <UserOutlined style={{ marginRight: 4 }} />
                    {order.technicianName}
                    {order.technicianPhone && ` (${order.technicianPhone})`}
                  </span>
                )}
                {order.repairedAt && (
                  <span>维修时间：{order.repairedAt}</span>
                )}
                {order.rating !== undefined && order.rating !== null && (
                  <span>
                    <StarOutlined style={{ marginRight: 4, color: '#faad14' }} />
                    评分：<Rate disabled value={order.rating} style={{ fontSize: 12 }} />
                  </span>
                )}
                <span>提交：{order.createdAt}</span>
              </div>
            </div>
          </div>
        </Card>
      </List.Item>
    );
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <UnorderedListOutlined style={{ color: '#1677ff', marginRight: 8 }} />
            我的报修单
          </Title>
          <Text type="secondary">共 {orders.length} 条报修记录</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/resident/submit')}
        >
          提交报修
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
              <p>暂无报修记录</p>
              <Button type="primary" onClick={() => navigate('/resident/submit')}>
                立即报修
              </Button>
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
        footer={
          detailModal.order?.status === 'pending_confirm' ? [
            <Button
              key="reject"
              danger
              icon={<CloseOutlined />}
              onClick={() => {
                if (detailModal.order) {
                  setRejectModal({ visible: true, order: detailModal.order });
                }
              }}
            >
              不满意打回
            </Button>,
            <Button
              key="confirm"
              type="primary"
              icon={<CheckOutlined />}
              style={{ background: '#52c41a', borderColor: '#52c41a' }}
              onClick={() => detailModal.order && showConfirmModal(detailModal.order)}
            >
              满意关单
            </Button>
          ] : [
            <Button key="close" onClick={() => setDetailModal({ visible: false, order: null })}>
              关闭
            </Button>
          ]
        }
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
              <Descriptions.Item label="期望上门日期">
                {detailModal.order.expectedDate}
              </Descriptions.Item>
              <Descriptions.Item label="期望时间段">
                {getSlotLabel(detailModal.order.expectedSlot)}
              </Descriptions.Item>
              <Descriptions.Item label="提交时间" span={2}>
                {detailModal.order.createdAt}
              </Descriptions.Item>
              {detailModal.order.technicianName && (
                <Descriptions.Item label="维修师傅" span={2}>
                  {detailModal.order.technicianName}
                  {detailModal.order.technicianPhone && ` (${detailModal.order.technicianPhone})`}
                </Descriptions.Item>
              )}
              {detailModal.order.assignedAt && (
                <Descriptions.Item label="分派时间" span={2}>
                  {detailModal.order.assignedAt}
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
                    <Tag color="blue">处理结果：{getResultLabel(detailModal.order.repairResult!)}</Tag>
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
                  whiteSpace: 'pre-wrap'
                }}>
                  {detailModal.order.lastRejectReason}
                </div>
              </>
            )}

            {detailModal.order.disputeReason && (
              <>
                <Divider orientation="left">争议说明</Divider>
                <div style={{
                  background: '#f9f0ff',
                  padding: 12,
                  borderRadius: 4,
                  whiteSpace: 'pre-wrap'
                }}>
                  {detailModal.order.disputeReason}
                </div>
                <Alert
                  type="warning"
                  showIcon
                  message="该工单已升级为争议单，等待物业前台人工介入处理"
                  style={{ marginTop: 12 }}
                />
              </>
            )}

            {detailModal.order.rating !== undefined && detailModal.order.rating !== null && (
              <>
                <Divider orientation="left">满意度评价</Divider>
                <div style={{
                  background: '#fffbe6',
                  padding: 12,
                  borderRadius: 4
                }}>
                  <Space>
                    <StarOutlined style={{ color: '#faad14' }} />
                    <Rate disabled value={detailModal.order.rating} />
                    <Text strong>{detailModal.order.rating} 星</Text>
                  </Space>
                  {detailModal.order.ratingComment && (
                    <div style={{ marginTop: 8, color: '#595959' }}>
                      {detailModal.order.ratingComment}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title="打回工单 - 填写不满意原因"
        open={rejectModal.visible}
        onCancel={() => {
          rejectForm.resetFields();
          setRejectModal({ visible: false, order: null });
        }}
        onOk={handleRejectSubmit}
        confirmLoading={actionLoading}
        okText="确认打回"
        okButtonProps={{ danger: true }}
      >
        <Alert
          type="warning"
          showIcon
          message={
            rejectModal.order?.rejectCount && rejectModal.order.rejectCount >= 2
              ? '⚠️ 这是第3次打回，工单将升级为争议单，由物业前台人工介入处理'
              : `当前为第 ${(rejectModal.order?.rejectCount || 0) + 1} 次打回，累计3次将升级为争议单`
          }
          style={{ marginBottom: 16 }}
        />
        <Form form={rejectForm} layout="vertical">
          <Form.Item
            name="reason"
            label="不满意原因"
            rules={[
              { required: true, message: '请填写打回原因' },
              { min: 5, message: '原因至少5个字符' }
            ]}
          >
            <TextArea
              rows={5}
              placeholder="请详细描述您不满意的原因，例如：问题未解决、师傅服务态度、需要重新处理等..."
              showCount
              maxLength={200}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="满意度评价 - 确认关单"
        open={confirmModal.visible}
        onCancel={() => {
          setConfirmModal({ visible: false, order: null });
          setConfirmRating(0);
          setConfirmComment('');
        }}
        onOk={handleConfirm}
        confirmLoading={actionLoading}
        okText="确认关单"
        okButtonProps={{
          type: 'primary',
          style: { background: confirmRating > 0 ? '#52c41a' : undefined },
          disabled: confirmRating === 0
        }}
        cancelText="再想想"
      >
        <div style={{ marginBottom: 16 }}>
          <p style={{ marginBottom: 8, fontWeight: 500 }}>
            请为本次维修服务打分：
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Rate
              value={confirmRating}
              onChange={(value) => setConfirmRating(value)}
              style={{ fontSize: 32 }}
            />
            {confirmRating > 0 && (
              <Text strong style={{ fontSize: 16, color: '#faad14' }}>
                {confirmRating} 星
              </Text>
            )}
          </div>
          {confirmRating === 0 && (
            <Text type="danger" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
              请先打分才能关单
            </Text>
          )}
        </div>
        <div style={{ marginBottom: 16 }}>
          <p style={{ marginBottom: 8 }}>评价文字（选填，不超过100字）：</p>
          <TextArea
            rows={3}
            placeholder="请简要描述您对本次维修服务的评价..."
            showCount
            maxLength={100}
            value={confirmComment}
            onChange={(e) => setConfirmComment(e.target.value)}
          />
        </div>
        <p style={{ fontSize: 12, color: '#999', margin: 0 }}>
          确认后工单将关闭，如有新问题请重新提交报修单。
        </p>
      </Modal>
    </div>
  );
}

export default ResidentOrders;
