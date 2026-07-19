import React from 'react';
import { Empty, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  image?: 'default' | 'simple';
}

const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No Data',
  description = 'No records found',
  action,
  image = 'default',
}) => {
  return (
    <Empty
      image={image === 'simple' ? Empty.PRESENTED_IMAGE_SIMPLE : Empty.PRESENTED_IMAGE_DEFAULT}
      style={{ marginTop: 48, marginBottom: 48 }}
      description={
        <div>
          <h3 style={{ marginBottom: 8 }}>{title}</h3>
          <p style={{ color: '#8c8c8c' }}>{description}</p>
        </div>
      }
    >
      {action && (
        <Button type="primary" icon={action.icon || <PlusOutlined />} onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </Empty>
  );
};

export default EmptyState;
