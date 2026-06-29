import React from "react";
import { Card, Button, Tag, message, Spin } from "antd";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import client from "../api/client";

const fetchMerchants = async () => {
  const token = localStorage.getItem("accessToken");

  const { data } = await client.get("/merchants", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return data;
};

const Merchants: React.FC = () => {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["merchants"],
    queryFn: fetchMerchants,
  });

  const merchants = data?.merchants || [];

  const syncMerchant = async (id: string) => {
    const token = localStorage.getItem("accessToken");

    try {
      await client.post(
        `/merchants/${id}/sync`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      message.success("Merchant synced successfully");

      queryClient.invalidateQueries({ queryKey: ["merchants"] });
    } catch (err: any) {
      message.error(
        err?.response?.data?.error || "Sync failed"
      );
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", marginTop: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <h2>Merchants & Integrations</h2>

      <div style={{ marginTop: 12 }}>
        {merchants.length > 0 ? (
          merchants.map((m: any) => (
            <Card key={m.id} style={{ marginBottom: 12 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                {/* LEFT */}
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {m.name}
                  </div>

                  <div style={{ color: "#888", fontSize: 13 }}>
                    {m.connector} • Last sync:{" "}
                    {m.lastSyncAt
                      ? new Date(m.lastSyncAt).toLocaleString()
                      : "n/a"}
                  </div>
                </div>

                {/* RIGHT */}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <Tag
                    color={
                      m.status === "CONNECTED"
                        ? "green"
                        : "red"
                    }
                  >
                    {m.status}
                  </Tag>

                  <Button
                    type="primary"
                    onClick={() => syncMerchant(m.id)}
                  >
                    Sync
                  </Button>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <div>No merchants found</div>
        )}
      </div>
    </div>
  );
};

export default Merchants;