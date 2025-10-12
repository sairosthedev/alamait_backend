import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Configure axios with auth token and longer timeout for salary operations
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 300000, // 5 minutes timeout for salary request operations
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Response interceptor to handle errors
apiClient.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        if (error.response?.status === 401) {
            // Handle unauthorized access
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export const salaryRequestService = {
    // Create salary requests by residence
    createSalaryRequestByResidence: async (requestData) => {
        try {
            console.log('Creating salary request by residence:', requestData);
            const response = await apiClient.post('/finance/employees/salary-requests-by-residence', requestData);
            return response.data;
        } catch (error) {
            console.error('Error creating salary request by residence:', error);
            throw error.response?.data || error.message;
        }
    },

    // Create single salary request
    createSalaryRequest: async (requestData) => {
        try {
            console.log('Creating salary request:', requestData);
            const response = await apiClient.post('/finance/employees/salary-requests', requestData);
            return response.data;
        } catch (error) {
            console.error('Error creating salary request:', error);
            throw error.response?.data || error.message;
        }
    },

    // Get employees for salary request
    getEmployees: async (filters = {}) => {
        try {
            const params = new URLSearchParams();
            Object.keys(filters).forEach(key => {
                if (filters[key]) params.append(key, filters[key]);
            });
            
            const response = await apiClient.get(`/finance/employees?${params}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    // Get residences for salary request
    getResidences: async () => {
        try {
            const response = await apiClient.get('/residences');
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    // Get salary request status
    getSalaryRequestStatus: async (requestId) => {
        try {
            const response = await apiClient.get(`/requests/${requestId}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    }
};

export default salaryRequestService;
