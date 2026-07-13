export interface LoadedImage {
  buffer: Buffer;
  format: string;
  width: number;
  height: number;
  dpi: number;
  pages: number;
  filename: string;
  mime: string;
}