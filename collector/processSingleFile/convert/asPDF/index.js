const fs = require("fs").promises;
const { v4 } = require("uuid");
const {
  createdDate,
  trashFile,
  writeToServerDocuments,
} = require("../../../utils/files");
const { tokenizeString } = require("../../../utils/tokenizer");
const { default: slugify } = require("slugify");
const PDFLoader = require("./PDFLoader");
const OCRLoader = require("../../../utils/OCRLoader");

/**
 * Best-effort extraction of embedded raster images from a PDF for Document Vision.
 * Uses the same pdf.js build as PDFLoader. Skips tiny decorative assets.
 * @param {string} fullFilePath
 * @returns {Promise<{ base64: string, mime: string }[]>}
 */
async function extractPdfVisionImages(fullFilePath) {
  const visionImages = [];
  const seen = new Set();
  let sharp;
  try {
    sharp = require("sharp");
  } catch {
    console.log(
      "[asPDF] sharp is unavailable; skipping PDF image extraction for vision."
    );
    return visionImages;
  }

  try {
    console.log(`[asPDF] Attempting to extract images for vision...`);
    const buffer = await fs.readFile(fullFilePath);
    const pdfjs = await import("pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js");
    const pdf = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;

    const OPS = pdfjs.OPS || {};
    const paintOps = new Set(
      [
        OPS.paintImageXObject,
        OPS.paintInlineImageXObject,
        OPS.paintImageMaskXObject,
      ].filter((op) => typeof op === "number")
    );

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const ops = await page.getOperatorList();
      const imageNames = new Set();

      for (let i = 0; i < ops.fnArray.length; i++) {
        if (!paintOps.has(ops.fnArray[i])) continue;
        const args = ops.argsArray[i];
        if (typeof args?.[0] === "string") imageNames.add(args[0]);
      }

      for (const name of imageNames) {
        try {
          const img = await Promise.race([
            new Promise((resolve) => {
              try {
                page.objs.get(name, resolve);
              } catch {
                resolve(null);
              }
            }),
            new Promise((resolve) => setTimeout(() => resolve(null), 2000)),
          ]);

          if (!img?.data || !img?.width || !img?.height) continue;
          if (img.width < 32 || img.height < 32) continue;

          const key = `${pageNum}:${name}:${img.width}x${img.height}:${img.data.length}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const channels =
            img.data.length >= img.width * img.height * 4
              ? 4
              : img.data.length >= img.width * img.height * 3
                ? 3
                : 1;
          const pngBuffer = await sharp(Buffer.from(img.data), {
            raw: {
              width: img.width,
              height: img.height,
              channels,
            },
          })
            .png()
            .toBuffer();

          visionImages.push({
            base64: pngBuffer.toString("base64"),
            mime: "image/png",
          });
          console.log(
            `[asPDF] Extracted image ${name} from page ${pageNum} (${img.width}x${img.height})`
          );
        } catch (e) {
          console.log(
            `[asPDF] Skipped image object on page ${pageNum}: ${e.message}`
          );
        }
      }
    }

    console.log(`[asPDF] Total images extracted: ${visionImages.length}`);
  } catch (e) {
    console.error(
      `Failed to extract images from PDF for vision: ${e.message}`
    );
  }
  return visionImages;
}

async function asPdf({
  fullFilePath = "",
  filename = "",
  options = {},
  metadata = {},
}) {
  const pdfLoader = new PDFLoader(fullFilePath, {
    splitPages: true,
  });

  console.log(`-- Working ${filename} --`);
  const pageContent = [];
  let docs = await pdfLoader.load();

  if (docs.length === 0) {
    console.log(
      `[asPDF] No text content found for ${filename}. Will attempt OCR parse.`
    );
    docs = await new OCRLoader({
      targetLanguages: options?.ocr?.langList,
    }).ocrPDF(fullFilePath);
  }

  for (const doc of docs) {
    console.log(
      `-- Parsing content from pg ${
        doc.metadata?.loc?.pageNumber || "unknown"
      } --`
    );
    if (!doc.pageContent || !doc.pageContent.length) continue;
    pageContent.push(doc.pageContent);
  }

  let visionImagesBase64 = [];
  if (options.documentVision) {
    visionImagesBase64 = await extractPdfVisionImages(fullFilePath);
  }

  // Allow image-only PDFs when Document Vision extracted embedded images.
  // Do not invent whitespace placeholders — those produce 0 embed chunks.
  if (!pageContent.length) {
    if (!options.documentVision || visionImagesBase64.length === 0) {
      console.error(`[asPDF] Resulting text content was empty for ${filename}.`);
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
      `[asPDF] No native text in ${filename}; continuing with ${visionImagesBase64.length} image(s) for Document Vision.`
    );
  }

  const content = pageContent.join("");
  const data = {
    id: v4(),
    url: "file://" + fullFilePath,
    title: metadata.title || filename,
    docAuthor:
      metadata.docAuthor ||
      docs[0]?.metadata?.pdf?.info?.Creator ||
      "no author found",
    description:
      metadata.description ||
      docs[0]?.metadata?.pdf?.info?.Title ||
      "No description found.",
    docSource: metadata.docSource || "pdf file uploaded by the user.",
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

module.exports = asPdf;
