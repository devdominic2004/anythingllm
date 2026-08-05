require('dotenv').config();
const fs = require('fs');
const path = require('path');
const graphClient = require('./graph-client');
const anythingLLMClient = require('./anythingllm-client');

const STATE_FILE = path.join(__dirname, 'sync-state.json');
const CONFIG_FILE = path.join(__dirname, 'config.json');
const TEMP_DIR = path.join(__dirname, 'temp');

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR);
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error("Error reading state file", e);
  }
  return {};
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error("Error reading config file", e);
  }
  return { mappings: [] };
}

async function processFolder(folderId, workspaceSlug, state) {
  console.log(`Checking folder ${folderId} for workspace ${workspaceSlug}...`);
  const files = await graphClient.getFilesInFolder(folderId);
  const folderState = state[folderId] || {};
  let newOrModifiedCount = 0;

  for (const file of files) {
    // Only process files, skip subfolders (can be expanded later if recursive sync is needed)
    if (file.folder) continue;

    const lastModified = new Date(file.lastModifiedDateTime).getTime();
    const lastSynced = folderState[file.id] || 0;

    if (lastModified > lastSynced) {
      console.log(`[SYNC] Downloading updated file: ${file.name}`);
      try {
        const localPath = await graphClient.downloadFile(file, TEMP_DIR);
        
        console.log(`[SYNC] Uploading ${file.name} to AnythingLLM workspace: ${workspaceSlug}`);
        const uploadResult = await anythingLLMClient.uploadDocument(localPath, workspaceSlug);
        console.log(`[UPLOAD RESULT]`, uploadResult);

        // Update state
        folderState[file.id] = lastModified;
        newOrModifiedCount++;

      } catch (err) {
        console.error(`[ERROR] Failed to sync ${file.name}`, err);
      } finally {
        // Always clean up temp file even if upload fails
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
        }
      }
    }
  }

  state[folderId] = folderState;
  return newOrModifiedCount;
}

async function syncAll() {
  console.log(`\n--- Starting Sync: ${new Date().toISOString()} ---`);
  const config = loadConfig();
  const state = loadState();

  if (!config.mappings || config.mappings.length === 0) {
    console.log("No folder mappings found in config.json");
    return;
  }

  for (const mapping of config.mappings) {
    if (mapping.sharepointFolderId && mapping.workspaceSlug) {
      await processFolder(mapping.sharepointFolderId, mapping.workspaceSlug, state);
    }
  }

  saveState(state);
  console.log(`--- Sync Complete ---\n`);
}

// Start interval
const intervalMinutes = parseInt(process.env.SYNC_INTERVAL_MINUTES) || 15;
console.log(`Sync Agent started. Interval: ${intervalMinutes} minutes.`);

// Run immediately once
syncAll().catch(console.error);

// Then loop
setInterval(() => {
  syncAll().catch(console.error);
}, intervalMinutes * 60 * 1000);
