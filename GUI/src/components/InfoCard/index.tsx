import * as RadixPopover from '@radix-ui/react-popover';
import clsx from 'clsx';
import { FC, PointerEvent, PropsWithChildren, ReactElement, ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AiOutlineInfoCircle } from 'react-icons/ai';
import { MdContentCopy, MdOutlineWarningAmber } from 'react-icons/md';
import useToastStore from 'store/toasts.store';

import './InfoCard.scss';

const OPEN_DELAY_MS = 150;
const CLOSE_DELAY_MS = 200;

type InfoCardProps = {
  readonly title: ReactNode;
  readonly content: ReactNode;
  readonly children: ReactElement;
  readonly variant?: 'info' | 'danger';
  readonly size?: 'default' | 'compact';
};

const InfoCard: FC<InfoCardProps> = ({ title, content, children, variant = 'info', size = 'default' }) => {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const closedByHover = useRef(false);

  const schedule = (nextOpen: boolean) => (event: PointerEvent) => {
    if (event.pointerType === 'touch') return;
    clearTimeout(timer.current);
    timer.current = setTimeout(
      () => {
        closedByHover.current = !nextOpen;
        setOpen(nextOpen);
      },
      nextOpen ? OPEN_DELAY_MS : CLOSE_DELAY_MS,
    );
  };

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <RadixPopover.Root open={open} onOpenChange={setOpen}>
      <RadixPopover.Trigger asChild onPointerEnter={schedule(true)} onPointerLeave={schedule(false)}>
        {children}
      </RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          className={clsx('info-card', `info-card--${variant}`, `info-card--${size}`)}
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={16}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => {
            if (closedByHover.current) event.preventDefault();
            closedByHover.current = false;
          }}
          onPointerEnter={schedule(true)}
          onPointerLeave={schedule(false)}
        >
          <div className="info-card__header">
            {variant === 'danger' ? (
              <MdOutlineWarningAmber className="info-card__header-icon" />
            ) : (
              <AiOutlineInfoCircle className="info-card__header-icon" />
            )}
            <span>{title}</span>
          </div>
          <div className="info-card__body">{content}</div>
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
};

type InfoCardSectionProps = {
  readonly label?: ReactNode;
};

export const InfoCardSection: FC<PropsWithChildren<InfoCardSectionProps>> = ({ label, children }) => (
  <section className="info-card__section">
    {label && <h4 className="info-card__label">{label}</h4>}
    {children}
  </section>
);

type InfoCardCopyRowProps = {
  readonly value: string;
};

export const InfoCardCopyRow: FC<InfoCardCopyRowProps> = ({ value }) => {
  const { t } = useTranslation();

  if (!value.trim()) {
    return (
      <div className="info-card__row">
        <span className="info-card__value info-card__value--empty">{t('overview.serviceInfo.empty')}</span>
      </div>
    );
  }

  return (
    <div className="info-card__row">
      <span className="info-card__value">{value}</span>
      <button
        type="button"
        className="info-card__copy"
        aria-label={t('global.copy') ?? ''}
        onClick={() => {
          void navigator.clipboard.writeText(value);
          useToastStore.getState().success({ title: t('overview.copiedToClipboard') });
        }}
      >
        <MdContentCopy />
      </button>
    </div>
  );
};

export default InfoCard;
