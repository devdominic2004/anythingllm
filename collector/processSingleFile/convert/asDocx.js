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
  let preProcessedContent = "";
  let rawXmlContent = "";
  
  // --- NATIVE XML TO MARKDOWN IMPLEMENTATION ---
  try {
    console.log(`-- Parsing content from docx via Native XML Parser --`);
    const AdmZip = require("adm-zip");
    const zip = new AdmZip(fullFilePath);
    const documentXml = zip.getEntry("word/document.xml");
    
    if (documentXml) {
      rawXmlContent = documentXml.getData().toString("utf8");
      const cheerio = require("cheerio");

      function parseDocxXmlToMarkdown(xmlString) {
        const $ = cheerio.load(xmlString, { xmlMode: true });
        let markdown = "";

        function parseParagraph(pNode) {
          let text = "";
          let isList = false;
          let listIndent = 0;
          let headingLevel = 0;

          const pPr = $(pNode).children("w\\:pPr").first();
          if (pPr.length) {
            const pStyle = pPr.children("w\\:pStyle").first();
            if (pStyle.length) {
              const val = pStyle.attr("w:val") || "";
              if (val.startsWith("Heading")) {
                const level = parseInt(val.replace("Heading", ""), 10);
                if (!isNaN(level) && level >= 1 && level <= 6) {
                  headingLevel = level;
                }
              }
            }

            const numPr = pPr.children("w\\:numPr").first();
            if (numPr.length) {
              isList = true;
              const ilvl = numPr.children("w\\:ilvl").first();
              if (ilvl.length) {
                listIndent = parseInt(ilvl.attr("w:val") || "0", 10);
              }
            }
          }

          const runs = $(pNode).children("w\\:r");
          runs.each((_, rNode) => {
            let runText = "";
            const tNodes = $(rNode).children("w\\:t");
            tNodes.each((_, tNode) => {
              runText += $(tNode).text();
            });

            if (!runText) return;

            const rPr = $(rNode).children("w\\:rPr").first();
            let isBold = false;
            let isItalic = false;
            let isStrike = false;

            if (rPr.length) {
              const b = rPr.children("w\\:b").first();
              if (b.length && b.attr("w:val") !== "0" && b.attr("w:val") !== "false") isBold = true;
              
              const i = rPr.children("w\\:i").first();
              if (i.length && i.attr("w:val") !== "0" && i.attr("w:val") !== "false") isItalic = true;

              const strike = rPr.children("w\\:strike").first();
              if (strike.length && strike.attr("w:val") !== "0" && strike.attr("w:val") !== "false") isStrike = true;
            }

            if (isStrike) runText = `~~${runText}~~`;
            if (isItalic) runText = `*${runText}*`;
            if (isBold) runText = `**${runText}**`;

            text += runText;
          });

          if (text.trim().length === 0) return "";

          if (headingLevel > 0) {
            text = `${"#".repeat(headingLevel)} ${text}`;
          } else if (isList) {
            const indentStr = "  ".repeat(listIndent);
            text = `${indentStr}- ${text}`;
          }

          return text;
        }

        $("w\\:body").children().each((_, node) => {
          if (node.tagName === "w:p") {
            const pText = parseParagraph(node);
            if (pText) markdown += pText + "\n\n";
          } else if (node.tagName === "w:tbl") {
            let isFirstRow = true;
            $(node).children("w\\:tr").each((_, row) => {
              let rowText = "|";
              let headerDivider = "|";
              $(row).children("w\\:tc").each((_, cell) => {
                const cellParas = $(cell).children("w\\:p");
                let cellText = "";
                cellParas.each((_, p) => {
                  cellText += parseParagraph(p).replace(/^[#-]+\s*/, "") + " ";
                });
                cellText = cellText.trim().replace(/\n/g, " ");
                rowText += ` ${cellText || " "} |`;
                if (isFirstRow) {
                  headerDivider += " --- |";
                }
              });
              markdown += rowText + "\n";
              if (isFirstRow) {
                markdown += headerDivider + "\n";
                isFirstRow = false;
              }
            });
            markdown += "\n";
          }
        });

        return markdown.trim();
      }

      const markdown = parseDocxXmlToMarkdown(rawXmlContent);
      preProcessedContent = markdown; // No HTML conversion needed anymore, just use the raw markdown
      
      if (markdown.trim().length > 0) {
        pageContent.push(markdown);
      }
    } else {
      console.error(`Failed to extract word/document.xml from ${filename}`);
    }
  } catch (err) {
    console.error(`Failed to parse DOCX using Native Parser:`, err);
  }
  // --------------------------------------------------------------

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
    preProcessedContent: preProcessedContent,
    rawXmlContent: rawXmlContent,
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
