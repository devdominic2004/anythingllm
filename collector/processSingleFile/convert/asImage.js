const { v4 } = require("uuid");
const { tokenizeString } = require("../../utils/tokenizer");
const {
  createdDate,
  trashFile,
  writeToServerDocuments,
} = require("../../utils/files");
const OCRLoader = require("../../utils/OCRLoader");
const { default: slugify } = require("slugify");
const path = require("path");

const IMAGE_EXTENSION_MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  tiff: "image/tiff",
  tif: "image/tiff",
};

function mimeFromFilename(filename = "") {
  const extension = path.extname(filename).replace(".", "").toLowerCase();
  return IMAGE_EXTENSION_MIME[extension] || "image/png";
}

async function asImage({
  fullFilePath = "",
  filename = "",
  options = {},
  metadata = {},
}) {
  let content = await new OCRLoader({
    targetLanguages: options?.ocr?.langList,
  }).ocrImage(fullFilePath);

  let visionImage = null;
  if (options.documentVision) {
    const fs = require("fs");
    try {
      const buffer = fs.readFileSync(fullFilePath);
      if (buffer?.length) {
        visionImage = {
          base64: buffer.toString("base64"),
          mime: mimeFromFilename(filename),
        };
      }
    } catch (e) {
      console.error(`Failed to read image for vision: ${e.message}`);
    }
  }

  // Allow OCR-empty images when Document Vision can still describe the file.
  // Avoid whitespace placeholders that later produce 0 embed chunks.
  if (!content?.length) {
    if (!options.documentVision || !visionImage) {
      console.error(`Resulting text content was empty for ${filename}.`);
      if (!options.absolutePath) trashFile(fullFilePath);
      return {
        success: false,
        reason: options.documentVision
          ? `No OCR text and image could not be read for vision in ${filename}.`
          : `No text content found in ${filename}.`,
        documents: [],
      };
    }
    content = "";
    console.log(
      `[asImage] No OCR text in ${filename}; continuing for Document Vision.`
    );
  }

  console.log(`-- Working ${filename} --`);
  const data = {
    id: v4(),
    url: "file://" + fullFilePath,
    title: metadata.title || filename,
    docAuthor: metadata.docAuthor || "Unknown",
    description: metadata.description || "Unknown",
    docSource: metadata.docSource || "image file uploaded by the user.",
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

  if (visionImage) {
    document.visionImagesBase64 = [visionImage];
  }

  if (!options.absolutePath) trashFile(fullFilePath);
  console.log(`[SUCCESS]: ${filename} converted & ready for embedding.\n`);
  return { success: true, reason: null, documents: [document] };
}

module.exports = asImage;
