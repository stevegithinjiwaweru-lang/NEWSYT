import React, { useState } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
  Spin,
  Space,
  Tag,
  Upload,
  Card,
} from "antd";
import {
  PlusOutlined,
  UploadOutlined,
  EditOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import client from "../../api/client";

interface Merchant {
  id: string;
  name: string;
}

interface Order {
  id: string;
  merchant?: Merchant;
  merchantId?: string;
  customerName: string;
  phone: string;
  address: string;
  amount: number;
  paymentType?: string;
  status: string;
  rider?: { name: string };
  lat?: number;
  lng?: number;
}

const normalizeArray = (response: any): any[] => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.orders)) return response.orders;
  if (Array.isArray(response?.merchants)) return response.merchants;
  if (Array.isArray(response?.riders)) return response.riders;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

const fetchOrders = async () => (await client.get("/orders")).data;
const fetchMerchants = async () => (await client.get("/merchants")).data;

const OrdersTable: React.FC = () => {
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [csvUploadVisible, setCsvUploadVisible] = useState(false);
  const [csvMerchantName, setCsvMerchantName] = useState("");
  const [csvUploading, setCsvUploading] = useState(false);

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: fetchOrders,
  });

  const { data: merchantsData, isLoading: merchantsLoading } = useQuery({
    queryKey: ["merchants"],
    queryFn: fetchMerchants,
  });

  const orders: Order[] = normalizeArray(ordersData);
  const merchants: Merchant[] = normalizeArray(merchantsData);

  const findMerchantByName = (name: string): Merchant | undefined => {
    const normalized = name.trim().toLowerCase();
    return merchants.find((m) => m.name.trim().toLowerCase() === normalized);
  };

  const handleSaveOrder = async (values: any) => {
    try {
      let payload = { ...values };

      // Resolve merchant name to ID
      if (payload.merchantName) {
        const merchant = findMerchantByName(payload.merchantName);
        if (!merchant) {
          message.error("Merchant not found. Please check the name.");
          return;
        }
        payload.merchantId = merchant.id;
        delete payload.merchantName;
      }

      // Data normalization
      if (payload.amount !== undefined) payload.amount = Number(payload.amount);
      if (payload.lat !== undefined) payload.lat = Number(payload.lat);
      if (payload.lng !== undefined) payload.lng = Number(payload.lng);
      if (!payload.paymentType) payload.paymentType = "COD";

      Object.keys(payload).forEach((key) => {
        if (typeof payload[key] === "string") {
          payload[key] = payload[key].trim();
        }
      });

      if (editingId) {
        await client.put(`/orders/${editingId}`, payload);
        message.success("Order updated successfully");
      } else {
        await client.post("/orders", payload);
        message.success("Order created successfully");
      }

      queryClient.invalidateQueries({ queryKey: ["orders"] });
      form.resetFields();
      setModalVisible(false);
      setEditingId(null);
    } catch (err: any) {
      message.error(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Failed to save order"
      );
    }
  };

  const handleCsvUpload = async (file: any) => {
    if (!csvMerchantName.trim()) {
      message.error("Please enter a merchant name");
      return;
    }

    const merchant = findMerchantByName(csvMerchantName);
    if (!merchant) {
      message.error("Merchant not found");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("merchantId", merchant.id);

    try {
      setCsvUploading(true);
      const response = await client.post("/orders/upload-csv", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const count = response.data?.imported ?? response.data?.count ?? 0;
      message.success(`Successfully imported ${count} orders`);

      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setCsvUploadVisible(false);
      setCsvMerchantName("");
    } catch (err: any) {
      message.error(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Failed to upload CSV"
      );
    } finally {
      setCsvUploading(false);
    }
  };

  const handleEditOrder = (record: Order) => {
    setEditingId(record.id);
    const editValues: any = { ...record };
    if (record.merchant?.name) {
      editValues.merchantName = record.merchant.name;
    }
    form.setFieldsValue(editValues);
    setModalVisible(true);
  };

  const handleDeleteOrder = async (id: string) => {
    try {
      await client.delete(`/orders/${id}`);
      message.success("Order deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    } catch (err: any) {
      message.error(err?.response?.data?.error || "Failed to delete order");
    }
  };

  const columns = [
    { title: "Order ID", dataIndex: "id", key: "id", width: 140 },
    { title: "Merchant", dataIndex: ["merchant", "name"], key: "merchant" },
    { title: "Customer", dataIndex: "customerName", key: "customer" },
    { title: "Phone", dataIndex: "phone", key: "phone", width: 120 },
    { title: "Address", dataIndex: "address", key: "address" },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      render: (amount: number) => `KSh ${(amount ?? 0).toLocaleString()}`,
      width: 110,
    },
    {
      title: "Payment",
      dataIndex: "paymentType",
      key: "paymentType",
      render: (type: string) => <Tag color={type === "COD" ? "blue" : "green"}>{type}</Tag>,
      width: 100,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          NEW: "blue",
          ASSIGNED: "orange",
          PICKED_UP: "cyan",
          IN_TRANSIT: "purple",
          DELIVERED: "green",
          FAILED: "red",
        };
        return <Tag color={colorMap[status] || "default"}>{status}</Tag>;
      },
      width: 100,
    },
    {
      title: "Rider",
      dataIndex: ["rider", "name"],
      key: "rider",
      render: (name?: string) => name || "—",
    },
    {
      title: "Actions",
      key: "actions",
      width: 110,
      render: (_: any, record: Order) => (
        <Space size="small">
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEditOrder(record)} />
          <Button
            danger
            icon={<DeleteOutlined />}
            size="small"
            onClick={() =>
              Modal.confirm({
                title: "Confirm Delete",
                content: "Are you sure you want to delete this order?",
                okText: "Delete",
                okType: "danger",
                onOk: () => handleDeleteOrder(record.id),
              })
            }
          />
        </Space>
      ),
    },
  ];

  if (ordersLoading || merchantsLoading) {
    return (
      <div style={{ textAlign: "center", marginTop: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2>Orders Management</h2>
        <Space>
          <Button type="primary" icon={<UploadOutlined />} onClick={() => setCsvUploadVisible(true)}>
            Upload CSV
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingId(null); form.resetFields(); setModalVisible(true); }}>
            New Order
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={orders}
        rowKey="id"
        pagination={{ pageSize: 12, showSizeChanger: true, showTotal: (total) => `Total ${total} orders` }}
        scroll={{ x: 1300 }}
      />

      {/* Order Form Modal */}
      <Modal
        title={editingId ? "Edit Order" : "Create New Order"}
        open={modalVisible}
        onCancel={() => { setModalVisible(false); setEditingId(null); form.resetFields(); }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSaveOrder}>
          <Form.Item label="Merchant" name="merchantName" rules={[{ required: true }]}>
            <Input placeholder="Enter merchant name (Naivas, Carrefour, etc.)" />
          </Form.Item>
          <Form.Item label="Customer Name" name="customerName" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="Phone Number" name="phone" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="Delivery Address" name="address" rules={[{ required: true }]}><Input.TextArea rows={3} /></Form.Item>
          <Form.Item label="Amount (KSh)" name="amount" rules={[{ required: true }]}><Input type="number" /></Form.Item>
          <Form.Item label="Payment Type" name="paymentType" initialValue="COD">
            <Select options={[{ label: "Cash on Delivery", value: "COD" }, { label: "Prepaid", value: "PREPAID" }]} />
          </Form.Item>
          <Form.Item label="Latitude" name="lat"><Input type="number" placeholder="Optional" /></Form.Item>
          <Form.Item label="Longitude" name="lng"><Input type="number" placeholder="Optional" /></Form.Item>
        </Form>
      </Modal>

      {/* CSV Upload Modal */}
      <Modal title="Bulk Upload Orders" open={csvUploadVisible} onCancel={() => { setCsvUploadVisible(false); setCsvMerchantName(""); }} footer={null}>
        <div style={{ marginBottom: 16 }}>
          <label>Merchant Name <span style={{ color: "red" }}>*</span></label>
          <Input
            placeholder="e.g. Naivas"
            value={csvMerchantName}
            onChange={(e) => setCsvMerchantName(e.target.value)}
            style={{ marginTop: 8 }}
          />
        </div>

        <Card style={{ background: "#fafafa" }}>
          <p><strong>CSV Format:</strong></p>
          <p style={{ fontSize: 13, color: "#555" }}>
            customerName, phone, address, amount, paymentType (COD/PREPAID), lat, lng
          </p>
        </Card>

        <Upload
          maxCount={1}
          accept=".csv"
          beforeUpload={(file) => { handleCsvUpload(file); return false; }}
          disabled={!csvMerchantName.trim() || csvUploading}
        >
          <Button type="primary" icon={<UploadOutlined />} loading={csvUploading} style={{ marginTop: 16 }} disabled={!csvMerchantName.trim()}>
            {csvUploading ? "Uploading..." : "Upload CSV File"}
          </Button>
        </Upload>
      </Modal>
    </div>
  );
};

export default OrdersTable;
