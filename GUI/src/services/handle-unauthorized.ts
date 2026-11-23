import { AxiosError } from 'axios';

import { LOGIN_LINK } from './api-conf';

export const redirectToLoginIfUnauthorized = (error: AxiosError) => {
  if (error.response?.status === 401 && LOGIN_LINK) {
    window.location.href = LOGIN_LINK;
  }
};
