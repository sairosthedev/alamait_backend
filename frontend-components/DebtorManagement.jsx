import React, { useState, useEffect } from 'react';
import axios from 'axios';

const DebtorManagement = () => {
  const [loading, setLoading] = useState(false);
  const [studentsWithoutDebtors, setStudentsWithoutDebtors] = useState([]);
  const [studentsWithDebtors, setStudentsWithDebtors] = useState([]);
  const [summary, setSummary] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const checkStudentsWithoutDebtors = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get('/api/finance/debtors/check/students-without-debtors', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.data.success) {
        setStudentsWithoutDebtors(response.data.studentsWithoutDebtors);
        setStudentsWithDebtors(response.data.studentsWithDebtors);
        setSummary(response.data.summary);
        setMessage(`Found ${response.data.summary.withoutDebtors} students without debtor accounts`);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to check students');
    } finally {
      setLoading(false);
    }
  };

  const createDebtorsForStudents = async () => {
    if (studentsWithoutDebtors.length === 0) {
      setMessage('No students without debtor accounts found');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await axios.post('/api/finance/debtors/bulk-create-for-students', {}, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.data.success) {
        setMessage(`Successfully created ${response.data.created} debtor accounts`);
        // Refresh the list
        await checkStudentsWithoutDebtors();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create debtor accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStudentsWithoutDebtors();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Debtor Account Management</h1>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-800">Total Students</h3>
            <p className="text-2xl font-bold text-blue-600">{summary.totalStudents || 0}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-green-800">With Debtor Accounts</h3>
            <p className="text-2xl font-bold text-green-600">{summary.withDebtors || 0}</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-red-800">Without Debtor Accounts</h3>
            <p className="text-2xl font-bold text-red-600">{summary.withoutDebtors || 0}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={checkStudentsWithoutDebtors}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Checking...' : 'Refresh Status'}
          </button>
          
          {studentsWithoutDebtors.length > 0 && (
            <button
              onClick={createDebtorsForStudents}
              disabled={loading}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              {loading ? 'Creating...' : `Create ${studentsWithoutDebtors.length} Debtor Accounts`}
            </button>
          )}
        </div>

        {/* Messages */}
        {message && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800">{message}</p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Students Without Debtor Accounts */}
        {studentsWithoutDebtors.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Students Without Debtor Accounts ({studentsWithoutDebtors.length})
            </h2>
            <div className="bg-red-50 border border-red-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-red-100">
                    <tr>
                      <th className="px-4 py-2 text-left text-red-800">Name</th>
                      <th className="px-4 py-2 text-left text-red-800">Email</th>
                      <th className="px-4 py-2 text-left text-red-800">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentsWithoutDebtors.map((student, index) => (
                      <tr key={student.studentId} className={index % 2 === 0 ? 'bg-white' : 'bg-red-50'}>
                        <td className="px-4 py-2">
                          {student.firstName} {student.lastName}
                        </td>
                        <td className="px-4 py-2">{student.email}</td>
                        <td className="px-4 py-2">
                          <span className="px-2 py-1 bg-red-200 text-red-800 rounded-full text-sm">
                            No Debtor Account
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Students With Debtor Accounts */}
        {studentsWithDebtors.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Students With Debtor Accounts ({studentsWithDebtors.length})
            </h2>
            <div className="bg-green-50 border border-green-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-green-100">
                    <tr>
                      <th className="px-4 py-2 text-left text-green-800">Name</th>
                      <th className="px-4 py-2 text-left text-green-800">Email</th>
                      <th className="px-4 py-2 text-left text-green-800">Debtor Code</th>
                      <th className="px-4 py-2 text-left text-green-800">Account Code</th>
                      <th className="px-4 py-2 text-left text-green-800">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentsWithDebtors.map((student, index) => (
                      <tr key={student.studentId} className={index % 2 === 0 ? 'bg-white' : 'bg-green-50'}>
                        <td className="px-4 py-2">
                          {student.firstName} {student.lastName}
                        </td>
                        <td className="px-4 py-2">{student.email}</td>
                        <td className="px-4 py-2 font-mono">{student.debtorCode}</td>
                        <td className="px-4 py-2 font-mono">{student.accountCode}</td>
                        <td className="px-4 py-2">
                          <span className="px-2 py-1 bg-green-200 text-green-800 rounded-full text-sm">
                            Has Debtor Account
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* No Students Found */}
        {studentsWithoutDebtors.length === 0 && studentsWithDebtors.length === 0 && !loading && (
          <div className="text-center py-8">
            <p className="text-gray-500">No students found. Please check your database connection.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DebtorManagement; 