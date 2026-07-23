import React from "react";
import { Tabs } from "antd";
import DispatchBoard from "../components/orders/DispatchBoard";
import OrdersTable from "../components/orders/OrdersTable";

const Orders: React.FC = () => {
  return (
    <Tabs
      defaultActiveKey="board"
      items={[
        { key: "board", label: "Dispatch Board", children: <DispatchBoard /> },
        { key: "all", label: "All Orders", children: <OrdersTable /> },
      ]}
    />
  );
};

export default Orders;
