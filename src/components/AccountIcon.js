import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useClerk } from '@clerk/clerk-react';
import { User } from '@phosphor-icons/react';
import './AccountIcon.css';

export const AccountIcon = ({ compact = false }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const navigate = useNavigate();
  const { signOut } = useClerk();

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const closeDropdown = () => {
    setIsDropdownOpen(false);
  };

  const handleProfile = () => {
    // Navigate to profile or open Clerk user profile
    closeDropdown();
    // You can implement profile page navigation here
    console.log('Navigate to profile');
  };

  const handleHistory = () => {
    closeDropdown();
    navigate('/history');
  };

  const handleSignOut = async () => {
    closeDropdown();
    await signOut();
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
          Account
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
                  <span>Profile</span>
                </button>
                <button className="account-dropdown-item" onClick={handleHistory}>
                  <span>Transcription History</span>
                </button>
                <div className="account-dropdown-divider" />
                <button className="account-dropdown-item" onClick={handleSignOut}>
                  <span>Sign out</span>
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
          Account
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
                top: buttonRef.current
                  ? buttonRef.current.getBoundingClientRect().bottom + 8
                  : '70px',
                right: '20px',
              }}
            >
              <button className="account-dropdown-item" onClick={handleProfile}>
                <span>Profile</span>
              </button>
              <button className="account-dropdown-item" onClick={handleHistory}>
                <span>Transcription History</span>
              </button>
              <div className="account-dropdown-divider" />
              <button className="account-dropdown-item" onClick={handleSignOut}>
                <span>Sign out</span>
              </button>
            </div>
          </>,
          document.body
        )}
    </div>
  );
};

export default AccountIcon;
