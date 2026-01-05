import React from 'react';

function ConfirmationDialog({ isOpen, title, message, onConfirm, onCancel, confirmText = 'OK', cancelText = 'Cancel', type = 'info' }) {
  if (!isOpen) return null;

  const getBackgroundColor = () => {
    switch(type) {
      case 'success': return '#d4edda';
      case 'warning': return '#fff3cd';
      case 'danger': return '#f8d7da';
      case 'error': return '#f8d7da';
      default: return '#d1ecf1';
    }
  };

  const getBorderColor = () => {
    switch(type) {
      case 'success': return '#c3e6cb';
      case 'warning': return '#ffeaa7';
      case 'danger': return '#f5c6cb';
      case 'error': return '#f5c6cb';
      default: return '#bee5eb';
    }
  };

  const getButtonColor = () => {
    switch(type) {
      case 'success': return '#28a745';
      case 'warning': return '#ffc107';
      case 'danger': return '#dc3545';
      case 'error': return '#dc3545';
      default: return '#17a2b8';
    }
  };

  return (
    <>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 999,
      }} onClick={onCancel} />
      
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        minWidth: '350px',
        maxWidth: '500px',
        zIndex: 1000,
        padding: '0',
        overflow: 'hidden',
      }}>
        <div style={{
          backgroundColor: getBackgroundColor(),
          borderBottom: `3px solid ${getBorderColor()}`,
          padding: '20px',
        }}>
          <h2 style={{ margin: 0, color: '#333', fontSize: '18px', fontWeight: '600' }}>{title}</h2>
        </div>
        
        <div style={{
          padding: '20px',
          color: '#555',
          lineHeight: '1.6',
        }}>
          {message}
        </div>
        
        <div style={{
          padding: '15px 20px',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px',
          borderTop: '1px solid #eee',
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: '#f5f5f5',
              color: '#333',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#ebebeb'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#f5f5f5'}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: getButtonColor(),
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => e.target.style.opacity = '0.9'}
            onMouseLeave={(e) => e.target.style.opacity = '1'}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </>
  );
}

export default ConfirmationDialog;
