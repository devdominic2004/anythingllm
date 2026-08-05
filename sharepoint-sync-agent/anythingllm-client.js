const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

class AnythingLLMClient {
  constructor() {
    this.baseUrl = (process.env.ANYTHINGLLM_URL || 'http://localhost:3001').replace(/\/+$/, '');
    this.apiKey = process.env.ANYTHINGLLM_API_KEY;
  }

  getHeaders(formHeaders = {}) {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      ...formHeaders
    };
  }

  async uploadDocument(filePath, workspaceSlug) {
    try {
      const form = new FormData();
      form.append('file', fs.createReadStream(filePath));

      // Append addToWorkspaces to automatically add and embed it in the target workspace
      // See server/endpoints/api/document/index.js for validateWorkspaceSlugQuery
      form.append('addToWorkspaces', workspaceSlug);

      const response = await axios.post(`${this.baseUrl}/api/v1/document/upload`, form, {
        headers: this.getHeaders(form.getHeaders()),
      });

      return response.data;
    } catch (error) {
      console.error(`Error uploading document ${filePath} to AnythingLLM:`, error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = new AnythingLLMClient();
