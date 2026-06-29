import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, Form, Input, Button, message } from "antd";
import client from "../api/client";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (vals: { phone: string; password: string }) => {
    try {
      setLoading(true);

      const { data } = await client.post("/auth/login", {
        phone: vals.phone,
        password: vals.password,
      });

      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      localStorage.setItem("user", JSON.stringify(data.user));

      message.success("Login successful");

      const role = data.user?.role;
      if (role === "DISPATCHER") {
        navigate("/orders");
      } else {
        navigate("/dashboard");
      }
    } catch (err: any) {
      message.error(
        err?.response?.data?.error || err.message || "Login failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        alignItems: "center",
        justifyContent: "center",
        background: "#f6f7fb",
      }}
    >
      <Card style={{ width: 420, borderRadius: 12 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 10,
          }}
        >
          <img src="/src/assets/logo.svg" alt="logo" style={{ width: 48 }} />
          <div>
            <div style={{ fontWeight: 800 }}>EASYBOX</div>
            <div style={{ color: "#888", fontSize: 12 }}>
              Dispatch & Operations
            </div>
          </div>
        </div>

        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item
            label="Phone"
            name="phone"
            rules={[{ required: true, message: "Phone is required" }]}
          >
            <Input placeholder="0700000000" />
          </Form.Item>

          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, message: "Password is required" }]}
          >
            <Input.Password />
          </Form.Item>

          <Form.Item>
            <Button type="primary" block htmlType="submit" loading={loading}>
              Login
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
