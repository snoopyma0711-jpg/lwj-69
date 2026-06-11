import axios from 'axios';
import { message } from 'antd';

const instance = axios.create({
  baseURL: '/api',
  timeout: 30000
});

instance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

instance.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      
      if (status === 401) {
        if (data.code === 'TOKEN_EXPIRED') {
          message.warning('登录已过期，请重新登录');
        } else {
          message.error(data.error || '未授权访问');
        }
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      } else if (status === 403) {
        message.error(data.error || '无权限执行此操作');
      } else if (status === 400 || status === 404 || status === 409) {
        message.error(data.error || '操作失败');
      } else if (status === 500) {
        message.error(data.error || '服务器错误');
      } else {
        message.error('网络请求失败');
      }
    } else if (error.request) {
      message.error('网络连接失败，请检查网络');
    } else {
      message.error('请求配置错误');
    }
    
    return Promise.reject(error);
  }
);

export default instance;
