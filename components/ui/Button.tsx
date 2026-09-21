import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './Button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'outline';
export type ButtonSize = 'small' | 'medium' | 'large';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

// No 'use client': the component has no state, so a Server Component can
// render it too (only a Client Component can pass it an onClick).
export function Button({
  children,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  onClick,
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  const buttonClasses = [
    'button',
    `button--${variant}`,
    `button--${size}`,
    disabled && 'button--disabled',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={buttonClasses} onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  );
}

export default Button;
