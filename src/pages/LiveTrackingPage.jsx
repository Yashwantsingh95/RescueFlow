import React, { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, 
  Phone, 
  MessageSquare, 
  Clock, 
  CheckCircle2, 
  X, 
  Navigation,
  Crosshair,
  RefreshCw,
  Loader2,
  AlertCircle
} from 'lucide-react';
import RealMap from '../components/ui/RealMap';
import DeliveryModal from '../components/ui/DeliveryModal';
import { api, getCurrentUser } from '../services/api';
import { getSocket, joinRescueRoom, leaveRescueRoom } from '../services/socket';
import { 
  requestCurrentPosition, 
  startWatchingPosition, 
  stopWatchingPosition,
  formatCoordinates 
} from '../services/locationService';

export default function LiveTrackingPage({ donation, onNavigate, onDeliveryCompleted }) {
  // Read donation prop or fallback to active session storage
  const storedDonation = (() => {
    try {
      const saved = sessionStorage.getItem('active_tracking_donation');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  })();

  const d = donation || storedDonation || {
    id: 'ACTIVE-TRACK',
    foodType: 'Meals in Transit',
    quantity: 30,
    unit: 'meals',
    pickupLocation: 'Pickup Point',
    shelter: { name: 'Shelter Facility', address: 'Shelter Destination' },
    driver: {
      name: 'Rahul',
      phone: '+91 98765 43210',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80',
      vehicle: 'Hero Electric Eco-Van'
    },
    image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=400&q=80'
  };

  const [rescueData, setRescueData] = useState(null);
  const [donorCoords, setDonorCoords] = useState(
    d.pickupCoordinates || 
    d.pickupLocation?.coordinates ||
    (Array.isArray(d.pickupLocation?.coordinates) ? d.pickupLocation.coordinates : null)
  );
  const [shelterCoords, setShelterCoords] = useState(
    d.shelter?.coordinates || 
    d.shelter?.location?.coordinates ||
    (Array.isArray(d.deliveryLocation?.coordinates) ? d.deliveryLocation.coordinates : null)
  );
  const [driverCoords, setDriverCoords] = useState(
    d.driver?.coordinates || 
    d.driver?.location?.coordinates ||
    (Array.isArray(d.lastDriverLocation?.coordinates) ? d.lastDriverLocation.coordinates : null)
  );
  const [userCoords, setUserCoords] = useState(null);
  const [userAccuracy, setUserAccuracy] = useState(null);
  const [userUpdatedAt, setUserUpdatedAt] = useState(null);
  const [driverUpdatedAt, setDriverUpdatedAt] = useState(null);
  const [currentStatus, setCurrentStatus] = useState(d?.status || 'ON_THE_WAY');

  // Sync state if active donation prop updates
  useEffect(() => {
    const p = d.pickupCoordinates || d.pickupLocation?.coordinates || (Array.isArray(d.pickupLocation?.coordinates) ? d.pickupLocation.coordinates : null);
    const s = d.shelter?.coordinates || d.shelter?.location?.coordinates || (Array.isArray(d.deliveryLocation?.coordinates) ? d.deliveryLocation.coordinates : null);
    const dr = d.driver?.coordinates || d.driver?.location?.coordinates || (Array.isArray(d.lastDriverLocation?.coordinates) ? d.lastDriverLocation.coordinates : null);

    if (isValidCoordinate(p)) setDonorCoords(p);
    if (isValidCoordinate(s)) setShelterCoords(s);
    if (isValidCoordinate(dr)) setDriverCoords(dr);
    if (d.status) setCurrentStatus(d.status);
  }, [d]);
  
  // Real Distance & ETA Routing States
  const [distanceKm, setDistanceKm] = useState(null);
  const [etaMinutes, setEtaMinutes] = useState(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(true);
  const [routeError, setRouteError] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);

  const [showContactModal, setShowContactModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [gpsError, setGpsError] = useState(null);

  const activeUser = getCurrentUser();
  const userRole = activeUser?.role?.toUpperCase() || 'DONOR';

  // Coordinate validator: GeoJSON coordinates are [longitude, latitude]
  const isValidCoordinate = (c) => {
    return Array.isArray(c) && 
      c.length === 2 && 
      typeof c[0] === 'number' && 
      typeof c[1] === 'number' && 
      !isNaN(c[0]) && 
      !isNaN(c[1]) && 
      c[0] >= -180 && c[0] <= 180 && 
      c[1] >= -90 && c[1] <= 90 &&
      (c[0] !== 0 || c[1] !== 0);
  };

  // Real Turn-by-Turn Road Routing Pipeline
  const calculateRoute = useCallback(async (origin, destination) => {
    if (!isValidCoordinate(origin) || !isValidCoordinate(destination)) {
      console.warn('[Routing Flow] Skipping route calculation: Coordinates not yet available or invalid:', { origin, destination });
      setIsCalculatingRoute(false);
      return;
    }

    setIsCalculatingRoute(true);
    setRouteError(null);

    try {
      console.log('[Routing Flow] Requesting real turn-by-turn route between:', { origin, destination });
      const res = await api.locations.getDirections(origin, destination);

      if (res && res.success && res.route) {
        const { distanceKm: dist, durationMinutes: dur, coordinates } = res.route;

        if (dist != null && !isNaN(Number(dist)) && dur != null && !isNaN(Number(dur))) {
          const finalDist = Number(dist);
          const finalEta = Number(dur);

          setDistanceKm(finalDist);
          setEtaMinutes(finalEta);
          if (Array.isArray(coordinates) && coordinates.length > 0) {
            setRouteCoordinates(coordinates);
          }
          setRouteError(null);
          console.log(`[Routing Flow] Successfully calculated route: ${finalDist} km, ${finalEta} min`);
          return;
        }
      }
      throw new Error('Routing API did not return valid distanceKm or durationMinutes');
    } catch (err) {
      console.error('[Routing Flow Technical Error]', err);
      setRouteError('Unable to calculate');
    } finally {
      setIsCalculatingRoute(false);
    }
  }, []);

  // 1. Fetch real tracking data and network coordinates from MongoDB
  const loadTrackingData = useCallback(async () => {
    try {
      const trackId = d.id || d._id;
      // First attempt: fetch specific rescue tracking if active
      if (trackId) {
        try {
          const res = await api.rescues.getTracking(trackId);
          if (res && res.rescue) {
            const r = res.rescue;
            setRescueData(r);
            setCurrentStatus(r.status || 'ON_THE_WAY');

            const pCoords = r.pickupLocation?.coordinates || 
                            r.pickup?.location?.coordinates || 
                            r.donorId?.location?.coordinates;
            const sCoords = r.deliveryLocation?.coordinates || 
                            r.destination?.location?.coordinates || 
                            r.shelterId?.location?.coordinates;
            const dCoords = r.lastDriverLocation?.coordinates || 
                            r.driver?.location?.coordinates || 
                            r.driverId?.location?.coordinates;

            if (isValidCoordinate(pCoords)) setDonorCoords(pCoords);
            if (isValidCoordinate(sCoords)) setShelterCoords(sCoords);
            if (isValidCoordinate(dCoords)) {
              setDriverCoords(dCoords);
              setDriverUpdatedAt(r.lastDriverLocation?.timestamp || new Date().toISOString());
            }

            if (r.distance != null && !isNaN(Number(r.distance))) {
              setDistanceKm(Number(r.distance));
            }
            if (r.eta != null && !isNaN(Number(r.eta))) {
              setEtaMinutes(Number(r.eta));
            }
            if (Array.isArray(r.routeCoordinates) && r.routeCoordinates.length > 0) {
              setRouteCoordinates(r.routeCoordinates);
            }

            // If distance/eta are already present from backend, populate them
            if (r.distance != null && r.eta != null) {
              setDistanceKm(r.distance);
              setEtaMinutes(r.eta);
              setIsCalculatingRoute(false);
              setRouteError(null);
              return;
            }

            // If coordinates exist but distance/eta are not yet computed, trigger routing
            const origin = dCoords || pCoords;
            const dest = sCoords;
            if (isValidCoordinate(origin) && isValidCoordinate(dest)) {
              await calculateRoute(origin, dest);
            } else {
              setIsCalculatingRoute(false);
            }
            return;
          }
        } catch (rescueErr) {
          console.warn('[Tracking Flow] Specific rescue lookup notice:', rescueErr.message);
        }
      }

      // Second attempt: fetch real network from MongoDB if no active rescue
      const network = await api.map.getNetwork();
      if (network) {
        let pCoords = null;
        let sCoords = null;
        let dCoords = null;

        if (network.shelters?.length > 0 && isValidCoordinate(network.shelters[0].coordinates)) {
          sCoords = network.shelters[0].coordinates;
          setShelterCoords(sCoords);
        }
        if (network.donations?.length > 0 && isValidCoordinate(network.donations[0].coordinates)) {
          pCoords = network.donations[0].coordinates;
          setDonorCoords(pCoords);
        }
        if (network.drivers?.length > 0 && isValidCoordinate(network.drivers[0].coordinates)) {
          dCoords = network.drivers[0].coordinates;
          setDriverCoords(dCoords);
          setDriverUpdatedAt(network.drivers[0].updatedAt);
        }
        if (network.currentUser?.coordinates && isValidCoordinate(network.currentUser.coordinates)) {
          setUserCoords(network.currentUser.coordinates);
          setUserAccuracy(network.currentUser.accuracy);
          setUserUpdatedAt(network.currentUser.timestamp);
        }

        const origin = dCoords || pCoords;
        const dest = sCoords;
        if (isValidCoordinate(origin) && isValidCoordinate(dest)) {
          await calculateRoute(origin, dest);
        } else {
          setIsCalculatingRoute(false);
        }
      } else {
        setIsCalculatingRoute(false);
      }
    } catch (err) {
      console.error('[Tracking Flow] Tracking data load notice:', err.message);
      setIsCalculatingRoute(false);
    }
  }, [d.id, d._id, calculateRoute]);

  // 2. Real Browser Geolocation Trigger ("Locate My Device")
  const detectUserGPS = async () => {
    setLocLoading(true);
    setGpsError(null);
    try {
      const pos = await requestCurrentPosition();
      const coords = [pos.longitude, pos.latitude];
      setUserCoords(coords);
      setUserAccuracy(pos.accuracy);
      setUserUpdatedAt(pos.timestamp);

      // Authenticated user updates THEIR OWN location in MongoDB GeoJSON
      await api.locations.updateUserLocation({
        latitude: pos.latitude,
        longitude: pos.longitude,
        accuracy: pos.accuracy,
        timestamp: pos.timestamp
      });
    } catch (err) {
      console.warn('GPS detection notice:', err.message);
      if (err.message.toLowerCase().includes('denied')) {
        setGpsError('Location permission denied. Enable location access in browser settings.');
      } else {
        setGpsError('Unable to determine your location.');
      }
    } finally {
      setLocLoading(false);
    }
  };

  // 3. Driver Live GPS: Watch driver position and sync to backend
  useEffect(() => {
    if (userRole === 'DRIVER') {
      const wid = startWatchingPosition((pos) => {
        setDriverCoords([pos.longitude, pos.latitude]);
        setDriverUpdatedAt(pos.timestamp);
      }, 6000);

      return () => {
        stopWatchingPosition();
      };
    }
  }, [userRole]);

  // 4. Socket.IO Real-Time Synchronization for Live Movement & Status
  useEffect(() => {
    loadTrackingData();
    detectUserGPS();

    const rescueRoomId = d.id || d._id || 'ACTIVE-TRACK';
    joinRescueRoom(rescueRoomId);

    const socket = getSocket();
    if (socket) {
      const handleDriverLocation = (payload) => {
        const coords = payload.coordinates || (payload.longitude && payload.latitude ? [payload.longitude, payload.latitude] : null);
        if (coords && isValidCoordinate(coords)) {
          setDriverCoords(coords);
          setDriverUpdatedAt(payload.timestamp || new Date().toISOString());
        }
      };

      const handleStatusChange = (payload) => {
        if (payload.status) {
          setCurrentStatus(payload.status);
          if (payload.status === 'DELIVERED') {
            setShowDeliveryModal(true);
          }
        }
      };

      socket.on('driver:location_updated', handleDriverLocation);
      socket.on('donation:picked_up', handleStatusChange);
      socket.on('donation:on_the_way', handleStatusChange);
      socket.on('donation:delivered', handleStatusChange);

      return () => {
        leaveRescueRoom(rescueRoomId);
        socket.off('driver:location_updated', handleDriverLocation);
        socket.off('donation:picked_up', handleStatusChange);
        socket.off('donation:on_the_way', handleStatusChange);
        socket.off('donation:delivered', handleStatusChange);
      };
    }
  }, [d.id, d._id, loadTrackingData]);

  // 5. Automatically re-calculate route whenever live driver / donor or shelter coordinates update
  useEffect(() => {
    const origin = driverCoords || donorCoords || (userRole === 'DRIVER' ? userCoords : null);
    const destination = shelterCoords || (currentStatus === 'ASSIGNED' ? donorCoords : null);

    if (isValidCoordinate(origin) && isValidCoordinate(destination)) {
      calculateRoute(origin, destination);
    } else {
      const timer = setTimeout(() => {
        setIsCalculatingRoute(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [driverCoords, donorCoords, shelterCoords, userCoords, currentStatus, calculateRoute]);

  // Real Road Routing Callback
  const handleRouteCalculated = useCallback(({ distanceKm: dist, etaMinutes: eta }) => {
    if (dist != null && !isNaN(Number(dist))) setDistanceKm(Number(dist));
    if (eta != null && !isNaN(Number(eta))) setEtaMinutes(Number(eta));
    setIsCalculatingRoute(false);
    setRouteError(null);
  }, []);

  const returnDashboard = userRole === 'SHELTER' ? '/shelter/dashboard' : userRole === 'DRIVER' ? '/driver/dashboard' : '/donor/dashboard';
  const returnImpact = userRole === 'SHELTER' ? '/shelter/impact' : userRole === 'DRIVER' ? '/driver/history' : '/donor/impact';

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1300px', margin: '0 auto' }} className="page-container">
      {/* Top Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => onNavigate(returnDashboard)}
            className="neo-btn neo-btn-outline"
            style={{ padding: '8px 12px' }}
            title="Return to Dashboard"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '1.75rem',
            fontWeight: 800,
            color: 'var(--color-dark)',
            margin: 0
          }}>
            Real GPS Live Tracking
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={detectUserGPS}
            disabled={locLoading}
            className="neo-btn neo-btn-outline"
            style={{ padding: '8px 14px', fontSize: '0.85rem', background: '#ffffff' }}
          >
            {locLoading ? <Loader2 size={16} className="anim-spin" /> : <Crosshair size={16} />}
            <span>{locLoading ? 'Locating...' : 'Locate My Device'}</span>
          </button>

          <span className="neo-badge neo-badge-live" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
            <span className="pulse-dot" />
            {currentStatus}
          </span>
        </div>
      </div>

      {/* GPS Error Notification if permission denied or unavailable */}
      {gpsError && (
        <div style={{
          background: '#fff2f2',
          border: '2px solid #e63946',
          borderRadius: '8px',
          padding: '10px 16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.85rem',
          fontWeight: 700,
          color: '#e63946'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} />
            <span>{gpsError}</span>
          </div>
          <button
            onClick={() => setGpsError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 800, color: '#e63946' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Real Interactive Google Map */}
      <div style={{ marginBottom: '24px' }}>
        <RealMap
          donorCoords={donorCoords}
          donorName={d.donor || 'ABC Restaurant'}
          donorAddress={d.pickupLocation || 'Pickup Point'}
          shelterCoords={shelterCoords}
          shelterName={d.shelter?.name || 'Shelter A'}
          shelterAddress={d.shelter?.address || 'Shelter Facility'}
          driverCoords={driverCoords}
          driverName={d.driver?.name || 'Rahul'}
          driverVehicle={d.driver?.vehicle || 'Hero Electric Eco-Van'}
          driverPhone={d.driver?.phone || '+91 98765 43210'}
          driverStatus={currentStatus}
          driverUpdatedAt={driverUpdatedAt}
          userCoords={userCoords}
          userAccuracy={userAccuracy}
          userUpdatedAt={userUpdatedAt}
          routeCoordinates={routeCoordinates}
          height="460px"
          status={currentStatus}
          interactive={true}
          onLocateDevice={detectUserGPS}
          onRouteCalculated={handleRouteCalculated}
        />
      </div>

      {/* Bottom Panel Card */}
      <div 
        className="neo-card" 
        style={{
          padding: '24px',
          background: '#ffffff'
        }}
      >
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          {/* Driver Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <img
              src={d.driver?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80'}
              alt={d.driver?.name}
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                border: 'var(--border-dark)',
                objectFit: 'cover'
              }}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: 'var(--color-dark)',
                  margin: 0
                }}>
                  {d.driver?.name || 'Rahul'}
                </h3>
                <span className="neo-badge neo-badge-matched" style={{ fontSize: '0.7rem' }}>
                  ★ 4.95
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', fontWeight: 600, margin: '4px 0 0' }}>
                {d.driver?.vehicle || 'Hero Electric Eco-Van (DL-01-EV-4289)'}
              </p>
            </div>
          </div>

          {/* Real-time Road Distance & ETA Metrics */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
            background: 'var(--color-bg)',
            padding: '12px 20px',
            borderRadius: '10px',
            border: 'var(--border-dark)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={20} color="var(--color-primary)" />
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-muted)' }}>
                  Estimated Arrival
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-dark)' }}>
                  {currentStatus === 'DELIVERED' 
                    ? 'Arrived' 
                    : isCalculatingRoute
                    ? 'Calculating...'
                    : routeError
                    ? 'Unable to calculate'
                    : etaMinutes != null 
                    ? `${etaMinutes} min` 
                    : 'Unable to calculate'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Navigation size={20} color="var(--color-primary)" />
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-muted)' }}>
                  Road Distance
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-dark)' }}>
                  {currentStatus === 'DELIVERED' 
                    ? '0.0 km' 
                    : isCalculatingRoute
                    ? 'Calculating...'
                    : routeError
                    ? 'Unable to calculate'
                    : distanceKm != null 
                    ? `${distanceKm} km` 
                    : 'Unable to calculate'}
                </div>
              </div>
            </div>
          </div>

          {/* Food Item Summary */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <img
              src={d.image}
              alt={d.foodType}
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '10px',
                border: 'var(--border-dark)',
                objectFit: 'cover'
              }}
            />
            <div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-dark)', margin: 0 }}>
                {d.foodType}
              </h4>
              <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-primary)', margin: '4px 0 0' }}>
                {d.quantity} {d.unit}
              </p>
            </div>
          </div>

          {/* Contact Button */}
          <div>
            <button
              onClick={() => setShowContactModal(true)}
              className="neo-btn neo-btn-dark"
              style={{ width: '100%', padding: '12px' }}
            >
              <Phone size={18} />
              <span>Contact Driver</span>
            </button>
          </div>
        </div>

        {/* 3-Step Milestone Status Bar */}
        <div style={{
          borderTop: '1px solid #e2dcc8',
          paddingTop: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
          paddingLeft: '20px',
          paddingRight: '20px'
        }}>
          {/* Step 1: Picked Up */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
            <div style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              background: ['PICKED_UP', 'ON_THE_WAY', 'DELIVERED'].includes(currentStatus) ? 'var(--color-primary)' : '#ffffff',
              color: ['PICKED_UP', 'ON_THE_WAY', 'DELIVERED'].includes(currentStatus) ? '#ffffff' : 'var(--color-dark)',
              border: '2px solid var(--color-dark)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 800,
              marginBottom: '6px'
            }}>
              ✓
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>Picked Up</span>
          </div>

          {/* Step 2: On The Way */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
            <div style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              background: ['ON_THE_WAY', 'DELIVERED'].includes(currentStatus) ? 'var(--color-primary)' : '#ffffff',
              color: ['ON_THE_WAY', 'DELIVERED'].includes(currentStatus) ? '#ffffff' : 'var(--color-dark)',
              border: '2px solid var(--color-dark)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 800,
              marginBottom: '6px'
            }}>
              {['ON_THE_WAY', 'DELIVERED'].includes(currentStatus) ? '✓' : '●'}
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>On The Way</span>
          </div>

          {/* Step 3: Delivered */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2 }}>
            <div style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              background: currentStatus === 'DELIVERED' ? 'var(--color-primary)' : '#ffffff',
              color: currentStatus === 'DELIVERED' ? '#ffffff' : 'var(--color-dark)',
              border: '2px solid var(--color-dark)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 800,
              marginBottom: '6px'
            }}>
              {currentStatus === 'DELIVERED' ? '✓' : '○'}
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: currentStatus === 'DELIVERED' ? 'var(--color-dark)' : 'var(--color-muted)' }}>
              Delivered
            </span>
          </div>
        </div>
      </div>

      {/* Driver Contact Modal */}
      {showContactModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(13, 19, 33, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
          padding: '20px'
        }}>
          <div className="neo-card" style={{ width: '100%', maxWidth: '400px', padding: '28px', background: '#ffffff', position: 'relative' }}>
            <button
              onClick={() => setShowContactModal(false)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <img
                src={d.driver?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120&q=80'}
                alt={d.driver?.name}
                style={{ width: '70px', height: '70px', borderRadius: '50%', border: 'var(--border-dark)', margin: '0 auto 12px' }}
              />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>{d.driver?.name || 'Rahul Sharma'}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '4px' }}>Vehicle: {d.driver?.vehicle || 'Electric Cargo Van'}</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <a
                href={`tel:${d.driver?.phone || '+919876543210'}`}
                className="neo-btn neo-btn-dark"
                style={{ textDecoration: 'none' }}
              >
                <Phone size={18} />
                <span>Call {d.driver?.phone || '+91 98765 43210'}</span>
              </a>
              <button
                onClick={() => {
                  alert(`Direct SMS sent to ${d.driver?.name || 'driver'}: "Pickup coordinator ABC Restaurant is ready for handover."`);
                  setShowContactModal(false);
                }}
                className="neo-btn neo-btn-outline"
              >
                <MessageSquare size={18} />
                <span>Send Quick Dispatch SMS</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Completed Celebration Modal */}
      <DeliveryModal
        isOpen={showDeliveryModal}
        donation={d}
        onClose={() => setShowDeliveryModal(false)}
        onViewImpact={() => {
          setShowDeliveryModal(false);
          onNavigate(returnImpact);
        }}
      />
    </div>
  );
}
