import clsx from 'clsx';
import React, { ButtonHTMLAttributes, forwardRef, PropsWithChildren } from 'react';

import './Button.scss';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  appearance?: 'primary' | 'secondary' | 'outline' | 'text' | 'icon' | 'error' | 'success' | 'loading';
  size?: 'm' | 's';
  className?: string;
};

const Button = forwardRef<HTMLButtonElement, PropsWithChildren<ButtonProps>>(
  ({ appearance = 'primary', size = 'm', disabled, children, className, ...rest }, ref) => {
    const buttonClasses = clsx('btn', `btn--${appearance}`, `btn--${size}`, disabled && 'btn--disabled', className);
    const isDisabled: boolean = disabled || appearance === 'loading';
    return (
      <button className={buttonClasses} ref={ref} disabled={isDisabled} {...rest}>
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';

export default Button;
