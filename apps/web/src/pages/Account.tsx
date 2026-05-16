import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { authApi, billingApi, type SubscriptionInfo } from '../lib/api';

export default function Account() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, isLoading, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      billingApi.getSubscription().then(setSubscription).catch(() => {});
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const planName = subscription?.plan?.name || getSourceLabel(subscription?.activeSource);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Account Settings</h1>

        {/* Profile */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-sm font-medium text-gray-500 uppercase mb-4">Profile</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Name</span>
              <span className="font-medium text-gray-900">{user?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Email</span>
              <span className="font-medium text-gray-900">{user?.email}</span>
            </div>
          </div>
        </div>

        {/* Current Plan */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-sm font-medium text-gray-500 uppercase mb-4">Current Plan</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Plan</span>
              <span className="font-medium text-gray-900">{planName}</span>
            </div>
            {subscription?.usage && (
              <div className="flex justify-between">
                <span className="text-gray-600">Minutes remaining</span>
                <span className="font-medium text-gray-900">
                  {subscription.usage.minutesRemaining} / {subscription.usage.minutesLimit}
                </span>
              </div>
            )}
            {subscription?.activeSource === 'demo' && subscription.demo && (
              <div className="flex justify-between">
                <span className="text-gray-600">Demo minutes</span>
                <span className="font-medium text-gray-900">
                  {subscription.demo.remaining} remaining
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6 space-y-3">
          <button
            onClick={logout}
            className="w-full py-3 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            Sign Out
          </button>

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-3 px-4 border border-red-200 rounded-lg text-red-600 font-medium hover:bg-red-50 transition-colors"
          >
            Delete Account
          </button>
        </div>

        {/* Delete confirmation */}
        {showDeleteConfirm && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
            <p className="text-red-800 mb-4">
              Are you sure? This will permanently delete your account and all your data.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    const res = await authApi.deleteAccount();
                    if (!res.ok) throw new Error('Failed to delete account');
                    navigate('/login');
                  } catch {
                    alert('Failed to delete account. Please try again.');
                  }
                }}
                className="flex-1 py-2 px-4 bg-red-600 rounded-lg text-white font-medium hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        )}

        <p className="text-center mt-8">
          <a href="/dashboard" className="text-sm text-blue-600 hover:underline">
            ← Back to dashboard
          </a>
        </p>
      </div>
    </div>
  );
}

function getSourceLabel(source?: string | null): string {
  switch (source) {
    case 'demo': return 'Free Demo';
    case 'event_pass': return 'Event Pass';
    case 'subscription': return 'Subscription';
    default: return 'No plan';
  }
}
