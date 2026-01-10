import React from 'react';
import { useToast } from '../context/ToastContext.jsx';

const Toast = ({ toast, onRemove }) => {
  const getToastStyles = (type) => {
    const baseStyles = {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 16px',
      borderRadius: '6px',
      marginBottom: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      fontSize: '14px',
      fontWeight: '500',
      maxWidth: '400px',
      wordWrap: 'break-word'
    };

    switch (type) {
      case 'success':
        return {
          ...baseStyles,
          backgroundColor: '#d1fae5',
          color: '#065f46',
          border: '1px solid #a7f3d0'
        };
      case 'error':
        return {
          ...baseStyles,
          backgroundColor: '#fee2e2',
          color: '#991b1b',
          border: '1px solid #fca5a5'
        };
      case 'info':
      default:
        return {
          ...baseStyles,
          backgroundColor: '#dbeafe',
          color: '#1e40af',
          border: '1px solid #93c5fd'
        };
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'info':
      default:
        return 'ℹ';
    }
  };

  return (
    <div style={getToastStyles(toast.type)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '16px' }}>{getIcon(toast.type)}</span>
        <span>{toast.message}</span>
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '18px',
          color: 'inherit',
          opacity: 0.7,
          padding: '0',
          marginLeft: '8px'
        }}
        aria-label="Close toast"
      >
        ×
      </button>
    </div>
  );
};

const ToastContainer = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 1000,
        pointerEvents: 'none'
      }}
    >
      <div style={{ pointerEvents: 'auto' }}>
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            toast={toast}
            onRemove={removeToast}
          />
        ))}
      </div>
    </div>
  );
};

export default ToastContainer;