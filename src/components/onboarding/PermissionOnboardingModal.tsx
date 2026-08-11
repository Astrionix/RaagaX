'use client';

import React from 'react';
import { usePermissionOnboarding } from '@/hooks/usePermissionOnboarding';

/**
 * PermissionOnboardingModal
 *
 * Shown ONCE on first install. Never again.
 * Explains why RaagaX needs the notification permission before asking.
 * User can tap "Enable Notifications" or "Not Now".
 */
export function PermissionOnboardingModal() {
  const { isVisible, step, requestNotifications, skipNotifications } = usePermissionOnboarding();

  if (!isVisible || step !== 'notifications') return null;

  return (
    <div className="permission-overlay" role="dialog" aria-modal="true" aria-labelledby="perm-title">
      <div className="permission-modal">

        {/* Icon */}
        <div className="permission-icon" aria-hidden="true">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="24" fill="url(#perm-grad)" />
            <path
              d="M24 12C18 12 14 16.5 14 22v8l-2 2v1h24v-1l-2-2v-8c0-5.5-4-10-10-10zm0 26c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2z"
              fill="white"
            />
            <defs>
              <linearGradient id="perm-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                <stop stopColor="#7C3AED" />
                <stop offset="1" stopColor="#2563EB" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Text */}
        <h2 id="perm-title" className="permission-title">
          Keep your music playing
        </h2>
        <p className="permission-body">
          RaagaX uses a media notification so you can control playback from your
          lock screen — play, pause, skip tracks without unlocking your phone.
        </p>

        {/* Actions */}
        <button
          id="perm-enable-btn"
          className="permission-btn-primary"
          onClick={requestNotifications}
        >
          Enable Notifications
        </button>
        <button
          id="perm-skip-btn"
          className="permission-btn-secondary"
          onClick={skipNotifications}
        >
          Not now
        </button>

      </div>

      <style>{`
        .permission-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(6px);
          animation: permFadeIn 0.3s ease;
        }
        @keyframes permFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .permission-modal {
          width: 100%;
          max-width: 480px;
          background: linear-gradient(145deg, #1a1a2e 0%, #16213e 100%);
          border: 1px solid rgba(124, 58, 237, 0.3);
          border-radius: 24px 24px 0 0;
          padding: 32px 28px 40px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          text-align: center;
          animation: permSlideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes permSlideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        .permission-icon {
          margin-bottom: 4px;
          filter: drop-shadow(0 0 16px rgba(124,58,237,0.5));
        }
        .permission-title {
          font-size: 22px;
          font-weight: 700;
          color: #f1f5f9;
          margin: 0;
          letter-spacing: -0.3px;
        }
        .permission-body {
          font-size: 14px;
          line-height: 1.6;
          color: #94a3b8;
          margin: 0;
          max-width: 340px;
        }
        .permission-btn-primary {
          width: 100%;
          padding: 15px;
          border-radius: 14px;
          border: none;
          background: linear-gradient(135deg, #7C3AED, #2563EB);
          color: white;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          letter-spacing: 0.2px;
          transition: opacity 0.2s, transform 0.15s;
          margin-top: 8px;
        }
        .permission-btn-primary:hover  { opacity: 0.9; transform: scale(1.01); }
        .permission-btn-primary:active { transform: scale(0.98); }
        .permission-btn-secondary {
          background: none;
          border: none;
          color: #64748b;
          font-size: 14px;
          cursor: pointer;
          padding: 8px;
          transition: color 0.2s;
        }
        .permission-btn-secondary:hover { color: #94a3b8; }
      `}</style>
    </div>
  );
}
