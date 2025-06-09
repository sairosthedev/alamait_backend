import axios from 'axios';
import { API_BASE_URL } from '../config';

class FinanceService {
    constructor() {
        this.baseURL = `${API_BASE_URL}/api/finance`;
    }

    // Get all balance sheet entries
    async getBalanceSheetEntries() {
        try {
            const [assetsResponse, liabilitiesResponse, equityResponse] = await Promise.all([
                axios.get(`${this.baseURL}/balance-sheets/assets`),
                axios.get(`${this.baseURL}/balance-sheets/liabilities`),
                axios.get(`${this.baseURL}/balance-sheets/equity`)
            ]);

            return {
                assets: assetsResponse.data.assets || [],
                liabilities: liabilitiesResponse.data.liabilities || [],
                equity: equityResponse.data.equity || []
            };
        } catch (error) {
            console.error('Error fetching balance sheet entries:', error);
            throw new Error('Failed to fetch balance sheet entries');
        }
    }

    // Add a new entry
    async addBalanceSheetEntry(entryData) {
        try {
            const { type, amount, category, description, entity } = entryData;
            const data = {
                amount: parseFloat(amount),
                category,
                description,
                entity,
                type
            };
            
            console.log('Adding balance sheet entry:', { data, entryType: type });
            
            const response = await axios.post(`${this.baseURL}/balance-sheets/${type}`, data);
            return response.data;
        } catch (error) {
            console.error('Error adding balance sheet entry:', error);
            throw new Error(error.response?.data?.error || 'Failed to add entry');
        }
    }

    // Update an existing entry
    async updateBalanceSheetEntry(entryId, entryData) {
        try {
            const { type, amount, category, description, entity } = entryData;
            const data = {
                amount: parseFloat(amount),
                category,
                description,
                entity,
                type
            };
            
            console.log('Updating balance sheet entry:', { id: entryId, data, entryType: type });
            
            const response = await axios.put(`${this.baseURL}/balance-sheets/${type}/${entryId}`, data);
            return response.data;
        } catch (error) {
            console.error('Error updating balance sheet entry:', error);
            throw new Error(error.response?.data?.error || 'Failed to update entry');
        }
    }

    // Delete an entry
    async deleteBalanceSheetEntry(entryId, type) {
        try {
            console.log('Deleting balance sheet entry:', { id: entryId, type });
            const response = await axios.delete(`${this.baseURL}/balance-sheets/${type}/${entryId}`);
            return response.data;
        } catch (error) {
            console.error('Error deleting balance sheet entry:', error);
            throw new Error(error.response?.data?.error || 'Failed to delete entry');
        }
    }

    // Get latest balance sheet
    async getLatestBalanceSheet() {
        try {
            const response = await axios.get(`${this.baseURL}/balance-sheets/latest`);
            return response.data;
        } catch (error) {
            console.error('Error fetching latest balance sheet:', error);
            throw new Error(error.response?.data?.error || 'Failed to fetch latest balance sheet');
        }
    }
}

export default new FinanceService(); 