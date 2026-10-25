import { useRouteError } from 'react-router';
import { LogoMark } from '@/components/icons/LogoMark';

export function RootErrorBoundary() {
  const error: any = useRouteError();
  const errorMessage = String(error?.message || error?.statusText || error || '');
  const isChunkError =
    errorMessage.includes('Failed to fetch dynamically imported module') ||
    errorMessage.includes('Importing a module script failed') ||
    errorMessage.includes('error loading dynamically imported module');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        width: '100vw',
        padding: '24px',
        backgroundColor: '#0a0a0c',
        color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        textAlign: 'center',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          maxWidth: '460px',
          width: '100%',
          padding: '36px 32px',
          borderRadius: '24px',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(30px)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '18px',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '4px',
          }}
        >
          <LogoMark size={36} />
        </div>

        <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
          {isChunkError ? 'New Version Available' : 'Something went wrong'}
        </h2>

        <p
          style={{
            fontSize: '14px',
            lineHeight: '1.6',
            color: 'rgba(255, 255, 255, 0.65)',
            margin: 0,
          }}
        >
          {isChunkError
            ? 'Raaga was just updated with new improvements. Please reload the app to get the latest features and audio sources.'
            : 'An unexpected application state occurred while loading this view.'}
        </p>

        {Boolean(errorMessage) && !isChunkError && (
          <pre
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              background: 'rgba(0, 0, 0, 0.4)',
              color: 'rgba(255, 100, 100, 0.85)',
              fontSize: '11px',
              overflowX: 'auto',
              textAlign: 'left',
              margin: '6px 0',
            }}
          >
            {errorMessage}
          </pre>
        )}

        <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '8px' }}>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              flex: 1,
              padding: '12px 18px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #fa586a 0%, #d83b52 100%)',
              color: '#fff',
              border: 'none',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.15s ease',
            }}
          >
            Reload App
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.href = '/';
            }}
            style={{
              padding: '12px 18px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
