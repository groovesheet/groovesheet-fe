import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import './LoginModal.css';
import {
  X,
  Check,
  GoogleLogo,
  FacebookLogo,
  AppleLogo,
  EnvelopeSimple,
  ArrowLeft,
} from '@phosphor-icons/react';
import { useSignIn, useSignUp, useAuthActions } from '../auth';

export const LoginModal = ({ isOpen, onClose }) => {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const { setActive } = useAuthActions();
  const { t } = useTranslation();
  const [showEmailSignIn, setShowEmailSignIn] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [isSignUp, setIsSignUp] = useState(false); // Track if this is a sign-up flow

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/',
      });
    } catch (err) {
      console.error('Error signing in with Google:', err);
    }
  };

  const handleFacebookSignIn = async () => {
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_facebook',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/',
      });
    } catch (err) {
      console.error('Error signing in with Facebook:', err);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_apple',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/',
      });
    } catch (err) {
      console.error('Error signing in with Apple:', err);
    }
  };

  const handleEmailSignIn = () => {
    setShowEmailSignIn(true);
  };

  const handleBack = () => {
    setShowEmailSignIn(false);
    setShowVerification(false);
  };

  const handleEmailConfirm = async () => {
    if (!email) {
      console.error('Email is required');
      alert('Please enter your email address');
      return;
    }

    // Immediately show the verification UI so the user can enter the code
    // while we do the sign-in / sign-up network work in the background.
    setIsSignUp(false);
    setShowVerification(true);

    // Focus the first code input after the verification view renders.
    // Use a short timeout to let React commit the DOM update.
    setTimeout(() => {
      const firstInput = document.getElementById('code-input-0');
      if (firstInput) firstInput.focus();
    }, 0);

    try {
      // First, try to sign in (for existing users)
      console.log('Attempting to sign in with email:', email);

      try {
        const signInResult = await signIn.create({
          identifier: email,
        });

        console.log('Sign-in result:', signInResult);

        // Send the email verification code for sign-in
        await signIn.prepareFirstFactor({
          strategy: 'email_code',
          emailAddressId: signInResult.supportedFirstFactors.find(
            (factor) => factor.strategy === 'email_code'
          )?.emailAddressId,
        });

        console.log('Sign-in verification code sent to:', email);
        return;
      } catch (signInError) {
        // If account doesn't exist (422 error), try sign-up instead
        if (
          signInError.status === 422 ||
          signInError.errors?.[0]?.code === 'form_identifier_not_found'
        ) {
          console.log('Account not found, switching to sign-up flow');

          // Create a new account with sign-up
          const signUpResult = await signUp.create({
            emailAddress: email,
          });

          console.log('Sign-up result:', signUpResult);

          // Send the email verification code for sign-up
          await signUp.prepareEmailAddressVerification({
            strategy: 'email_code',
          });

          console.log('Sign-up verification code sent to:', email);
          setIsSignUp(true);
          return;
        } else {
          // If it's a different error, throw it
          throw signInError;
        }
      }
    } catch (err) {
      console.error('Error during email confirmation:', err);
      console.error('Error details:', {
        message: err.message,
        status: err.status,
        authError: err.authError,
        errors: err.errors,
      });

      // Show user-friendly error message
      if (err.errors && err.errors.length > 0) {
        alert(`Error: ${err.errors[0].message}`);
      } else {
        alert(`Failed to send verification code: ${err.message}`);
      }
    }
  };

  const handleVerificationCodeChange = (index, value) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newCode = [...verificationCode];
      newCode[index] = value;
      setVerificationCode(newCode);

      // Auto-focus next input
      if (value && index < 5) {
        const nextInput = document.getElementById(`code-input-${index + 1}`);
        if (nextInput) nextInput.focus();
      }
    }
  };

  // Handle paste: distribute pasted digits across the inputs starting at startIndex
  const handlePasteVerification = (e, startIndex) => {
    e.preventDefault();
    const paste = (e.clipboardData || window.clipboardData).getData('Text') || '';
    const digits = paste.replace(/\D/g, '').split('');
    if (!digits.length) return;

    const newCode = [...verificationCode];
    for (let i = 0; i < digits.length && startIndex + i < 6; i++) {
      newCode[startIndex + i] = digits[i];
    }
    setVerificationCode(newCode);

    // Focus the next empty input if any, otherwise focus the last filled
    let focusIndex = Math.min(5, startIndex + digits.length - 1);
    for (let i = startIndex; i < 6; i++) {
      if (!newCode[i]) {
        focusIndex = i;
        break;
      }
    }
    const nextInput = document.getElementById(`code-input-${focusIndex}`);
    if (nextInput) nextInput.focus();
  };

  const handleVerificationConfirm = async () => {
    const code = verificationCode.join('');

    if (code.length !== 6) {
      alert('Please enter the complete 6-digit code');
      return;
    }

    try {
      console.log('Attempting to verify code:', code);
      console.log('Is sign-up flow:', isSignUp);

      let result;

      if (isSignUp) {
        // Verify email for sign-up
        result = await signUp.attemptEmailAddressVerification({
          code: code,
        });
        console.log('Sign-up verification result:', result);
        console.log('Status:', result.status);
        console.log('Missing fields:', result.missingFields);
        console.log('Required fields:', result.requiredFields);

        // If verification succeeded but additional fields are needed
        if (result.status === 'missing_requirements') {
          console.log(
            'Email verified, but additional fields required. Attempting to complete sign-up...'
          );

          // Try to complete the sign-up without additional fields
          // Auth provider may require a finalize step
          try {
            const completeResult = await signUp.update({});
            console.log('Update result:', completeResult);

            if (completeResult.status === 'complete') {
              console.log('Sign-up completed successfully!');
              if (completeResult.createdSessionId) {
                await setActive({ session: completeResult.createdSessionId });
              }
              onClose();
              window.location.reload();
              return;
            }
          } catch (updateErr) {
            console.log('Update failed:', updateErr);
          }

          // If still missing requirements, show what's needed
          alert(
            `Additional information required: ${
              result.missingFields?.join(', ') || 'Unknown fields'
            }`
          );
          return;
        }
      } else {
        // Verify email for sign-in
        result = await signIn.attemptFirstFactor({
          strategy: 'email_code',
          code: code,
        });
        console.log('Sign-in verification result:', result);
      }

      if (result.status === 'complete') {
        console.log('Authentication successful!');
        // For sign-in, set the active session
        if (!isSignUp && result.createdSessionId) {
          await setActive({ session: result.createdSessionId });
        }
        // Close the modal and let auth session settle
        onClose();
        window.location.reload(); // Refresh to update the UI
      } else {
        console.log('Additional steps required:', result.status);
        console.log('Result details:', result);
        alert('Additional verification steps required');
      }
    } catch (err) {
      console.error('Error verifying code:', err);
      console.error('Error details:', {
        message: err.message,
        status: err.status,
        authError: err.authError,
        errors: err.errors,
      });

      // Show user-friendly error message
      if (err.errors && err.errors.length > 0) {
        alert(`Error: ${err.errors[0].message}`);
      } else {
        alert(`Verification failed: ${err.message}`);
      }
    }
  };

  // Render modal using a portal to ensure it's outside the app container
  return ReactDOM.createPortal(
    <div
      className="login-modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        zIndex: 2147483647,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      <div
        className="login-modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ zIndex: 2147483647 }}
      >
        <div className="flex flex-col w-full max-w-[645px] h-auto items-start pt-7 pb-6 px-6 relative bg-[#323033] rounded-[13px] overflow-hidden border-[16px] border-solid border-[#ffffff33]">
          {!showEmailSignIn && !showVerification ? (
            // make this initial view match the email step height and distribute space top->bottom
            <div className="flex flex-col min-h-[373px] items-start justify-between relative self-stretch w-full">
              <div className="flex items-center justify-between relative self-stretch w-full flex-[0_0_auto] mb-8">
                <div className="relative flex items-center justify-center w-fit [font-family:'Hubot_Sans-Regular',Helvetica] font-normal text-white text-4xl tracking-[0] leading-[31.2px] sm:whitespace-nowrap">
                  {t('login.welcome')}
                </div>

                <button
                  className="close-button relative w-9 h-9 cursor-pointer bg-transparent border-0 p-0 flex items-center justify-center"
                  onClick={onClose}
                  aria-label={t('login.closeAria')}
                >
                  <X size={36} color="white" weight="bold" />
                </button>
              </div>

              <div className="flex flex-col items-start gap-3 relative self-stretch w-full">
                <div className="relative flex items-start justify-start self-stretch [font-family:'Hubot_Sans-Regular',Helvetica] font-normal text-white text-2xl tracking-[0] leading-[normal]">
                  {t('login.continueWith')}
                </div>

                <div className="inline-flex items-center gap-2 relative flex-[0_0_auto]">
                  <div className="flex w-7 h-7 items-center justify-center gap-[8.75px] relative bg-[#5f5e60] rounded-md">
                    <Check size={21} color="white" weight="bold" />
                  </div>

                  <p className="relative flex items-center justify-center w-fit [font-family:'Hubot_Sans-Light',Helvetica] font-light text-white text-sm tracking-[0] leading-4 whitespace-nowrap">
                    <span className="hidden sm:inline">{t('login.subscribeLong')}</span>
                    <span className="sm:hidden">{t('login.subscribeShort')}</span>
                  </p>
                </div>

                <div className="flex flex-col items-start gap-3 self-stretch w-full relative flex-[0_0_auto]">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full relative">
                    <button
                      onClick={handleGoogleSignIn}
                      className="auth-button bg-[linear-gradient(0deg,rgba(0,0,0,0.1)_0%,rgba(0,0,0,0.1)_100%)] flex flex-col items-start justify-between pt-2 pb-4 px-3 relative rounded-md overflow-hidden hover:bg-[linear-gradient(0deg,rgba(0,0,0,0.2)_0%,rgba(0,0,0,0.2)_100%)] transition-all"
                      style={{
                        backgroundImage: 'url(/images/Google_Bg.png)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    >
                      <div className="relative flex items-center justify-center w-fit [font-family:'Hubot_Sans-Medium',Helvetica] font-medium text-white text-xl tracking-[0] leading-8 whitespace-nowrap">
                        {t('login.google')}
                      </div>

                      <div className="auth-icon relative w-11 h-11 mt-6">
                        <GoogleLogo size={44} color="white" weight="fill" />
                      </div>
                    </button>

                    <button
                      onClick={handleFacebookSignIn}
                      className="auth-button bg-[linear-gradient(0deg,rgba(0,0,0,0.2)_0%,rgba(0,0,0,0.2)_100%)] flex flex-col items-start justify-between pt-2 pb-4 px-3 relative rounded-md overflow-hidden hover:bg-[linear-gradient(0deg,rgba(0,0,0,0.3)_0%,rgba(0,0,0,0.3)_100%)] transition-all"
                      style={{
                        backgroundImage: 'url(/images/Facebook_Bg.png)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    >
                      <div className="relative flex items-center justify-center w-fit [font-family:'Hubot_Sans-Medium',Helvetica] font-medium text-white text-xl tracking-[0] leading-8 whitespace-nowrap">
                        {t('login.facebook')}
                      </div>

                      <div className="auth-icon relative w-11 h-11 mt-6">
                        <FacebookLogo size={44} color="white" weight="fill" />
                      </div>
                    </button>

                    <button
                      onClick={handleAppleSignIn}
                      className="auth-button bg-[linear-gradient(0deg,rgba(0,0,0,1)_0%,rgba(0,0,0,1)_100%)] flex flex-col items-start justify-between pt-2 pb-4 px-3 relative rounded-md overflow-hidden hover:bg-[linear-gradient(0deg,rgba(0,0,0,0.8)_0%,rgba(0,0,0,0.8)_100%)] transition-all"
                      style={{
                        backgroundImage: 'url(/images/Apple_Bg.png)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    >
                      <div className="relative flex items-center justify-center w-fit [font-family:'Hubot_Sans-Medium',Helvetica] font-medium text-white text-xl tracking-[0] leading-8 whitespace-nowrap">
                        {t('login.apple')}
                      </div>

                      <div className="auth-icon relative w-11 h-11 mt-6">
                        <AppleLogo size={44} color="white" weight="fill" />
                      </div>
                    </button>

                    <button
                      onClick={handleEmailSignIn}
                      className="auth-button flex flex-col items-start justify-between pt-2 pb-4 px-3 relative rounded-md overflow-hidden hover:opacity-90 transition-all"
                      style={{
                        backgroundImage: 'url(/images/Email_Bg.png)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    >
                      <div className="relative flex items-center justify-center w-fit [font-family:'Hubot_Sans-Medium',Helvetica] font-medium text-white text-xl tracking-[0] leading-8 whitespace-nowrap">
                        {t('login.email')}
                      </div>

                      <div className="auth-icon relative w-11 h-11 mt-10">
                        <EnvelopeSimple size={44} color="white" weight="fill" />
                      </div>
                    </button>
                  </div>

                  <div className="inline-flex items-start relative flex-[0_0_auto] flex-wrap mt-2">
                    <p className="relative flex items-center justify-center w-fit [font-family:'Hubot_Sans-Light',Helvetica] font-light text-[#a4a3a4] text-xs tracking-[0] leading-4">
                      {t('login.termsPrefix')}&nbsp;
                    </p>

                    <button className="relative flex items-center justify-center w-fit [font-family:'Hubot_Sans-Regular',Helvetica] font-normal text-[#a4a3a4] text-xs tracking-[0] leading-4 underline cursor-pointer bg-transparent border-0 p-0 hover:text-white transition-colors">
                      {t('login.privacyPolicy')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : showEmailSignIn && !showVerification ? (
            <div className="flex flex-col min-h-[373px] items-start justify-between relative self-stretch w-full">
              <div className="flex flex-col items-start gap-6 relative self-stretch w-full flex-[0_0_auto]">
                <div className="flex items-start justify-between relative self-stretch w-full flex-[0_0_auto]">
                  <button
                    onClick={handleBack}
                    className="inline-flex items-center justify-center gap-2 relative flex-[0_0_auto] bg-transparent border-0 cursor-pointer p-0"
                  >
                    <ArrowLeft size={24} color="white" weight="bold" />
                    <div className="relative flex items-center justify-center w-fit [font-family:'Hubot_Sans-Regular',Helvetica] font-normal text-white text-lg tracking-[0] leading-[normal]">
                      {t('login.back')}
                    </div>
                  </button>

                  <button
                    className="close-button relative w-9 h-9 cursor-pointer bg-transparent border-0 p-0 flex items-center justify-center"
                    onClick={onClose}
                    aria-label={t('login.closeAria')}
                  >
                    <X size={36} color="white" weight="bold" />
                  </button>
                </div>

                <p className="relative flex items-center justify-start w-[426.94px] [font-family:'Hubot_Sans-Regular',Helvetica] font-normal text-white text-4xl tracking-[0] leading-[44px]">
                  {t('login.emailPrompt')}
                </p>
              </div>

              <div className="flex flex-col items-start gap-3 self-stretch w-full relative flex-[0_0_auto]">
                <div className="flex items-start gap-3 self-stretch w-full relative flex-[0_0_auto]">
                  <div className="flex flex-1 bg-[#5f5e60] h-[98px] items-center px-5 py-px relative rounded-md overflow-hidden">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t('login.emailPlaceholder')}
                      className={`${
                        email ? 'text-white' : 'text-[#a4a3a4]'
                      } w-full bg-transparent relative flex items-center justify-center [font-family:'Hubot_Sans-Regular',Helvetica] font-normal text-2xl tracking-[0] leading-8 border-0 outline-none placeholder:text-[#a4a3a4]`}
                    />
                  </div>

                  <button
                    onClick={handleEmailConfirm}
                    className="inline-flex justify-center flex-[0_0_auto] bg-[#012fa7] h-[98px] items-center px-5 py-px relative rounded-md overflow-hidden hover:bg-[#0137c7] transition-all cursor-pointer border-0"
                  >
                    <div className="text-white relative flex items-center justify-center w-fit [font-family:'Hubot_Sans-Regular',Helvetica] font-normal text-2xl tracking-[0] leading-8 whitespace-nowrap">
                      {t('login.confirm')}
                    </div>
                  </button>
                </div>
              </div>
            </div>
          ) : showVerification ? (
            <div className="flex flex-col h-[373px] items-start justify-between relative self-stretch w-full">
              <div className="flex flex-col items-start gap-6 relative self-stretch w-full flex-[0_0_auto]">
                <div className="flex items-start justify-between relative self-stretch w-full flex-[0_0_auto]">
                  <button
                    onClick={handleBack}
                    className="inline-flex items-center justify-center gap-2 relative flex-[0_0_auto] bg-transparent border-0 cursor-pointer p-0"
                  >
                    <ArrowLeft size={24} color="white" weight="bold" />
                    <div className="relative flex items-center justify-center w-fit [font-family:'Hubot_Sans-Regular',Helvetica] font-normal text-white text-lg tracking-[0] leading-[normal]">
                      {t('login.back')}
                    </div>
                  </button>

                  <button
                    className="close-button relative w-9 h-9 cursor-pointer bg-transparent border-0 p-0 flex items-center justify-center"
                    onClick={onClose}
                    aria-label={t('login.closeAria')}
                  >
                    <X size={36} color="white" weight="bold" />
                  </button>
                </div>

                <p className="relative flex items-center justify-start w-[426.94px] [font-family:'Hubot_Sans-Regular',Helvetica] font-normal text-white text-4xl tracking-[0] leading-[44px]">
                  {t('login.codePrompt')}
                </p>
              </div>

              <div className="flex flex-col h-[236px] mt-8 items-start gap-3 relative self-stretch w-full">
                <div className="flex items-start gap-3 relative flex-1 self-stretch w-full grow">
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <div
                      key={index}
                      className="justify-around flex-1 grow bg-[#5f5e60] flex items-center px-5 py-px relative self-stretch rounded-md overflow-hidden"
                    >
                      <input
                        id={`code-input-${index}`}
                        type="text"
                        maxLength={1}
                        value={verificationCode[index]}
                        onChange={(e) => handleVerificationCodeChange(index, e.target.value)}
                        onPaste={(e) => handlePasteVerification(e, index)}
                        onKeyDown={(e) => {
                          if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
                            const prevInput = document.getElementById(`code-input-${index - 1}`);
                            if (prevInput) prevInput.focus();
                          }
                        }}
                        className={`${
                          verificationCode[index] ? 'text-white' : 'text-[#a4a3a4]'
                        } text-[40px] relative flex items-center justify-center w-full text-center bg-transparent [font-family:'Hubot_Sans-Regular',Helvetica] font-normal tracking-[0] leading-8 border-0 outline-none focus:ring-0`}
                      />
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleVerificationConfirm}
                  className="h-[98px] justify-center w-full bg-[#012fa7] flex items-center px-5 py-px relative self-stretch rounded-md overflow-hidden hover:bg-[#0137c7] transition-all cursor-pointer border-0"
                >
                  <div className="text-white text-2xl relative flex items-center justify-center w-fit [font-family:'Hubot_Sans-Regular',Helvetica] font-normal tracking-[0] leading-8 whitespace-nowrap">
                    {t('login.confirm')}
                  </div>
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
};
