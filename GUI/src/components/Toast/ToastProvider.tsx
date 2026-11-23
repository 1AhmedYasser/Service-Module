import * as RadixToast from '@radix-ui/react-toast';
import { FC, PropsWithChildren, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useToastStore from 'store/toasts.store';

import { POPUP_DURATION } from '../../constants/consts';

import Toast from './index';

const TOAST_GAP = 8;

export const ToastProvider: FC<PropsWithChildren> = ({ children }) => {
  const { t } = useTranslation();
  const toasts = useToastStore((state) => state.toasts);
  const listRef = useRef<HTMLOListElement>(null);
  const [expanded, setExpanded] = useState(false);

  const layoutToasts = useCallback(() => {
    const list = listRef.current;
    if (!list) return;

    const items = Array.from(list.querySelectorAll<HTMLElement>(':scope > .toast'));
    if (items.length === 0) {
      setExpanded(false);
      return;
    }

    if (!expanded) return;

    let offset = 0;
    for (let i = items.length - 1; i >= 0; i--) {
      items[i].style.setProperty('--toast-offset', `${offset}px`);
      offset += items[i].offsetHeight + TOAST_GAP;
    }
    list.style.setProperty('--toast-list-height', `${offset - TOAST_GAP}px`);
  }, [expanded]);

  useLayoutEffect(() => {
    layoutToasts();
  }, [layoutToasts, toasts]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const observer = new MutationObserver(layoutToasts);
    observer.observe(list, { childList: true });
    return () => observer.disconnect();
  }, [layoutToasts]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const expand = () => setExpanded(true);
    const collapse = () => setExpanded(false);
    list.addEventListener('mouseenter', expand);
    list.addEventListener('mouseleave', collapse);
    return () => {
      list.removeEventListener('mouseenter', expand);
      list.removeEventListener('mouseleave', collapse);
    };
  }, []);

  return (
    <RadixToast.Provider
      swipeDirection="right"
      label={t('global.notification') ?? 'Notification'}
      duration={POPUP_DURATION * 1000}
    >
      {children}
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
      <RadixToast.Viewport ref={listRef} className="toast__list" data-expanded={expanded} />
    </RadixToast.Provider>
  );
};
