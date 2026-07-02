import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAuthActions } from '../auth';
import { User } from '@phosphor-icons/react';
import { useLocalizedNavigate } from '../i18n/locale';
import './AccountIcon.css';

export const AccountIcon = ({ compact = false }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
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
    // Navigate to profile or open account profile
    closeDropdown();
    // You can implement profile page navigation here
    console.log('Navigate to profile');
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
  const updateDropdownPosition = () => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const menuWidth = dropdownRef.current?.offsetWidth || 260; // fallback to min width + padding
    const gutter = 12; // small padding from viewport edges

    const left = Math.min(Math.max(rect.left, gutter), viewportWidth - menuWidth - gutter);
    const top = rect.bottom + 8;

    setDropdownPosition({ top, left });
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        closeDropdown();
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
  }, [isDropdownOpen]);

  // compact: render minimal markup for mobile menu so it looks like other links
  if (compact) {
    return (
      <div className="account-button compact relative" style={{ width: '100%' }}>
        <button
          ref={buttonRef}
          onClick={toggleDropdown}
          className="account-label text-left"
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
          ReactDOM.createPortal(
            <>
              <div
                className="account-dropdown-backdrop"
                onClick={closeDropdown}
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 999,
                  background: 'transparent',
                }}
              />
              <div ref={dropdownRef} className="account-dropdown-menu mobile">
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
              </div>
            </>,
            document.body
          )}
      </div>
    );
  }

  return (
    <div className="account-button inline-flex items-center justify-end gap-6 relative">
      <button
        ref={buttonRef}
        onClick={toggleDropdown}
        className="inline-flex items-center gap-2 relative flex-[0_0_auto] bg-transparent border-0 cursor-pointer p-0"
      >
        <div
          className="flex items-center justify-center account-icon"
          style={{ width: 32, height: 32 }}
        >
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
        ReactDOM.createPortal(
          <>
            <div
              className="account-dropdown-backdrop"
              onClick={closeDropdown}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 999,
                background: 'transparent',
              }}
            />
            <div
              ref={dropdownRef}
              className="account-dropdown-menu desktop"
              style={{
                position: 'fixed',
                top: `${dropdownPosition.top}px`,
                left: `${dropdownPosition.left}px`,
              }}
            >
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
            </div>
          </>,
          document.body
        )}
    </div>
  );
};

export default AccountIcon;
