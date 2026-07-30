import React from "react";
import OrdersHeader from "./OrdersHeader";
import OrdersStatusTabs from "./OrdersStatusTabs";
import OrdersFilters from "./OrdersFilters";
import SummaryCards from "./SummaryCards";
import BulkActionsToolbar from "./BulkActionsToolbar";
import OrdersTable from "./OrdersTable"; // reuse existing table component in same folder
import AssignRiderModal from "./AssignRiderModal";
import RemoveRiderDialog from "./RemoveRiderDialog";
import "./orders-page.css";

const OrdersPage: React.FC = () => {
  return (
    <div className="orders-page">
      <OrdersHeader />

      <div className="orders-top-row">
        <OrdersStatusTabs />
        <div style={{ flex: 1 }}>
          <OrdersFilters />
          <SummaryCards />
        </div>
      </div>

      <BulkActionsToolbar />

      <div className="orders-table-wrap">
        <OrdersTable />
      </div>

      <AssignRiderModal />
      <RemoveRiderDialog />
    </div>
  );
};

export default OrdersPage;
