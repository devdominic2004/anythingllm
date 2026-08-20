const fs = require("fs");
const path = require("path");

const documentsPath = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR, `documents`)
  : path.resolve(__dirname, `../../storage/documents`);

class DocumentManager {
  constructor({ workspace = null, maxTokens = null }) {
    this.workspace = workspace;
    this.maxTokens = maxTokens || Number.POSITIVE_INFINITY;
    this.documentStoragePath = documentsPath;
  }

  log(text, ...args) {
    console.log(`\x1b[36m[DocumentManager]\x1b[0m ${text}`, ...args);
  }

  async pinnedDocuments() {
    if (!this.workspace) return [];
    const { Document } = require("../../models/documents");
    return await Document.where({
      workspaceId: Number(this.workspace.id),
      pinned: true,
    });
  }

  async pinnedDocs() {
    if (!this.workspace) return [];
    const docPaths = (await this.pinnedDocuments()).map((doc) => doc.docpath);
    if (docPaths.length === 0) return [];

    let tokens = 0;
    const pinnedDocs = [];
    for await (const docPath of docPaths) {
      try {
        const filePath = path.resolve(this.documentStoragePath, docPath);
        const data = JSON.parse(
          fs.readFileSync(filePath, { encoding: "utf-8" })
        );

        if (
          !data.hasOwnProperty("pageContent") ||
          !data.hasOwnProperty("token_count_estimate")
        ) {
          this.log(
            `Skipping document - Could not find page content or token_count_estimate in pinned source.`
          );
          continue;
        }

        if (tokens >= this.maxTokens) {
          this.log(
            `Skipping document - Token limit of ${this.maxTokens} has already been exceeded by pinned documents.`
          );
          continue;
        }

        pinnedDocs.push(data);
        tokens += data.token_count_estimate || 0;
      } catch {}
    }

    this.log(
      `Found ${pinnedDocs.length} pinned sources - prepending to content with ~${tokens} tokens of content.`
    );
    return pinnedDocs;
  }

  async getDocsByPaths(docPaths = []) {
    if (!this.workspace || docPaths.length === 0) return [];

    const docs = [];
    
    const readPath = (targetPath) => {
      try {
        const stat = fs.statSync(targetPath);
        if (stat.isDirectory()) {
          const files = fs.readdirSync(targetPath);
          for (const file of files) {
            readPath(path.join(targetPath, file));
          }
        } else if (targetPath.endsWith(".json")) {
          const data = JSON.parse(fs.readFileSync(targetPath, { encoding: "utf-8" }));
          docs.push(data);
        }
      } catch (e) {
        this.log(`Could not resolve document for path ${targetPath}`);
      }
    };

    for await (const docPath of docPaths) {
      const filePath = path.resolve(this.documentStoragePath, docPath);
      readPath(filePath);
    }
    return docs;
  }
}

module.exports.DocumentManager = DocumentManager;
