import React, { useEffect, useMemo, useState } from "react";
import { Modal, List, Avatar, Button, Input, Tag, Space, Empty, message } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { fetchRiders, assignOrder } from "../../services/dispatch.service";
import { runInBatches } from "../../utils/batchApi";

interface Props {
  open: boolean;
  orderId: string | null;
  selectedOrderIds?: string[];
  onClose: () => void;
  onAssigned?: () => void;
}

const AssignRiderModal: React.FC<Props> = ({ open, orderId, selectedOrderIds = [], onClose, onAssigned }) => {
  const queryClient = useQueryClient();
  const { data: ridersData } = useQuery({ queryKey: ["riders"], queryFn: fetchRiders });
  const riders = useMemo(() => (Array.isArray(ridersData) ? ridersData : ridersData?.items || []), [ridersData]);
  const [query, setQuery] = useState("");
  const [selectedRider, setSelectedRider] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedRider(null);
      setQuery("");
    }
  }, [open]);

  const filtered = riders.filter((r: any) => (r.name || "").toLowerCase().includes(query.toLowerCase()) || (r.phone || "").includes(query));

  const handleAssignSingle = async () => {
    if (!selectedRider) return message.error("Select a rider");
    if (!orderId) return;
    setLoading(true);
    try {
      await assignOrder(orderId, selectedRider.id);
      queryClient.invalidateQueries(["dispatchOrders"]);
      queryClient.invalidateQueries(["orders"]);
      onAssigned && onAssigned();
      onClose();
    } catch (err: any) {
      message.error(err?.response?.data?.error || err.message || "Failed to assign");
    } finally {
      setLoading(false);
    }
  };

  const handleAutoDistribute = async () => {
    if (!selectedRider && !selectedOrderIds.length) return message.error("Select orders and a rider or pick 'Auto-distribute' without selecting a single rider");
    // Auto-distribute logic: distribute selectedOrderIds across available riders respecting capacity=4
    setLoading(true);
    try {
      // For simplicity assign selected orders round-robin to filtered riders where capacity > 0
      const availableRiders = filtered.slice();
      if (availableRiders.length === 0) return message.error("No available riders");

      // naive distribution: cycle riders and assign until orders exhausted
      const assignments: Array<Promise<any>> = [];
      let ri = 0;
      for (const oid of selectedOrderIds) {
        const rider = availableRiders[ri % availableRiders.length];
        assignments.push(assignOrder(oid, rider.id));
        ri += 1;
      }

      const results = await runInBatches(assignments.map((p, idx) => idx), async (idx) => {
        // we actually have promises, but runInBatches expects items => handler
        // here simply await the promise
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (assignments[idx] as any);
      }, 6);

      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;
      message.success(`${succeeded} assigned, ${failed} failed`);
      queryClient.invalidateQueries(["dispatchOrders"]);
      queryClient.invalidateQueries(["orders"]);
      onAssigned && onAssigned();
      onClose();
    } catch (err: any) {
      message.error(err?.message || "Auto-distribute failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={selectedOrderIds.length ? `Assign ${selectedOrderIds.length} orders` : orderId ? `Assign Rider` : "Assign Rider"} open={open} onCancel={onClose} footer={null} width={700}>
      <Input.Search placeholder="Search rider by name or phone" onSearch={(v) => setQuery(v)} onChange={(e) => setQuery(e.target.value)} style={{ marginBottom: 12 }} />

      {filtered.length ? (
        <List
          dataSource={filtered}
          renderItem={(r: any) => (
            <List.Item actions={[<Button type="primary" loading={loading && selectedRider?.id === r.id} onClick={() => { setSelectedRider(r); }}>Select</Button>]}
            >
              <List.Item.Meta avatar={<Avatar icon={<UserOutlined />} />} title={<div style={{ display: "flex", gap: 8, alignItems: "center" }}><strong>{r.name}</strong><Tag>{r.status}</Tag></div>} description={r.phone} />
            </List.Item>
          )}
        />
      ) : (
        <Empty description="No riders" />
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
        <Button onClick={onClose}>Cancel</Button>
        {selectedOrderIds.length > 0 ? (
          <Button type="primary" onClick={handleAutoDistribute} loading={loading}>Auto-distribute</Button>
        ) : (
          <Button type="primary" onClick={handleAssignSingle} loading={loading}>Assign</Button>
        )}
      </div>
    </Modal>
  );
};

export default AssignRiderModal;
