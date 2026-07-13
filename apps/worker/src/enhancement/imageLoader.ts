import fs from "fs/promises";
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";
import { LoadedImage } from "./types";

export async function loadImage(filePath: string): Promise<LoadedImage> {
    const buffer = await fs.readFile(filePath);

    const fileType = await fileTypeFromBuffer(buffer);

    if (!fileType) {
        throw new Error("Unsupported file.");
    }

    if (
        fileType.mime !== "image/png" &&
        fileType.mime !== "image/jpeg" &&
        fileType.mime !== "image/webp" &&
        fileType.mime !== "application/pdf"
    ) {
        throw new Error(`Unsupported format ${fileType.mime}`);
    }

    let imageBuffer = buffer;

    if (fileType.mime === "application/pdf") {
        throw new Error("PDF conversion coming in next step.");
    }

    const metadata = await sharp(imageBuffer).metadata();

    return {
        buffer: imageBuffer,
        format: metadata.format ?? "unknown",
        width: metadata.width ?? 0,
        height: metadata.height ?? 0,
        dpi: metadata.density ?? 300,
        pages: metadata.pages ?? 1,
        filename: filePath.split(/[\\/]/).pop() ?? "",
        mime: fileType.mime
    };
}