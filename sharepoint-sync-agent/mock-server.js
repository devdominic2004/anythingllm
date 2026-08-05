const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8080;

// Create a dummy file if it doesn't exist
const DUMMY_FILE_PATH = path.join(__dirname, 'dummy-document.txt');
if (!fs.existsSync(DUMMY_FILE_PATH)) {
  fs.writeFileSync(DUMMY_FILE_PATH, 'This is a top secret document from the Mock SharePoint server! It contains highly confidential test data.');
}

// Mock Microsoft Graph API endpoint for getting files in a folder
app.get('/v1.0/drive/items/:folderId/children', (req, res) => {
  const { folderId } = req.params;
  console.log(`[Mock Server] Received request for folder: ${folderId}`);

  // Return a mock response that mimics the Microsoft Graph API structure
  res.json({
    "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#drive/items('mock')/children",
    "value": [
      {
        "id": "mock_file_12345",
        "name": "mock_secret_document.txt",
        "lastModifiedDateTime": new Date().toISOString(), // Always appears "new" so it downloads immediately
        "size": fs.statSync(DUMMY_FILE_PATH).size,
        "file": {
          "mimeType": "text/plain"
        },
        "@microsoft.graph.downloadUrl": `http://localhost:${PORT}/download/mock_file_12345`
      }
    ]
  });
});

// Mock download endpoint
app.get('/download/:fileId', (req, res) => {
  console.log(`[Mock Server] Downloading dummy file...`);
  res.download(DUMMY_FILE_PATH, 'mock_secret_document.txt');
});

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`🟢 Mock SharePoint API Server is running!`);
  console.log(`========================================`);
  console.log(`Listening on http://localhost:${PORT}`);
  console.log(`Ensure your Sync Agent .env has MOCK_MODE=true`);
  console.log(`========================================\n`);
});
