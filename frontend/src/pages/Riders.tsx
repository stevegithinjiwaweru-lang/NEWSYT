import React, { useState } from "react";
import {
  Card,
  List,
  Avatar,
  Button,
  Modal,
  Form,
  Input,
  Tag,
  message,
  Spin,
} from "antd";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import client from "../api/client";

interface Rider {
  id: string;
  name: string;
  phone: string;
  bikeReg?: string;
  status: string;
}

const fetchRiders = async () => {
  const response = await client.get("/riders");
  return response.data;
};

const Riders: React.FC = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ["riders"],
    queryFn: fetchRiders,
  });

  const riders: Rider[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.riders)
    ? data.riders
    : Array.isArray(data?.data)
    ? data.data
    : [];

  // CREATE RIDER
  const addRider = async (vals: any) => {
    try {
      setLoading(true);

      const res = await client.post("/riders", {
        name: vals.name,
        phone: vals.phone,
        bikeReg: vals.bikeReg,
      });

      const { rider, tempPassword } = res.data;

      message.success("Rider created");
      form.resetFields();
      setOpen(false);

      queryClient.invalidateQueries({ queryKey: ["riders"] });

      if (tempPassword) {
        Modal.info({
          title: "Rider account created",
          content: (
            <div>
              <p>
                The rider account was created with the following credentials:
              </p>
              <p>
                <strong>Phone:</strong> {rider.phone}
              </p>
              <p>
                <strong>Temporary password:</strong> {tempPassword}
              </p>
              <p>Please ask the rider to change the password after first login.</p>
            </div>
          ),
        });
      }
    } catch (err: any) {
      message.error(err?.response?.data?.error || "Failed to create rider");
    } finally {
      setLoading(false);
    }
  };

  // DELETE RIDER
  const removeRider = async (id: string) => {
    try {
      await client.delete(`/riders/${id}`);
      message.success("Rider removed");
      queryClient.invalidateQueries({ queryKey: ["riders"] });
    } catch (err: any) {
      message.error(err?.response?.data?.error || "Failed to delete rider");
    }
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <h2>Riders</h2>

        <Button type="primary" onClick={() => setOpen(true)}>
          Add Rider
        </Button>
      </div>

      <Card>
        {isLoading ? (
          <Spin />
        ) : (
          <List
            dataSource={riders}
            renderItem={(r: Rider) => (
              <List.Item
                actions={[
                  <Button
                    danger
                    onClick={() => removeRider(r.id)}
                  >
                    Remove
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={<Avatar>{r.name?.[0]}</Avatar>}
                  title={r.name}
                  description={
                    <div>
                      {r.phone}

                      <div style={{ marginTop: 6 }}>
                        <Tag
                          color={r.status === "AVAILABLE" ? "green" : "orange"}
                        >
                          {r.status}
                        </Tag>
                      </div>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      <Modal
        title="Add Rider"
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={addRider}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}> 
            <Input />
          </Form.Item>

          <Form.Item name="phone" label="Phone" rules={[{ required: true }]}> 
            <Input />
          </Form.Item>

          <Form.Item name="bikeReg" label="Bike Registration"> 
            <Input />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={loading} block>
            Create Rider
          </Button>
        </Form>
      </Modal>
    </div>
  );
};

export default Riders;