import React from "react";
import { Card, Row, Col, Tag, Spin } from "antd";
import { useQuery } from "@tanstack/react-query";
import client from "../api/client";

// =====================
// FETCH ORDERS
// =====================
const fetchOrders = async () => {
  const { data } = await client.get("/orders");
  return data;
};

// =====================
// FETCH MERCHANTS
// =====================
const fetchMerchants = async () => {
  const { data } = await client.get("/merchants");
  return data;
};

const Dashboard: React.FC = () => {
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: fetchOrders,
  });

  const { data: merchantsData, isLoading: merchantsLoading } = useQuery({
    queryKey: ["merchants"],
    queryFn: fetchMerchants,
  });

  // =====================
  // SAFE NORMALIZATION
  // =====================
  const orders = Array.isArray(ordersData?.items)
    ? ordersData.items
    : [];
  const merchants = Array.isArray(merchantsData?.items)
    ? merchantsData.items
    : [];

  console.log("Orders Response:", ordersData);
  console.log("Merchants Response:", merchantsData);
  console.log("Orders:", orders);
  console.log("Merchants:", merchants);

  const delivered = orders.filter(
    (o: any) => o.status === "DELIVERED"
  ).length;

  const pending = orders.filter(
    (o: any) => o.status !== "DELIVERED"
  ).length;

  const kpis = [
    { label: "Orders", value: orders.length },
    { label: "Delivered", value: delivered },
    { label: "Pending", value: pending },
    { label: "Merchants", value: merchants.length },
  ];

  if (ordersLoading || merchantsLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", marginTop: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      {/* KPI */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12,1fr)",
          gap: 16,
          marginBottom: 18,
        }}
      >
        {kpis.map((k, i) => (
          <div key={i} style={{ gridColumn: "span 3" }}>
            <Card>
              <div style={{ fontSize: 12, color: "#888" }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{k.value}</div>
            </Card>
          </div>
        ))}
      </div>

      <Row gutter={16}>
        {/* ORDERS */}
        <Col span={16}>
          <Card title="Recent Orders">
            <table style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Merchant</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Amount</th>
                </tr>
              </thead>

              <tbody>
                {orders.length ? (
                  orders.map((o: any) => (
                    <tr key={o.id}>
                      <td>{o.id}</td>
                      <td>{o.merchant?.name || "N/A"}</td>
                      <td>{o.customerName}</td>
                      <td>
                        <Tag
                          color={
                            o.status === "DELIVERED"
                              ? "green"
                              : o.status === "ASSIGNED"
                              ? "orange"
                              : "blue"
                          }
                        >
                          {o.status}
                        </Tag>
                      </td>
                      <td>KSh {o.amount}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center" }}>
                      No orders found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </Col>

        {/* MERCHANTS */}
        <Col span={8}>
          <Card title="Merchants">
            {merchants.length ? (
              merchants.map((m: any) => (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 0",
                  }}
                >
                  <div>{m.name}</div>
                  <Tag color={m.status === "CONNECTED" ? "green" : "red"}>
                    {m.status}
                  </Tag>
                </div>
              ))
            ) : (
              <div>No merchants found</div>
            )}
          </Card>

          <Card title="Live Tracking" style={{ marginTop: 16 }}>
            <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "#999" }}>
              Map coming next
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;