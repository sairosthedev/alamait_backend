import api from './api';

export const requestService = {
    // Create new request with extended timeout for salary requests
    createRequest: async (requestData) => {
        try {
            console.log('Creating request:', requestData);
            
            // Set longer timeout for salary requests
            const timeout = (requestData.type === 'financial' && requestData.category === 'salary') 
                ? 300000 // 5 minutes for salary requests
                : 60000; // 1 minute for other requests
            
            const response = await api.post('/requests', requestData, {
                timeout: timeout
            });
            return response.data;
        } catch (error) {
            console.error('Error creating request:', error);
            throw error.response?.data || error.message;
        }
    },

    // Get all requests with filters
    getRequests: async (filters = {}) => {
        try {
            const params = new URLSearchParams();
            Object.keys(filters).forEach(key => {
                if (filters[key]) params.append(key, filters[key]);
            });
            
            const response = await api.get(`/requests?${params}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    // Get request by ID
    getRequestById: async (requestId) => {
        try {
            const response = await api.get(`/requests/${requestId}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    // Update request
    updateRequest: async (requestId, requestData) => {
        try {
            const response = await api.put(`/requests/${requestId}`, requestData);
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    // Add update to request
    addUpdate: async (requestId, updateData) => {
        try {
            const response = await api.post(`/requests/${requestId}/updates`, updateData);
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    // Delete request
    deleteRequest: async (requestId) => {
        try {
            const response = await api.delete(`/requests/${requestId}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    }
};

export default requestService;
