import React from 'react'
import { ConfigProvider, theme } from 'antd'

// Pink primary token
const antdTheme = {
  token: {
    colorPrimary: '#FF6FA3',
    borderRadius: 12,
    colorBgLayout: '#f6f7fb',
    colorBgContainer: '#ffffff'
  },
  algorithm: theme.defaultAlgorithm
}

export const AntdThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ConfigProvider theme={antdTheme}>
      {children}
    </ConfigProvider>
  )
}