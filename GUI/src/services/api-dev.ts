import axios, { AxiosError } from 'axios';

import { redirectToLoginIfUnauthorized } from './handle-unauthorized';

const instance = axios.create({
  baseURL: import.meta.env.REACT_APP_RUUTER_API_URL,
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
    // Add switch case to handle specific error codes
    if ((error.response?.status ?? 0) > 400 && (error.response?.status ?? 0) < 599) {
      console.log('Teenusele puudub ligipääs. Proovi hiljem uuesti.');
    }
    return Promise.reject(error);
  },
);

export default instance;
