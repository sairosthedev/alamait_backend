import api from '../config/api';

// Student Management Functions

// Get all students
export const getAllStudents = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    
    Object.keys(filters).forEach(key => {
      if (filters[key] && filters[key] !== '') {
        params.append(key, filters[key]);
      }
    });

    const response = await api.get(`/admin/students?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching students:', error);
    throw error;
  }
};

// Get student by ID
export const getStudentById = async (id) => {
  try {
    const response = await api.get(`/admin/students/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching student:', error);
    throw error;
  }
};

// Create student
export const createStudent = async (studentData) => {
  try {
    const response = await api.post('/admin/students', studentData);
    return response.data;
  } catch (error) {
    console.error('Error creating student:', error);
    throw error;
  }
};

// Update student
export const updateStudent = async (id, studentData) => {
  try {
    const response = await api.put(`/admin/students/${id}`, studentData);
    return response.data;
  } catch (error) {
    console.error('Error updating student:', error);
    throw error;
  }
};

// Delete student
export const deleteStudent = async (id) => {
  try {
    const response = await api.delete(`/admin/students/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting student:', error);
    throw error;
  }
};

// Manual add student
export const manualAddStudent = async (studentData) => {
  try {
    const response = await api.post('/admin/students/manual-add', studentData);
    return response.data;
  } catch (error) {
    console.error('Error manually adding student:', error);
    throw error;
  }
};

// CSV Upload Functions

// Upload CSV for bulk student creation
export const uploadCsvStudents = async (csvData, residenceId, defaults = {}) => {
  try {
    const response = await api.post('/admin/students/upload-csv', {
      csvData,
      residenceId,
      defaultRoomNumber: defaults.roomNumber,
      defaultStartDate: defaults.startDate,
      defaultEndDate: defaults.endDate,
      defaultMonthlyRent: defaults.monthlyRent
    });
    return response.data;
  } catch (error) {
    console.error('Error uploading CSV students:', error);
    throw error;
  }
};

// Get CSV template for student upload
export const getStudentCsvTemplate = async () => {
  try {
    const response = await api.get('/admin/students/csv-template');
    return response.data;
  } catch (error) {
    console.error('Error getting CSV template:', error);
    throw error;
  }
};

// Get student payments
export const getStudentPayments = async (studentId) => {
  try {
    const response = await api.get(`/admin/students/${studentId}/payments`);
    return response.data;
  } catch (error) {
    console.error('Error fetching student payments:', error);
    throw error;
  }
};

// Get student leases
export const getStudentLeases = async (studentId) => {
  try {
    const response = await api.get(`/admin/students/${studentId}/leases`);
    return response.data;
  } catch (error) {
    console.error('Error fetching student leases:', error);
    throw error;
  }
};

