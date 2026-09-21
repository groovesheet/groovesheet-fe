'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { User } from '@phosphor-icons/react';
import { useAuthActions } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import { useLocalizedNavigate } from '@/lib/navigation-client';
import './AccountIcon.css';

const BACKDROP_STYLE = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 999,
  background: 'transparent',
} as const;

export const AccountIcon = ({ compact = false }: { compact?: boolean }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const navigate = useLocalizedNavigate();
  const { signOut } = useAuthActions();
  const { t } = useTranslation();

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const closeDropdown = () => {
    setIsDropdownOpen(false);
  };

  const handleProfile = () => {
    closeDropdown();
    navigate('/account/profile');
  };

  const handleHistory = () => {
    closeDropdown();
    navigate('/account/history');
  };

  const handleBilling = () => {
    closeDropdown();
    navigate('/account/billing');
  };

  const handleSignOut = async () => {
    closeDropdown();
    await signOut();
  };

  // Compute dropdown position relative to the trigger and clamp within viewport
  const updateDropdownPosition = useCallback(() => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const menuWidth = dropdownRef.current?.offsetWidth || 260; // fallback to min width + padding
    const gutter = 12; // small padding from viewport edges

    const left = Math.min(Math.max(rect.left, gutter), viewportWidth - menuWidth - gutter);
    const top = rect.bottom + 8;

    setDropdownPosition({ top, left });
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Reposition dropdown on open and on resize/scroll to keep it attached to the trigger
  useEffect(() => {
    if (!isDropdownOpen) return undefined;

    updateDropdownPosition();

    const handleReposition = () => updateDropdownPosition();
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);

    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isDropdownOpen, updateDropdownPosition]);

  const menuItems = (
    <>
      <button className="account-dropdown-item" onClick={handleProfile}>
        <span>{t('nav.profile')}</span>
      </button>
      <button className="account-dropdown-item" onClick={handleHistory}>
        <span>{t('nav.history')}</span>
      </button>
      <button className="account-dropdown-item" onClick={handleBilling}>
        <span>{t('nav.billing')}</span>
      </button>
      <div className="account-dropdown-divider" />
      <button className="account-dropdown-item danger" onClick={handleSignOut}>
        <span>{t('nav.signOut')}</span>
      </button>
    </>
  );

  // compact: render minimal markup for mobile menu so it looks like other links
  if (compact) {
    return (
      <div className="account-button compact" style={{ width: '100%' }}>
        <button
          ref={buttonRef}
          onClick={toggleDropdown}
          className="account-label compact-label"
          style={{
            fontFamily: "'Hubot_Sans-Regular',Helvetica",
            color: '#cfd3d6',
            fontSize: 'inherit',
            lineHeight: 'inherit',
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            width: '100%',
            textAlign: 'left',
          }}
        >
          {t('nav.account')}
        </button>

        {isDropdownOpen &&
          createPortal(
            <>
              <div className="account-dropdown-backdrop" onClick={closeDropdown} style={BACKDROP_STYLE} />
              <div ref={dropdownRef} className="account-dropdown-menu mobile">
                {menuItems}
              </div>
            </>,
            document.body
          )}
      </div>
    );
  }

  return (
    <div className="account-button desktop-layout">
      <button ref={buttonRef} onClick={toggleDropdown} className="account-trigger">
        <div className="account-icon-box account-icon" style={{ width: 32, height: 32 }}>
          <User size={28} weight="regular" style={{ color: 'var(--color-muted-foreground)' }} />
        </div>

        <div
          className="account-label"
          style={{ fontFamily: "'Hubot_Sans-Regular',Helvetica", transform: 'translateY(1px)' }}
        >
          {t('nav.account')}
        </div>
      </button>

      {isDropdownOpen &&
        createPortal(
          <>
            <div className="account-dropdown-backdrop" onClick={closeDropdown} style={BACKDROP_STYLE} />
            <div
              ref={dropdownRef}
              className="account-dropdown-menu desktop"
              style={{
                position: 'fixed',
                top: `${dropdownPosition.top}px`,
                left: `${dropdownPosition.left}px`,
              }}
            >
              {menuItems}
            </div>
          </>,
          document.body
        )}
    </div>
  );
};

export default AccountIcon;
