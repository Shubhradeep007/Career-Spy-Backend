const axios   = require("axios");
const mammoth = require("mammoth");
const PDFParser = require("pdf2json");

/**
 * Downloads a file from Cloudinary and returns a Buffer.
 */
const downloadFile = async (url) => {
  const response = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(response.data);
};

/**
 * Extracts plain text from a PDF buffer using pdf2json.
 * Works on Windows + Node 22 with zero import issues.
 */
const extractPdfText = (buffer) => {
  return new Promise((resolve, reject) => {
    const parser = new PDFParser(null, 1); // 1 = raw text mode

    parser.on("pdfParser_dataReady", (pdfData) => {
      // pdf2json stores raw text in pdfData.Pages[].Texts[].R[].T
      // getRawTextContent() gives us everything joined cleanly
      const text = parser.getRawTextContent();
      resolve(text);
    });

    parser.on("pdfParser_dataError", (err) => {
      reject(new Error(err.parserError || "PDF parsing failed"));
    });

    parser.parseBuffer(buffer);
  });
};

/**
 * Extracts plain text from a PDF or DOCX buffer.
 */
const extractTextFromBuffer = async (buffer, fileType) => {
  if (fileType === "pdf") {
    return await extractPdfText(buffer);
  }

  if (fileType === "doc" || fileType === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error(`Unsupported file type: ${fileType}`);
};

/**
 * Main entry — downloads from Cloudinary URL and returns extracted text.
 */
const extractResumeText = async (fileUrl, fileType) => {
  const buffer = await downloadFile(fileUrl);
  const text   = await extractTextFromBuffer(buffer, fileType);
  return text.trim();
};

module.exports = { extractResumeText };