/**
 * OCR layer: sends invoice PDF/image to OCR.space and returns ParsedResults[].ParsedText.
 * Table mode (isTable) improves tab-separated line items for extraction/lineItems.ts.
 */
import axios from "axios";
import FormData from "form-data";
import fs from "fs";

export async function analyzeInvoice(
  filePath: string
) {
  const formData = new FormData();

  // OCR.space multipart request
  formData.append(
    "file",
    fs.createReadStream(filePath)
  );

  formData.append(
    "apikey",
    "helloworld"
  );

  formData.append(
    "language",
    "eng"
  );

  formData.append(
    "isTable",
    "true"
  );

  const response = await axios.post(
    "https://api.ocr.space/parse/image",
    formData,
    {
      headers: formData.getHeaders(),
    }
  );

  return response.data;
}