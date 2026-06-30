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
  Divider,
  Card,
  Empty,
} from "antd";
import {
  PlusOutlined,
  UploadOutlined,
  EditOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import client from "../api/client";

const fetchOrders = async () => {
  const token = localStorage.getItem("accessToken");
  const { data } = await client.get("/orders", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return data;
};

const fetchMerchants = async () => {
  const token = localStorage.getItem("accessToken");
  const { data } = await client.get("/merchants", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return data;
};

const fetchRiders = async () => {
  const token = localStorage.getItem("accessToken");
  const { data } = await client.get("/riders", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return data;
};

const Orders: React.FC = () => {
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [csvUploadVisible, setCsvUploadVisible] = useState(false);
  const [selectedMerchantForCsv, setSelectedMerchantForCsv] = useState<string | null>(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [assignForm] = Form.useForm();

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: fetchOrders,
  });

  const { data: merchantsData, isLoading: merchantsLoading } = useQuery({
    queryKey: ["merchants"],
    queryFn: fetchMerchants,
  });

  const { data: ridersData, isLoading: ridersLoading } = useQuery({
    queryKey: ["riders"],
    queryFn: fetchRiders,
  });

  const orders = ordersData?.orders || [];
  const merchants = merchantsData?.merchants || [];
  const riders = ridersData?.riders || [];

  const handleCreateOrder = async (values: any) => {
    const token = localStorage.getItem("accessToken");

    try {
      if (editingId) {
        // Update
        await client.put(`/orders/${editingId}`, values, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        message.success("Order updated successfully");
      } else {
        // Create
        await client.post("/orders", values, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        message.success("Order created successfully");
      }

      queryClient.invalidateQueries({ queryKey: ["orders"] });
      form.resetFields();
      setModalVisible(false);
      setEditingId(null);
    } catch (err: any) {
      message.error(
        err?.response?.data?.error || "Failed to save order"
      );
    }
  };

  const handleAssignRider = async (values: any) => {
    const token = localStorage.getItem("accessToken");

    try {
      await client.post(
        `/orders/${selectedOrderId}/assign`,
        { riderId: values.riderId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      message.success("Order assigned to rider");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setAssignModalVisible(false);
      setSelectedOrderId(null);
      assignForm.resetFields();
    } catch (err: any) {
      message.error(
        err?.response?.data?.error || "Failed to assign order"
      );
    }
  };

  const handleCsvUpload = async (file: any) => {
    if (!selectedMerchantForCsv) {
      message.error("Please select a merchant first");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("merchantId", selectedMerchantForCsv);

    const token = localStorage.getItem("accessToken");

    try {
      setCsvUploading(true);
      const response = await client.post("/orders/upload-csv", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      message.success(
        `Successfully imported ${response.data.count} orders`
      );
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setCsvUploadVisible(false);
      setSelectedMerchantForCsv(null);
    } catch (err: any) {
      message.error(
        err?.response?.data?.error || "Failed to upload CSV"
      );
    } finally {
      setCsvUploading(false);
    }
  };

  const handleEditOrder = (record: any) => {
    setEditingId(record.id);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDeleteOrder = async (id: string) => {
    const token = localStorage.getItem("accessToken");

    try {
      await client.delete(`/orders/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      message.success("Order deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    } catch (err: any) {
      message.error(
        err?.response?.data?.error || "Failed to delete order"
      );
    }
  };

  const columns = [
    {
      title: "Order ID",
      dataIndex: "id",
      key: "id",
      width: 150,
      render: (text: string) => <span style={{ fontSize: 12 }}>{text}</span>,
    },
    {
      title: "Merchant",
      dataIndex: ["merchant", "name"],
      key: "merchantName",
    },
    {
      title: "Customer",
      dataIndex: "customerName",
      key: "customerName",
    },
    {
      title: "Phone",
      dataIndex: "phone",
      key: "phone",
    },
    {
      title: "Address",
      dataIndex: "address",
      key: "address",
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      render: (amount: number) => `KSh ${amount.toLocaleString()}`,
    },
    {
      title: "Payment Type",
      dataIndex: "paymentType",
      key: "paymentType",
      render: (type: string) => (
        <Tag color={type === "COD" ? "blue" : "green"}>
          {type}
        </Tag>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => {
        const statusColors: { [key: string]: string } = {
          NEW: "blue",
          ASSIGNED: "orange",
          PICKED_UP: "cyan",
          IN_TRANSIT: "purple",
          DELIVERED: "green",
          FAILED: "red",
          RETURNED: "volcano",
        };
        return <Tag color={statusColors[status] || "default"}>{status}</Tag>;
      },
    },
    {
      title: "Rider",
      dataIndex: ["rider", "name"],
      key: "riderName",
      render: (name: string) => name || "-",
    },
    {
      title: "Actions",
      key: "actions",
      width: 200,
      render: (_: any, record: any) => (
        <Space size="small">
          {record.status === "NEW" && (
            <Button
              type="primary"
              size="small"
              onClick={() => {
                setSelectedOrderId(record.id);
                assignForm.resetFields();
                setAssignModalVisible(true);
              }}
            >
              Assign
            </Button>
          )}
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEditOrder(record)}
          />
          <Button
            danger
            icon={<DeleteOutlined />}
            size="small"
            onClick={() =>
              Modal.confirm({
                title: "Delete Order",
                content: "Are you sure you want to delete this order?",
                okText: "Yes",
                cancelText: "No",
                onOk: () => handleDeleteOrder(record.id),
              })
            }
          />
        </Space>
      ),
    },
  ];

  if (ordersLoading || merchantsLoading || ridersLoading) {
    return (
      <div style={{ textAlign: "center", marginTop: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <h2>Orders</h2>
        <Space>
          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={() => setCsvUploadVisible(true)}
          >
            Upload CSV
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingId(null);
              form.resetFields();
              setModalVisible(true);
            }}
          >
            Create Order
          </Button>
        </Space>
      </div>

      {orders.length > 0 ? (
        <Table
          columns={columns}
          dataSource={orders}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} orders`,
          }}
          scroll={{ x: 1400 }}
        />
      ) : (
        <Empty description="No orders found" />
      )}

      {/* Create/Edit Order Modal */}
      <Modal
        title={editingId ? "Edit Order" : "Create Order"}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingId(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateOrder}
        >
          <Form.Item
            label="Merchant"
            name="merchantId"
            rules={[{ required: true, message: "Please select a merchant" }]}
          >
            <Select
              placeholder="Select merchant"
              options={merchants.map((m: any) => ({
                label: m.name,
                value: m.id,
              }))}
            />
          </Form.Item>

          <Form.Item
            label="Customer Name"
            name="customerName"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="Phone"
            name="phone"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="Address"
            name="address"
            rules={[{ required: true }]}
          >
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.Item
            label="Amount (KSh)"
            name="amount"
            rules={[{ required: true }]}
          >
            <Input type="number" />
          </Form.Item>

          <Form.Item
            label="Payment Type"
            name="paymentType"
            initialValue="COD"
          >
            <Select
              options={[
                { label: "Cash on Delivery", value: "COD" },
                { label: "Prepaid", value: "PREPAID" },
              ]}
            />
          </Form.Item>

          <Form.Item label="Latitude" name="lat">
            <Input type="number" placeholder="Optional" />
          </Form.Item>

          <Form.Item label="Longitude" name="lng">
            <Input type="number" placeholder="Optional" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Assign Rider Modal */}
      <Modal
        title="Assign Order to Rider"
        open={assignModalVisible}
        onCancel={() => {
          setAssignModalVisible(false);
          setSelectedOrderId(null);
          assignForm.resetFields();
        }}
        onOk={() => assignForm.submit()}
      >
        <Form
          form={assignForm}
          layout="vertical"
          onFinish={handleAssignRider}
        >
          <Form.Item
            label="Select Rider"
            name="riderId"
            rules={[{ required: true, message: "Please select a rider" }]}
          >
            <Select
              placeholder="Choose a rider"
              options={riders
                .filter((r: any) => r.status === "AVAILABLE")
                .map((r: any) => ({
                  label: `${r.name} (${r.phone})",
                  value: r.id,
                }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* CSV Upload Modal */}
      <Modal
        title="Upload Orders CSV"
        open={csvUploadVisible}
        onCancel={() => {
          setCsvUploadVisible(false);
          setSelectedMerchantForCsv(null);
        }}
        footer={null}
      >
        <div style={{ marginBottom: 16 }}>
          <label>Select Merchant</label>
          <Select
            placeholder="Choose a merchant"
            style={{ width: "100%", marginTop: 8 }}
            value={selectedMerchantForCsv}
            onChange={setSelectedMerchantForCsv}
            options={merchants
              .filter((m: any) => m.connector === "CSV")
              .map((m: any) => ({
                label: m.name,
                value: m.id,
              }))}
          />
        </div>

        <Card
          style={{ backgroundColor: "#f5f5f5", marginBottom: 16 }}
        >
          <p style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
            <strong>CSV Format Required:</strong>
          </p>
          <p style={{ fontSize: 12, color: "#666", margin: "4px 0" }}>
            customerName, phone, address, amount, paymentType (optional: COD/PREPAID), lat (optional), lng (optional)
          </p>
          <p style={{ fontSize: 12, color: "#999", marginTop: 8 }}>
            Example row: John Doe, 0712345678, Karen, 1500, COD, -1.2921, 36.8219
          </p>
        </Card>

        <Upload
          maxCount={1}
          accept=".csv"
          beforeUpload={(file) => {
            handleCsvUpload(file);
            return false;
          }}
          disabled={!selectedMerchantForCsv || csvUploading}
        >
          <Button
            icon={<UploadOutlined />}
            loading={csvUploading}
            disabled={!selectedMerchantForCsv}
          >
            {csvUploading ? "Uploading..." : "Click to Upload CSV"}
          </Button>
        </Upload>
      </Modal>
    </div>
  );
};

export default Orders;
