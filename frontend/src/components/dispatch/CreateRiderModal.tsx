import React from "react";
import { Modal, Form, Input, Select, Button, message } from "antd";
import { createRider } from "../../services/dispatch.service";
import { useQueryClient } from "@tanstack/react-query";

const { Option } = Select;

const CreateRiderModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [form] = Form.useForm();
  const qc = useQueryClient();

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        name: values.name,
        phone: values.phone,
        bikeReg: values.bikeReg,
        status: values.status || 'AVAILABLE',
      };
      await createRider(payload);
      message.success('Rider created');
      qc.invalidateQueries(['riders']);
      onClose();
      form.resetFields();
    } catch (err: any) {
      message.error(err?.message || 'Failed to create rider');
    }
  };

  return (
    <Modal title="Create Rider" open={open} onCancel={onClose} footer={null}>
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="Name" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="phone" label="Phone" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="bikeReg" label="Vehicle Registration">
          <Input />
        </Form.Item>
        <Form.Item name="status" label="Status">
          <Select>
            <Option value="AVAILABLE">Available</Option>
            <Option value="OFFLINE">Offline</Option>
          </Select>
        </Form.Item>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" onClick={handleCreate}>Create</Button>
        </div>
      </Form>
    </Modal>
  );
};

export default CreateRiderModal;
