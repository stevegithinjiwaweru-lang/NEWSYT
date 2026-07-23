import React, { useMemo } from "react";
import { Card, Tag, Spin, Empty, Row, Col } from "antd";
import { useQuery } from "@tanstack/react-query";
import client from "../api/client";
import { STATUS } from "../theme/palette";

interface DispatchRecord {
  id: string;
  orderReference: string;
  status: string;
  rider?: { name: string; phone: string } | null;
  order?: { customerName: string; address: string } | null;
  estimatedDelivery?: string | null;
  actualPickupAt?: string | null;
  actualDeliveryAt?: string | null;
  createdAt: string;
}

const ACTIVE_STATUSES = ["PENDING", "CREATED", "ASSIGNED", "PICKED_UP", "EN_ROUTE", "ARRIVED"];

const STATUS_TAG: Record<string, { color: string; label: string }> = {
  PENDING: { color: STATUS.muted, label: "Pending" },
  CREATED: { color: STATUS.muted, label: "Created" },
  ASSIGNED: { color: STATUS.warning, label: "Assigned" },
  PICKED_UP: { color: STATUS.warning, label: "Picked Up" },
  EN_ROUTE: { color: STATUS.warning, label: "En Route" },
  ARRIVED: { color: STATUS.warning, label: "Arrived" },
  DELIVERED: { color: STATUS.good, label: "Delivered" },
  FAILED: { color: STATUS.critical, label: "Failed" },
  CANCELLED: { color: STATUS.critical, label: "Cancelled" },
};

const fetchDispatches = async () => (await client.get("/dispatches")).data;

const asList = (data: any, ...keys: string[]): any[] => {
  if (Array.isArray(data)) return data;
  for (const key of keys) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
};

const Dispatch: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["dispatches"],
    queryFn: fetchDispatches,
    refetchInterval: 15000,
  });

  const dispatches: DispatchRecord[] = asList(data, "dispatches");

  const active = useMemo(
    () =>
      dispatches
        .filter((d) => ACTIVE_STATUSES.includes(d.status))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [dispatches]
  );

  const summary = [
    { label: "Active Dispatches", value: active.length },
    { label: "Picked Up", value: dispatches.filter((d) => d.status === "PICKED_UP").length },
    { label: "En Route", value: dispatches.filter((d) => d.status === "EN_ROUTE").length },
    { label: "Delivered Today", value: dispatches.filter((d) => d.status === "DELIVERED").length },
  ];

  if (isLoading) {
    return <Spin size="large" style={{ display: "block", margin: "120px auto" }} />;
  }

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        {summary.map((s) => (
          <Col span={6} key={s.label}>
            <Card>
              <div style={{ color: "#e40d6e", fontWeight: 700, fontSize: 13 }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>{s.value}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Card title="Active Dispatches">
        {active.length ? (
          <div className="table-wrap">
            <table style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Order Ref</th>
                  <th>Customer</th>
                  <th>Address</th>
                  <th>Rider</th>
                  <th>Status</th>
                  <th>Est. Delivery</th>
                </tr>
              </thead>
              <tbody>
                {active.map((d) => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 700, color: "#e40d6e" }}>
                      {d.orderReference.slice(0, 8).toUpperCase()}
                    </td>
                    <td>{d.order?.customerName || "N/A"}</td>
                    <td>{d.order?.address || "N/A"}</td>
                    <td>{d.rider?.name || "Unassigned"}</td>
                    <td>
                      <Tag color={STATUS_TAG[d.status]?.color || STATUS.muted}>
                        {STATUS_TAG[d.status]?.label || d.status}
                      </Tag>
                    </td>
                    <td>
                      {d.estimatedDelivery
                        ? new Date(d.estimatedDelivery).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty description="No active dispatches right now" />
        )}
      </Card>
    </div>
  );
};

export default Dispatch;
