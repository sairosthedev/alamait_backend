import api from './api';

export const paymentService = {
    // Create new payment
    createPayment: async (paymentData) => {
        try {
            const response = await api.post('/admin/payments', paymentData);
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
            
            const response = await api.get(`/admin/payments?${params}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    // Get payment by ID
    getPaymentById: async (paymentId) => {
        try {
            const response = await api.get(`/admin/payments/${paymentId}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    // Update payment status
    updatePaymentStatus: async (paymentId, status) => {
        try {
            const response = await api.put(`/admin/payments/${paymentId}/status`, { status });
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
            
            const response = await api.post(`/admin/payments/${paymentId}/upload-pop`, formData, {
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
            
            const response = await api.get(`/admin/payments/total?${params}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    // Get students for dropdown
    getStudents: async () => {
        try {
            const response = await api.get('/admin/students');
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    // Get residences for dropdown
    getResidences: async () => {
        try {
            const response = await api.get('/admin/residences');
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    // Get rooms for a specific residence
    getRooms: async (residenceId) => {
        try {
            const response = await api.get(`/admin/residences/${residenceId}/rooms`);
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    }
};

export default paymentService; 