const { parse } = require("node-html-parser");

function parseDocxXmlToMarkdown(xmlString) {
  const root = parse(xmlString);
  let markdown = "";

  const body = root.getElementsByTagName("w:body")[0];
  if (!body) return "";

  function parseParagraph(pNode) {
    let text = "";
    
    let isList = false;
    let listIndent = 0;
    
    // In docx, headers might look like <w:pStyle w:val="Heading1"/>
    let headingLevel = 0;

    const pPr = pNode.getElementsByTagName("w:pPr")[0];
    if (pPr) {
      const pStyle = pPr.getElementsByTagName("w:pStyle")[0];
      if (pStyle) {
        const val = pStyle.getAttribute("w:val") || "";
        if (val.startsWith("Heading")) {
          const level = parseInt(val.replace("Heading", ""), 10);
          if (!isNaN(level) && level >= 1 && level <= 6) {
            headingLevel = level;
          }
        }
      }

      const numPr = pPr.getElementsByTagName("w:numPr")[0];
      if (numPr) {
        isList = true;
        const ilvl = numPr.getElementsByTagName("w:ilvl")[0];
        if (ilvl) {
          listIndent = parseInt(ilvl.getAttribute("w:val") || "0", 10);
        }
      }
    }

    const runs = pNode.getElementsByTagName("w:r");
    for (const rNode of runs) {
      let runText = "";
      const tNodes = rNode.getElementsByTagName("w:t");
      for (const tNode of tNodes) {
        runText += tNode.text;
      }
      
      if (!runText) continue;

      const rPr = rNode.getElementsByTagName("w:rPr")[0];
      let isBold = false;
      let isItalic = false;
      let isStrike = false;

      if (rPr) {
        const b = rPr.getElementsByTagName("w:b")[0];
        if (b && b.getAttribute("w:val") !== "0" && b.getAttribute("w:val") !== "false") isBold = true;
        
        const i = rPr.getElementsByTagName("w:i")[0];
        if (i && i.getAttribute("w:val") !== "0" && i.getAttribute("w:val") !== "false") isItalic = true;

        const strike = rPr.getElementsByTagName("w:strike")[0];
        if (strike && strike.getAttribute("w:val") !== "0" && strike.getAttribute("w:val") !== "false") isStrike = true;
      }

      if (isStrike) runText = `~~${runText}~~`;
      if (isItalic) runText = `*${runText}*`;
      if (isBold) runText = `**${runText}**`;

      text += runText;
    }

    if (text.trim().length === 0) return "";

    if (headingLevel > 0) {
      text = `${"#".repeat(headingLevel)} ${text}`;
    } else if (isList) {
      const indentStr = "  ".repeat(listIndent);
      text = `${indentStr}- ${text}`;
    }

    return text;
  }

  for (const node of body.childNodes) {
    if (node.rawTagName === "w:p") {
      const pText = parseParagraph(node);
      if (pText) markdown += pText + "\n\n";
    } else if (node.rawTagName === "w:tbl") {
      const rows = node.getElementsByTagName("w:tr");
      let isFirstRow = true;
      for (const row of rows) {
        const cells = row.getElementsByTagName("w:tc");
        let rowText = "|";
        let headerDivider = "|";
        for (const cell of cells) {
          const cellParas = cell.getElementsByTagName("w:p");
          // Remove Markdown formatting inside tables (like lists/headings) for simplicity and stability
          let cellText = cellParas.map(p => parseParagraph(p).replace(/^[#-]+\s*/, "")).join(" ").replace(/\n/g, " ");
          rowText += ` ${cellText.trim() || " "} |`;
          if (isFirstRow) {
            headerDivider += " --- |";
          }
        }
        markdown += rowText + "\n";
        if (isFirstRow) {
          markdown += headerDivider + "\n";
          isFirstRow = false;
        }
      }
      markdown += "\n";
    }
  }

  return markdown.trim();
}

console.log(parseDocxXmlToMarkdown(`
<w:document>
  <w:body>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
      </w:pPr>
      <w:r><w:t>Title</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Hello </w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>bold</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:numPr><w:ilvl w:val="0"/></w:numPr>
      </w:pPr>
      <w:r><w:t>List Item 1</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:numPr><w:ilvl w:val="1"/></w:numPr>
      </w:pPr>
      <w:r><w:t>Sub Item 1</w:t></w:r>
    </w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>H1</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>H2</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>V1</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>V2</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>
`));
