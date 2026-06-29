import React, { useState } from "react";
import { Card, Button, message } from "antd";
import client from "../api/client";

const Reports: React.FC = () => {
  const [loading, setLoading] = useState(false);

  // FETCH ORDERS FROM BACKEND
  const fetchOrders = async () => {
    const { data } = await client.get("/orders");
    return data?.orders || [];
  };

  // EXPORT CSV
  const exportCSV = async () => {
    try {
      setLoading(true);

      const orders = await fetchOrders();

      const headers = [
        "Order ID",
        "Customer",
        "Phone",
        "Address",
        "Amount",
        "Status",
      ];

      const rows = orders.map((o: any) => [
        o.id,
        o.customerName,
        o.phone,
        o.address,
        o.amount,
        o.status,
      ]);

      const csvContent =
        [headers, ...rows]
          .map((row) => row.join(","))
          .join("\n");

      const blob = new Blob([csvContent], {
        type: "text/csv;charset=utf-8;",
      });

      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `orders-report-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      message.success("CSV exported successfully");
    } catch (err) {
      message.error("Failed to export CSV");
    } finally {
      setLoading(false);
    }
  };

  // EXPORT PDF (simple frontend version)
  const exportPDF = async () => {
    try {
      setLoading(true);

      const orders = await fetchOrders();

      const win = window.open("", "_blank");

      if (!win) return;

      win.document.write("<h1>Orders Report</h1>");
      win.document.write("<table border='1' cellpadding='5'>");
      win.document.write(
        "<tr><th>ID</th><th>Customer</th><th>Amount</th><th>Status</th></tr>"
      );

      orders.forEach((o: any) => {
        win?.document.write(`
          <tr>
            <td>${o.id}</td>
            <td>${o.customerName}</td>
            <td>${o.amount}</td>
            <td>${o.status}</td>
          </tr>
        `);
      });

      win.document.write("</table>");
      win.document.close();
      win.print();

      message.success("PDF ready for printing");
    } catch {
      message.error("Failed to export PDF");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Reports</h2>

      <Card style={{ marginTop: 12 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <Button onClick={exportCSV} loading={loading}>
            Export CSV
          </Button>

          <Button onClick={exportPDF} loading={loading}>
            Export PDF
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default Reports;