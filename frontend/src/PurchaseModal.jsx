import React, { useState } from 'react';

const PLANS = [
  {
    key: 'starter',
    title: 'Starter',
    badge: null,
    tokens: '20 Analyses',
    price: '₹99',
    description: 'Perfect for targeting a few specific roles.',
    features: ['20 In-depth ATS analyses', 'Detailed keyword gap report', 'Never expires'],
  },
  {
    key: 'pro',
    title: 'Pro',
    badge: 'Most Popular',
    tokens: '75 Analyses',
    price: '₹249',
    description: 'Best for active job searches across dozens of openings.',
    features: ['75 In-depth ATS analyses', 'ATS keyword scanner', 'Priority AI processing', 'Never expires'],
  },
  {
    key: 'unlimited',
    title: 'Unlimited',
    badge: 'Best Value',
    tokens: '30 Days Unlimited',
    price: '₹499',
    description: 'Unlimited runs for intensive application sprints.',
    features: ['Unlimited resume analyses', 'Real-time rewrite suggestions', '30 days full access', 'Direct support'],
  },
];

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      return resolve(true);
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function PurchaseModal({ isOpen, onClose, onPurchaseSuccess, token }) {
  const [loadingKey, setLoadingKey] = useState(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSelectPlan = async (planKey) => {
    setError('');
    setLoadingKey(planKey);

    try {
      // 1. Create order on backend
      const orderRes = await fetch('/api/purchase/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planKey }),
      });

      const text = await orderRes.text();
      let orderData;
      try {
        orderData = JSON.parse(text);
      } catch {
        throw new Error(`Server returned ${orderRes.status}: ${text || 'Empty response'}`);
      }

      if (!orderRes.ok) {
        throw new Error(orderData.message || 'Failed to create order');
      }

      // 2. Automatic test verification if mock mode is active
      if (orderData.isMock || orderData.orderId.startsWith('order_mock_')) {
        const verifyRes = await fetch('/api/purchase/verify-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            razorpay_order_id: orderData.orderId,
            razorpay_payment_id: `pay_mock_${Date.now()}`,
            razorpay_signature: 'mock_signature',
            planKey,
          }),
        });

        const verifyData = await verifyRes.json();
        if (!verifyRes.ok) {
          throw new Error(verifyData.message || 'Mock payment verification failed');
        }

        onPurchaseSuccess(verifyData);
        onClose();
        return;
      }

      // 3. Ensure Razorpay SDK is loaded
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded || !window.Razorpay) {
        throw new Error('Razorpay SDK failed to load. Please disable ad-blockers and try again.');
      }

      // 4. Standard Razorpay configuration (Allows default UPI checkout flow)
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: 'INR',
        name: 'Resume Review ATS',
        description: `Upgrade Plan - ${planKey.toUpperCase()}`,
        order_id: orderData.orderId,
        prefill: {
          name: 'Raj Maurya',
          email: 'raj@example.com',
          contact: '9876543210',
        },
        theme: {
          color: '#2F6F5E',
        },
        modal: {
          ondismiss: function () {
            setLoadingKey(null);
          },
        },
        handler: async function (response) {
          try {
            const verifyRes = await fetch('/api/purchase/verify-payment', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                planKey,
              }),
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) {
              throw new Error(verifyData.message || 'Payment verification failed');
            }

            onPurchaseSuccess(verifyData);
            onClose();
          } catch (vErr) {
            setError(vErr.message);
          } finally {
            setLoadingKey(null);
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      setError(err.message || 'Purchase process failed. Please try again.');
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          maxWidth: '850px',
          width: '100%',
          padding: '32px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          position: 'relative',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            border: 'none',
            background: '#f1f5f9',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#64748b',
          }}
        >
          ×
        </button>

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>
            Choose a Token Pack
          </h2>
          <p style={{ color: '#64748b', margin: 0, fontSize: '15px' }}>
            Pay via UPI (Google Pay, PhonePe, Paytm, QR), Cards, or Netbanking.
          </p>
          {error && (
            <div
              style={{
                marginTop: '12px',
                padding: '10px',
                background: '#fee2e2',
                color: '#991b1b',
                borderRadius: '8px',
                fontSize: '14px',
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: '20px',
          }}
        >
          {PLANS.map((plan) => {
            const isPro = plan.key === 'pro';
            const isLoading = loadingKey === plan.key;

            return (
              <div
                key={plan.key}
                style={{
                  border: isPro ? '2px solid #2F6F5E' : '1px solid #e2e8f0',
                  borderRadius: '14px',
                  padding: '24px',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  background: isPro ? '#f4fbf7' : '#ffffff',
                }}
              >
                {plan.badge && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-12px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#2F6F5E',
                      color: '#ffffff',
                      padding: '2px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    {plan.badge}
                  </span>
                )}

                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 4px 0', color: '#0f172a' }}>
                    {plan.title}
                  </h3>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', margin: '12px 0 4px 0' }}>
                    {plan.price}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#2F6F5E', marginBottom: '12px' }}>
                    {plan.tokens}
                  </div>
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0', lineHeight: 1.4 }}>
                    {plan.description}
                  </p>

                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0', fontSize: '13px', color: '#334155' }}>
                    {plan.features.map((feat, idx) => (
                      <li key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ color: '#16a34a', marginRight: '8px', fontWeight: 'bold' }}>✓</span>
                        {feat}
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  disabled={!!loadingKey}
                  onClick={() => handleSelectPlan(plan.key)}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: isPro ? '#2F6F5E' : '#1E2A28',
                    color: '#ffffff',
                    fontWeight: 600,
                    cursor: loadingKey ? 'not-allowed' : 'pointer',
                    opacity: loadingKey ? 0.7 : 1,
                  }}
                >
                  {isLoading ? 'Processing...' : `Get ${plan.title}`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}