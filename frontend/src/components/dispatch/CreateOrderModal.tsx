import React from "react";
import { Modal, Form, Input, DatePicker, Button, message } from "antd";
import { createOrder } from "../../services/dispatch.service";
import { useQueryClient } from "@tanstack/react-query";

const CreateOrderModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [form] = Form.useForm();
  const qc = useQueryClient();

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        customerName: values.customerName,
        phone: values.phone,
        address: values.pickup,
        destination: values.destination,
        scheduledAt: values.scheduledAt ? values.scheduledAt.toISOString() : null,
        notes: values.notes,
        status: 'PENDING'
      };
      await createOrder(payload);
      message.success('Order created');
      qc.invalidateQueries(['dispatchOrders']);
      onClose();
      form.resetFields();
    } catch (err: any) {
      message.error(err?.message || 'Failed to create order');
    }
  };

  return (
    <Modal title="Create Order" open={open} onCancel={onClose} footer={null}>
      <Form form={form} layout="vertical">
        <Form.Item name="customerName" label="Customer Name" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="phone" label="Phone" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="pickup" label="Pickup Location" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="destination" label="Destination" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="scheduledAt" label="Scheduled Time">
          <DatePicker showTime />
        </Form.Item>
        <Form.Item name="notes" label="Notes">
          <Input.TextArea />
        </Form.Item>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" onClick={handleCreate}>Create</Button>
        </div>
      </Form>
    </Modal>
  );
};

export default CreateOrderModal;
