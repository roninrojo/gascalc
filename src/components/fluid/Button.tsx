import type { ComponentPropsWithoutRef, ReactNode } from 'react';

type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'default' | 'icon';
  leadingIcon?: ReactNode;
  label?: string;
};

export function Button({
  variant = 'secondary',
  size = 'default',
  type = 'button',
  className = '',
  leadingIcon,
  label,
  children,
  ...props
}: ButtonProps) {
  return <button type={type} className={`fluid-button ${className}`} data-variant={variant} data-size={size} {...props}>
    <span className="fluid-button-content">
      {leadingIcon}
      {label && <span className="fluid-button-label">
        <span aria-hidden="true">{label}</span>
        <span>{label}</span>
      </span>}
      {children}
    </span>
  </button>;
}
