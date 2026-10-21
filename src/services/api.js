const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined' && window.location.port !== '5173') {
    return `${window.location.origin}/api`;
  }
  return 'http://localhost:5001/api';
};

const API_BASE_URL = getApiBaseUrl();

// Token storage helpers
export const getToken = () => localStorage.getItem('rescueflow_token');
export const setToken = (token) => localStorage.setItem('rescueflow_token', token);
export const removeToken = () => localStorage.removeItem('rescueflow_token');
export const getCurrentUser = () => {
  const userStr = localStorage.getItem('rescueflow_user');
  try {
    return userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    return null;
  }
};
export const setCurrentUser = (user) => localStorage.setItem('rescueflow_user', JSON.stringify(user));

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  try {
    const res = await fetch(url, { ...options, headers });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401 && (data.message === 'User no longer exists' || data.message === 'Invalid or expired token')) {
        removeToken();
        localStorage.removeItem('rescueflow_user');
      }
      throw new Error(data.message || `Request failed with status ${res.status}`);
    }
    return data;
  } catch (err) {
    console.warn(`[API] ${endpoint} request failed:`, err.message);
    throw err;
  }
}

export const api = {
  // Auth
  auth: {
    login: async (email, password) => {
      const data = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      if (data.token) {
        setToken(data.token);
        setCurrentUser(data.user);
      }
      return data;
    },
    googleAuth: async (authPayload) => {
      const data = await request('/auth/google', {
        method: 'POST',
        body: JSON.stringify(authPayload)
      });
      if (data.token) {
        setToken(data.token);
        setCurrentUser(data.user);
      }
      return data;
    },
    register: async (userData) => {
      const data = await request('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData)
      });
      if (data.token) {
        setToken(data.token);
        setCurrentUser(data.user);
      }
      return data;
    },
    me: async () => request('/auth/me'),
    getConfig: async () => request('/auth/config'),
    seed: async () => request('/auth/seed'),
    logout: () => {
      removeToken();
      localStorage.removeItem('rescueflow_user');
    }
  },

  // Locations & Routing
  locations: {
    geocode: async (address) => request('/locations/geocode', {
      method: 'POST',
      body: JSON.stringify({ address })
    }),
    search: async (query, lat, lon) => {
      let url = `/locations/search?q=${encodeURIComponent(query)}`;
      if (lat && lon) {
        url += `&lat=${lat}&lon=${lon}`;
      }
      return request(url);
    },
    reverse: async (latitude, longitude) => request('/locations/reverse', {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude })
    }),
    getDirections: async (origin, destination) => request('/locations/directions', {
      method: 'POST',
      body: JSON.stringify({ origin, destination })
    }),
    updateUserLocation: async (locationPayload) => request('/users/location', {
      method: 'PATCH',
      body: JSON.stringify(locationPayload)
    })
  },

  // Real-time Global Map Network
  map: {
    getNetwork: async () => request('/map/network'),
    getNearby: async (lat, lng, radius = 15000) => request(`/map/nearby?lat=${lat}&lng=${lng}&radius=${radius}`)
  },

  // Donations
  donations: {
    create: async (donationData) => request('/donations', {
      method: 'POST',
      body: JSON.stringify(donationData)
    }),
    getAll: async () => request('/donations'),
    getById: async (id) => request(`/donations/${id}`)
  },

  // Matching
  matching: {
    find: async (donationId, excludedShelterIds = []) => request('/matching/find', {
      method: 'POST',
      body: JSON.stringify({ donationId, excludedShelterIds })
    }),
    confirm: async (donationId, shelterId) => request('/matching/confirm', {
      method: 'POST',
      body: JSON.stringify({ donationId, shelterId })
    })
  },

  // Shelter
  shelters: {
    getDashboard: async () => request('/shelters/dashboard'),
    getDonations: async () => request('/shelters/donations'),
    getDonationById: async (id) => request(`/shelters/donations/${id}`),
    updateCapacity: async (data) => request('/shelters/capacity', {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
    updateLocation: async (locationData) => request('/shelters/location', {
      method: 'PATCH',
      body: JSON.stringify(locationData)
    }),
    accept: async (id) => request(`/shelters/donations/${id}/accept`, {
      method: 'POST'
    }),
    reject: async (id) => request(`/shelters/donations/${id}/reject`, {
      method: 'POST'
    }),
    getAccepted: async () => request('/shelters/accepted'),
    getTracking: async (id) => request(`/shelters/tracking/${id}`)
  },

  // Driver
  drivers: {
    getDashboard: async () => request('/drivers/dashboard'),
    getRequests: async () => request('/drivers/requests'),
    acceptRequest: async (id) => request(`/drivers/requests/${id}/accept`, {
      method: 'POST'
    }),
    confirmPickup: async (id) => request(`/drivers/requests/${id}/pickup`, {
      method: 'PATCH'
    }),
    confirmDelivery: async (id) => request(`/drivers/requests/${id}/delivery`, {
      method: 'PATCH'
    }),
    updateLocation: async (lat, lng, extra = {}) => request('/drivers/location', {
      method: 'PATCH',
      body: JSON.stringify({ lat, lng, ...extra })
    }),
    getHistory: async () => request('/drivers/history')
  },

  // Rescues
  rescues: {
    getTracking: async (id) => request(`/rescues/${id}`)
  },

  // Impact
  impact: {
    getGlobal: async () => request('/impact/global'),
    getDonor: async (id) => request(`/impact/donor/${id}`),
    getShelter: async (id) => request(`/impact/shelter/${id}`),
    getDriver: async (id) => request(`/impact/driver/${id}`)
  },

  // Notifications
  notifications: {
    getAll: async () => request('/notifications'),
    markAsRead: async (id) => request(`/notifications/${id}/read`, {
      method: 'PATCH'
    }),
    markAllAsRead: async () => request('/notifications/read-all', {
      method: 'PATCH'
    })
  }
};
