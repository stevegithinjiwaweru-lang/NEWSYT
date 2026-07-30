import React from "react";
import { Row, Col, Input, DatePicker, Select } from "antd";

const { RangePicker } = DatePicker;

const DispatchFilters: React.FC<{ filters: any; onChange: (patch: any) => void }> = ({ filters, onChange }) => {
  return (
    <div>
      <Row gutter={8}>
        <Col sm={24} md={8}>
          <Input placeholder="Search order number / customer / destination" defaultValue={filters.q} onChange={(e) => onChange({ q: e.target.value })} />
        </Col>
        <Col sm={12} md={8}>
          <Select allowClear placeholder="Merchant (Zucchini)" style={{ width: "100%" }} onChange={(v) => onChange({ merchantId: v })} />
        </Col>
        <Col sm={12} md={8}>
          <RangePicker style={{ width: "100%" }} onChange={(dates, dateStrings) => onChange({ from: dateStrings[0], to: dateStrings[1] })} />
        </Col>
      </Row>
    </div>
  );
};

export default DispatchFilters;
