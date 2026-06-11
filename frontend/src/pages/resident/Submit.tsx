import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Form,
  Select,
  Input,
  DatePicker,
  Radio,
  Button,
  Card,
  Typography,
  Col,
  Row,
  Alert,
  message
} from 'antd';
import { FileAddOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import axios from '../../api/axios';
import { CATEGORY_OPTIONS, SLOT_OPTIONS, RepairCategory, TimeSlot } from '../../types';
import { generateIdempotencyKey } from '../../utils/helpers';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;

function ResidentSubmit() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<null | { orderNo: string }>(null);

  const disabledDate = (current: any) => {
    return current && current < dayjs().startOf('day');
  };

  const onFinish = async (values: {
    category: RepairCategory;
    description: string;
    expectedDate: dayjs.Dayjs;
    expectedSlot: TimeSlot;
  }) => {
    setLoading(true);
    try {
      const idempotencyKey = generateIdempotencyKey('create_order');
      const response: any = await axios.post('/resident/orders', {
        category: values.category,
        description: values.description,
        expectedDate: values.expectedDate.format('YYYY-MM-DD'),
        expectedSlot: values.expectedSlot,
        idempotencyKey
      });

      if (response.order) {
        setSubmitSuccess({ orderNo: response.order.orderNo });
        message.success(response.message || '报修单提交成功');
        form.resetFields();
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <FileAddOutlined style={{ color: '#1677ff', marginRight: 8 }} />
            提交报修单
          </Title>
          <Text type="secondary">填写以下信息提交您的报修需求，我们将尽快安排维修师傅处理</Text>
        </div>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/resident/orders')}>
          返回列表
        </Button>
      </div>

      {submitSuccess && (
        <Alert
          type="success"
          showIcon
          message="报修单提交成功"
          description={
            <div>
              <div>您的报修单编号：<strong>{submitSuccess.orderNo}</strong></div>
              <div>我们将尽快分派维修师傅上门处理，请保持电话畅通</div>
              <Button
                type="link"
                style={{ padding: 0 }}
                onClick={() => navigate('/resident/orders')}
              >
                查看我的报修单 →
              </Button>
            </div>
          }
          style={{ marginBottom: 24 }}
          closable
          onClose={() => setSubmitSuccess(null)}
        />
      )}

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          size="large"
          initialValues={{
            expectedSlot: 'morning'
          }}
        >
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item
                name="category"
                label="报修类别"
                rules={[{ required: true, message: '请选择报修类别' }]}
              >
                <Select placeholder="请选择报修类别">
                  {CATEGORY_OPTIONS.map(cat => (
                    <Option key={cat.value} value={cat.value}>
                      <span
                        style={{
                          display: 'inline-block',
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: cat.color,
                          marginRight: 8
                        }}
                      />
                      {cat.label}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                name="expectedDate"
                label="期望上门日期"
                rules={[{ required: true, message: '请选择期望上门日期' }]}
              >
                <DatePicker
                  style={{ width: '100%' }}
                  disabledDate={disabledDate}
                  placeholder="选择期望上门日期"
                  format="YYYY-MM-DD"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col xs={24}>
              <Form.Item
                name="expectedSlot"
                label="期望上门时间段"
                rules={[{ required: true, message: '请选择期望上门时间段' }]}
              >
                <Radio.Group style={{ width: '100%' }}>
                  <Row gutter={16}>
                    {SLOT_OPTIONS.map(slot => (
                      <Col xs={24} sm={8} key={slot.value}>
                        <Radio.Button
                          value={slot.value}
                          style={{
                            width: '100%',
                            textAlign: 'center',
                            height: 'auto',
                            padding: '12px 16px',
                            lineHeight: 1.5
                          }}
                        >
                          {slot.label}
                        </Radio.Button>
                      </Col>
                    ))}
                  </Row>
                </Radio.Group>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="问题描述"
            rules={[
              { required: true, message: '请描述您的问题' },
              { min: 5, message: '问题描述至少5个字符' },
              { max: 500, message: '问题描述不能超过500字符' }
            ]}
          >
            <TextArea
              rows={6}
              placeholder="请详细描述您遇到的问题，例如：漏水位置、故障现象、发生时间等，越详细越好..."
              showCount
              maxLength={500}
            />
          </Form.Item>

          <Alert
            type="info"
            showIcon
            message="温馨提示"
            description={
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>同一类别报修24小时内只能提交一次</li>
                <li>提交后物业前台会尽快分派维修师傅处理</li>
                <li>请保持手机畅通，师傅可能会提前联系确认</li>
                <li>维修完成后需要您确认满意后才能关单</li>
              </ul>
            }
            style={{ marginBottom: 24 }}
          />

          <Form.Item style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <Button
                size="large"
                onClick={() => form.resetFields()}
              >
                重置
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={loading}
                icon={<FileAddOutlined />}
              >
                {loading ? '提交中...' : '提交报修单'}
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}

export default ResidentSubmit;
