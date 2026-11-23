import axios, { AxiosError } from 'axios';

import { redirectToLoginIfUnauthorized } from './handle-unauthorized';

const instance = axios.create({
  baseURL: import.meta.env.REACT_APP_AUTH_BASE_URL,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  },
  withCredentials: true,
});

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
