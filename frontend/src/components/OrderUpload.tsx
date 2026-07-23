import React, { useState } from "react";
import client from "../api/client";

export default function OrderUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [merchantName, setMerchantName] = useState<string>("");
  const [message, setMessage] = useState<string>("");

  const createManualOrder = async () => {
    // Replace with a modal/form for real input; this is a simple example
    const payload = {
      merchantName,
      customerName: `Manual Customer ${Date.now()}`,
      phone: "0700000000",
      address: "Somewhere",
      amount: 100,
    };
    try {
      const { data } = await client.post("/orders", payload);
      setMessage("Order created: " + data.order.id);
    } catch (e: any) {
      console.error(e);
      setMessage(
        "Create failed: " + (e?.response?.data?.error || e?.message || "Network error")
      );
    }
  };

  const uploadCsv = async () => {
    if (!file) return setMessage("Select a CSV file first");

    const fd = new FormData();
    fd.append("file", file);
    if (merchantName) fd.append("merchantName", merchantName);

    try {
      const { data } = await client.post("/orders/upload-csv", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessage(`Upload success: imported=${data.imported}`);
    } catch (e: any) {
      console.error(e);
      setMessage(
        "Upload failed: " + (e?.response?.data?.error || e?.message || "Network error")
      );
    }
  };

  return (
    <div>
      <h3>Manual Order & CSV Upload</h3>

      <div>
        <label>
          Merchant Name (e.g., Naivas or Carrefour):
          <input value={merchantName} onChange={(e) => setMerchantName(e.target.value)} />
        </label>
      </div>

      <button onClick={createManualOrder}>Create Order (manual)</button>

      <hr />

      <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <button onClick={uploadCsv}>Upload CSV (Naivas / Carrefour only)</button>

      {message && <p>{message}</p>}
    </div>
  );
}
