const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const TurndownService = require('turndown');

const turndownService = new TurndownService();
turndownService.remove('img'); // Strip images

const inputFile = process.argv[2];

if (!inputFile || !inputFile.endsWith('.docx')) {
    console.error("Usage: node local-convert.js <path_to_docx>");
    process.exit(1);
}

const outputFile = inputFile.replace(/\.docx$/i, '.md');

console.log(`Converting ${inputFile}...`);

const options = {
    convertImage: mammoth.images.inline(() => Promise.resolve({src: ""}))
};

mammoth.convertToHtml({path: inputFile}, options)
    .then(result => {
        const markdown = turndownService.turndown(result.value);
        fs.writeFileSync(outputFile, markdown);
        console.log(`\n✅ Success! Created: ${outputFile}`);
        console.log(`Drag and drop this .md file into AnythingLLM!`);
    })
    .catch(err => console.error("Error converting file:", err));
