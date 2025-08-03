<template>
  <div class="lease-bulk-download">
    <v-card>
      <v-card-title>
        <v-icon left>mdi-download-multiple</v-icon>
        Lease Bulk Download
      </v-card-title>

      <v-card-text>
        <!-- Error/Success Messages -->
        <v-alert
          v-if="error"
          type="error"
          dismissible
          @click:close="error = null"
          class="mb-4"
        >
          {{ error }}
        </v-alert>

        <v-alert
          v-if="success"
          type="success"
          dismissible
          @click:close="success = null"
          class="mb-4"
        >
          {{ success }}
        </v-alert>

        <!-- Controls -->
        <v-row class="mb-4">
          <v-col cols="12" md="3">
            <v-select
              v-model="selectedResidence"
              :items="residenceOptions"
              label="Filter by Residence"
              outlined
              dense
            />
          </v-col>

          <v-col cols="12" md="9">
            <v-btn
              color="primary"
              :loading="downloadLoading"
              :disabled="selectedLeases.length === 0"
              @click="handleBulkDownload"
              class="mr-2"
            >
              <v-icon left>mdi-cloud-download</v-icon>
              Download Selected ({{ selectedLeases.length }})
            </v-btn>

            <v-btn
              color="secondary"
              outlined
              :loading="downloadLoading"
              :disabled="selectedResidence === 'all'"
              @click="handleResidenceDownload"
              class="mr-2"
            >
              <v-icon left>mdi-download</v-icon>
              Download Residence
            </v-btn>

            <v-btn
              color="info"
              outlined
              :loading="downloadLoading"
              @click="handleDownloadAll"
              class="mr-2"
            >
              <v-icon left>mdi-download</v-icon>
              Download All
            </v-btn>

            <v-btn
              text
              :disabled="selectedLeases.length === 0"
              @click="clearSelection"
            >
              <v-icon left>mdi-close</v-icon>
              Clear Selection
            </v-btn>
          </v-col>
        </v-row>

        <!-- Leases Table -->
        <v-data-table
          v-model="selectedLeases"
          :headers="headers"
          :items="filteredLeases"
          :loading="loading"
          show-select
          item-key="id"
          class="elevation-1"
        >
          <template v-slot:item.student="{ item }">
            {{ item.student?.name || 'N/A' }}
          </template>

          <template v-slot:item.residence="{ item }">
            {{ item.residence?.name || 'N/A' }}
          </template>

          <template v-slot:item.status="{ item }">
            <v-chip
              :color="item.status === 'active' ? 'success' : 'default'"
              small
            >
              {{ item.status }}
            </v-chip>
          </template>

          <template v-slot:item.createdAt="{ item }">
            {{ formatDate(item.createdAt) }}
          </template>

          <template v-slot:item.actions="{ item }">
            <v-btn
              small
              text
              color="primary"
              @click="downloadSingle(item.id)"
            >
              Download
            </v-btn>
          </template>
        </v-data-table>

        <div v-if="filteredLeases.length === 0 && !loading" class="text-center py-8">
          <v-icon size="64" color="grey">mdi-file-document-outline</v-icon>
          <p class="text-h6 grey--text mt-4">No leases found</p>
        </div>
      </v-card-text>
    </v-card>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'LeaseBulkDownload',
  data() {
    return {
      leases: [],
      selectedLeases: [],
      loading: false,
      downloadLoading: false,
      error: null,
      success: null,
      residences: [],
      selectedResidence: 'all',
      headers: [
        { text: 'Student', value: 'student' },
        { text: 'Residence', value: 'residence' },
        { text: 'Filename', value: 'originalname' },
        { text: 'Status', value: 'status' },
        { text: 'Upload Date', value: 'createdAt' },
        { text: 'Actions', value: 'actions', sortable: false }
      ]
    };
  },
  computed: {
    filteredLeases() {
      if (this.selectedResidence === 'all') {
        return this.leases;
      }
      return this.leases.filter(lease => lease.residence === this.selectedResidence);
    },
    residenceOptions() {
      return [
        { text: 'All Residences', value: 'all' },
        ...this.residences.map(residence => ({
          text: residence.name,
          value: residence._id
        }))
      ];
    }
  },
  async mounted() {
    await this.fetchLeases();
    await this.fetchResidences();
  },
  methods: {
    async fetchLeases() {
      try {
        this.loading = true;
        const token = localStorage.getItem('token');
        const response = await axios.get('/api/finance/leases', {
          headers: { Authorization: `Bearer ${token}` }
        });
        this.leases = response.data.leases || [];
      } catch (error) {
        console.error('Error fetching leases:', error);
        this.error = 'Failed to fetch leases';
      } finally {
        this.loading = false;
      }
    },

    async fetchResidences() {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('/api/residences', {
          headers: { Authorization: `Bearer ${token}` }
        });
        this.residences = response.data.data || [];
      } catch (error) {
        console.error('Error fetching residences:', error);
      }
    },

    async handleBulkDownload() {
      if (this.selectedLeases.length === 0) {
        this.error = 'Please select at least one lease to download';
        return;
      }

      try {
        this.downloadLoading = true;
        this.error = null;
        this.success = null;

        const token = localStorage.getItem('token');
        const response = await axios.post(
          '/api/lease-downloads/multiple',
          { leaseIds: this.selectedLeases },
          {
            headers: { Authorization: `Bearer ${token}` },
            responseType: 'blob'
          }
        );

        this.downloadFile(response.data, `leases_${Date.now()}.zip`);
        this.success = `Successfully downloaded ${this.selectedLeases.length} lease(s)`;
        this.selectedLeases = [];
      } catch (error) {
        console.error('Download failed:', error);
        this.error = 'Failed to download leases. Please try again.';
      } finally {
        this.downloadLoading = false;
      }
    },

    async handleResidenceDownload() {
      if (this.selectedResidence === 'all') {
        this.error = 'Please select a specific residence for residence-based download';
        return;
      }

      try {
        this.downloadLoading = true;
        this.error = null;
        this.success = null;

        const token = localStorage.getItem('token');
        const response = await axios.get(
          `/api/lease-downloads/residence/${this.selectedResidence}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            responseType: 'blob'
          }
        );

        this.downloadFile(response.data, `residence_leases_${Date.now()}.zip`);
        const residenceName = this.residences.find(r => r._id === this.selectedResidence)?.name || 'Unknown';
        this.success = `Successfully downloaded all leases for ${residenceName}`;
      } catch (error) {
        console.error('Residence download failed:', error);
        this.error = 'Failed to download residence leases. Please try again.';
      } finally {
        this.downloadLoading = false;
      }
    },

    async handleDownloadAll() {
      try {
        this.downloadLoading = true;
        this.error = null;
        this.success = null;

        const token = localStorage.getItem('token');
        const response = await axios.get(
          '/api/lease-downloads/all',
          {
            headers: { Authorization: `Bearer ${token}` },
            responseType: 'blob'
          }
        );

        this.downloadFile(response.data, `all_leases_${Date.now()}.zip`);
        this.success = 'Successfully downloaded all leases';
      } catch (error) {
        console.error('All leases download failed:', error);
        this.error = 'Failed to download all leases. Please try again.';
      } finally {
        this.downloadLoading = false;
      }
    },

    downloadSingle(leaseId) {
      window.open(`/api/lease-downloads/single/${leaseId}`, '_blank');
    },

    downloadFile(blob, filename) {
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    },

    clearSelection() {
      this.selectedLeases = [];
    },

    formatDate(date) {
      return new Date(date).toLocaleDateString();
    }
  }
};
</script>

<style scoped>
.lease-bulk-download {
  padding: 20px;
}
</style> 