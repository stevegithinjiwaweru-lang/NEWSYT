import React, { useState, useEffect } from "react";
import {
  Card,
  Upload,
  Button,
  Table,
  message,
  Tag,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Spin,
} from "antd";
import { UploadOutlined, PlusOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import client from "../api/client";

const fetchOrders = async () => (await client.get("/orders")).data;
const fetchMerchants = async () => (await client.get("/merchants")).data;

const Orders: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [selectedMerchantId, setSelectedMerchantId] = useState<string | null>(null);

  // Orders query
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["orders"],
    queryFn: fetchOrders,
  });
  const orders = data?.orders || [];

  // Merchants query (for CSV upload merchantId)
  const { data: merchantsData, isLoading: merchantsLoading } = useQuery({
    queryKey: ["merchantsList"],
    queryFn: fetchMerchants,
    staleTime: 5 * 60 * 1000,
  });
  const merchants = merchantsData?.merchants || [];

  // default merchant selection: first merchant when loaded
  useEffect(() => {
    if (!selectedMerchantId && merchants.length > 0) {
      setSelectedMerchantId(merchants[0].id);
    }
  }, [merchants, selectedMerchantId]);

  // CSV UPLOAD -> BACKEND (now includes merchantId)
  const beforeUpload = async (file: File) => {
    // validation
    if (!selectedMerchantId) {
      message.error("Please select a merchant before uploading CSV (or create one on the Merchants page).");
      return false;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("merchantId", selectedMerchantId);

    try {
      // axios will set multipart/form-data automatically when FormData is passed
      await client.post("/orders/bulk-csv", formData, {
        headers: {
          // don't override Content-Type; let browser set boundary
        },
      });
      message.success("CSV uploaded successfully — queued for processing");
      refetch();
    } catch (err: any) {
      // surface backend validation errors (merchantId/file/multer)
      const errMsg = err?.response?.data?.error || err?.message || "CSV upload failed";
      message.error(errMsg);
    }

    // return false to prevent antd Upload from auto-posting since we already handled it
    return false;
  };

  // CREATE ORDER (unchanged)
  const handleCreateOrder = async (values: any) => {
    try {
      setLoading(true);

      await client.post("/orders", {
        merchantId: values.merchantId,
        customerName: values.customerName,
        phone: values.phone,
        address: values.address,
        amount: values.amount,
        paymentType: values.paymentType,
      });

      message.success("Order created successfully");

      form.resetFields();
      setOpen(false);
      refetch();
    } catch (err: any) {
      message.error(err?.response?.data?.error || "Failed to create order");
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: "Order ID", dataIndex: "id", key: "id" },
    { title: "Customer", dataIndex: "customerName", key: "customerName" },
    { title: "Phone", dataIndex: "phone", key: "phone" },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (s: string) => (
        <Tag color={s === "NEW" ? "blue" : s === "ASSIGNED" ? "orange" : "green"}>
          {s}
        </Tag>
      ),
    },
    { title: "Amount", dataIndex: "amount", key: "amount", render: (amount: number) => `KSh ${amount}` },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <h2>Orders</h2>

        <Space align="center">
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
            Create Order
          </Button>

          {/* Merchant selector for CSV upload */}
          <Select
            value={selectedMerchantId}
            onChange={(val) => setSelectedMerchantId(val)}
            loading={merchantsLoading}
            style={{ width: 220 }}
            placeholder="Select merchant for CSV"
          >
            {merchants.map((m: any) => (
              <Select.Option key={m.id} value={m.id}>
                {m.name} ({m.connector})
              </Select.Option>
            ))}
          </Select>

          <Upload beforeUpload={beforeUpload} showUploadList={false}>
            <Button icon={<UploadOutlined />}>Upload CSV</Button>
          </Upload>
        </Space>
      </div>

      <Card>
        {isLoading ? (
          <Spin />
        ) : (
          <Table dataSource={orders} columns={columns as any} rowKey="id" pagination={{ pageSize: 10 }} />
        )}
      </Card>

      {/* Create order modal */}
      <Modal title="Create New Order" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} confirmLoading={loading} okText="Create Order">
        <Form form={form} layout="vertical" onFinish={handleCreateOrder}>
          <Form.Item name="merchantId" label="Merchant ID" rules={[{ required: true }]}>
            <Input placeholder="Enter merchantId" />
          </Form.Item>

          <Form.Item name="customerName" label="Customer Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          <Form.Item name="phone" label="Phone" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          <Form.Item name="address" label="Address" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>

          <Form.Item name="amount" label="Amount" rules={[{ required: true }]}>
            <InputNumber style={{ width: "100%" }} min={0} />
          </Form.Item>

          <Form.Item name="paymentType" label="Payment Type" initialValue="COD">
            <Select>
              <Select.Option value="COD">Cash on Delivery</Select.Option>
              <Select.Option value="PREPAID">Prepaid</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Orders;
