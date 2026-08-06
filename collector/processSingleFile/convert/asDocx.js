const { v4 } = require("uuid");
const mammoth = require("mammoth");
const TurndownService = require("turndown");
const {
  createdDate,
  trashFile,
  writeToServerDocuments,
} = require("../../utils/files");
const { tokenizeString } = require("../../utils/tokenizer");
const { default: slugify } = require("slugify");

const IMAGE_EXTENSION_MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

/**
 * Extract embedded images from a .docx (ZIP) as base64 payloads for Document Vision.
 * @param {string} fullFilePath
 * @returns {{ base64: string, mime: string }[]}
 */
function extractDocxVisionImages(fullFilePath) {
  const visionImages = [];
  try {
    console.log(`[asDocx] Attempting to extract images for vision...`);
    const AdmZip = require("adm-zip");
    const zip = new AdmZip(fullFilePath);
    const zipEntries = zip.getEntries();

    console.log(`[asDocx] Found ${zipEntries.length} total entries in zip.`);

    for (const zipEntry of zipEntries) {
      if (
        !zipEntry.entryName.startsWith("word/media/") ||
        zipEntry.isDirectory
      ) {
        continue;
      }

      console.log(`[asDocx] Found media entry: ${zipEntry.entryName}`);
      const extension = zipEntry.name.split(".").pop()?.toLowerCase();
      const mime = IMAGE_EXTENSION_MIME[extension];
      if (!mime) {
        console.log(`[asDocx] Ignored non-supported extension: ${extension}`);
        continue;
      }

      const buffer = zipEntry.getData();
      if (!buffer?.length) continue;

      visionImages.push({
        base64: buffer.toString("base64"),
        mime,
      });
      console.log(`[asDocx] Successfully extracted and encoded ${zipEntry.name}`);
    }

    console.log(`[asDocx] Total images extracted: ${visionImages.length}`);
  } catch (e) {
    console.error(
      `Failed to extract images from DOCX for vision: ${e.message}`
    );
  }
  return visionImages;
}

async function asDocX({
  fullFilePath = "",
  filename = "",
  options = {},
  metadata = {},
}) {
  console.log(`-- Working ${filename} --`);
  let pageContent = [];
  
  try {
    const turndownService = new TurndownService();
    turndownService.remove('img'); // actively remove all image tags to prevent Base64 bloat

    // Strip images using mammoth
    const mammothOptions = {
      convertImage: mammoth.images.inline(function(element) {
          return Promise.resolve({src: ""});
      })
    };
    
    console.log(`-- Parsing content from docx via Mammoth & Turndown --`);
    const result = await mammoth.convertToHtml({path: fullFilePath}, mammothOptions);
    const html = result.value;
    
    const markdown = turndownService.turndown(html);
    
    if (markdown.trim().length > 0) {
      pageContent.push(markdown);
    }
  } catch (err) {
    console.error(`Failed to parse DOCX using mammoth:`, err);
  }

  const visionImagesBase64 = options.documentVision
    ? extractDocxVisionImages(fullFilePath)
    : [];

  // Allow image-only documents when Document Vision is enabled and images exist.
  // Do not invent whitespace placeholders — those produce 0 embed chunks.
  if (!pageContent.length) {
    if (!options.documentVision || visionImagesBase64.length === 0) {
      console.error(`Resulting text content was empty for ${filename}.`);
      if (!options.absolutePath) trashFile(fullFilePath);
      return {
        success: false,
        reason: options.documentVision
          ? `No text content or extractable images found in ${filename}.`
          : `No text content found in ${filename}.`,
        documents: [],
      };
    }
    console.log(
      `[asDocx] No native text in ${filename}; continuing with ${visionImagesBase64.length} image(s) for Document Vision.`
    );
  }

  const content = pageContent.join("");
  const data = {
    id: v4(),
    url: "file://" + fullFilePath,
    title: metadata.title || filename,
    docAuthor: metadata.docAuthor || "no author found",
    description: metadata.description || "No description found.",
    docSource: metadata.docSource || "docx file uploaded by the user.",
    chunkSource: metadata.chunkSource || "",
    published: createdDate(fullFilePath),
    wordCount: content ? content.split(" ").length : 0,
    pageContent: content,
    token_count_estimate: content ? tokenizeString(content) : 0,
  };

  const document = writeToServerDocuments({
    data,
    filename: `${slugify(filename)}-${data.id}`,
    options: { parseOnly: options.parseOnly },
  });

  if (visionImagesBase64.length > 0) {
    document.visionImagesBase64 = visionImagesBase64;
  }

  if (!options.absolutePath) trashFile(fullFilePath);
  console.log(`[SUCCESS]: ${filename} converted & ready for embedding.\n`);
  return { success: true, reason: null, documents: [document] };
}

module.exports = asDocX;
