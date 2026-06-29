import React, { useState, useEffect } from "react";
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
  Alert,
  Tooltip,
  Empty,
} from "antd";
import { LockOutlined } from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import client from "../api/client";

const fetchOrders = async () => {
  const { data } = await client.get("/orders");
  return data;
};

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
    refetchInterval: 3000,
  });

  const { data: ridersData, isLoading: ridersLoading } = useQuery({
    queryKey: ["riders"],
    queryFn: fetchRiders,
    refetchInterval: 5000,
  });

  // =====================
  // SAFE NORMALIZATION
  // =====================
  const orders = ordersData?.orders || ordersData?.data || [];
  const riders = ridersData?.riders || ridersData?.data || [];

  // =====================
  // RESTRICTED MERCHANTS (CSV-SYNCED, NO MANUAL ASSIGNMENT)
  // =====================
  const RESTRICTED_MERCHANTS = ["Naivas", "Carrefour", "naivas", "carrefour"];

  const isOrderFromRestrictedMerchant = (order: any) => {
    const merchantName = order.merchant?.name || "";
    return RESTRICTED_MERCHANTS.some((restricted) =>
      merchantName.toLowerCase().includes(restricted.toLowerCase())
    );
  };

  // =====================
  // FILTER ONLY ASSIGNABLE ORDERS (NEW status + NOT from restricted merchants)
  // =====================
  const assignableOrders = orders.filter(
    (o: any) => o.status === "NEW" && !isOrderFromRestrictedMerchant(o)
  );

  const restrictedOrders = orders.filter(
    (o: any) => o.status === "NEW" && isOrderFromRestrictedMerchant(o)
  );

  // =====================
  // ASSIGN RIDER
  // =====================
  const handleAssign = async () => {
    if (!selectedOrder || !selectedRider) {
      message.warning("Please select both an order and a rider");
      return;
    }

    if (isOrderFromRestrictedMerchant(selectedOrder)) {
      message.error(
        `Orders from ${selectedOrder.merchant?.name} cannot be manually assigned. They sync from their own system.`
      );
      return;
    }

    try {
      await client.patch(`/orders/${selectedOrder.id}/assign`, {
        riderId: selectedRider,
      });

      message.success(
        `Order assigned to rider ${riders.find((r: any) => r.id === selectedRider)?.name}`
      );

      setSelectedOrder(null);
      setSelectedRider(null);

      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["riders"] });
    } catch (err: any) {
      message.error(err?.response?.data?.error || "Assignment failed");
    }
  };

  // =====================
  // TABLE COLUMNS
  // =====================
  const columns = [
    {
      title: "Order ID",
      dataIndex: "id",
      key: "id",
      width: 120,
    },
    {
      title: "Merchant",
      render: (_: any, record: any) => {
        const merchantName = record.merchant?.name || "N/A";
        const isRestricted = isOrderFromRestrictedMerchant(record);
        return (
          <div>
            {merchantName}
            {isRestricted && (
              <Tag color="red" style={{ marginLeft: 8 }}>
                <LockOutlined /> Auto-Sync
              </Tag>
            )}
          </div>
        );
      },
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
      width: 120,
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      render: (v: number) => `KSh ${v.toLocaleString()}`,
      width: 120,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
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
      width: 100,
    },
    {
      title: "Action",
      key: "action",
      render: (_: any, record: any) => {
        const isRestricted = isOrderFromRestrictedMerchant(record);
        return isRestricted ? (
          <Tooltip title="This order is managed by the merchant's system and cannot be manually assigned">
            <Button type="primary" disabled>
              Assign Rider
            </Button>
          </Tooltip>
        ) : (
          <Button type="primary" onClick={() => setSelectedOrder(record)}>
            Assign Rider
          </Button>
        );
      },
      width: 140,
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

      {/* INFO ALERTS */}
      {restrictedOrders.length > 0 && (
        <Alert
          message={`${restrictedOrders.length} order(s) from Naivas/Carrefour cannot be assigned`}
          description="These are auto-synced from the merchant's system. They will be managed via their own rider app."
          type="warning"
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />
      )}

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
          <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 16 }}>
            Available Orders ({assignableOrders.length})
          </div>

          {assignableOrders.length === 0 ? (
            <Empty description="No orders available for assignment" />
          ) : (
            <Table
              dataSource={assignableOrders}
              columns={columns as any}
              rowKey="id"
              pagination={{ pageSize: 8 }}
              size="small"
              scroll={{ x: 800 }}
            />
          )}
        </Card>

        {/* RIDERS */}
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 16 }}>
            Available Riders ({riders.filter((r: any) => r.status === "AVAILABLE").length})
          </div>

          {riders.length === 0 ? (
            <Empty description="No riders available" />
          ) : (
            <List
              dataSource={riders}
              renderItem={(r: any) => (
                <List.Item
                  actions={[
                    <Tag
                      color={
                        r.status === "AVAILABLE" ? "green" : "orange"
                      }
                    >
                      {r.status}
                    </Tag>,
                  ]}
                  style={{
                    padding: 12,
                    backgroundColor:
                      selectedRider === r.id ? "#e6f7ff" : "transparent",
                    cursor: "pointer",
                    borderRadius: 4,
                  }}
                  onClick={() => setSelectedRider(r.id)}
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        style={{
                          backgroundColor:
                            selectedRider === r.id ? "#1890ff" : "#87d068",
                        }}
                      >
                        {r.name?.charAt(0) || "R"}
                      </Avatar>
                    }
                    title={<strong>{r.name}</strong>}
                    description={`${r.phone}${
                      r.bikeReg ? ` • ${r.bikeReg}` : ""
                    }`}
                  />
                </List.Item>
              )}
            />
          )}
        </Card>
      </div>

      {/* ASSIGN MODAL */}
      <Modal
        title="Assign Order to Rider"
        open={!!selectedOrder}
        onCancel={() => {
          setSelectedOrder(null);
          setSelectedRider(null);
        }}
        onOk={handleAssign}
        okText="Assign Order"
        width={500}
      >
        {selectedOrder && (
          <div>
            <div style={{ marginBottom: 16, padding: 12, backgroundColor: "#f0f2f5", borderRadius: 4 }}>
              <p>
                <b>Order ID:</b> {selectedOrder.id}
              </p>
              <p>
                <b>Merchant:</b> {selectedOrder.merchant?.name}
              </p>
              <p>
                <b>Customer:</b> {selectedOrder.customerName}
              </p>
              <p>
                <b>Phone:</b> {selectedOrder.phone}
              </p>
              <p>
                <b>Amount:</b> KSh {selectedOrder.amount.toLocaleString()}
              </p>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                Select Rider
              </label>
              <Select
                style={{ width: "100%" }}
                placeholder="Choose a rider"
                value={selectedRider || undefined}
                onChange={setSelectedRider}
              >
                {riders
                  .filter((r: any) => r.status === "AVAILABLE")
                  .map((r: any) => (
                    <Select.Option key={r.id} value={r.id}>
                      {r.name} — {r.phone}
                    </Select.Option>
                  ))}
              </Select>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Dispatch;
