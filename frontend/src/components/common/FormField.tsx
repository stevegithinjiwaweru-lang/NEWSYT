import React from 'react';
import { Form, Input, Select, DatePicker, InputNumber } from 'antd';
import { EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';

interface FormFieldProps {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'textarea' | 'select' | 'date' | 'phone';
  placeholder?: string;
  required?: boolean;
  rules?: any[];
  options?: Array<{ label: string; value: any }>;
  maxLength?: number;
  rows?: number;
  disabled?: boolean;
  help?: string;
}

const FormField: React.FC<FormFieldProps> = ({
  name,
  label,
  type = 'text',
  placeholder,
  required = false,
  rules = [],
  options = [],
  maxLength,
  rows = 4,
  disabled = false,
  help,
}) => {
  const finalRules = required ? [{ required: true, message: `${label} is required` }, ...rules] : rules;

  let input: React.ReactNode;

  switch (type) {
    case 'email':
      input = <Input type="email" placeholder={placeholder} disabled={disabled} maxLength={maxLength} />;
      break;
    case 'password':
      input = <Input.Password placeholder={placeholder} disabled={disabled} iconRender={(visible) => (visible ? <EyeOutlined /> : <EyeInvisibleOutlined />)} />;
      break;
    case 'number':
      input = <InputNumber style={{ width: '100%' }} placeholder={placeholder} disabled={disabled} />;
      break;
    case 'textarea':
      input = <Input.TextArea placeholder={placeholder} rows={rows} disabled={disabled} maxLength={maxLength} showCount />;
      break;
    case 'select':
      input = <Select placeholder={placeholder} options={options} disabled={disabled} />;
      break;
    case 'date':
      input = <DatePicker style={{ width: '100%' }} placeholder={placeholder} disabled={disabled} />;
      break;
    case 'phone':
      input = <Input placeholder={placeholder} disabled={disabled} maxLength={maxLength} prefix="+" />;
      break;
    default:
      input = <Input placeholder={placeholder} disabled={disabled} maxLength={maxLength} />;
  }

  return (
    <Form.Item name={name} label={label} rules={finalRules} help={help}>
      {input}
    </Form.Item>
  );
};

export default FormField;
