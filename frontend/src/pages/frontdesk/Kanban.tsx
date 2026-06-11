import React, { useState, useEffect } from 'react';
import {
  Row,
  Col,
  Card,
  Tag,
  Button,
  Typography,
  Modal,
  Form,
  Select,
  Space,
  Descriptions,
  Divider,
  message,
  Spin,
  Tooltip,
  Badge,
  Alert
} from 'antd';
import {
  AppstoreOutlined,
  UserOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
  ReloadOutlined,
  TeamOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import axios from '../../api/axios';
import { RepairOrder, Technician, RepairStatus } from '../../types';
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
const { Option } = Select;

interface KanbanData {
  kanban: {
    pending_assign: RepairOrder[];
    in_progress: RepairOrder[];
    pending_confirm: RepairOrder[];
    closed: RepairOrder[];
  };
  counts: Record<string, number>;
}

const KANBAN_COLUMNS: { key: keyof KanbanData['kanban']; title: string; icon: string; color: string }[] = [
  { key: 'pending_assign', title: '待分派', icon: '📋', color: '#faad14' },
  { key: 'in_progress', title: '进行中', icon: '🔧', color: '#1677ff' },
  { key: 'pending_confirm', title: '待确认', icon: '✅', color: '#13c2c2' },
  { key: 'closed', title: '已关闭', icon: '✔️', color: '#52c41a' }
];

function FrontdeskKanban() {
  const [data, setData] = useState<KanbanData | null>(null);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailModal, setDetailModal] = useState<{ visible: boolean; order: RepairOrder | null }>({
    visible: false,
    order: null
  });
  const [assignModal, setAssignModal] = useState<{ visible: boolean; order: RepairOrder | null }>({
    visible: false,
    order: null
  });
  const [disputeModal, setDisputeModal] = useState<{ visible: boolean; order: RepairOrder | null }>({
    visible: false,
    order: null
  });
  const [assignForm] = Form.useForm();
  const [disputeForm] = Form.useForm();
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [kanbanRes, techRes] = await Promise.all([
        axios.get('/frontdesk/orders/kanban') as any,
        axios.get('/frontdesk/technicians') as any
      ]);
      setData(kanbanRes);
      setTechnicians(techRes.technicians || []);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAssign = async () => {
    try {
      const values = await assignForm.validateFields();
      if (!assignModal.order) return;

      setActionLoading(true);
      const idempotencyKey = generateIdempotencyKey(`assign_${assignModal.order.id}_${values.technicianId}`);
      
      await axios.post(`/frontdesk/orders/${assignModal.order.id}/assign`, {
        technicianId: values.technicianId,
        idempotencyKey
      });
      
      message.success('分派成功');
      assignForm.resetFields();
      setAssignModal({ visible: false, order: null });
      setDetailModal({ visible: false, order: null });
      fetchData();
    } catch {
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolveDispute = async () => {
    try {
      const values = await disputeForm.validateFields();
      if (!disputeModal.order) return;

      setActionLoading(true);
      const idempotencyKey = generateIdempotencyKey(`dispute_${disputeModal.order.id}`);
      
      await axios.post(`/frontdesk/orders/${disputeModal.order.id}/resolve-dispute`, {
        action: values.action,
        reason: values.reason,
        newTechnicianId: values.newTechnicianId,
        idempotencyKey
      });
      
      message.success('争议单处理成功');
      disputeForm.resetFields();
      setDisputeModal({ visible: false, order: null });
      setDetailModal({ visible: false, order: null });
      fetchData();
    } catch {
    } finally {
      setActionLoading(false);
    }
  };

  const renderKanbanCard = (order: RepairOrder) => {
    let extraClass = '';
    if (order.isOverdue) extraClass += ' overdue';
    if (order.status === 'rework') extraClass += ' rework';
    if (order.status === 'dispute') extraClass += ' dispute';

    return (
      <div
        key={order.id}
        className={`kanban-card${extraClass}`}
        onClick={() => setDetailModal({ visible: true, order })}
        style={{ cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <Space size={4} wrap>
            <Tag
              color={getCategoryColor(order.category)}
              style={{ margin: 0, fontSize: 11 }}
            >
              {getCategoryLabel(order.category)}
            </Tag>
            {order.status === 'rework' && <Tag color="orange" style={{ margin: 0, fontSize: 11 }}>返修</Tag>}
            {order.status === 'dispute' && <Tag color="purple" style={{ margin: 0, fontSize: 11 }}>争议</Tag>}
            {order.rejectCount > 0 && order.status !== 'rework' && order.status !== 'dispute' && (
              <Tag color="orange" style={{ margin: 0, fontSize: 11 }}>返修{order.rejectCount}</Tag>
            )}
          </Space>
          {order.isOverdue && (
            <Tooltip title="已超过48小时未关闭">
              <Badge status="error" />
            </Tooltip>
          )}
        </div>
        
        <div style={{
          fontSize: 13,
          fontWeight: 500,
          marginBottom: 6,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}>
          {order.description}
        </div>
        
        <div style={{ fontSize: 11, color: '#8c8c8c' }}>
          <div style={{ marginBottom: 2 }}>
            <EnvironmentOutlined style={{ marginRight: 4 }} />
            {order.building} {order.room}
          </div>
          <div style={{ marginBottom: 2 }}>
            <UserOutlined style={{ marginRight: 4 }} />
            {order.residentName}
          </div>
          <div>
            {order.expectedDate} {getSlotLabel(order.expectedSlot).split(' ')[0]}
          </div>
        </div>
        
        {order.technicianName && (
          <div style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: '1px dashed #f0f0f0',
            fontSize: 11,
            color: '#1677ff'
          }}>
            <TeamOutlined style={{ marginRight: 4 }} />
            {order.technicianName}
          </div>
        )}
        
        {order.status === 'pending_assign' && (
          <Button
            type="primary"
            size="small"
            block
            style={{ marginTop: 8 }}
            onClick={(e) => {
              e.stopPropagation();
              setAssignModal({ visible: true, order });
            }}
          >
            立即分派
          </Button>
        )}
        
        {order.status === 'dispute' && (
          <Button
            type="primary"
            size="small"
            block
            danger
            style={{ marginTop: 8 }}
            onClick={(e) => {
              e.stopPropagation();
              setDisputeModal({ visible: true, order });
            }}
          >
            处理争议
          </Button>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="page-header" style={{ padding: 16, background: '#fff', borderRadius: 8, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>
              <AppstoreOutlined style={{ color: '#722ed1', marginRight: 8 }} />
              工单看板
            </Title>
            <div style={{ marginTop: 4 }}>
              <Space size={16}>
                {data && (
                  <>
                    <Tag color="#faad14">待分派 {data.counts.pending_assign}</Tag>
                    <Tag color="#1677ff">
                      进行中 {data.counts.in_progress}
                      {data.counts.rework > 0 && (
                        <span style={{ color: '#faad14', marginLeft: 4 }}>
                          (返修 {data.counts.rework})
                        </span>
                      )}
                    </Tag>
                    <Tag color="#13c2c2">
                      待确认 {data.counts.pending_confirm}
                      {data.counts.dispute > 0 && (
                        <span style={{ color: '#722ed1', marginLeft: 4 }}>
                          (争议 {data.counts.dispute})
                        </span>
                      )}
                    </Tag>
                    <Tag color="#52c41a">已关闭 {data.counts.closed}</Tag>
                  </>
                )}
              </Space>
            </div>
          </div>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchData}
            loading={loading}
          >
            刷新
          </Button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, background: '#fff', borderRadius: 8 }}>
          <Spin size="large" tip="加载中..." />
        </div>
      ) : data ? (
        <Row gutter={[16, 16]}>
          {KANBAN_COLUMNS.map(col => (
            <Col xs={24} sm={12} lg={6} key={col.key}>
              <div className="kanban-column">
                <div className="kanban-column-title">
                  <span>
                    <span style={{ marginRight: 6 }}>{col.icon}</span>
                    {col.title}
                  </span>
                  <Tag color={col.color} style={{ margin: 0 }}>
                    {data.kanban[col.key]?.length || 0}
                  </Tag>
                </div>
                <div>
                  {(data.kanban[col.key] || []).map(renderKanbanCard)}
                  {(data.kanban[col.key] || []).length === 0 && (
                    <div style={{
                      textAlign: 'center',
                      padding: '40px 20px',
                      color: '#bfbfbf',
                      fontSize: 12
                    }}>
                      暂无工单
                    </div>
                  )}
                </div>
              </div>
            </Col>
          ))}
        </Row>
      ) : null}

      <Modal
        title={`工单详情 - ${detailModal.order?.orderNo || ''}`}
        open={detailModal.visible}
        onCancel={() => setDetailModal({ visible: false, order: null })}
        footer={[
          detailModal.order?.status === 'pending_assign' && (
            <Button
              key="assign"
              type="primary"
              onClick={() => detailModal.order && setAssignModal({ visible: true, order: detailModal.order })}
            >
              分派工单
            </Button>
          ),
          detailModal.order?.status === 'dispute' && (
            <Button
              key="dispute"
              type="primary"
              danger
              onClick={() => detailModal.order && setDisputeModal({ visible: true, order: detailModal.order })}
            >
              处理争议
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
              {detailModal.order.isOverdue && (
                <Tag color="red">超48小时</Tag>
              )}
            </Space>

            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="工单编号" span={2}>
                {detailModal.order.orderNo}
              </Descriptions.Item>
              <Descriptions.Item label="住户">
                {detailModal.order.residentName} ({detailModal.order.residentPhone})
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
              <Descriptions.Item label="提交时间" span={2}>
                {detailModal.order.createdAt}
              </Descriptions.Item>
              {detailModal.order.technicianName && (
                <>
                  <Descriptions.Item label="维修师傅">
                    {detailModal.order.technicianName}
                    {detailModal.order.technicianPhone && ` (${detailModal.order.technicianPhone})`}
                  </Descriptions.Item>
                  <Descriptions.Item label="分派时间">
                    {detailModal.order.assignedAt}
                  </Descriptions.Item>
                </>
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
                      处理结果：{getResultLabel(detailModal.order.repairResult!)}
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
              </>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title={`分派工单 - ${assignModal.order?.orderNo || ''}`}
        open={assignModal.visible}
        onCancel={() => {
          assignForm.resetFields();
          setAssignModal({ visible: false, order: null });
        }}
        onOk={handleAssign}
        confirmLoading={actionLoading}
        okText="确认分派"
      >
        {assignModal.order && (
          <div>
            <Alert
              type="info"
              showIcon
              message={
                <span>
                  <strong>{assignModal.order.building} {assignModal.order.room}</strong>
                  {' · '}
                  {getCategoryLabel(assignModal.order.category)}
                  {' · '}
                  {assignModal.order.expectedDate} {getSlotLabel(assignModal.order.expectedSlot)}
                </span>
              }
              style={{ marginBottom: 16 }}
            />
            <Form form={assignForm} layout="vertical">
              <Form.Item
                name="technicianId"
                label="选择维修师傅"
                rules={[{ required: true, message: '请选择维修师傅' }]}
                extra={
                  <span style={{ fontSize: 12, color: '#faad14' }}>
                    <ExclamationCircleOutlined /> 同一时段已有3单的师傅无法再分派
                  </span>
                }
              >
                <Select
                  placeholder="请选择维修师傅"
                  size="large"
                  showSearch
                  optionFilterProp="children"
                >
                  {technicians.map(tech => (
                    <Option key={tech.id} value={tech.id}>
                      <TeamOutlined style={{ marginRight: 8 }} />
                      {tech.realName}
                      <span style={{ color: '#999', marginLeft: 8 }}>
                        {tech.phone}
                      </span>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      <Modal
        title={`处理争议单 - ${disputeModal.order?.orderNo || ''}`}
        open={disputeModal.visible}
        onCancel={() => {
          disputeForm.resetFields();
          setDisputeModal({ visible: false, order: null });
        }}
        onOk={handleResolveDispute}
        confirmLoading={actionLoading}
        okText="确认处理"
      >
        {disputeModal.order && (
          <div>
            <Alert
              type="warning"
              showIcon
              message="该工单已累计打回3次，请人工介入处理"
              description={
                <div style={{ marginTop: 8 }}>
                  <div><strong>争议原因：</strong>{disputeModal.order.disputeReason}</div>
                  <div style={{ marginTop: 4 }}>
                    <strong>住户信息：</strong>
                    {disputeModal.order.residentName} - {disputeModal.order.building} {disputeModal.order.room}
                  </div>
                </div>
              }
              style={{ marginBottom: 16 }}
            />
            <Form form={disputeForm} layout="vertical">
              <Form.Item
                name="action"
                label="处理方式"
                rules={[{ required: true, message: '请选择处理方式' }]}
              >
                <Radio.Group>
                  <Radio value="close">直接关闭工单</Radio>
                  <Radio value="reassign">重新分派给其他师傅</Radio>
                </Radio.Group>
              </Form.Item>
              <Form.Item
                noStyle
                shouldUpdate={(prev, curr) => prev.action !== curr.action}
              >
                {({ getFieldValue }) =>
                  getFieldValue('action') === 'reassign' ? (
                    <Form.Item
                      name="newTechnicianId"
                      label="新维修师傅"
                      rules={[{ required: true, message: '请选择新的维修师傅' }]}
                    >
                      <Select placeholder="请选择新的维修师傅" showSearch optionFilterProp="children">
                        {technicians.map(tech => (
                          <Option key={tech.id} value={tech.id}>
                            {tech.realName} ({tech.phone})
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  ) : null
                }
              </Form.Item>
              <Form.Item
                name="reason"
                label="处理说明"
                rules={[
                  { required: true, message: '请填写处理说明' },
                  { min: 5, message: '说明至少5个字符' }
                ]}
              >
                <TextArea rows={4} placeholder="请填写处理说明，该记录将保存到工单历史中..." />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default FrontdeskKanban;
