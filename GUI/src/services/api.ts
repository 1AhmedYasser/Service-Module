import axios, { AxiosError, AxiosRequestConfig } from 'axios';

import { redirectToLoginIfUnauthorized } from './handle-unauthorized';

const defaultConfig = {
  baseURL: import.meta.env.REACT_APP_BASE_API_PATH,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  },
  withCredentials: true,
};

const instance = axios.create(defaultConfig);

export const createApiInstance = (additionalHeaders?: Record<string, string>) => {
  const config: AxiosRequestConfig = {
    ...defaultConfig,
    headers: {
      ...defaultConfig.headers,
      ...additionalHeaders,
    },
  };

  return axios.create(config);
};

instance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError) => {
    redirectToLoginIfUnauthorized(error);
    return Promise.reject(new Error(error.message));
  },
);

export default instance;
