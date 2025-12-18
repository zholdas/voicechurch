import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { roomsApi } from '../lib/api';
import type { TranslationDirection, PublicRoomInfo } from '../lib/types';

// Landing page components
import Navbar from '../components/landing/Navbar';
import HeroSection from '../components/landing/HeroSection';
import OneChurchSection from '../components/landing/OneChurchSection';
import SimpleSetupSection from '../components/landing/SimpleSetupSection';
import OneServiceSection from '../components/landing/OneServiceSection';
import BeyondChurchesSection from '../components/landing/BeyondChurchesSection';
import FeaturesSection from '../components/landing/FeaturesSection';
import WhyWordBeaconSection from '../components/landing/WhyWordBeaconSection';
import PricingSection from '../components/landing/PricingSection';
import FAQSection from '../components/landing/FAQSection';
import ScheduleDemoSection from '../components/landing/ScheduleDemoSection';
import CTASection from '../components/landing/CTASection';
import Footer from '../components/landing/Footer';

export default function Home() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [publicRooms, setPublicRooms] = useState<PublicRoomInfo[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);

  // Load public rooms
  useEffect(() => {
    roomsApi
      .getPublicRooms()
      .then(setPublicRooms)
      .catch(console.error)
      .finally(() => setLoadingRooms(false));
  }, []);

  const handleQuickBroadcast = (dir: TranslationDirection) => {
    navigate(`/broadcast?direction=${dir}`);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <Navbar />

      {/* Hero Section */}
      <HeroSection />

      {/* One Church, Many Languages */}
      <OneChurchSection />

      {/* Simple Setup */}
      <SimpleSetupSection />

      {/* One Service for Everyone */}
      <OneServiceSection />

      {/* Beyond Churches */}
      <BeyondChurchesSection />

      {/* Features */}
      <FeaturesSection />

      {/* Why WordBeacon */}
      <WhyWordBeaconSection />

      {/* Public Rooms - Keep existing functionality */}
      {!loadingRooms && publicRooms.length > 0 && (
        <section className="py-16 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-2xl font-semibold text-gray-900 text-center mb-8">
              Active Rooms
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {publicRooms.map((room) => (
                <Link
                  key={room.id}
                  to={`/room/${room.slug}`}
                  className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-lg text-gray-900">
                      {room.name}
                    </h3>
                    {room.isActive && (
                      <span className="flex items-center gap-1 text-green-600 text-sm">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Live
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span
                      className={`px-2 py-0.5 rounded-full ${
                        room.direction === 'es-to-en'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-green-50 text-green-700'
                      }`}
                    >
                      {room.direction === 'es-to-en'
                        ? 'ES → EN'
                        : 'EN → ES'}
                    </span>
                    <span>{room.listenerCount} listeners</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Quick Broadcast - Keep existing functionality */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h3 className="text-2xl font-semibold text-gray-900 mb-4">
            Try It Now
          </h3>
          <p className="text-gray-600 mb-8 max-w-xl mx-auto">
            Start a quick broadcast with a temporary room. No sign-up required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => handleQuickBroadcast('es-to-en')}
              className="inline-flex items-center justify-center px-6 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
              Spanish → English
            </button>
            <button
              onClick={() => handleQuickBroadcast('en-to-es')}
              className="inline-flex items-center justify-center px-6 py-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
              English → Spanish
            </button>
            <Link
              to="/join"
              className="inline-flex items-center justify-center px-6 py-4 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                />
              </svg>
              Join Room
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            Start a temporary room with a random URL
          </p>

          {/* Sign in CTA */}
          {!isAuthenticated && (
            <div className="mt-8 p-6 bg-amber-50 border border-amber-200 rounded-xl max-w-md mx-auto">
              <p className="text-gray-700 mb-3">
                Want to create permanent rooms with custom URLs?
              </p>
              <Link
                to="/login"
                className="inline-flex items-center px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
              >
                Sign in to manage rooms
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Pricing */}
      <PricingSection />

      {/* FAQ */}
      <FAQSection />

      {/* Schedule Demo */}
      <ScheduleDemoSection />

      {/* CTA */}
      <CTASection />

      {/* Footer */}
      <Footer />
    </div>
  );
}
