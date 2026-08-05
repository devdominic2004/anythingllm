# SharePoint Sync Agent Setup Guide

This guide explains how to set up the Azure Application and run the Sync Agent.

## 1. Environment Strategy (Sandbox vs. Production)
Because Microsoft has restricted the free M365 Developer Sandbox program, you have two options:
**Option A (Mock Server):** Run `npm run mock-server` locally to test the AnythingLLM injection logic safely.
**Option B (Production with `Sites.Selected`):** Register the app in your company's real production tenant, but use the highly restricted `Sites.Selected` permission. This guarantees the script can **only** read one specific, empty test folder that you designate, keeping all other company data perfectly safe.

## 2. Register an Azure Application
1. Go to the [Azure Active Directory Portal](https://aad.portal.azure.com/) (or Entra ID) and log in.
2. Navigate to **App registrations** -> **New registration**.
3. Name it `AnythingLLM-SharePoint-Sync` and select **Accounts in this organizational directory only**.
4. Click **Register**.

## 3. Get Credentials
1. On the app overview page, copy the **Application (client) ID** and **Directory (tenant) ID**.
2. Go to **Certificates & secrets** -> **New client secret**.
3. Add a description, set expiration, and click Add.
4. **Copy the Secret Value** immediately (it will be hidden later).

## 4. Grant API Permissions (Option B - Production Safe)
If you are doing Option B in your production tenant, you **must not** use `Sites.Read.All` as it grants access to the entire company.
1. Go to **API permissions** -> **Add a permission**.
2. Select **Microsoft Graph** -> **Application permissions**.
3. Search for and check exactly: `Sites.Selected`.
4. Click **Add permissions**.
5. Click **Grant admin consent for [Your Tenant]** to approve the permissions.

*(Note: Because `Sites.Selected` requires you to explicitly grant the App access to a specific site, your SharePoint Admin will need to run a one-time PowerShell script or Graph API call to grant this App registration "Read" access to your specific Test Site).*

## 5. Configure the Script
1. Rename `.env.example` to `.env`.
2. Fill in the `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, and `AZURE_CLIENT_SECRET`.
3. Provide your `ANYTHINGLLM_URL` and `ANYTHINGLLM_API_KEY` (Generate this in the AnythingLLM dashboard).

## 6. Configure Folder Mappings
1. Open `config.json`.
2. Find the Drive/Folder ID you want to sync using Graph Explorer or URL inspection.
3. Map it to the `workspaceSlug` of the AnythingLLM workspace you want the files to go into.

## 7. Run the Agent
1. Open a terminal in this directory (`sharepoint-sync-agent`).
2. Run `npm start` (or `node index.js`).
3. The script will run continuously in the background!
