import React, { useEffect, useState } from "react";
import { Card, Table, Spin, Empty, Tag, Button } from "antd";
import { useQuery } from "@tanstack/react-query";
import client from "../../api/client";

const OrdersTableComponent: React.FC = () => {
  const [filters, setFilters] = useState<any>({ page: 1, limit: 25 });
  const fetchOrders = async () => (await client.get('/orders', { params: { ...filters, status: undefined, limit: filters.limit || 25 } })).data;
  const { data, isLoading } = useQuery({ queryKey: ['ordersPage', filters], queryFn: fetchOrders, keepPreviousData: true });
  const orders = Array.isArray(data) ? data : data?.items || [];

  const columns = [
    { title: 'Order No.', dataIndex: 'id', key: 'id', render: (id: string) => <a href={`/orders/${id}`}>{id?.slice(0,8).toUpperCase()}</a> },
    { title: 'Customer', dataIndex: 'customerName', key: 'customerName' },
    { title: 'Merchant', dataIndex: ['merchant', 'name'], key: 'merchant' },
    { title: 'Rider', dataIndex: ['rider', 'name'], key: 'rider' },
    { title: 'Pickup', dataIndex: 'address', key: 'pickup' },
    { title: 'Destination', dataIndex: 'destination', key: 'destination' },
    { title: 'Created', dataIndex: 'createdAt', key: 'createdAt', render: (d: string) => new Date(d).toLocaleString() },
    { title: 'Delivered', dataIndex: 'deliveredAt', key: 'deliveredAt', render: (d: string) => d ? new Date(d).toLocaleString() : '—' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color="blue">{s}</Tag> },
    { title: 'Actions', key: 'actions', render: (_: any, record: any) => <div style={{ display: 'flex', gap: 8 }}><Button onClick={() => window.location.assign(`/orders/${record.id}`)}>View</Button><Button>Print</Button></div> },
  ];

  if (isLoading) return <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>;

  return (
    <Card>
      <Table rowKey="id" dataSource={orders} columns={columns} pagination={{ pageSize: filters.limit || 25 }} />
      {orders.length === 0 && <Empty description="No orders" />}
    </Card>
  );
};

export default OrdersTableComponent;
