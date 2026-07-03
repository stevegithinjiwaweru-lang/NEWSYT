import React, { useState } from "react";

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
      const resp = await fetch("/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await resp.json();
      if (!resp.ok) {
        setMessage("Create failed: " + (json.error || json.message));
      } else {
        setMessage("Order created: " + json.order.id);
      }
    } catch (e) {
      console.error(e);
      setMessage("Network error");
    }
  };

  const uploadCsv = async () => {
    if (!file) return setMessage("Select a CSV file first");

    const fd = new FormData();
    fd.append("file", file);
    if (merchantName) fd.append("merchantName", merchantName);

    try {
      const resp = await fetch("/orders/upload-csv", {
        method: "POST",
        body: fd,
      });
      const json = await resp.json();
      if (!resp.ok) {
        setMessage("Upload failed: " + (json.error || json.message));
      } else {
        setMessage(`Upload success: vendor=${json.vendor} imported=${json.imported}`);
      }
    } catch (e) {
      console.error(e);
      setMessage("Network error during upload");
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
