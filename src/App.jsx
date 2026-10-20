import React, { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import CreateDonationPage from './pages/CreateDonationPage';
import MatchingPage from './pages/MatchingPage';
import DonationDetailsPage from './pages/DonationDetailsPage';
import LiveTrackingPage from './pages/LiveTrackingPage';
import ImpactPage from './pages/ImpactPage';
import ProfilePage from './pages/ProfilePage';
import ShelterDashboardPage from './pages/ShelterDashboardPage';
import DriverDashboardPage from './pages/DriverDashboardPage';
import LiveNetworkMapPage from './pages/LiveNetworkMapPage';
import Sidebar from './components/layout/Sidebar';
import PWAInstallBanner from './components/ui/PWAInstallBanner';
import { initialDonations, initialStats, mockShelters } from './data/mockData';
import { api, getCurrentUser, getToken } from './services/api';
import { Menu } from 'lucide-react';

export default function App() {
  // Helper to normalize path from URL
  const getInitialPath = () => {
    const p = window.location.pathname;
    if (!p || p === '/' || p === '') return '/landing';
    return p.endsWith('/') && p.length > 1 ? p.slice(0, -1) : p;
  };

  const [currentRoute, setCurrentRoute] = useState(getInitialPath);
  const [currentUser, setCurrentUser] = useState(getCurrentUser);
  const [donations, setDonations] = useState(initialDonations);
  const [stats, setStats] = useState(initialStats);
  const [selectedDonation, setSelectedDonation] = useState(initialDonations[0]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);

  // Sync selected tracking donation to sessionStorage for seamless cross-navigation
  useEffect(() => {
    if (selectedDonation) {
      try {
        sessionStorage.setItem('active_tracking_donation', JSON.stringify(selectedDonation));
      } catch (e) {}
    }
  }, [selectedDonation]);

  // Sync navigation with browser URL bar and History API
  const navigate = (toPath) => {
    let formattedPath = toPath;
    // Map any legacy IDs without leading slash
    if (!formattedPath.startsWith('/')) {
      formattedPath = `/${formattedPath.replace('-', '/')}`;
    }

    if (window.location.pathname !== formattedPath) {
      window.history.pushState(null, '', formattedPath);
    }
    setCurrentRoute(formattedPath);
    window.scrollTo(0, 0);
  };

  // Listen to browser Back/Forward popstate buttons
  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname;
      setCurrentRoute(p === '/' || !p ? '/landing' : p);
      setCurrentUser(getCurrentUser());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Strict Role-Based Protected Route Enforcement
  useEffect(() => {
    const user = getCurrentUser();
    const token = getToken();
    const isAuthenticated = Boolean(user && token);
    const path = currentRoute;

    // 1. Unauthenticated user trying to access any protected role portal
    if (!isAuthenticated) {
      if (path.startsWith('/donor') || path.startsWith('/shelter') || path.startsWith('/driver')) {
        navigate('/login');
        return;
      }
    }

    // 2. Authenticated user visiting /login or /signup -> redirect to designated role dashboard
    if (isAuthenticated && (path === '/login' || path === '/signup')) {
      const role = user?.role?.toUpperCase();
      if (role === 'SHELTER') {
        navigate('/shelter/dashboard');
      } else if (role === 'DRIVER') {
        navigate('/driver/dashboard');
      } else {
        navigate('/donor/dashboard');
      }
      return;
    }

    // 3. Strict Role Isolation (Cross-role route protection)
    if (isAuthenticated) {
      const role = user?.role?.toUpperCase();
      if (role === 'DONOR') {
        if (path.startsWith('/shelter') || path.startsWith('/driver')) {
          navigate('/donor/dashboard');
        }
      } else if (role === 'SHELTER') {
        if (path.startsWith('/donor') || path.startsWith('/driver')) {
          navigate('/shelter/dashboard');
        }
      } else if (role === 'DRIVER') {
        if (path.startsWith('/donor') || path.startsWith('/shelter')) {
          navigate('/driver/dashboard');
        }
      }
    }
  }, [currentRoute, currentUser]);

  // Load backend stats and verify health on mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const impactRes = await api.impact.getGlobal();
        if (impactRes && impactRes.impact) {
          setStats((prev) => ({
            ...prev,
            mealsRescued: impactRes.impact.mealsRescued,
            foodDivertedKg: impactRes.impact.foodDivertedKg,
            successfulPickups: impactRes.impact.successfulRescues
          }));
        }
        setBackendConnected(true);
      } catch (e) {
        setBackendConnected(false);
      }

      // If user is logged in as DONOR, load their real donations
      const user = getCurrentUser();
      if (user && user.role === 'DONOR' && getToken()) {
        try {
          const res = await api.donations.getAll();
          if (res && res.donations && res.donations.length > 0) {
            const mapped = res.donations.map((d) => ({
              id: d._id,
              foodType: d.foodType,
              quantity: d.quantity,
              unit: d.unit,
              pickupLocation: d.pickupLocation?.address || 'Pickup Point',
              pickupCoordinates: d.pickupLocation?.coordinates || null,
              safeUntil: d.expiryInfo?.label || '2h remaining',
              remainingTime: d.expiryInfo?.label || '2h remaining',
              category: d.category || 'Vegetarian',
              status: d.status,
              statusLabel: d.status === 'ON_THE_WAY' ? 'LIVE' : d.status,
              donor: d.donorId?.name || user.name || 'Food Donor',
              shelter: d.shelterId ? {
                name: d.shelterId.name,
                address: d.shelterId.location?.address || 'Shelter Facility',
                coordinates: d.shelterId.location?.coordinates || null
              } : null,
              driver: d.driverId ? {
                name: d.driverId.name,
                phone: d.driverId.phone,
                vehicle: d.driverId.vehicle,
                coordinates: d.driverId.location?.coordinates || null,
                avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80'
              } : null,
              notes: d.notes || 'Packed in food-grade containers.'
            }));
            setDonations(mapped);
            if (mapped.length > 0) {
              setSelectedDonation(mapped[0]);
            }
          }
        } catch (err) {
          console.warn('[Sync] Using local resilient data');
        }
      }
    };

    checkConnection();
  }, [currentUser]);

  // Auth Handlers
  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
    const role = user?.role?.toUpperCase();
    if (role === 'SHELTER') {
      navigate('/shelter/dashboard');
    } else if (role === 'DRIVER') {
      navigate('/driver/dashboard');
    } else {
      navigate('/donor/dashboard');
    }
  };

  const handleLogout = () => {
    api.auth.logout();
    setCurrentUser(null);
    navigate('/login');
  };

  // Donation creation handler
  const handleDonationCreated = async (newDonationData) => {
    try {
      const futureHours = 2.5;
      const safeUntilISO = newDonationData.safeUntil || new Date(Date.now() + futureHours * 60 * 60 * 1000).toISOString();
      const coords = Array.isArray(newDonationData.coords) && newDonationData.coords.length === 2
        ? [Number(newDonationData.coords[0]), Number(newDonationData.coords[1])]
        : [77.2197, 28.6328];

      const res = await api.donations.create({
        foodType: newDonationData.foodType,
        category: newDonationData.category,
        quantity: newDonationData.quantity,
        unit: newDonationData.unit,
        safeUntil: safeUntilISO,
        notes: newDonationData.notes,
        pickupLocation: {
          type: 'Point',
          coordinates: coords,
          lat: coords[1],
          lng: coords[0],
          address: newDonationData.pickupLocation || 'Pickup Point'
        }
      });

      if (res && res.donation) {
        const createdUI = {
          ...newDonationData,
          id: res.donation._id,
          _id: res.donation._id,
          pickupCoordinates: coords,
          status: 'POSTED',
          statusLabel: 'MATCHING'
        };
        setDonations([createdUI, ...donations]);
        setSelectedDonation(createdUI);
      }
    } catch (err) {
      console.warn('Backend create fallback:', err.message);
      setDonations([newDonationData, ...donations]);
    }
  };

  const handleMatchConfirmed = async (matchedShelter) => {
    if (selectedDonation) {
      const donationId = selectedDonation.id || selectedDonation._id;
      const shelterId = matchedShelter.shelterId || matchedShelter._id || matchedShelter.id;

      if (donationId && shelterId) {
        try {
          await api.matching.confirm(donationId, shelterId);
        } catch (err) {
          console.warn('Backend match confirm fallback:', err.message);
        }
      }

      const updated = {
        ...selectedDonation,
        shelter: matchedShelter,
        status: 'MATCHED',
        statusLabel: 'MATCHED'
      };
      setSelectedDonation(updated);
      setDonations(donations.map(d => (d.id === updated.id || d._id === updated.id) ? updated : d));
    }
  };

  const handleDeliveryCompleted = async (donationId) => {
    try {
      await api.drivers.confirmDelivery(donationId);
    } catch (e) {
      console.warn('Delivery confirm API fallback:', e.message);
    }

    setDonations(donations.map(d => {
      if (d.id === donationId) {
        return {
          ...d,
          status: 'DELIVERED',
          statusLabel: 'DELIVERED',
          deliveredAt: 'Just now'
        };
      }
      return d;
    }));

    setStats((prev) => ({
      ...prev,
      activeDonations: Math.max(0, prev.activeDonations - 1),
      successfulPickups: prev.successfulPickups + 1,
      mealsRescued: prev.mealsRescued + (selectedDonation?.quantity || 40),
      foodDivertedKg: prev.foodDivertedKg + 50
    }));
  };

  const isPublic = currentRoute === '/landing' || currentRoute === '/login' || currentRoute === '/signup';
  const role = currentUser?.role?.toUpperCase() || 'DONOR';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Public Pages: Landing, Login, Signup */}
      {isPublic && (
        <main style={{ flex: 1 }}>
          {currentRoute === '/landing' && <LandingPage onNavigate={navigate} />}
          {currentRoute === '/login' && <LoginPage onNavigate={navigate} onLoginSuccess={handleAuthSuccess} />}
          {currentRoute === '/signup' && <SignupPage onNavigate={navigate} onLoginSuccess={handleAuthSuccess} />}
        </main>
      )}

      {/* Authenticated Platform Layout (Strict Role Portals) */}
      {!isPublic && (
        <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg)' }}>
          {/* Universal Role-Aware Sidebar */}
          <Sidebar
            activeRoute={currentRoute}
            onNavigate={navigate}
            onLogout={handleLogout}
            mobileOpen={mobileMenuOpen}
            setMobileOpen={setMobileMenuOpen}
          />

          {/* Main App Content Area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {/* Top Bar Connection & Role Strip */}
            <div style={{
              background: '#ffffff',
              borderBottom: 'var(--border-dark)',
              padding: '8px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.8rem',
              fontWeight: 700
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="pulse-dot" style={{ background: backendConnected ? '#2a9d8f' : '#f4a261' }} />
                <span>
                  Backend API: <strong>{backendConnected ? 'Connected (Node + Express + MongoDB)' : 'Connecting...'}</strong>
                </span>
                <span style={{ color: 'var(--color-muted)' }}>•</span>
                <span style={{ color: 'var(--color-primary)' }}>Port 5001</span>
              </div>

              {/* Verified Identity Tag (No Role Switching Buttons) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--color-muted)' }}>
                  Authenticated:
                </span>
                <span className="neo-badge neo-badge-dark" style={{ fontSize: '0.75rem', padding: '3px 8px' }}>
                  {currentUser?.name || 'User'} ({role})
                </span>
              </div>
            </div>

            {/* Mobile Header */}
            <header className="mobile-header" style={{
              display: 'none',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              background: 'var(--color-dark)',
              color: '#ffffff',
              borderBottom: 'var(--border-dark)'
            }}>
              <button 
                onClick={() => setMobileMenuOpen(true)}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}
              >
                <Menu size={24} />
              </button>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: '1.2rem', color: 'var(--color-bg)' }}>
                RESCUEFLOW
              </span>
              <div 
                onClick={() => navigate(`/${role.toLowerCase()}/profile`)}
                style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.9rem', color: '#ffffff', cursor: 'pointer' }}
              >
                {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
              </div>
            </header>

            {/* Strict Portal Router */}
            <main style={{ flex: 1, overflowY: 'auto' }}>
              {/* DONOR PORTAL SCREENS */}
              {role === 'DONOR' && (
                <>
                  {(currentRoute === '/donor/dashboard' || currentRoute === '/donor/donations') && (
                    <DashboardPage
                      donations={donations}
                      stats={stats}
                      onNavigate={navigate}
                      onSelectDonation={setSelectedDonation}
                    />
                  )}

                  {currentRoute === '/donor/map' && (
                    <LiveNetworkMapPage onNavigate={navigate} />
                  )}

                  {currentRoute === '/donor/create' && (
                    <CreateDonationPage
                      onNavigate={navigate}
                      onDonationCreated={handleDonationCreated}
                    />
                  )}

                  {currentRoute === '/donor/matching' && (
                    <MatchingPage
                      donation={selectedDonation}
                      onNavigate={navigate}
                      onMatchConfirmed={handleMatchConfirmed}
                    />
                  )}

                  {currentRoute === '/donor/donation-details' && (
                    <DonationDetailsPage
                      donation={selectedDonation}
                      onNavigate={navigate}
                    />
                  )}

                  {currentRoute === '/donor/tracking' && (
                    <LiveTrackingPage
                      donation={selectedDonation}
                      onNavigate={navigate}
                      onDeliveryCompleted={handleDeliveryCompleted}
                    />
                  )}

                  {currentRoute === '/donor/impact' && (
                    <ImpactPage onNavigate={navigate} />
                  )}

                  {currentRoute === '/donor/profile' && (
                    <ProfilePage onNavigate={navigate} onLogout={handleLogout} />
                  )}
                </>
              )}

              {/* SHELTER PORTAL SCREENS */}
              {role === 'SHELTER' && (
                <>
                  {currentRoute === '/shelter/dashboard' && (
                    <ShelterDashboardPage
                      tab="dashboard"
                      onNavigate={navigate}
                      onSelectDonation={setSelectedDonation}
                    />
                  )}

                  {currentRoute === '/shelter/map' && (
                    <LiveNetworkMapPage onNavigate={navigate} />
                  )}

                  {currentRoute === '/shelter/available' && (
                    <ShelterDashboardPage
                      tab="available"
                      onNavigate={navigate}
                      onSelectDonation={setSelectedDonation}
                    />
                  )}

                  {currentRoute === '/shelter/accepted' && (
                    <ShelterDashboardPage
                      tab="accepted"
                      onNavigate={navigate}
                      onSelectDonation={setSelectedDonation}
                    />
                  )}

                  {currentRoute === '/shelter/capacity' && (
                    <ShelterDashboardPage
                      tab="capacity"
                      onNavigate={navigate}
                      onSelectDonation={setSelectedDonation}
                    />
                  )}

                  {currentRoute === '/shelter/tracking' && (
                    <LiveTrackingPage
                      donation={selectedDonation}
                      onNavigate={navigate}
                      onDeliveryCompleted={handleDeliveryCompleted}
                    />
                  )}

                  {currentRoute === '/shelter/impact' && (
                    <ImpactPage onNavigate={navigate} />
                  )}

                  {currentRoute === '/shelter/profile' && (
                    <ProfilePage onNavigate={navigate} onLogout={handleLogout} />
                  )}
                </>
              )}

              {/* DRIVER PORTAL SCREENS */}
              {role === 'DRIVER' && (
                <>
                  {currentRoute === '/driver/dashboard' && (
                    <DriverDashboardPage
                      tab="dashboard"
                      onNavigate={navigate}
                      onSelectDonation={setSelectedDonation}
                    />
                  )}

                  {currentRoute === '/driver/map' && (
                    <LiveNetworkMapPage onNavigate={navigate} />
                  )}

                  {currentRoute === '/driver/requests' && (
                    <DriverDashboardPage
                      tab="requests"
                      onNavigate={navigate}
                      onSelectDonation={setSelectedDonation}
                    />
                  )}

                  {currentRoute === '/driver/rescue' && (
                    <DriverDashboardPage
                      tab="rescue"
                      onNavigate={navigate}
                      onSelectDonation={setSelectedDonation}
                    />
                  )}

                  {currentRoute === '/driver/route' && (
                    <LiveTrackingPage
                      donation={selectedDonation}
                      onNavigate={navigate}
                      onDeliveryCompleted={handleDeliveryCompleted}
                    />
                  )}

                  {currentRoute === '/driver/history' && (
                    <DriverDashboardPage
                      tab="history"
                      onNavigate={navigate}
                      onSelectDonation={setSelectedDonation}
                    />
                  )}

                  {currentRoute === '/driver/profile' && (
                    <ProfilePage onNavigate={navigate} onLogout={handleLogout} />
                  )}
                </>
              )}
            </main>
          </div>
        </div>
      )}

      {/* Floating Chrome & Mobile Install Banner */}
      <PWAInstallBanner />
    </div>
  );
}
