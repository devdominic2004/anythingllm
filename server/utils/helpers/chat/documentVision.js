const fs = require("fs");
const path = require("path");
const { documentsPath, normalizePath } = require("../../files");

const VISION_SYSTEM_PROMPT =
  "You describe images extracted from uploaded documents so the descriptions can be embedded for search. Be detailed and factual. Include any visible text, chart values, labels, and layout.";

/**
 * Resolve the on-disk JSON path for a collector document.
 * @param {{ location?: string }} doc
 * @returns {string|null}
 */
function resolveDocumentFilePath(doc = {}) {
  if (!doc?.location) return null;
  return path.resolve(documentsPath, normalizePath(doc.location));
}

/**
 * Extract text from getChatCompletion return shapes across providers.
 * @param {any} result
 * @returns {string}
 */
function extractTextResponse(result) {
  if (!result) return "";
  if (typeof result === "string") return result.trim();
  if (typeof result?.textResponse === "string")
    return result.textResponse.trim();
  return "";
}

/**
 * Build a data-URL attachment for LLM providers that expect AnythingLLM's
 * attachment shape (`contentString` + `mime`).
 * @param {{ base64: string, mime?: string }|string} image
 * @param {number} index
 */
function toVisionAttachment(image, index = 0) {
  if (typeof image === "string") {
    return {
      name: `document-image-${index + 1}.jpg`,
      mime: "image/jpeg",
      contentString: `data:image/jpeg;base64,${image}`,
    };
  }

  const mime = image.mime || "image/jpeg";
  const ext = mime.split("/")[1] || "jpg";
  return {
    name: `document-image-${index + 1}.${ext}`,
    mime,
    contentString: `data:${mime};base64,${image.base64}`,
  };
}

/**
 * Describe embedded document images with the active LLM and append the text
 * to both the in-memory document and the cached JSON on disk.
 *
 * Must complete before Document.addDocuments reads the file for embedding.
 *
 * @param {Object[]} documents - Collector documents (may include visionImagesBase64)
 * @param {{ log?: Function }} [opts]
 * @returns {Promise<Object[]>} documents with pageContent updated and base64 stripped
 */
async function appendVisionDescriptionsToDocuments(documents = [], opts = {}) {
  const log =
    typeof opts.log === "function"
      ? opts.log
      : (text, ...args) =>
          console.log(`\x1b[36m[DocumentVision]\x1b[0m ${text}`, ...args);

  if (!Array.isArray(documents) || documents.length === 0) return documents;

  const { getLLMProvider } = require("../../helpers");
  const llm = getLLMProvider();

  if (typeof llm.constructPrompt !== "function") {
    log(
      "Active LLM provider does not support constructPrompt; skipping document vision."
    );
    return documents.map(stripVisionPayload);
  }

  for (const doc of documents) {
    const images = doc.visionImagesBase64;
    if (!Array.isArray(images) || images.length === 0) {
      stripVisionPayload(doc);
      continue;
    }

    try {
      log(
        `Generating descriptions for ${images.length} image(s) in "${doc.title || doc.location}"...`
      );
      let allDescriptions = "";

      for (let i = 0; i < images.length; i++) {
        const attachment = toVisionAttachment(images[i], i);
        const messages = llm.constructPrompt({
          systemPrompt: VISION_SYSTEM_PROMPT,
          userPrompt:
            "Describe the contents, charts, text, and visual information in this image in detail.",
          contextTexts: [],
          chatHistory: [],
          attachments: [attachment],
        });

        const result = await llm.getChatCompletion(messages, {
          temperature: 0.1,
        });
        const visionDescription = extractTextResponse(result);

        if (!visionDescription) {
          log(
            `Vision LLM returned empty description for image ${i + 1}; skipping.`
          );
          continue;
        }

        allDescriptions += `\n\n[Image ${i + 1} Description: ${visionDescription}]`;
      }

      if (!allDescriptions.trim()) {
        log(
          `No usable vision descriptions produced for "${doc.title || doc.location}".`
        );
        stripVisionPayload(doc);
        continue;
      }

      const existingContent = (doc.pageContent || "").trim();
      doc.pageContent = existingContent
        ? `${existingContent}${allDescriptions}`
        : allDescriptions.trim();
      doc.token_count_estimate = undefined;
      doc.wordCount = doc.pageContent.split(/\s+/).filter(Boolean).length;

      const docFilePath = resolveDocumentFilePath(doc);
      if (docFilePath && fs.existsSync(docFilePath)) {
        const docData = JSON.parse(fs.readFileSync(docFilePath, "utf8"));
        docData.pageContent = doc.pageContent;
        docData.wordCount = doc.wordCount;
        fs.writeFileSync(docFilePath, JSON.stringify(docData, null, 4), {
          encoding: "utf-8",
        });
        log(`Appended image descriptions to ${docFilePath}`);
      } else {
        log(
          `Warning: could not find document JSON for ${doc.location}; in-memory pageContent was updated only.`
        );
      }
    } catch (e) {
      console.error(
        `[DocumentVision] Failed to process vision for "${doc.title || doc.location}":`,
        e?.message || e
      );
    }

    stripVisionPayload(doc);
  }

  return documents;
}

function stripVisionPayload(doc) {
  if (doc && Object.prototype.hasOwnProperty.call(doc, "visionImagesBase64")) {
    delete doc.visionImagesBase64;
  }
  return doc;
}

module.exports = {
  appendVisionDescriptionsToDocuments,
  extractTextResponse,
  resolveDocumentFilePath,
  toVisionAttachment,
};
