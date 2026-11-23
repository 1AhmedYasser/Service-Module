import * as RadixDialog from '@radix-ui/react-dialog';
import React, { Children, FC, PropsWithChildren, ReactNode } from 'react';

import { Track } from '..';
import './Modal.scss';

type ModalProps = {
  title: string | null;
  description?: string;
  footer?: ReactNode;
  onClose: () => void;
  size?: 'default' | 'large';
};

const Modal: FC<PropsWithChildren<ModalProps>> = ({
  title,
  footer,
  onClose,
  children,
  description,
  size = 'default',
}) => {
  return (
    <RadixDialog.Root defaultOpen={true} onOpenChange={onClose}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="modal__overlay" />
        <RadixDialog.Content
          onClick={(e) => e.stopPropagation()}
          className={`modal${size === 'large' ? ' modal--large' : ''}`}
          aria-describedby={description ? 'modal-description' : undefined}
        >
          {title && (
            <div className="modal__header">
              <RadixDialog.Title className="h3 modal__title">{title}</RadixDialog.Title>
            </div>
          )}
          {Children.toArray(children).length > 0 && <div className="modal__body">{children}</div>}
          {footer && (
            <Track className="modal__footer" gap={16} justify="end">
              {footer}
            </Track>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};

export default Modal;
