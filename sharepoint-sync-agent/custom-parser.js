const AdmZip = require('adm-zip');
const fs = require('fs');
const cheerio = require('cheerio'); // AnythingLLM has this!

function parseDocx(filePath) {
    const zip = new AdmZip(filePath);
    const documentXml = zip.readAsText("word/document.xml");
    
    if (!documentXml) {
        console.error("Could not find word/document.xml");
        return;
    }

    const $ = cheerio.load(documentXml, { xmlMode: true });
    
    let markdown = "";

    // Iterate over all paragraphs and tables
    $('w\\:body').children().each((i, el) => {
        const tagName = el.tagName;
        if (tagName === 'w:p') {
            let paragraphText = "";
            $(el).find('w\\:t').each((j, textEl) => {
                paragraphText += $(textEl).text();
            });
            if (paragraphText.trim().length > 0) {
                markdown += paragraphText.trim() + "\n\n";
            }
        } else if (tagName === 'w:tbl') {
            // Handle table
            markdown += "\n[Table Extracted]\n";
            $(el).find('w\\:tr').each((j, trEl) => {
                let rowText = [];
                $(trEl).find('w\\:tc').each((k, tcEl) => {
                    let cellText = "";
                    $(tcEl).find('w\\:t').each((l, textEl) => {
                        cellText += $(textEl).text();
                    });
                    rowText.push(cellText.trim());
                });
                markdown += "| " + rowText.join(" | ") + " |\n";
            });
            markdown += "\n";
        }
    });

    console.log("Extraction complete. Length:", markdown.length);
    fs.writeFileSync("output.md", markdown);
}

parseDocx("Experiment no.1.docx");
