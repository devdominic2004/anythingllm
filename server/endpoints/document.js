const { Document } = require("../models/documents");
const { normalizePath, documentsPath, isWithin, fileData } = require("../utils/files");
const { reqBody } = require("../utils/http");
const {
  flexUserRoleValid,
  ROLES,
} = require("../utils/middleware/multiUserProtected");
const { validatedRequest } = require("../utils/middleware/validatedRequest");
const fs = require("fs");
const path = require("path");

function documentEndpoints(app) {
  if (!app) return;
  app.post(
    "/document/create-folder",
    [validatedRequest, flexUserRoleValid([ROLES.admin, ROLES.manager])],
    async (request, response) => {
      try {
        const { name } = reqBody(request);
        const storagePath = path.join(documentsPath, normalizePath(name));
        if (!isWithin(path.resolve(documentsPath), path.resolve(storagePath)))
          throw new Error("Invalid folder name.");

        if (fs.existsSync(storagePath)) {
          response.status(500).json({
            success: false,
            message: "Folder by that name already exists",
          });
          return;
        }

        fs.mkdirSync(storagePath, { recursive: true });
        response.status(200).json({ success: true, message: null });
      } catch (e) {
        console.error(e);
        response.status(500).json({
          success: false,
          message: `Failed to create folder: ${e.message} `,
        });
      }
    }
  );

  app.post(
    "/document/move-files",
    [validatedRequest, flexUserRoleValid([ROLES.admin, ROLES.manager])],
    async (request, response) => {
      try {
        const { files } = reqBody(request);
        const docpaths = files.map(({ from }) => from);
        const documents = await Document.where({ docpath: { in: docpaths } });

        const embeddedFiles = documents.map((doc) => doc.docpath);
        const moveableFiles = files.filter(
          ({ from }) => !embeddedFiles.includes(from)
        );

        const movePromises = moveableFiles.map(({ from, to }) => {
          const sourcePath = path.join(documentsPath, normalizePath(from));
          const destinationPath = path.join(documentsPath, normalizePath(to));

          return new Promise((resolve, reject) => {
            if (
              !isWithin(documentsPath, sourcePath) ||
              !isWithin(documentsPath, destinationPath)
            )
              return reject("Invalid file location");

            fs.rename(sourcePath, destinationPath, (err) => {
              if (err) {
                console.error(`Error moving file ${from} to ${to}:`, err);
                reject(err);
              } else {
                resolve();
              }
            });
          });
        });

        Promise.all(movePromises)
          .then(() => {
            const unmovableCount = files.length - moveableFiles.length;
            if (unmovableCount > 0) {
              response.status(200).json({
                success: true,
                message: `${unmovableCount}/${files.length} files not moved. Unembed them from all workspaces.`,
              });
            } else {
              response.status(200).json({
                success: true,
                message: null,
              });
            }
          })
          .catch((err) => {
            console.error("Error moving files:", err);
            response
              .status(500)
              .json({ success: false, message: "Failed to move some files." });
          });
      } catch (e) {
        console.error(e);
        response
          .status(500)
          .json({ success: false, message: "Failed to move files." });
      }
    }
  );

  app.get(
    "/document/:folderName/:filename/raw",
    [validatedRequest, flexUserRoleValid([ROLES.admin, ROLES.manager, ROLES.workspace_builder])],
    async (request, response) => {
      try {
        const { folderName, filename } = request.params;
        const filePath = `${folderName}/${filename}`;
        
        const fileDataRaw = await fileData(filePath);
        if (!fileDataRaw) {
          response.status(404).json({ success: false, error: "File not found" });
          return;
        }

        response.status(200).json({
          success: true,
          pageContent: fileDataRaw.pageContent,
          preProcessedContent: fileDataRaw.preProcessedContent || "No pre-processed content available.",
          rawXmlContent: fileDataRaw.rawXmlContent || "",
        });
      } catch (e) {
        console.error(e);
        response.status(500).json({ success: false, error: e.message });
      }
    }
  );

  app.get(
    "/document/original",
    [validatedRequest, flexUserRoleValid([ROLES.admin, ROLES.manager, ROLES.workspace_builder, ROLES.default])],
    async (request, response) => {
      try {
        const { sourceUrl = "", docTitle = "" } = request.query;
        if (!sourceUrl && !docTitle) {
          response.status(400).json({ success: false, error: "Missing sourceUrl or docTitle" });
          return;
        }

        let targetFilePath = null;

        // 1. Try finding by docTitle if provided
        if (docTitle) {
          const cleanTitle = path.basename(docTitle.trim());
          const candidateInCustom = path.resolve(documentsPath, "custom-documents", cleanTitle);
          if (fs.existsSync(candidateInCustom) && isWithin(documentsPath, candidateInCustom)) {
            targetFilePath = candidateInCustom;
          } else {
            // Search across subfolders in documentsPath
            for (const folder of fs.readdirSync(documentsPath)) {
              const fullFolder = path.resolve(documentsPath, folder);
              if (fs.existsSync(fullFolder) && fs.lstatSync(fullFolder).isDirectory()) {
                const checkFile = path.resolve(fullFolder, cleanTitle);
                if (fs.existsSync(checkFile) && isWithin(documentsPath, checkFile)) {
                  targetFilePath = checkFile;
                  break;
                }
              }
            }
          }
        }

        // 2. If not found by docTitle, resolve using sourceUrl
        if (!targetFilePath && sourceUrl) {
          let parsedPath = sourceUrl;
          if (sourceUrl.startsWith("file://")) {
            parsedPath = sourceUrl.replace("file://", "");
          }
          
          if (parsedPath.includes("/collector/hotdir/")) {
            const filename = path.basename(parsedPath);
            parsedPath = path.resolve(documentsPath, "custom-documents", filename);
          } else if (!path.isAbsolute(parsedPath)) {
            parsedPath = path.resolve(documentsPath, normalizePath(parsedPath));
          }

          const folderPath = path.dirname(parsedPath);
          if (isWithin(path.resolve(documentsPath), path.resolve(folderPath)) && fs.existsSync(folderPath)) {
            if (parsedPath.endsWith(".txt") || parsedPath.endsWith(".json") || parsedPath.endsWith(".md")) {
              const filesInDir = fs.readdirSync(folderPath);
              const originalFile = filesInDir.find(f => !f.endsWith(".json") && !f.endsWith(".md") && !f.endsWith(".txt"));
              if (originalFile) {
                targetFilePath = path.join(folderPath, originalFile);
              }
            } else if (fs.existsSync(parsedPath)) {
              targetFilePath = parsedPath;
            }
          }
        }

        if (!targetFilePath || !fs.existsSync(targetFilePath)) {
          response.status(404).json({ success: false, error: "Original file not found. It may have been deleted by the system." });
          return;
        }

        response.download(targetFilePath, path.basename(targetFilePath));
      } catch (e) {
        console.error("Error downloading original file:", e);
        response.status(500).json({ success: false, error: "Failed to download original file" });
      }
    }
  );
}

module.exports = { documentEndpoints };
