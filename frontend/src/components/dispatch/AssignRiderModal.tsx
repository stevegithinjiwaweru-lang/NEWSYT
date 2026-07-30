import React, { useEffect, useMemo, useState } from "react";
import { Modal, List, Avatar, Button, Input, Tag, Space, Empty, message, Divider, Typography } from "antd";
import { UserOutlined } from "@ant-design/icons";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { fetchRiders, assignOrder, fetchPendingDispatchOrders } from "../../services/dispatch.service";
import { runInBatches } from "../../utils/batchApi";

const { Text } = Typography;

interface Props {
  open: boolean;
  orderId: string | null;
  selectedOrderIds?: string[];
  onClose: () => void;
  onAssigned?: (summary?: any) => void;
}

const ACTIVE_STATUSES = new Set(["ASSIGNED", "PICKED_UP", "IN_TRANSIT"]);
const MAX_CAPACITY = 4;

const AssignRiderModal: React.FC<Props> = ({ open, orderId, selectedOrderIds = [], onClose, onAssigned }) => {
  const queryClient = useQueryClient();
  const { data: ridersData } = useQuery({ queryKey: ["riders"], queryFn: fetchRiders });
  const { data: pendingOrdersData } = useQuery({ queryKey: ["recentOrdersForCapacity"], queryFn: async () => (await fetchPendingDispatchOrders({ limit: 100 })).items || [] });

  const riders = useMemo(() => (Array.isArray(ridersData) ? ridersData : ridersData?.items || []), [ridersData]);
  const recentOrders = useMemo(() => (Array.isArray(pendingOrdersData) ? pendingOrdersData : pendingOrdersData?.items || []), [pendingOrdersData]);

  const [query, setQuery] = useState("");
  const [selectedRider, setSelectedRider] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any | null>(null);

  useEffect(() => {
    if (!open) {
      setSelectedRider(null);
      setQuery("");
      setSummary(null);
    }
  }, [open]);

  // compute active orders per rider by fetching orders assigned to riders (best-effort; limited by API limits)
  const riderCapacity = useMemo(() => {
    const map = new Map<string, { active: number; remaining: number }>();
    for (const r of riders) map.set(r.id, { active: 0, remaining: MAX_CAPACITY });

    // recentOrders includes only recent pending orders; to compute active, we try to use orders fetched from cache - else active may be 0
    // For more accurate counts consider server-side aggregation endpoint in future
    for (const o of recentOrders) {
      const rid = o.rider?.id || o.riderId;
      if (!rid) continue;
      const s = o.status;
      if (ACTIVE_STATUSES.has(s)) {
        const prev = map.get(rid) || { active: 0, remaining: MAX_CAPACITY };
        prev.active += 1;
        prev.remaining = Math.max(0, MAX_CAPACITY - prev.active);
        map.set(rid, prev);
      }
    }

    // ensure riders without entries exist
    for (const r of riders) {
      if (!map.has(r.id)) map.set(r.id, { active: 0, remaining: MAX_CAPACITY });
    }

    return map;
  }, [riders, recentOrders]);

  const filteredRiders = useMemo(() => riders.filter((r: any) => (r.name || "").toLowerCase().includes(query.toLowerCase()) || (r.phone || "").includes(query)), [riders, query]);

  const handleAssignSingle = async () => {
    if (!selectedRider) return message.error("Select a rider");
    if (!orderId) return;
    const cap = riderCapacity.get(selectedRider.id)?.remaining ?? MAX_CAPACITY;
    if (cap <= 0) return message.error("Selected rider is at capacity");
    setLoading(true);
    try {
      await assignOrder(orderId, selectedRider.id);
      queryClient.invalidateQueries(["dispatchOrders"]);
      queryClient.invalidateQueries(["orders"]);
      onAssigned && onAssigned({ total: 1, success: 1, failed: 0 });
      onClose();
    } catch (err: any) {
      message.error(err?.response?.data?.error || err.message || "Failed to assign");
    } finally {
      setLoading(false);
    }
  };

  const handleAutoDistribute = async () => {
    if (!selectedOrderIds || selectedOrderIds.length === 0) return message.error("No orders selected");
    setLoading(true);
    try {
      // Build list of riders with remaining capacity
      const capacities: Array<{ riderId: string; remaining: number; rider: any }> = [];
      for (const r of filteredRiders) {
        const cap = riderCapacity.get(r.id)?.remaining ?? MAX_CAPACITY;
        if (cap > 0) capacities.push({ riderId: r.id, remaining: cap, rider: r });
      }
      // sort by remaining descending to fill largest capacity first
      capacities.sort((a, b) => b.remaining - a.remaining);

      const assignments: Array<{ orderId: string; riderId: string }> = [];
      let orderIdx = 0;
      for (const c of capacities) {
        for (let i = 0; i < c.remaining && orderIdx < selectedOrderIds.length; i++) {
          assignments.push({ orderId: selectedOrderIds[orderIdx], riderId: c.riderId });
          orderIdx += 1;
        }
        if (orderIdx >= selectedOrderIds.length) break;
      }

      const remainingPending = selectedOrderIds.length - assignments.length;

      // execute assignments in batches
      const results = await runInBatches(assignments, async (a) => {
        try {
          await assignOrder(a.orderId, a.riderId);
          return { orderId: a.orderId, riderId: a.riderId, success: true };
        } catch (err: any) {
          return { orderId: a.orderId, riderId: a.riderId, success: false, reason: err?.response?.data?.error || err.message };
        }
      }, 6);

      const detailed = results.map((r) => (r.status === "fulfilled" ? r.value : (r.reason || { success: false })));
      const succeeded = detailed.filter((d: any) => d.success).length;
      const failed = detailed.filter((d: any) => !d.success).length;

      const ridersAtCapacity = capacities.filter((c) => c.remaining === 0 || c.remaining <= 0).map((c) => c.rider.name);

      const summaryObj = {
        totalSelected: selectedOrderIds.length,
        successfullyAssigned: succeeded,
        failedAssignments: failed,
        remainingPending,
        ridersAtCapacity,
        details: detailed,
      };

      setSummary(summaryObj);
      queryClient.invalidateQueries(["dispatchOrders"]);
      queryClient.invalidateQueries(["orders"]);
      onAssigned && onAssigned(summaryObj);
    } catch (err: any) {
      message.error(err?.message || "Auto-distribute failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={selectedOrderIds.length ? `Assign ${selectedOrderIds.length} orders` : orderId ? `Assign Rider` : "Assign Rider"} open={open} onCancel={onClose} footer={null} width={800}>
      <Input.Search placeholder="Search rider by name or phone" onSearch={(v) => setQuery(v)} onChange={(e) => setQuery(e.target.value)} style={{ marginBottom: 12 }} />

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1, maxHeight: 400, overflow: 'auto' }}>
          {filteredRiders.length ? (
            <List
              dataSource={filteredRiders}
              renderItem={(r: any) => {
                const cap = riderCapacity.get(r.id) || { active: 0, remaining: MAX_CAPACITY };
                return (
                  <List.Item actions={[
                    <Button type="link" onClick={() => setSelectedRider(r)} disabled={cap.remaining <= 0}>{cap.remaining <= 0 ? 'At capacity' : 'Select'}</Button>
                  ]}>
                    <List.Item.Meta avatar={<Avatar icon={<UserOutlined />} />} title={<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div>{r.name}</div><div><Text type={cap.remaining <= 0 ? 'danger' : cap.remaining <=1 ? 'warning' : 'secondary'}>{cap.active} / 4 Active Orders</Text></div></div>} description={<div>{r.phone} · <Text strong>Remaining: {cap.remaining}</Text></div>} />
                  </List.Item>
                );
              }}
            />
          ) : (
            <Empty description="No riders" />
          )}
        </div>

        <div style={{ width: 320 }}>
          <Card title="Selected">
            <div style={{ marginBottom: 12 }}><strong>Rider:</strong> {selectedRider ? selectedRider.name : '—'}</div>
            <div style={{ marginBottom: 12 }}><strong>Orders:</strong> {selectedOrderIds.length || (orderId ? 1 : 0)}</div>
            <Space style={{ marginTop: 12 }} direction="vertical">
              {orderId ? <Button type="primary" loading={loading} onClick={handleAssignSingle}>Assign</Button> : <Button type="primary" loading={loading} onClick={handleAutoDistribute}>Auto-distribute</Button>}
              <Button onClick={onClose}>Cancel</Button>
            </Space>
          </Card>

          {summary && (
            <Card title="Assignment Summary" style={{ marginTop: 12 }}>
              <div>Total Selected: {summary.totalSelected}</div>
              <div>Successfully Assigned: {summary.successfullyAssigned}</div>
              <div>Failed Assignments: {summary.failedAssignments}</div>
              <div>Remaining Pending: {summary.remainingPending}</div>
              <div>Riders at Capacity: {summary.ridersAtCapacity.join(', ') || 'None'}</div>
            </Card>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default AssignRiderModal;
