import api from './api';

export const salaryRequestService = {
    // Create salary requests by residence
    createSalaryRequestByResidence: async (requestData) => {
        try {
            console.log('Creating salary request by residence:', requestData);
            const response = await api.post('/finance/employees/salary-requests-by-residence', requestData);
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
            const response = await api.post('/finance/employees/salary-requests', requestData);
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
            
            const response = await api.get(`/finance/employees?${params}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    // Get residences for salary request
    getResidences: async () => {
        try {
            const response = await api.get('/residences');
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    // Get salary request status
    getSalaryRequestStatus: async (requestId) => {
        try {
            const response = await api.get(`/requests/${requestId}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    }
};

export default salaryRequestService;
