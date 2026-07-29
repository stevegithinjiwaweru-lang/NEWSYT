import React from "react";
import { Table, Button, Spin, Space, Tag } from "antd";
import { useQuery } from "@tanstack/react-query";
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

// Accept both spellings used in code/seed/docs
const ZUCCHINI_NAMES = new Set(["zucchini", "zuchinni"]);

const OrdersTable: React.FC = () => {
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

  const merchantNameById = new Map<string, string>();
  for (const m of merchants) merchantNameById.set(m.id, (m.name || "").toLowerCase());

  const isZucchini = (o: Order) => {
    const nameFromOrder = (o.merchant?.name || "").toLowerCase();
    if (nameFromOrder && ZUCCHINI_NAMES.has(nameFromOrder)) return true;
    const nameFromId = merchantNameById.get(o.merchantId || "") || "";
    return ZUCCHINI_NAMES.has(nameFromId);
  };

  const filteredOrders = orders.filter(isZucchini);

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
        <h2>Orders</h2>
        <Space>
          <Button type="default" disabled>
            Create / Upload moved to Dispatch
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={filteredOrders}
        rowKey="id"
        pagination={{ pageSize: 12, showSizeChanger: true, showTotal: (total) => `Total ${total} orders` }}
        scroll={{ x: 1300 }}
      />
    </div>
  );
};

export default OrdersTable;
