import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Configure axios with auth token
const apiClient = axios.create({
    baseURL: API_BASE_URL,
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

export const paymentService = {
    // Create new payment
    createPayment: async (paymentData) => {
        try {
            const response = await apiClient.post('/admin/payments', paymentData);
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    // Get all payments with filters
    getPayments: async (filters = {}) => {
        try {
            const params = new URLSearchParams();
            Object.keys(filters).forEach(key => {
                if (filters[key]) params.append(key, filters[key]);
            });
            
            const response = await apiClient.get(`/admin/payments?${params}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    // Get payment by ID
    getPaymentById: async (paymentId) => {
        try {
            const response = await apiClient.get(`/admin/payments/${paymentId}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    // Update payment status
    updatePaymentStatus: async (paymentId, status) => {
        try {
            const response = await apiClient.put(`/admin/payments/${paymentId}/status`, { status });
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    // Upload proof of payment
    uploadProofOfPayment: async (paymentId, file) => {
        try {
            const formData = new FormData();
            formData.append('proofOfPayment', file);
            
            const response = await apiClient.post(`/admin/payments/${paymentId}/upload-pop`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    // Get payment totals
    getPaymentTotals: async (filters = {}) => {
        try {
            const params = new URLSearchParams();
            Object.keys(filters).forEach(key => {
                if (filters[key]) params.append(key, filters[key]);
            });
            
            const response = await apiClient.get(`/admin/payments/total?${params}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    // Get students for dropdown
    getStudents: async () => {
        try {
            const response = await apiClient.get('/admin/students');
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    // Get residences for dropdown
    getResidences: async () => {
        try {
            const response = await apiClient.get('/admin/residences');
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    // Get rooms for a specific residence
    getRooms: async (residenceId) => {
        try {
            const response = await apiClient.get(`/admin/residences/${residenceId}/rooms`);
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    }
};

export default paymentService; 