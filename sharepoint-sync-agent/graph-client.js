const { ConfidentialClientApplication } = require('@azure/msal-node');
const { Client } = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

class GraphClient {
  constructor() {
    this.isMockMode = process.env.MOCK_MODE === 'true';

    this.tenantId = process.env.AZURE_TENANT_ID;
    this.clientId = process.env.AZURE_CLIENT_ID;
    this.clientSecret = process.env.AZURE_CLIENT_SECRET;

    if (!this.isMockMode) {
      const msalConfig = {
        auth: {
          clientId: this.clientId,
          authority: `https://login.microsoftonline.com/${this.tenantId}`,
          clientSecret: this.clientSecret,
        }
      };
      this.cca = new ConfidentialClientApplication(msalConfig);
    }
  }

  async getAccessToken() {
    if (this.isMockMode) return 'mock_token';

    const tokenRequest = {
      scopes: ['https://graph.microsoft.com/.default'],
    };

    try {
      const response = await this.cca.acquireTokenByClientCredential(tokenRequest);
      return response.accessToken;
    } catch (error) {
      console.error('Error acquiring token:', error);
      throw error;
    }
  }

  async getClient() {
    const accessToken = await this.getAccessToken();
    const clientOptions = {
      authProvider: (done) => {
        done(null, accessToken);
      }
    };

    if (this.isMockMode) {
      clientOptions.baseUrl = 'http://localhost:8080';
    }

    return Client.init(clientOptions);
  }

  async getFilesInFolder(folderId) {
    try {
      const client = await this.getClient();
      // Assuming folderId is a driveItem id
      // To get files from a specific driveItem: /drives/{drive-id}/items/{item-id}/children
      // If folderId is a site's document library folder, we can use: /sites/{site-id}/drive/items/{folder-id}/children
      // For simplicity, assuming folderId is a generic driveItem ID accessible directly via /drive/items
      const response = await client.api(`/drive/items/${folderId}/children`).get();
      return response.value;
    } catch (error) {
      console.error(`Error fetching files for folder ${folderId}:`, error);
      return [];
    }
  }

  async downloadFile(fileItem, downloadPath) {
    try {
      const downloadUrl = fileItem['@microsoft.graph.downloadUrl'];
      if (!downloadUrl) throw new Error('No download URL found for file');
      
      const response = await axios({
        url: downloadUrl,
        method: 'GET',
        responseType: 'stream'
      });

      const filePath = path.join(downloadPath, fileItem.name);
      const writer = fs.createWriteStream(filePath);

      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(filePath));
        writer.on('error', reject);
      });
    } catch (error) {
      console.error(`Error downloading file ${fileItem.name}:`, error);
      throw error;
    }
  }
}

module.exports = new GraphClient();
