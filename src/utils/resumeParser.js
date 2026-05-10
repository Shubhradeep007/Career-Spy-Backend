const axios    = require("axios");
const mammoth  = require("mammoth");
const { PDFParse } = require("pdf-parse");

/**
 * Downloads a file from a URL (Cloudinary) and returns a Buffer.
 */
const downloadFile = async (url) => {
  const response = await axios.get(url, { responseType: "arraybuffer" });
  return Buffer.from(response.data);
};

/**
 * Extracts plain text from a PDF buffer using pdf-parse.
 */
const extractPdfText = async (buffer) => {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  return result.text;
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