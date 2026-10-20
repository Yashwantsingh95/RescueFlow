import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  Phone, 
  Navigation, 
  Award,
  RefreshCw,
  ArrowRight,
  PackageCheck,
  Power
} from 'lucide-react';
import { api, getCurrentUser } from '../services/api';
import { getSocket } from '../services/socket';
import StatCard from '../components/ui/StatCard';

export default function DriverDashboardPage({ tab = 'dashboard', onNavigate, onSelectDonation }) {
  const [driverData, setDriverData] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);

  const currentUser = getCurrentUser();

  const loadData = async () => {
    setLoading(true);
    try {
      const dash = await api.drivers.getDashboard();
      setDriverData(dash);
      if (dash?.driver?.availability) {
        setIsAvailable(dash.driver.availability === 'AVAILABLE');
      }

      const reqs = await api.drivers.getRequests();
      setRequests(reqs.requests || []);
    } catch (err) {
      console.warn('Driver load fallback:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const socket = getSocket();
    if (socket) {
      const handleLiveMissionUpdate = () => {
        loadData();
      };

      socket.on('donation:accepted', handleLiveMissionUpdate);
      socket.on('driver:accepted', handleLiveMissionUpdate);
      socket.on('donation:picked_up', handleLiveMissionUpdate);
      socket.on('donation:delivered', handleLiveMissionUpdate);

      return () => {
        socket.off('donation:accepted', handleLiveMissionUpdate);
        socket.off('driver:accepted', handleLiveMissionUpdate);
        socket.off('donation:picked_up', handleLiveMissionUpdate);
        socket.off('donation:delivered', handleLiveMissionUpdate);
      };
    }
  }, []);

  const handleConfirmPickup = async (id) => {
    try {
      const res = await api.drivers.confirmPickup(id);
      setStatusMessage('✓ Food boxes verified and loaded! Now en-route to shelter.');
      loadData();
      setTimeout(() => setStatusMessage(''), 5000);
    } catch (err) {
      alert(`Error updating pickup: ${err.message}`);
    }
  };

  const handleConfirmDelivery = async (id) => {
    try {
      const res = await api.drivers.confirmDelivery(id);
      setStatusMessage('🎉 Safe handover completed! Rescue marked DELIVERED and impact recorded.');
      loadData();
      setTimeout(() => setStatusMessage(''), 5000);
    } catch (err) {
      alert(`Error completing delivery: ${err.message}`);
    }
  };

  const handleAcceptRequest = async (id) => {
    try {
      const res = await api.drivers.acceptRequest(id);
      setStatusMessage('✓ Mission accepted! Proceed to pickup location.');
      loadData();
      setTimeout(() => setStatusMessage(''), 5000);
    } catch (err) {
      alert(`Error accepting mission: ${err.message}`);
    }
  };

  const toggleAvailability = () => {
    const nextState = !isAvailable;
    setIsAvailable(nextState);
    setStatusMessage(`Status switched to ${nextState ? 'ONLINE & READY' : 'OFFLINE'}`);
    setTimeout(() => setStatusMessage(''), 3000);
  };

  const driver = driverData?.driver || {
    name: currentUser?.name || 'Rahul (Volunteer Express)',
    vehicle: 'Hero Electric Eco-Van (DL-01-EV-4289)',
    availability: isAvailable ? 'AVAILABLE' : 'OFFLINE',
    phone: '+91 98765 43210',
    rating: 4.95
  };

  const activeRescues = requests.filter(r => ['ACCEPTED', 'ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'].includes(r.status));
  const pendingRequests = requests.filter(r => r.status === 'MATCHED' || r.status === 'POSTED');
  const deliveredRescues = requests.filter(r => r.status === 'DELIVERED');

  let displayedMissions = requests;
  if (tab === 'requests') displayedMissions = pendingRequests;
  if (tab === 'rescue') displayedMissions = activeRescues;
  if (tab === 'history') displayedMissions = deliveredRescues;

  return (
    <div style={{ padding: '32px 36px', maxWidth: '1300px', margin: '0 auto' }} className="page-container">
      {/* Top Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '28px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span className="neo-badge neo-badge-matched" style={{ background: '#3a86ff', color: '#ffffff' }}>
              DRIVER VOLUNTEER COCKPIT
            </span>
            <span className={`neo-badge ${isAvailable ? 'neo-badge-live' : 'neo-badge-dark'}`}>
              <span className={isAvailable ? "pulse-dot" : ""} /> {isAvailable ? 'DISPATCH READY' : 'OFFLINE'}
            </span>
          </div>
          <h1 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 'clamp(1.8rem, 3vw, 2.4rem)',
            fontWeight: 800,
            color: 'var(--color-dark)'
          }}>
            {driver.name}
          </h1>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.95rem', fontWeight: 500 }}>
            Vehicle: <strong>{driver.vehicle}</strong> • Phone: {driver.phone}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => onNavigate('/driver/map')}
            className="neo-btn neo-btn-dark"
            style={{ padding: '10px 16px', fontSize: '0.85rem' }}
          >
            <MapPin size={16} />
            <span>Live Logistics Map</span>
          </button>

          <button
            onClick={toggleAvailability}
            className={`neo-btn ${isAvailable ? 'neo-btn-outline' : 'neo-btn-dark'}`}
            style={{ padding: '10px 16px', fontSize: '0.85rem' }}
          >
            <Power size={16} />
            <span>{isAvailable ? 'Go Offline' : 'Go Online'}</span>
          </button>

          <button
            onClick={loadData}
            className="neo-btn neo-btn-outline"
            style={{ padding: '10px 16px', fontSize: '0.85rem', background: '#ffffff' }}
          >
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div style={{
          background: '#d8f3dc',
          border: 'var(--border-dark)',
          borderRadius: '10px',
          padding: '14px 20px',
          marginBottom: '24px',
          fontWeight: 700,
          color: '#1b4332',
          boxShadow: 'var(--shadow-neo-sm)'
        }}>
          {statusMessage}
        </div>
      )}

      {/* Driver Metric Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '20px',
        marginBottom: '36px'
      }}>
        <StatCard
          value={activeRescues.length}
          label="Active Mission"
          subtext={activeRescues.length > 0 ? "Delivery in transit" : "No active pickup"}
          badgeText={activeRescues.length > 0 ? "IN PROGRESS" : "STANDBY"}
        />
        <StatCard
          value={pendingRequests.length}
          label="Available Missions"
          subtext="Ready for dispatch"
        />
        <StatCard
          value={driverData?.stats?.completedCount ?? (14 + deliveredRescues.length)}
          label="Completed Deliveries"
          subtext="Safe food handovers"
        />
        <StatCard
          value="4.95 ★"
          label="Driver Score"
          subtext="On-time rating"
        />
      </div>

      {/* Mission Section */}
      <div className="neo-card" style={{ padding: '32px', background: '#ffffff', marginBottom: '36px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '1.4rem',
              fontWeight: 800,
              color: 'var(--color-dark)'
            }}>
              {tab === 'requests' ? 'New Dispatch Requests' : tab === 'rescue' ? 'Active Rescue Underway' : tab === 'history' ? 'Completed Rescue History' : 'Assigned Rescue Missions'}
            </h2>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.88rem', marginTop: '2px' }}>
              Confirm step-by-step handover from Food Donor to Shelter Recipient.
            </p>
          </div>

          <span className="neo-badge neo-badge-dark">
            {displayedMissions.length} {tab === 'history' ? 'DELIVERED' : 'ASSIGNED'}
          </span>
        </div>

        {displayedMissions.length === 0 ? (
          <p style={{ color: 'var(--color-muted)', padding: '24px 0', textAlign: 'center' }}>
            No missions in this category right now.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {displayedMissions.map((req) => (
              <div
                key={req._id}
                style={{
                  border: 'var(--border-dark)',
                  borderRadius: '12px',
                  padding: '24px',
                  background: 'var(--color-bg)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <span className="neo-badge neo-badge-live" style={{ marginBottom: '8px', display: 'inline-block' }}>
                      STATUS: {req.status}
                    </span>
                    <h3 style={{ fontSize: '1.4rem', fontWeight: 900 }}>
                      {req.foodType}
                    </h3>
                    <p style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                      {req.quantity} {req.unit} • {req.category}
                    </p>
                  </div>

                  {/* Primary Action Buttons */}
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {(req.status === 'MATCHED' || req.status === 'POSTED') && (
                      <button
                        onClick={() => handleAcceptRequest(req._id)}
                        className="neo-btn neo-btn-dark"
                        style={{ padding: '10px 18px', fontSize: '0.9rem' }}
                      >
                        <CheckCircle2 size={18} />
                        <span>Accept Delivery Mission</span>
                      </button>
                    )}

                    {(req.status === 'ACCEPTED' || req.status === 'ASSIGNED') && (
                      <button
                        onClick={() => handleConfirmPickup(req._id)}
                        className="neo-btn neo-btn-dark"
                        style={{ padding: '10px 18px', fontSize: '0.9rem' }}
                      >
                        <PackageCheck size={18} />
                        <span>Confirm Pickup from Donor</span>
                      </button>
                    )}

                    {(req.status === 'PICKED_UP' || req.status === 'ON_THE_WAY') && (
                      <button
                        onClick={() => handleConfirmDelivery(req._id)}
                        className="neo-btn neo-btn-dark"
                        style={{ padding: '10px 18px', fontSize: '0.9rem' }}
                      >
                        <CheckCircle2 size={18} />
                        <span>Confirm Delivery to Shelter</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        if (onSelectDonation) onSelectDonation(req);
                        onNavigate('/driver/route');
                      }}
                      className="neo-btn neo-btn-outline"
                      style={{ padding: '10px 16px', fontSize: '0.9rem', background: '#ffffff' }}
                    >
                      <Navigation size={18} />
                      <span>Open Live GPS Navigation</span>
                    </button>
                  </div>
                </div>

                {/* Waypoints */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '16px',
                  padding: '16px',
                  background: '#ffffff',
                  border: 'var(--border-dark)',
                  borderRadius: '10px'
                }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-muted)' }}>
                      Pickup Point (Donor)
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', marginTop: '2px' }}>
                      {req.donorId?.name || 'ABC Restaurant'}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
                      {req.pickupLocation?.address || 'Connaught Place, New Delhi'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-muted)' }}>
                      Dropoff Point (Shelter)
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', marginTop: '2px' }}>
                      {req.shelterId?.name || 'Shelter A (Hope Foundation)'}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)' }}>
                      {req.shelterId?.location?.address || 'Plot 14, Karol Bagh, New Delhi'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
