# Frontend Integration Guide for Bulk Lease Downloads

## 🎯 Quick Integration Steps

### 1. **Add to Admin Dashboard**

**React (Material-UI):**
```javascript
// In your AdminDashboard.jsx
import LeaseBulkDownload from './components/LeaseBulkDownload';

// Add to your routes or tabs
<Tab label="Lease Downloads" icon={<DownloadIcon />}>
  <LeaseBulkDownload />
</Tab>
```

**Vue.js (Vuetify):**
```javascript
// In your AdminDashboard.vue
import LeaseBulkDownload from '@/components/LeaseBulkDownload.vue';

// Add to your navigation
<v-tab-item>
  <LeaseBulkDownload />
</v-tab-item>
```

### 2. **Add to Finance Dashboard**

**React:**
```javascript
// In your FinanceDashboard.jsx
import LeaseBulkDownload from './components/LeaseBulkDownload';

// Add to your menu
<MenuItem onClick={() => setActiveTab('lease-downloads')}>
  <ListItemIcon><DownloadIcon /></ListItemIcon>
  <ListItemText>Lease Downloads</ListItemText>
</MenuItem>

// In your content area
{activeTab === 'lease-downloads' && <LeaseBulkDownload />}
```

**Vue.js:**
```javascript
// In your FinanceDashboard.vue
import LeaseBulkDownload from '@/components/LeaseBulkDownload.vue';

// Add to your navigation drawer
<v-list-item @click="currentView = 'lease-downloads'">
  <v-list-item-icon>
    <v-icon>mdi-download-multiple</v-icon>
  </v-list-item-icon>
  <v-list-item-content>
    <v-list-item-title>Lease Downloads</v-list-item-title>
  </v-list-item-content>
</v-list-item>

// In your main content
<LeaseBulkDownload v-if="currentView === 'lease-downloads'" />
```

## 🚀 **Simple Button Integration**

If you want to add just a simple download button to existing pages:

### **React Simple Button:**
```javascript
import React, { useState } from 'react';
import { Button, CircularProgress } from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';
import axios from 'axios';

const SimpleLeaseDownload = ({ leaseIds, buttonText = "Download Leases" }) => {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    if (!leaseIds || leaseIds.length === 0) {
      alert('No leases selected');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.post(
        '/api/lease-downloads/multiple',
        { leaseIds },
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      // Create download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `leases_${Date.now()}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Download failed:', error);
      alert('Download failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="contained"
      color="primary"
      startIcon={loading ? <CircularProgress size={20} /> : <DownloadIcon />}
      onClick={handleDownload}
      disabled={loading || !leaseIds || leaseIds.length === 0}
    >
      {loading ? 'Downloading...' : buttonText}
    </Button>
  );
};

export default SimpleLeaseDownload;
```

### **Vue.js Simple Button:**
```javascript
<template>
  <v-btn
    color="primary"
    :loading="loading"
    :disabled="!leaseIds || leaseIds.length === 0"
    @click="handleDownload"
  >
    <v-icon left>mdi-download</v-icon>
    {{ loading ? 'Downloading...' : buttonText }}
  </v-btn>
</template>

<script>
import axios from 'axios';

export default {
  props: {
    leaseIds: {
      type: Array,
      default: () => []
    },
    buttonText: {
      type: String,
      default: 'Download Leases'
    }
  },
  data() {
    return {
      loading: false
    };
  },
  methods: {
    async handleDownload() {
      if (!this.leaseIds || this.leaseIds.length === 0) {
        this.$toast.error('No leases selected');
        return;
      }

      try {
        this.loading = true;
        const token = localStorage.getItem('token');
        const response = await axios.post(
          '/api/lease-downloads/multiple',
          { leaseIds: this.leaseIds },
          {
            headers: { Authorization: `Bearer ${token}` },
            responseType: 'blob'
          }
        );

        // Create download
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `leases_${Date.now()}.zip`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      } catch (error) {
        console.error('Download failed:', error);
        this.$toast.error('Download failed. Please try again.');
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>
```

## 📋 **Usage Examples**

### **1. Add to Existing Lease List Page:**

```javascript
// In your existing lease list component
import SimpleLeaseDownload from './SimpleLeaseDownload';

// Add state for selected leases
const [selectedLeases, setSelectedLeases] = useState([]);

// Add checkbox to each lease row
<Checkbox
  checked={selectedLeases.includes(lease.id)}
  onChange={(e) => {
    if (e.target.checked) {
      setSelectedLeases([...selectedLeases, lease.id]);
    } else {
      setSelectedLeases(selectedLeases.filter(id => id !== lease.id));
    }
  }}
/>

// Add download button
<SimpleLeaseDownload 
  leaseIds={selectedLeases}
  buttonText={`Download Selected (${selectedLeases.length})`}
/>
```

### **2. Add to Residence Management Page:**

```javascript
// In your residence management component
import { Button } from '@mui/material';

const handleDownloadResidenceLeases = async (residenceId) => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.get(
      `/api/lease-downloads/residence/${residenceId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      }
    );

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `residence_leases_${Date.now()}.zip`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (error) {
    console.error('Download failed:', error);
  }
};

// Add button to each residence row
<Button
  size="small"
  variant="outlined"
  onClick={() => handleDownloadResidenceLeases(residence.id)}
>
  Download Leases
</Button>
```

### **3. Add to Admin Dashboard Header:**

```javascript
// In your admin dashboard header
import { AppBar, Toolbar, Button } from '@mui/material';

const handleDownloadAllLeases = async () => {
  try {
    const token = localStorage.getItem('token');
    const response = await axios.get(
      '/api/lease-downloads/all',
      {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      }
    );

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `all_leases_${Date.now()}.zip`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (error) {
    console.error('Download failed:', error);
  }
};

// Add to toolbar
<Toolbar>
  <Button
    color="inherit"
    onClick={handleDownloadAllLeases}
  >
    Download All Leases
  </Button>
</Toolbar>
```

## 🔧 **API Endpoints Summary**

| Endpoint | Method | Description | Access |
|----------|--------|-------------|---------|
| `/api/lease-downloads/single/:leaseId` | GET | Download single lease | All authenticated users |
| `/api/lease-downloads/multiple` | POST | Download multiple leases as ZIP | All authenticated users |
| `/api/lease-downloads/residence/:residenceId` | GET | Download all leases for residence | Admin/Finance/CEO |
| `/api/lease-downloads/all` | GET | Download all leases | Admin/Finance/CEO |

## 🎯 **Key Features**

✅ **Bulk Selection** - Checkbox selection for multiple leases  
✅ **Residence Filtering** - Filter by specific residence  
✅ **Single Downloads** - Individual lease downloads  
✅ **ZIP Compression** - Efficient file transfer  
✅ **Progress Indicators** - Loading states during download  
✅ **Error Handling** - User-friendly error messages  
✅ **Success Feedback** - Confirmation of successful downloads  

## 🚀 **Ready to Use!**

The components are fully functional and ready to integrate into your existing admin and finance dashboards. Just copy the component files and follow the integration steps above! 