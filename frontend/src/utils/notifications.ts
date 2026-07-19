import { notification } from 'antd';
import { CheckCircleOutlined, ExclamationCircleOutlined, InfoCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';

export type NotificationType = 'success' | 'info' | 'warning' | 'error';

interface NotificationOptions {
  message: string;
  description?: string;
  duration?: number;
}

const defaultDuration = 3;

export const notify = {
  success: (options: NotificationOptions) => {
    notification.success({
      message: options.message,
      description: options.description,
      duration: options.duration ?? defaultDuration,
      icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
    });
  },

  error: (options: NotificationOptions) => {
    notification.error({
      message: options.message,
      description: options.description,
      duration: options.duration ?? defaultDuration,
      icon: <CloseCircleOutlined style={{ color: '#f5222d' }} />,
    });
  },

  warning: (options: NotificationOptions) => {
    notification.warning({
      message: options.message,
      description: options.description,
      duration: options.duration ?? defaultDuration,
      icon: <ExclamationCircleOutlined style={{ color: '#faad14' }} />,
    });
  },

  info: (options: NotificationOptions) => {
    notification.info({
      message: options.message,
      description: options.description,
      duration: options.duration ?? defaultDuration,
      icon: <InfoCircleOutlined style={{ color: '#1890ff' }} />,
    });
  },
};

export default notify;
