import React, { useState } from "react";
import {
  Card,
  Table,
  Button,
  Modal,
  Select,
  List,
  Avatar,
  message,
  Tag,
  Spin,
  Empty,
  Row,
  Col,
  Typography,
} from "antd";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import client from "../api/client";

const { Title } = Typography;

interface Order {
  id: string;
  merchant?: { name: string };
  customerName: string;
  phone: string;
  address: string;
  amount: number;
  status: string;
  rider?: { name: string };
}

interface Rider {
  id: string;
  name: string;
  phone: string;
  status: "AVAILABLE" | "BUSY" | "OFFLINE";
}

const normalizeArray = (response: any): any[] => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.orders)) return response.orders;
  if (Array.isArray(response?.riders)) return response.riders;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

const fetchOrders = async () => {
  const token = localStorage.getItem("accessToken");
  const { data } = await client.get("/orders", { headers: { Authorization: `Bearer ${token}` } });
  return data;
};

const fetchRiders = async () => {
  const token = localStorage.getItem("accessToken");
  const { data } = await client.get("/riders", { headers: { Authorization: `Bearer ${token}` } });
  return data;
};

const Dispatch: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null);

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: fetchOrders,
    refetchInterval: 15000,
  });

  const { data: ridersData, isLoading: ridersLoading } = useQuery({
    queryKey: ["riders"],
    queryFn: fetchRiders,
    refetchInterval: 10000,
  });

  const orders: Order[] = normalizeArray(ordersData);
  const riders: Rider[] = normalizeArray(ridersData);

  const pendingOrders = orders.filter((o) => o.status === "NEW");
  const availableRiders = riders.filter((r) => r.status === "AVAILABLE");

  const handleAssignRider = async () => {
    if (!selectedOrder || !selectedRiderId) return;

    try {
      await client.post(`/orders/${selectedOrder.id}/assign`, {
        riderId: selectedRiderId,
      });

      message.success(`Order ${selectedOrder.id} assigned successfully`);
      setSelectedOrder(null);
      setSelectedRiderId(null);

      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["riders"] });
    } catch (err: any) {
      message.error(err?.response?.data?.error || "Failed to assign rider");
    }
  };

  const columns = [
    { title: "Order ID", dataIndex: "id", key: "id", width: 130 },
    { title: "Merchant", dataIndex: ["merchant", "name"], key: "merchant" },
    { title: "Customer", dataIndex: "customerName", key: "customer" },
    { title: "Phone", dataIndex: "phone", key: "phone", width: 130 },
    { title: "Amount", dataIndex: "amount", key: "amount", render: (amt: number) => `KSh ${amt.toLocaleString()}` },
    {
      title: "Current Rider",
      key: "currentRider",
      render: (_: any, record: Order) => record.rider?.name || <span style={{ color: "#999" }}>Not Assigned</span>,
    },
    {
      title: "Action",
      key: "action",
      render: (_: any, record: Order) => (
        <Button type="primary" onClick={() => setSelectedOrder(record)}>
          Assign Rider
        </Button>
      ),
    },
  ];

  if (ordersLoading || ridersLoading) {
    return <Spin size="large" style={{ display: "block", margin: "120px auto" }} />;
  }

  return (
    <div>
      <Title level={2}>Dispatch Center</Title>

      <Row gutter={[16, 16]}>
        {/* Left: Pending Orders */}
        <Col xs={24} lg={16}>
          <Card title={`New Orders Awaiting Dispatch (${pendingOrders.length})`} bordered={false}>
            {pendingOrders.length > 0 ? (
              <Table
                columns={columns}
                dataSource={pendingOrders}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                scroll={{ x: 900 }}
              />
            ) : (
              <Empty description="No new orders pending dispatch" />
            )}
          </Card>
        </Col>

        {/* Right: Available Riders */}
        <Col xs={24} lg={8}>
          <Card title={`Available Riders (${availableRiders.length})`} bordered={false}>
            {availableRiders.length > 0 ? (
              <List
                dataSource={availableRiders}
                renderItem={(rider: Rider) => (
                  <List.Item
                    key={rider.id}
                    onClick={() => setSelectedRiderId(rider.id)}
                    style={{
                      cursor: "pointer",
                      backgroundColor: selectedRiderId === rider.id ? "#e6f7ff" : "transparent",
                      borderRadius: 6,
                    }}
                  >
                    <List.Item.Meta
                      avatar={<Avatar style={{ backgroundColor: "#52c41a" }}>{rider.name.charAt(0)}</Avatar>}
                      title={rider.name}
                      description={rider.phone}
                    />
                    <Tag color="green">AVAILABLE</Tag>
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="No riders currently available" />
            )}
          </Card>
        </Col>
      </Row>

      {/* Assignment Confirmation Modal */}
      <Modal
        title="Assign Rider to Order"
        open={!!selectedOrder}
        onCancel={() => {
          setSelectedOrder(null);
          setSelectedRiderId(null);
        }}
        onOk={handleAssignRider}
        okText="Confirm Assignment"
        okButtonProps={{ disabled: !selectedRiderId }}
        width={480}
      >
        {selectedOrder && (
          <div>
            <p><strong>Order ID:</strong> {selectedOrder.id}</p>
            <p><strong>Customer:</strong> {selectedOrder.customerName}</p>
            <p><strong>Destination:</strong> {selectedOrder.address}</p>
            <p><strong>Amount:</strong> KSh {selectedOrder.amount.toLocaleString()}</p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Dispatch;