import React from 'react';
import { Card, Statistic, Row, Col, Tooltip } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';

interface KPICardProps {
  title: string;
  value: number | string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon?: React.ReactNode;
  color?: string;
  loading?: boolean;
  onClick?: () => void;
  tooltip?: string;
}

const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  prefix,
  suffix,
  description,
  trend,
  trendValue,
  icon,
  color = '#FF6FA3',
  loading = false,
  onClick,
  tooltip,
}) => {
  const trendColor = trend === 'up' ? '#52c41a' : trend === 'down' ? '#f5222d' : '#8c8c8c';

  const content = (
    <Card
      hoverable={!!onClick}
      onClick={onClick}
      style={{
        borderLeft: `4px solid ${color}`,
        transition: 'all 0.3s ease',
        cursor: onClick ? 'pointer' : 'default',
      }}
      bodyStyle={{ padding: '20px' }}
    >
      <Row align="middle" justify="space-between" style={{ marginBottom: 12 }}>
        <Col>
          <div style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 500, textTransform: 'uppercase' }}>
            {title}
          </div>
        </Col>
        {icon && <Col style={{ fontSize: 24, color }}>{icon}</Col>}
      </Row>

      <Statistic
        value={value}
        prefix={prefix}
        suffix={suffix}
        loading={loading}
        valueStyle={{ color: '#262626', fontSize: '28px', fontWeight: 700 }}
      />

      {(description || trend) && (
        <div style={{ marginTop: 12 }}>
          {trend && trendValue && (
            <div style={{ color: trendColor, fontSize: 12, display: 'flex', alignItems: 'center', marginBottom: 4 }}>
              {trend === 'up' ? <ArrowUpOutlined style={{ marginRight: 4 }} /> : <ArrowDownOutlined style={{ marginRight: 4 }} />}
              <span>{trendValue}</span>
            </div>
          )}
          {description && <div style={{ fontSize: 12, color: '#8c8c8c' }}>{description}</div>}
        </div>
      )}
    </Card>
  );

  if (tooltip) {
    return <Tooltip title={tooltip}>{content}</Tooltip>;
  }

  return content;
};

export default KPICard;
