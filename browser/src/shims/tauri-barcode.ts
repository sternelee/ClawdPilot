export enum Format {
  QRCode = "QR_CODE",
  EAN8 = "EAN_8",
  EAN13 = "EAN_13",
  Code39 = "CODE_39",
  Code128 = "CODE_128",
  PDF417 = "PDF_417",
  Aztec = "AZTEC",
  DataMatrix = "DATA_MATRIX",
  UPC_A = "UPC_A",
  UPC_E = "UPC_E",
}

export async function scan(_options?: { formats?: Format[] }): Promise<{ content: string }> {
  throw new Error("Barcode scanning is not supported in browser mode");
}

export async function checkPermissions(): Promise<{ camera: "granted" | "denied" | "prompt" }> {
  return { camera: "denied" };
}

export async function requestPermissions(): Promise<{ camera: "granted" | "denied" | "prompt" }> {
  return { camera: "denied" };
}
