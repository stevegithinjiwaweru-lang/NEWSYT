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
} from "antd";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import client from "../api/client";

// =====================
// FETCH ORDERS
// =====================
const fetchOrders = async () => {
  const { data } = await client.get("/orders");
  return data;
};

// =====================
// FETCH RIDERS
// =====================
const fetchRiders = async () => {
  const { data } = await client.get("/riders");
  return data;
};

const Dispatch: React.FC = () => {
  const queryClient = useQueryClient();

  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [selectedRider, setSelectedRider] = useState<string | null>(null);

  // =====================
  // DATA QUERIES
  // =====================
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: fetchOrders,
  });

  const { data: ridersData, isLoading: ridersLoading } = useQuery({
    queryKey: ["riders"],
    queryFn: fetchRiders,
  });

  // =====================
  // SAFE NORMALIZATION
  // =====================
  const orders = ordersData?.orders || ordersData?.data || [];
  const riders = ridersData?.riders || ridersData?.data || [];

  // =====================
  // STRICT UNASSIGNED FILTER
  // =====================
  const unassignedOrders = orders.filter(
    (o: any) => o.status === "NEW"
  );

  // =====================
  // ASSIGN RIDER
  // =====================
  const assign = async () => {
    if (!selectedOrder || !selectedRider) {
      message.warning("Select a rider first");
      return;
    }

    try {
      await client.patch(`/orders/${selectedOrder.id}/assign`, {
        riderId: selectedRider,
      });

      message.success("Order assigned successfully");

      setSelectedOrder(null);
      setSelectedRider(null);

      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["riders"] });
    } catch (err: any) {
      message.error(
        err?.response?.data?.error || "Assignment failed"
      );
    }
  };

  // =====================
  // TABLE COLUMNS
  // =====================
  const columns = [
    {
      title: "Order ID",
      dataIndex: "id",
    },
    {
      title: "Merchant",
      render: (_: any, record: any) =>
        record.merchant?.name || "N/A",
    },
    {
      title: "Customer",
      dataIndex: "customerName",
    },
    {
      title: "Amount",
      dataIndex: "amount",
      render: (v: number) => `KSh ${v}`,
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (status: string) => (
        <Tag
          color={
            status === "DELIVERED"
              ? "green"
              : status === "ASSIGNED"
              ? "orange"
              : "blue"
          }
        >
          {status}
        </Tag>
      ),
    },
    {
      title: "Action",
      render: (_: any, record: any) => (
        <Button
          type="primary"
          onClick={() => setSelectedOrder(record)}
        >
          Assign Rider
        </Button>
      ),
    },
  ];

  if (ordersLoading || ridersLoading) {
    return (
      <div style={{ textAlign: "center", marginTop: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <h2>Dispatch Center</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 16,
          marginTop: 12,
        }}
      >
        {/* ORDERS */}
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>
            Unassigned Orders ({unassignedOrders.length})
          </div>

          <Table
            dataSource={unassignedOrders}
            columns={columns as any}
            rowKey="id"
            pagination={{ pageSize: 8 }}
          />
        </Card>

        {/* RIDERS */}
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>
            Available Riders
          </div>

          <List
            dataSource={riders}
            renderItem={(r: any) => (
              <List.Item
                actions={[
                  <Tag
                    color={
                      r.status === "AVAILABLE"
                        ? "green"
                        : "orange"
                    }
                  >
                    {r.status}
                  </Tag>,
                ]}
              >
                <List.Item.Meta
                  avatar={<Avatar>{r.name?.charAt(0) || "R"}</Avatar>}
                  title={r.name}
                  description={`${r.phone} ${
                    r.bikeReg ? `• ${r.bikeReg}` : ""
                  }`}
                />
              </List.Item>
            )}
          />
        </Card>
      </div>

      {/* ASSIGN MODAL */}
      <Modal
        title="Assign Order"
        open={!!selectedOrder}
        onCancel={() => {
          setSelectedOrder(null);
          setSelectedRider(null);
        }}
        onOk={assign}
        okText="Assign"
      >
        <p>
          <b>Order:</b> {selectedOrder?.id}
        </p>

        <p>
          <b>Customer:</b> {selectedOrder?.customerName}
        </p>

        <Select
          style={{ width: "100%" }}
          placeholder="Select rider"
          value={selectedRider || undefined}
          onChange={(v) => setSelectedRider(v)}
        >
          {riders
            .filter((r: any) => r.status === "AVAILABLE")
            .map((r: any) => (
              <Select.Option key={r.id} value={r.id}>
                {r.name} — {r.phone}
              </Select.Option>
            ))}
        </Select>
      </Modal>
    </div>
  );
};

export default Dispatch;