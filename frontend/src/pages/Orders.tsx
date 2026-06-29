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
  Empty,
  Alert,
} from "antd";
import { UploadOutlined, PlusOutlined } from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import client from "../api/client";

const fetchOrders = async () => (await client.get("/orders")).data;
const fetchMerchants = async () => (await client.get("/merchants")).data;

const Orders: React.FC = () => {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [form] = Form.useForm();
  const [selectedMerchantForCSV, setSelectedMerchantForCSV] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Orders query
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["orders"],
    queryFn: fetchOrders,
    refetchInterval: 3000,
  });
  const orders = data?.orders || [];

  // Merchants query (for CSV upload and manual order creation)
  const { data: merchantsData, isLoading: merchantsLoading } = useQuery({
    queryKey: ["merchantsList"],
    queryFn: fetchMerchants,
    staleTime: 5 * 60 * 1000,
  });
  const merchants = merchantsData?.merchants || [];

  // Default merchant selection: first merchant when loaded
  useEffect(() => {
    if (!selectedMerchantForCSV && merchants.length > 0) {
      setSelectedMerchantForCSV(merchants[0].id);
    }
  }, [merchants, selectedMerchantForCSV]);

  // CSV UPLOAD HANDLER
  const handleCSVUpload = async (file: File) => {
    // Validation
    if (!selectedMerchantForCSV) {
      message.error(
        "Please select a merchant before uploading CSV. Create one on the Merchants page if needed."
      );
      return false;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      message.error("Only CSV files are allowed");
      return false;
    }

    if (file.size > 10 * 1024 * 1024) {
      message.error("File size must be less than 10MB");
      return false;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("merchantId", selectedMerchantForCSV);

    try {
      setCsvLoading(true);
      const response = await client.post("/orders/bulk-csv", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      message.success(`CSV uploaded successfully! Processing ${file.name}`);
      setSelectedMerchantForCSV(merchants[0]?.id || null);
      
      // Refetch orders after a delay to see new data
      setTimeout(() => refetch(), 1500);
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "CSV upload failed. Please try again.";
      message.error(errMsg);
      console.error("CSV upload error:", err);
    } finally {
      setCsvLoading(false);
    }

    return false;
  };

  // CREATE MANUAL ORDER
  const handleCreateOrder = async (values: any) => {
    try {
      setCreateLoading(true);

      const selectedMerchant = merchants.find((m: any) => m.id === values.merchantId);

      if (!selectedMerchant) {
        message.error("Selected merchant not found");
        return;
      }

      const response = await client.post("/orders", {
        merchantId: values.merchantId,
        customerName: values.customerName,
        phone: values.phone,
        address: values.address,
        amount: Number(values.amount || 0),
        paymentType: values.paymentType || "COD",
      });

      message.success(`Order created for ${selectedMerchant.name}`);
      form.resetFields();
      setCreateModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.error || "Failed to create order. Please check merchant exists.";
      message.error(errMsg);
      console.error("Create order error:", err);
    } finally {
      setCreateLoading(false);
    }
  };

  const columns = [
    { title: "Order ID", dataIndex: "id", key: "id", width: 120 },
    { title: "Merchant", dataIndex: ["merchant", "name"], key: "merchant" },
    { title: "Customer", dataIndex: "customerName", key: "customerName" },
    { title: "Phone", dataIndex: "phone", key: "phone" },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (s: string) => {
        const colorMap: Record<string, string> = {
          NEW: "blue",
          ASSIGNED: "orange",
          PICKED_UP: "cyan",
          IN_TRANSIT: "purple",
          DELIVERED: "green",
          FAILED: "red",
          RETURNED: "magenta",
        };
        return <Tag color={colorMap[s] || "default"}>{s}</Tag>;
      },
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      render: (amount: number) => `KSh ${amount.toLocaleString()}`,
    },
  ];

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>Orders ({orders.length})</h2>

        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
          >
            Create Order Manually
          </Button>

          {merchants.length === 0 ? (
            <Button disabled>
              <UploadOutlined /> Upload CSV (Create Merchant First)
            </Button>
          ) : (
            <>
              <Select
                value={selectedMerchantForCSV}
                onChange={setSelectedMerchantForCSV}
                loading={merchantsLoading}
                style={{ width: 240 }}
                placeholder="Select merchant for CSV"
              >
                {merchants.map((m: any) => (
                  <Select.Option key={m.id} value={m.id}>
                    {m.name} ({m.connector})
                  </Select.Option>
                ))}
              </Select>

              <Upload
                beforeUpload={handleCSVUpload}
                showUploadList={false}
                accept=".csv"
              >
                <Button icon={<UploadOutlined />} loading={csvLoading}>
                  Upload CSV
                </Button>
              </Upload>
            </>
          )}
        </Space>
      </div>

      {/* INFO MESSAGE */}
      <Alert
        message="CSV orders from Naivas & Carrefour cannot be manually assigned - they sync from their own systems"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      {/* ORDERS TABLE */}
      <Card>
        {orders.length === 0 ? (
          <Empty
            description="No orders yet"
            style={{ marginTop: 50, marginBottom: 50 }}
          >
            <Button type="primary" onClick={() => setCreateModalOpen(true)}>
              Create First Order
            </Button>
          </Empty>
        ) : (
          <Table
            dataSource={orders}
            columns={columns as any}
            rowKey="id"
            pagination={{ pageSize: 15, showSizeChanger: true }}
            scroll={{ x: 1000 }}
          />
        )}
      </Card>

      {/* CREATE ORDER MODAL */}
      <Modal
        title="Create New Order"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={createLoading}
        okText="Create Order"
        width={500}
      >
        {merchants.length === 0 ? (
          <Alert
            message="No merchants found"
            description="Please create a merchant on the Merchants page first"
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        ) : (
          <Form
            form={form}
            layout="vertical"
            onFinish={handleCreateOrder}
          >
            <Form.Item
              name="merchantId"
              label="Merchant"
              rules={[
                { required: true, message: "Please select a merchant" },
              ]}
            >
              <Select placeholder="Select merchant">
                {merchants.map((m: any) => (
                  <Select.Option key={m.id} value={m.id}>
                    {m.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="customerName"
              label="Customer Name"
              rules={[
                { required: true, message: "Customer name is required" },
              ]}
            >
              <Input placeholder="e.g., John Kamau" />
            </Form.Item>

            <Form.Item
              name="phone"
              label="Phone Number"
              rules={[
                { required: true, message: "Phone is required" },
                {
                  pattern: /^[0-9+\-\s()]*$/,
                  message: "Invalid phone format",
                },
              ]}
            >
              <Input placeholder="e.g., 0712345678" />
            </Form.Item>

            <Form.Item
              name="address"
              label="Delivery Address"
              rules={[
                { required: true, message: "Address is required" },
              ]}
            >
              <Input.TextArea
                rows={3}
                placeholder="e.g., Garden Estate, Thika Rd"
              />
            </Form.Item>

            <Form.Item
              name="amount"
              label="Amount (KSh)"
              rules={[
                { required: true, message: "Amount is required" },
              ]}
            >
              <InputNumber
                style={{ width: "100%" }}
                min={0}
                placeholder="e.g., 1250"
              />
            </Form.Item>

            <Form.Item
              name="paymentType"
              label="Payment Type"
              initialValue="COD"
            >
              <Select>
                <Select.Option value="COD">
                  Cash on Delivery (COD)
                </Select.Option>
                <Select.Option value="PREPAID">Prepaid</Select.Option>
              </Select>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default Orders;
