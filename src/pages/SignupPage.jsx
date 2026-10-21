import React, { useState, useEffect } from 'react';
import { 
  HeartHandshake, 
  MapPin, 
  Building2, 
  Store, 
  Truck, 
  ArrowRight, 
  Loader2, 
  Crosshair,
  CheckCircle2,
  Edit2,
  AlertTriangle,
  Search,
  Map,
  X,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api';
import { requestCurrentPosition, formatCoordinates } from '../services/locationService';
import ShelterLocationPicker from '../components/ui/ShelterLocationPicker';

export default function SignupPage({ onNavigate, onLoginSuccess }) {
  const [role, setRole] = useState('shelter');
  const [orgName, setOrgName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Location state - NEVER default coordinates
  const [location, setLocation] = useState('');
  const [coords, setCoords] = useState(null); // [lng, lat]
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isEditingLocation, setIsEditingLocation] = useState(true);

  // Proximity-based search state
  const [userNearbyCoords, setUserNearbyCoords] = useState(null);
  const [donorSuggestions, setDonorSuggestions] = useState([]);
  const [isDonorSearching, setIsDonorSearching] = useState(false);
  const [showDonorMapPicker, setShowDonorMapPicker] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const [error, setError] = useState('');
  const [locStatus, setLocStatus] = useState('');
  const [dynamicGoogleClientId, setDynamicGoogleClientId] = useState('');
  const [showGoogleModal, setShowGoogleModal] = useState(false);

  // Auto-fetch runtime Google Client ID from backend
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const conf = await api.auth.getConfig();
        if (conf?.googleClientId) {
          setDynamicGoogleClientId(conf.googleClientId);
        }
      } catch (e) {
        console.log('[Auth Config notice]', e.message);
      }
    };
    fetchConfig();
  }, []);

  // 1. Silently get approximate user coords on mount for nearby search bias
  useEffect(() => {
    if (navigator?.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserNearbyCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          console.log('[Proximity detection notice]', err.message);
        },
        { timeout: 5000, enableHighAccuracy: false }
      );
    }
  }, []);

  // 2. Real-time autocomplete suggestions as user types in Donor/Driver location
  useEffect(() => {
    if (role === 'shelter' || showDonorMapPicker) return;
    if (!location || location.trim().length < 2) {
      setDonorSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsDonorSearching(true);
      try {
        const res = await api.locations.search(
          location.trim(),
          userNearbyCoords?.lat,
          userNearbyCoords?.lng
        );
        if (res?.results && res.results.length > 0) {
          setDonorSuggestions(res.results);
        } else {
          setDonorSuggestions([]);
        }
      } catch (err) {
        console.warn('[Location search notice]', err.message);
      } finally {
        setIsDonorSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [location, role, showDonorMapPicker, userNearbyCoords]);

  // Handle selecting a place suggestion from dropdown
  const handleSelectDonorSuggestion = (place) => {
    setLocation(place.address || place.name);
    setCoords([place.lng, place.lat]);
    setDonorSuggestions([]);
    setLocStatus(`Location verified: ${place.name} (${place.lat.toFixed(4)}, ${place.lng.toFixed(4)})`);
    setError('');
  };

  // Handle Shelter Location Confirmed from Map Picker
  const handleShelterLocationConfirmed = (locData) => {
    setCoords(locData.coordinates);
    setLocation(locData.address);
    setIsConfirmed(true);
    setIsEditingLocation(false);
    setError('');
  };

  // Device GPS for Donor / Driver only if clicked explicitly
  const handleDetectLocation = async () => {
    setLocLoading(true);
    setLocStatus('Detecting device GPS...');
    try {
      const pos = await requestCurrentPosition();
      setCoords([pos.longitude, pos.latitude]);
      setUserNearbyCoords({ lat: pos.latitude, lng: pos.longitude });
      setLocStatus(`GPS acquired (${pos.latitude.toFixed(4)}, ${pos.longitude.toFixed(4)})`);
      
      // Reverse geocode to get real street address
      try {
        const rev = await api.locations.reverse(pos.latitude, pos.longitude);
        setLocation(rev.address || `GPS: ${pos.latitude.toFixed(4)}°N, ${pos.longitude.toFixed(4)}°E`);
      } catch {
        setLocation(`GPS: ${pos.latitude.toFixed(4)}°N, ${pos.longitude.toFixed(4)}°E`);
      }
    } catch (err) {
      setLocStatus(`GPS notice: ${err.message}`);
    } finally {
      setLocLoading(false);
    }
  };

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    setCoords(null);
    setLocation('');
    setIsConfirmed(false);
    setIsEditingLocation(true);
    setDonorSuggestions([]);
    setShowDonorMapPicker(false);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Strict validation for shelter role: Location MUST be explicitly confirmed on map
    if (role === 'shelter') {
      if (!coords || coords.length !== 2 || !isConfirmed) {
        setError('Please select and confirm your shelter location on the map before continuing.');
        return;
      }
    } else {
      // For donor: Must specify location
      if (!location.trim()) {
        setError('Please enter or select your location address.');
        return;
      }
    }

    setLoading(true);

    try {
      const payload = {
        name: orgName,
        email,
        password,
        role: role.toUpperCase(),
        ...(coords && coords.length === 2 ? {
          location: {
            type: 'Point',
            coordinates: coords,
            address: location || 'Registered Location'
          }
        } : (location ? {
          location: {
            address: location
          }
        } : {}))
      };

      const res = await api.auth.register(payload);
      if (onLoginSuccess && res?.user) {
        onLoginSuccess(res.user);
      } else {
        if (role === 'donor') onNavigate('/donor/dashboard');
        else if (role === 'shelter') onNavigate('/shelter/dashboard');
        else if (role === 'driver') onNavigate('/driver/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  // Google Sign-Up with chosen Role
  const handleGoogleSignUp = () => {
    setGoogleLoading(true);
    setError('');

    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || dynamicGoogleClientId;

    const locPayload = coords && coords.length === 2 ? {
      type: 'Point',
      coordinates: coords,
      address: location || 'Registered Location'
    } : (location ? { address: location } : undefined);

    if (window.google?.accounts?.id && googleClientId) {
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response) => {
            try {
              const res = await api.auth.googleAuth({
                token: response.credential,
                role: role.toUpperCase(),
                location: locPayload
              });
              if (onLoginSuccess && res?.user) {
                onLoginSuccess(res.user);
              } else {
                if (role === 'donor') onNavigate('/donor/dashboard');
                else if (role === 'shelter') onNavigate('/shelter/dashboard');
                else if (role === 'driver') onNavigate('/driver/dashboard');
              }
            } catch (err) {
              setError(err.message || 'Google registration failed.');
            } finally {
              setGoogleLoading(false);
            }
          }
        });

        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            console.warn('[Google Sign-Up] One-Tap prompt moment:', notification.getNotDisplayedReason?.() || notification.getSkippedReason?.());
            setGoogleLoading(false);
          }
        });
      } catch (err) {
        setError(err.message || 'Error initializing Google Sign-Up.');
        setGoogleLoading(false);
      }
    } else {
      setShowGoogleModal(true);
      setGoogleLoading(false);
    }
  };

  const handleDemoGoogleSignUp = async () => {
    setGoogleLoading(true);
    setError('');
    setShowGoogleModal(false);
    try {
      const locPayload = coords && coords.length === 2 ? {
        type: 'Point',
        coordinates: coords,
        address: location || 'Registered Location'
      } : (location ? { address: location } : undefined);

      const res = await api.auth.googleAuth({
        isDemo: true,
        role: role.toUpperCase(),
        name: orgName || `Google Verified ${role.toUpperCase()}`,
        email: email || `google.${role}@rescueflow.org`,
        location: locPayload
      });
      if (onLoginSuccess && res?.user) {
        onLoginSuccess(res.user);
      } else {
        if (role === 'donor') onNavigate('/donor/dashboard');
        else if (role === 'shelter') onNavigate('/shelter/dashboard');
        else if (role === 'driver') onNavigate('/driver/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Google registration failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 20px'
    }}>
      {/* Brand Header */}
      <div 
        onClick={() => onNavigate('landing')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
          marginBottom: '24px'
        }}
      >
        <div style={{
          width: '38px',
          height: '38px',
          background: 'var(--color-primary)',
          border: 'var(--border-dark)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          boxShadow: 'var(--shadow-neo-sm)'
        }}>
          <HeartHandshake size={22} strokeWidth={2.5} />
        </div>
        <span style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '1.5rem',
          fontWeight: 900,
          letterSpacing: '-0.03em',
          color: 'var(--color-dark)'
        }}>
          RESCUEFLOW
        </span>
      </div>

      {/* Signup Card */}
      <div 
        className="neo-card" 
        style={{
          width: '100%',
          maxWidth: (role === 'shelter' || showDonorMapPicker) ? '760px' : '580px',
          padding: '36px 32px',
          background: '#ffffff',
          transition: 'max-width 0.2s ease'
        }}
      >
        <h2 style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: '1.9rem',
          fontWeight: 800,
          color: 'var(--color-dark)',
          marginBottom: '6px'
        }}>
          Create Your Account
        </h2>
        <p style={{
          color: 'var(--color-muted)',
          fontSize: '0.92rem',
          marginBottom: '20px'
        }}>
          Join the food rescue network with real database registration.
        </p>

        {error && (
          <div style={{
            background: '#ffe5e5',
            color: '#b00020',
            border: '2px solid #b00020',
            borderRadius: '8px',
            padding: '12px 16px',
            fontSize: '0.88rem',
            fontWeight: 700,
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 1. Role Selection */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, marginBottom: '8px' }}>
              1. Select Your Role
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              <div
                onClick={() => handleRoleChange('shelter')}
                style={{
                  padding: '14px 10px',
                  borderRadius: '10px',
                  border: 'var(--border-dark)',
                  background: role === 'shelter' ? 'var(--color-primary)' : 'var(--color-bg)',
                  color: role === 'shelter' ? '#ffffff' : 'var(--color-dark)',
                  boxShadow: role === 'shelter' ? 'var(--shadow-neo-sm)' : 'none',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                <Building2 size={22} style={{ margin: '0 auto 4px' }} />
                <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>Shelter</div>
                <div style={{ fontSize: '0.72rem', opacity: role === 'shelter' ? 0.95 : 0.65 }}>NGO / Recipient</div>
              </div>

              <div
                onClick={() => handleRoleChange('donor')}
                style={{
                  padding: '14px 10px',
                  borderRadius: '10px',
                  border: 'var(--border-dark)',
                  background: role === 'donor' ? 'var(--color-primary)' : 'var(--color-bg)',
                  color: role === 'donor' ? '#ffffff' : 'var(--color-dark)',
                  boxShadow: role === 'donor' ? 'var(--shadow-neo-sm)' : 'none',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                <Store size={22} style={{ margin: '0 auto 4px' }} />
                <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>Donor</div>
                <div style={{ fontSize: '0.72rem', opacity: role === 'donor' ? 0.95 : 0.65 }}>Restaurant / Grocery</div>
              </div>

              <div
                onClick={() => handleRoleChange('driver')}
                style={{
                  padding: '14px 10px',
                  borderRadius: '10px',
                  border: 'var(--border-dark)',
                  background: role === 'driver' ? 'var(--color-primary)' : 'var(--color-bg)',
                  color: role === 'driver' ? '#ffffff' : 'var(--color-dark)',
                  boxShadow: role === 'driver' ? 'var(--shadow-neo-sm)' : 'none',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                <Truck size={22} style={{ margin: '0 auto 4px' }} />
                <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>Driver</div>
                <div style={{ fontSize: '0.72rem', opacity: role === 'driver' ? 0.95 : 0.65 }}>Volunteer Delivery</div>
              </div>
            </div>
          </div>

          {/* 2. Organization / User Info */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, marginBottom: '8px' }}>
              2. Account Details
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                  {role === 'shelter' ? 'Shelter Organization Name' : role === 'donor' ? 'Donor / Restaurant Name' : 'Driver Full Name'}
                </label>
                <input
                  type="text"
                  required
                  className="neo-input"
                  placeholder={role === 'shelter' ? 'e.g. Hope Community Shelter' : role === 'donor' ? 'e.g. Downtown Bistro' : 'e.g. Rahul Sharma'}
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  className="neo-input"
                  placeholder="contact@organization.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '4px' }}>
                  Password
                </label>
                <input
                  type="password"
                  required
                  className="neo-input"
                  placeholder="Create secure password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* 3. SHELTER LOCATION SECTION (Mandatory Map Selection Flow) */}
          {role === 'shelter' ? (
            <div style={{
              background: '#fafafa',
              border: '2px solid var(--color-dark)',
              borderRadius: '12px',
              padding: '20px',
              marginTop: '4px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div>
                  <h3 style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: '1.15rem',
                    fontWeight: 800,
                    margin: 0,
                    color: 'var(--color-dark)'
                  }}>
                    3. Shelter Location (Required)
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: 'var(--color-muted)' }}>
                    Type your shelter name/address to see nearby suggestions or click & drag pin on the map.
                  </p>
                </div>

                {isConfirmed && !isEditingLocation && (
                  <button
                    type="button"
                    onClick={() => setIsEditingLocation(true)}
                    className="neo-btn neo-btn-outline"
                    style={{ padding: '6px 12px', fontSize: '0.78rem', background: '#ffffff' }}
                  >
                    <Edit2 size={13} />
                    <span>Edit Location</span>
                  </button>
                )}
              </div>

              {/* Confirmed State Summary */}
              {isConfirmed && !isEditingLocation ? (
                <div style={{
                  background: '#d8f3dc',
                  border: '2px solid #1b4332',
                  borderRadius: '10px',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <CheckCircle2 size={24} color="#1b4332" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1b4332', textTransform: 'uppercase' }}>
                        Selected Shelter Location Confirmed
                      </div>
                      <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--color-dark)', marginTop: '2px' }}>
                        {location}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#2d6a4f', marginTop: '4px', fontWeight: 600 }}>
                        Latitude: <strong>{coords[1].toFixed(5)}</strong> • Longitude: <strong>{coords[0].toFixed(5)}</strong> ({formatCoordinates(coords[1], coords[0])})
                      </div>
                    </div>
                  </div>

                  <span className="neo-badge neo-badge-matched" style={{ background: '#1b4332', color: '#ffffff', fontSize: '0.72rem' }}>
                    CONFIRMED
                  </span>
                </div>
              ) : (
                /* Interactive Map & Search Picker with Nearby Bias */
                <ShelterLocationPicker
                  initialLocation={coords ? { coordinates: coords, address: location } : null}
                  nearbyCoords={userNearbyCoords}
                  onLocationConfirmed={handleShelterLocationConfirmed}
                  confirmButtonText="Confirm Location"
                />
              )}
            </div>
          ) : (
            /* DONOR & DRIVER LOCATION WITH LIVE NEARBY AUTOCOMPLETE SUGGESTIONS */
            <div style={{
              background: '#fafafa',
              border: '2px solid var(--color-dark)',
              borderRadius: '12px',
              padding: '18px',
              marginTop: '4px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div>
                  <label style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-dark)' }}>
                    3. {role === 'donor' ? 'Donation Pickup Location' : 'Base Service Area'}
                  </label>
                  <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--color-muted)' }}>
                    Type your address or landmark — suggestions are prioritized for your area.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setShowDonorMapPicker(!showDonorMapPicker)}
                    className="neo-btn neo-btn-outline"
                    style={{
                      background: showDonorMapPicker ? 'var(--color-dark)' : '#ffffff',
                      color: showDonorMapPicker ? '#ffffff' : 'var(--color-dark)',
                      fontSize: '0.78rem',
                      padding: '5px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="Toggle Map Picker"
                  >
                    <Map size={13} />
                    <span>{showDonorMapPicker ? 'Close Map' : 'Pick on Map'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDetectLocation}
                    disabled={locLoading}
                    className="neo-btn neo-btn-outline"
                    style={{
                      background: '#ffffff',
                      fontSize: '0.78rem',
                      padding: '5px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="Use Device GPS"
                  >
                    {locLoading ? <Loader2 size={13} className="anim-spin" /> : <Crosshair size={13} />}
                    <span>Use My GPS</span>
                  </button>
                </div>
              </div>

              {/* Optional Interactive Map Picker for Donor */}
              {showDonorMapPicker ? (
                <div style={{ marginTop: '12px' }}>
                  <ShelterLocationPicker
                    initialLocation={coords ? { coordinates: coords, address: location } : null}
                    nearbyCoords={userNearbyCoords}
                    onLocationConfirmed={(locData) => {
                      setCoords(locData.coordinates);
                      setLocation(locData.address);
                      setShowDonorMapPicker(false);
                      setLocStatus(`Location confirmed: ${locData.address}`);
                    }}
                    onCancel={() => setShowDonorMapPicker(false)}
                    confirmButtonText="Confirm Pickup Location"
                  />
                </div>
              ) : (
                /* Live Autocomplete Input */
                <div style={{ position: 'relative', marginTop: '10px' }}>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      required
                      className="neo-input"
                      placeholder={role === 'donor' ? 'Type restaurant/store address, sector or landmark...' : 'Type your delivery hub or base city...'}
                      value={location}
                      onChange={(e) => {
                        setLocation(e.target.value);
                        setCoords(null); // reset coords until suggestion chosen
                      }}
                      style={{ paddingLeft: '38px', paddingRight: '36px', width: '100%', fontSize: '0.92rem' }}
                    />
                    <Search 
                      size={18} 
                      style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-muted)' }} 
                    />
                    {isDonorSearching && (
                      <Loader2 
                        size={16} 
                        className="anim-spin" 
                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-primary)' }} 
                      />
                    )}
                    {location && !isDonorSearching && (
                      <button
                        type="button"
                        onClick={() => {
                          setLocation('');
                          setCoords(null);
                          setDonorSuggestions([]);
                        }}
                        style={{
                          position: 'absolute',
                          right: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 800
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Suggestions List Box */}
                  {donorSuggestions.length > 0 && (
                    <div 
                      className="neo-card"
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: '#ffffff',
                        border: '2px solid var(--color-dark)',
                        borderRadius: '8px',
                        boxShadow: 'var(--shadow-neo)',
                        maxHeight: '230px',
                        overflowY: 'auto',
                        zIndex: 1200,
                        marginTop: '4px',
                        padding: '6px'
                      }}
                    >
                      <div style={{ padding: '4px 10px', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-muted)', borderBottom: '1px solid #f0f0f0' }}>
                        📍 Nearby Location Suggestions:
                      </div>
                      {donorSuggestions.map((place, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleSelectDonorSuggestion(place)}
                          style={{
                            padding: '10px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                            borderBottom: idx < donorSuggestions.length - 1 ? '1px solid #f5f5f5' : 'none',
                            transition: 'background 0.15s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-bg)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <MapPin size={17} color="var(--color-primary)" style={{ marginTop: '2px', flexShrink: 0 }} />
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--color-dark)' }}>
                              {place.name}
                            </div>
                            <div style={{ fontSize: '0.76rem', color: 'var(--color-muted)', marginTop: '1px' }}>
                              {place.address}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Confirmed / Selected Pill */}
                  {coords && coords.length === 2 && (
                    <div style={{
                      marginTop: '8px',
                      background: '#d8f3dc',
                      border: '1.5px solid #1b4332',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      fontSize: '0.78rem',
                      color: '#1b4332',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <CheckCircle2 size={16} />
                      <span>Verified GPS: <strong>{coords[1].toFixed(5)}, {coords[0].toFixed(5)}</strong> ({location})</span>
                    </div>
                  )}

                  {locStatus && !coords && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600, display: 'block', marginTop: '6px' }}>
                      {locStatus}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || (role === 'shelter' && (!isConfirmed || !coords))}
            className="neo-btn neo-btn-dark"
            style={{ 
              width: '100%', 
              padding: '14px', 
              marginTop: '6px', 
              fontSize: '1rem',
              opacity: (role === 'shelter' && (!isConfirmed || !coords)) ? 0.6 : 1,
              cursor: (role === 'shelter' && (!isConfirmed || !coords)) ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : role === 'shelter' && (!isConfirmed || !coords) ? (
              <span>Confirm Shelter Location Above to Continue</span>
            ) : (
              <>
                <span>Complete Registration</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>

          {/* Divider */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            margin: '20px 0 16px 0'
          }}>
            <div style={{ flex: 1, height: '1px', background: '#e2dcc8' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-muted)', textTransform: 'uppercase' }}>
              or continue with
            </span>
            <div style={{ flex: 1, height: '1px', background: '#e2dcc8' }} />
          </div>

          {/* Real Google Sign-Up Button */}
          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={googleLoading}
            className="neo-btn neo-btn-outline"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '0.9rem',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}
          >
            {googleLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z" />
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
                  <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.347 2.825.957 4.039l3.007-2.332z" />
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" />
                </svg>
                <span>Sign Up with Google as {role.toUpperCase()}</span>
              </>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: '0.9rem', marginTop: '22px' }}>
          <span style={{ color: 'var(--color-muted)' }}>Already registered? </span>
          <span 
            onClick={() => onNavigate('login')}
            style={{ fontWeight: 800, color: 'var(--color-dark)', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Log in to your portal
          </span>
        </div>
      </div>

      {/* Google OAuth Helper & Demo Modal */}
      {showGoogleModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 9999
        }}>
          <div className="neo-card" style={{
            background: '#ffffff',
            maxWidth: '440px',
            width: '100%',
            padding: '24px',
            position: 'relative'
          }}>
            <button
              onClick={() => setShowGoogleModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#f0ebd8', border: 'var(--border-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={20} color="#e76f51" />
              </div>
              <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.2rem', fontWeight: 800 }}>
                Google Sign-Up Options
              </h3>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--color-muted)', marginBottom: '16px', lineHeight: 1.5 }}>
              Google Cloud OAuth Client ID is not yet configured in Render environment variables (<code>GOOGLE_CLIENT_ID</code>).
            </p>

            <div style={{ background: 'var(--color-bg)', padding: '14px', borderRadius: '8px', border: 'var(--border-dark)', marginBottom: '18px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, display: 'block', marginBottom: '4px' }}>
                ⚡ Test Google Sign-Up Instantly:
              </span>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '10px' }}>
                Create and enter your portal as a Google Verified {role.toUpperCase()} right now:
              </p>
              <button
                type="button"
                onClick={handleDemoGoogleSignUp}
                className="neo-btn neo-btn-dark"
                style={{ width: '100%', padding: '10px', fontSize: '0.9rem' }}
              >
                Sign Up as Google {role.toUpperCase()} →
              </button>
            </div>

            <div style={{ textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => setShowGoogleModal(false)}
                className="neo-btn neo-btn-outline"
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
