import React from 'react';
import { Result, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  status?: '404' | '500' | 'error' | 'info' | 'success' | 'warning';
}

const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'An error occurred while loading this page.',
  onRetry,
  status = 'error',
}) => {
  return (
    <Result
      status={status}
      title={<h2>{title}</h2>}
      subTitle={<p>{message}</p>}
      extra={
        onRetry && (
          <Button type="primary" icon={<ReloadOutlined />} onClick={onRetry}>
            Try Again
          </Button>
        )
      }
      style={{ marginTop: 48, marginBottom: 48 }}
    />
  );
};

export default ErrorState;
