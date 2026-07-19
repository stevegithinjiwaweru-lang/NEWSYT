import React from 'react';
import { Table, TableProps, Empty, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { TableSkeleton } from './LoadingSkeletons';

interface DataTableProps<T> extends TableProps<T> {
  loading?: boolean;
  isEmpty?: boolean;
  onRefresh?: () => void;
  emptyText?: string;
}

const DataTable = React.forwardRef<any, DataTableProps<any>>((
  { loading = false, isEmpty = false, onRefresh, emptyText = 'No data available', ...props },
  ref
) => {
  if (loading) {
    return <TableSkeleton rows={5} />;
  }

  if (isEmpty) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Empty description={emptyText} />
        {onRefresh && (
          <Button type="primary" icon={<ReloadOutlined />} onClick={onRefresh} style={{ marginTop: 16 }}>
            Refresh
          </Button>
        )}
      </div>
    );
  }

  return (
    <Table
      ref={ref}
      {...props}
      pagination={{
        position: ['bottomRight'],
        showSizeChanger: true,
        showQuickJumper: true,
        showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
        pageSizeOptions: ['10', '20', '50', '100'],
        defaultPageSize: 20,
        ...props.pagination,
      }}
      style={{ fontSize: '13px' }}
      rowHoverable
    />
  );
});

DataTable.displayName = 'DataTable';

export default DataTable;
