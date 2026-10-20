import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Package, 
  Check, 
  X, 
  Truck, 
  Clock, 
  MapPin, 
  ArrowRight, 
  AlertCircle,
  Users,
  ShieldCheck,
  RefreshCw,
  Sliders,
  CheckCircle2,
  Save,
  Edit2
} from 'lucide-react';
import { api, getCurrentUser } from '../services/api';
import { getSocket } from '../services/socket';
import StatCard from '../components/ui/StatCard';
import ShelterLocationPicker from '../components/ui/ShelterLocationPicker';
import { formatCoordinates } from '../services/locationService';

export default function ShelterDashboardPage({ tab = 'dashboard', onNavigate, onSelectDonation }) {
  const [shelterData, setShelterData] = useState(null);
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');
  
  // Capacity update form state
  const [capacityInput, setCapacityInput] = useState(120);
  const [needInput, setNeedInput] = useState('HIGH');
  const [capacitySaved, setCapacitySaved] = useState(false);

  // Edit shelter location state
  const [showEditLocationModal, setShowEditLocationModal] = useState(false);
  const [locationSaving, setLocationSaving] = useState(false);

  const currentUser = getCurrentUser();

  const handleLocationConfirmed = async (locData) => {
    setLocationSaving(true);
    try {
      await api.shelters.updateLocation({
        latitude: locData.latitude,
        longitude: locData.longitude,
        address: locData.address
      });
      setShowEditLocationModal(false);
      setActionMessage('Shelter location registered & updated successfully! Changes are live across the rescue network.');
      setTimeout(() => setActionMessage(''), 5000);
      loadData();
    } catch (err) {
      alert(`Failed to update shelter location: ${err.message}`);
    } finally {
      setLocationSaving(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const dash = await api.shelters.getDashboard();
      setShelterData(dash);
      if (dash?.shelter?.capacity) {
        setCapacityInput(dash.shelter.capacity);
      }
      if (dash?.shelter?.currentNeed) {
        setNeedInput(dash.shelter.currentNeed);
      }

      const dons = await api.shelters.getDonations();
      setDonations(dons.donations || []);
    } catch (err) {
      console.warn('Shelter load fallback:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const socket = getSocket();
    if (socket) {
      const handleLiveFeedUpdate = () => {
        loadData();
      };

      socket.on('donation:matched', handleLiveFeedUpdate);
      socket.on('donation:created', handleLiveFeedUpdate);
      socket.on('donation:accepted', handleLiveFeedUpdate);
      socket.on('donation:delivered', handleLiveFeedUpdate);

      return () => {
        socket.off('donation:matched', handleLiveFeedUpdate);
        socket.off('donation:created', handleLiveFeedUpdate);
        socket.off('donation:accepted', handleLiveFeedUpdate);
        socket.off('donation:delivered', handleLiveFeedUpdate);
      };
    }
  }, []);

  const handleAccept = async (id) => {
    try {
      const res = await api.shelters.accept(id);
      setActionMessage(`✓ Accepted donation! Driver ${res.driver ? res.driver.name : 'assigned'} is dispatched for pickup.`);
      loadData();
      setTimeout(() => setActionMessage(''), 5000);
    } catch (err) {
      alert(`Error accepting: ${err.message}`);
    }
  };

  const handleReject = async (id) => {
    try {
      const res = await api.shelters.reject(id);
      setActionMessage(`✓ Passed. ${res.message}`);
      loadData();
      setTimeout(() => setActionMessage(''), 5000);
    } catch (err) {
      alert(`Error declining: ${err.message}`);
    }
  };

  const handleUpdateCapacity = async (e) => {
    e.preventDefault();
    try {
      await api.shelters.updateCapacity({
        capacity: Number(capacityInput),
        currentNeed: needInput
      });
      setCapacitySaved(true);
      loadData();
      setTimeout(() => setCapacitySaved(false), 3000);
    } catch (err) {
      alert(`Failed to update capacity: ${err.message}`);
    }
  };

  const shelter = shelterData?.shelter || {
    name: currentUser?.name || 'Shelter Facility',
    capacity: capacityInput,
    currentOccupancy: 0,
    location: currentUser?.location || null,
    currentNeed: needInput
  };

  const hasValidCoords = Boolean(
    shelter.location?.coordinates && 
    Array.isArray(shelter.location.coordinates) && 
    shelter.location.coordinates.length === 2 && 
    !isNaN(shelter.location.coordinates[0]) && 
    !isNaN(shelter.location.coordinates[1])
  );

  const availableCapacity = Math.max(0, shelter.capacity - (shelter.currentOccupancy || 0));

  // Tab filtering logic
  const availableDonations = donations.filter(d => d.status === 'MATCHED' || d.status === 'POSTED');
  const acceptedDonations = donations.filter(d => ['ACCEPTED', 'ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED'].includes(d.status));

  let displayedDonations = donations;
  if (tab === 'available') displayedDonations = availableDonations;
  if (tab === 'accepted') displayedDonations = acceptedDonations;

  return (
    <div style={{ padding: '32px 36px', maxWidth: '1300px', margin: '0 auto' }} className="page-container">
      {/* Top Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span className="neo-badge neo-badge-matched" style={{ background: '#e76f51', color: '#ffffff' }}>
              SHELTER RECIPIENT PORTAL
            </span>
            <span className="neo-badge neo-badge-live">
              <span className="pulse-dot" /> LIVE NETWORK
            </span>
          </div>
          <h1 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 'clamp(1.8rem, 3vw, 2.4rem)',
            fontWeight: 800,
            color: 'var(--color-dark)'
          }}>
            {shelter.name}
          </h1>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.95rem', fontWeight: 500, margin: '4px 0 0' }}>
            {hasValidCoords ? (shelter.location?.address || 'Registered Location') : 'No location registered'} • Need: <strong>{shelter.currentNeed}</strong>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => onNavigate('/shelter/map')}
            className="neo-btn neo-btn-dark"
            style={{ padding: '10px 16px', fontSize: '0.85rem' }}
          >
            <MapPin size={16} />
            <span>Live Network Map</span>
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

      {/* Shelter Registered Location Bar */}
      <div 
        className="neo-card"
        style={{
          background: '#ffffff',
          padding: '16px 22px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          border: '2px solid var(--color-dark)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            background: hasValidCoords ? '#e76f51' : '#b00020',
            color: '#ffffff',
            borderRadius: '10px',
            border: '2px solid var(--color-dark)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Building2 size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-muted)' }}>
                Registered Shelter Location
              </span>
              {hasValidCoords ? (
                <span className="neo-badge neo-badge-matched" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                  ACTIVE ON LIVE MAP
                </span>
              ) : (
                <span className="neo-badge neo-badge-expired" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                  LOCATION REQUIRED
                </span>
              )}
            </div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--color-dark)', marginTop: '2px' }}>
              {shelter.location?.address || 'No location registered yet'}
            </div>
            {hasValidCoords ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', fontWeight: 600, marginTop: '2px' }}>
                Latitude: <strong>{shelter.location.coordinates[1].toFixed(5)}</strong> • Longitude: <strong>{shelter.location.coordinates[0].toFixed(5)}</strong> ({formatCoordinates(shelter.location.coordinates[1], shelter.location.coordinates[0])})
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: '#b00020', fontWeight: 700, marginTop: '2px' }}>
                ⚠️ Please select and confirm your shelter location on the map. Rescues cannot be routed without an exact location.
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowEditLocationModal(true)}
          className="neo-btn neo-btn-dark"
          style={{ padding: '10px 18px', fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Edit2 size={15} />
          <span>{hasValidCoords ? 'Edit Location' : 'Set Shelter Location'}</span>
        </button>
      </div>

      {/* Edit Shelter Location Modal */}
      {showEditLocationModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(13, 19, 33, 0.75)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div 
            className="neo-card"
            style={{
              background: '#ffffff',
              maxWidth: '820px',
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              padding: '28px',
              border: '3px solid var(--color-dark)',
              boxShadow: 'var(--shadow-neo-lg)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '1.4rem',
                  fontWeight: 900,
                  margin: 0,
                  color: 'var(--color-dark)'
                }}>
                  {hasValidCoords ? 'Edit Shelter Location' : 'Set Shelter Location'}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--color-muted)' }}>
                  Search for your shelter's address, click anywhere on the map, or drag the pin. This permanent registered location will appear on the live network map.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditLocationModal(false)}
                className="neo-btn neo-btn-outline"
                style={{ width: '36px', height: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={20} />
              </button>
            </div>

            <ShelterLocationPicker
              initialLocation={hasValidCoords ? shelter.location : null}
              onLocationConfirmed={handleLocationConfirmed}
              onCancel={() => setShowEditLocationModal(false)}
              confirmButtonText={locationSaving ? 'Saving to Database...' : 'Confirm & Save Location'}
            />
          </div>
        </div>
      )}

      {actionMessage && (
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
          {actionMessage}
        </div>
      )}

      {/* Stats Cards (Overview) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '20px',
        marginBottom: '36px'
      }}>
        <StatCard
          value={shelterData?.stats?.availableCapacity ?? availableCapacity}
          label="Available Meal Capacity"
          subtext={`Max Storage: ${shelter.capacity} meals`}
          badgeText={availableCapacity > 20 ? "CAPACITY AVAILABLE" : "NEARING LIMIT"}
        />
        <StatCard
          value={availableDonations.length}
          label="Available / Matched"
          subtext="Awaiting your acceptance"
        />
        <StatCard
          value={acceptedDonations.filter(d => ['ACCEPTED', 'PICKED_UP', 'ON_THE_WAY'].includes(d.status)).length}
          label="Inbound In-Transit"
          subtext="En route to your facility"
        />
        <StatCard
          value={shelterData?.stats?.totalReceived ?? 18}
          label="Rescues Received"
          subtext="Meals safely distributed"
        />
      </div>

      {/* Capacity & Need Configuration Tab View */}
      {(tab === 'capacity' || tab === 'dashboard') && (
        <div className="neo-card" style={{ padding: '28px', background: '#ffffff', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Sliders size={20} color="var(--color-primary)" />
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.35rem', fontWeight: 800 }}>
              Shelter Capacity & Urgent Need Controls
            </h2>
          </div>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
            The geospatial matching engine uses your capacity and need status to pair time-sensitive donations accurately.
          </p>

          <form onSubmit={handleUpdateCapacity} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px', alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, marginBottom: '6px' }}>
                Total Facility Meal Capacity
              </label>
              <input
                type="number"
                min="10"
                max="1000"
                className="neo-input"
                value={capacityInput}
                onChange={(e) => setCapacityInput(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, marginBottom: '6px' }}>
                Current Urgency / Need Tier
              </label>
              <select
                className="neo-input"
                value={needInput}
                onChange={(e) => setNeedInput(e.target.value)}
              >
                <option value="CRITICAL">CRITICAL (Immediate intake needed)</option>
                <option value="HIGH">HIGH (Strong daily demand)</option>
                <option value="MEDIUM">MEDIUM (Normal intake)</option>
                <option value="LOW">LOW (Near capacity)</option>
              </select>
            </div>

            <div>
              <button
                type="submit"
                className="neo-btn neo-btn-dark"
                style={{ width: '100%', padding: '12px' }}
              >
                <Save size={16} />
                <span>{capacitySaved ? 'Capacity Updated!' : 'Save Capacity'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Inbound & Matched Donations Queue */}
      {tab !== 'capacity' && (
        <div className="neo-card" style={{ padding: '32px', background: '#ffffff', marginBottom: '36px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '1.4rem',
              fontWeight: 800,
              color: 'var(--color-dark)'
            }}>
              {tab === 'available' ? 'Available Surplus Donations For Acceptance' : tab === 'accepted' ? 'Accepted Inbound Rescues' : 'Inbound & Matched Rescue Donations'}
            </h2>

            <span className="neo-badge neo-badge-dark">
              {displayedDonations.length} {tab === 'accepted' ? 'IN-TRANSIT' : 'RESCUES'}
            </span>
          </div>

          {displayedDonations.length === 0 ? (
            <p style={{ color: 'var(--color-muted)', padding: '24px 0', textAlign: 'center' }}>
              No donations matching this filter right now.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {displayedDonations.map((d) => {
                const isMatched = d.status === 'MATCHED' || d.status === 'POSTED';
                const isInTransit = ['ACCEPTED', 'ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'].includes(d.status);

                return (
                  <div
                    key={d._id}
                    style={{
                      border: 'var(--border-dark)',
                      borderRadius: '12px',
                      padding: '20px 24px',
                      background: 'var(--color-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '16px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '10px',
                        background: 'var(--color-primary)',
                        border: 'var(--border-dark)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff'
                      }}>
                        <Package size={24} />
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-dark)' }}>
                            {d.foodType}
                          </h3>
                          <span className={`neo-badge ${isInTransit ? 'neo-badge-live' : 'neo-badge-matched'}`}>
                            {d.status}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-primary)', marginTop: '2px' }}>
                          {d.quantity} {d.unit} • {d.category}
                        </div>

                        <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginTop: '4px' }}>
                          Donor: <strong>{d.donorId?.name || 'ABC Restaurant'}</strong> • Pickup: {d.pickupLocation?.address || 'Connaught Place'}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {isMatched && (
                        <>
                          <button
                            onClick={() => handleAccept(d._id)}
                            className="neo-btn neo-btn-dark"
                            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                          >
                            <Check size={16} />
                            <span>Accept & Dispatch Driver</span>
                          </button>
                          <button
                            onClick={() => handleReject(d._id)}
                            className="neo-btn neo-btn-outline"
                            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                            title="Pass donation to trigger fallback shelter matching"
                          >
                            <X size={16} />
                            <span>Pass / Reroute</span>
                          </button>
                        </>
                      )}

                      {isInTransit && (
                        <button
                          onClick={() => {
                            if (onSelectDonation) onSelectDonation(d);
                            onNavigate('/shelter/tracking');
                          }}
                          className="neo-btn neo-btn-dark"
                          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                        >
                          <Truck size={16} />
                          <span>Track Live Delivery →</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
