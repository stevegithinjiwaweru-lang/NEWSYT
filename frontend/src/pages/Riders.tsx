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
import { useQuery } from "@tanstack/react-query";
import client from "../api/client";

const fetchRiders = async () => (await client.get("/riders")).data;

const Riders: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const {
    data,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["riders"],
    queryFn: fetchRiders,
  });

  const riders = data?.riders || [];

  // CREATE RIDER
  const addRider = async (vals: any) => {
    try {
      setLoading(true);

      await client.post("/riders", {
        name: vals.name,
        phone: vals.phone,
        bikeReg: vals.bikeReg,
      });

      message.success("Rider created");
      form.resetFields();
      setOpen(false);
      refetch();
    } catch (err: any) {
      message.error(
        err?.response?.data?.error || "Failed to create rider"
      );
    } finally {
      setLoading(false);
    }
  };

  // DELETE RIDER
  const removeRider = async (id: string) => {
    try {
      await client.delete(`/riders/${id}`);
      message.success("Rider removed");
      refetch();
    } catch {
      message.error("Failed to delete rider");
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
            renderItem={(r: any) => (
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
                          color={
                            r.status === "AVAILABLE"
                              ? "green"
                              : "orange"
                          }
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
        <Form
          form={form}
          layout="vertical"
          onFinish={addRider}
        >
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="phone"
            label="Phone"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="bikeReg"
            label="Bike Registration"
          >
            <Input />
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            block
          >
            Create Rider
          </Button>
        </Form>
      </Modal>
    </div>
  );
};

export default Riders;