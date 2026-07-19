import React from 'react';
import { Skeleton, Space, Card } from 'antd';

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({ rows = 5, columns = 6 }) => {
  return (
    <div style={{ padding: '16px' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ marginBottom: '16px' }}>
          <Skeleton active paragraph={{ rows: 1 }} />
        </div>
      ))}
    </div>
  );
};

export const CardSkeleton: React.FC = () => (
  <Card>
    <Skeleton active paragraph={{ rows: 3 }} />
  </Card>
);

export const KPISkeleton: React.FC = () => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
    {Array.from({ length: 4 }).map((_, i) => (
      <Card key={i}>
        <Skeleton active paragraph={{ rows: 2 }} />
      </Card>
    ))}
  </div>
);

export const FormSkeleton: React.FC = () => (
  <Space direction="vertical" style={{ width: '100%' }}>
    <Skeleton active paragraph={{ rows: 1 }} />
    <Skeleton active paragraph={{ rows: 1 }} />
    <Skeleton active paragraph={{ rows: 1 }} />
    <Skeleton active paragraph={{ rows: 2 }} />
  </Space>
);
