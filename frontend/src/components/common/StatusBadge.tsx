import React from 'react';
import { Tag } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined, CloseCircleOutlined, SendOutlined, PauseCircleOutlined } from '@ant-design/icons';
import { ORDER_STATUSES, PAYMENT_TYPES, MERCHANT_STATUSES, RIDER_STATUSES } from '../../utils/constants';

type StatusType = 'order' | 'payment' | 'merchant' | 'rider';

interface StatusBadgeProps {
  type: StatusType;
  status: string;
  size?: 'small' | 'default' | 'large';
}

const getStatusIcon = (type: StatusType, status: string) => {
  const iconProps = { style: { marginRight: '4px' } };
  
  if (type === 'order') {
    switch (status) {
      case 'DELIVERED':
        return <CheckCircleOutlined {...iconProps} />;
      case 'IN_TRANSIT':
        return <SendOutlined {...iconProps} />;
      case 'FAILED':
        return <CloseCircleOutlined {...iconProps} />;
      case 'ASSIGNED':
        return <ClockCircleOutlined {...iconProps} />;
      default:
        return null;
    }
  }
  
  if (type === 'rider') {
    switch (status) {
      case 'AVAILABLE':
        return <CheckCircleOutlined {...iconProps} />;
      case 'IN_DELIVERY':
        return <SendOutlined {...iconProps} />;
      case 'SUSPENDED':
        return <ExclamationCircleOutlined {...iconProps} />;
      case 'BUSY':
        return <PauseCircleOutlined {...iconProps} />;
      default:
        return null;
    }
  }
  
  return null;
};

const getStatusConfig = (type: StatusType, status: string) => {
  const configs: Record<StatusType, any> = {
    order: ORDER_STATUSES,
    payment: PAYMENT_TYPES,
    merchant: MERCHANT_STATUSES,
    rider: RIDER_STATUSES,
  };
  
  return configs[type][status] || { label: status, color: 'default' };
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ type, status, size = 'default' }) => {
  const config = getStatusConfig(type, status);
  const icon = getStatusIcon(type, status);
  
  const sizeStyles: Record<string, { fontSize: string }> = {
    small: { fontSize: '12px' },
    default: { fontSize: '13px' },
    large: { fontSize: '14px' },
  };
  
  return (
    <Tag color={config.color} style={sizeStyles[size]}>
      {icon}
      {config.label}
    </Tag>
  );
};

export default StatusBadge;
