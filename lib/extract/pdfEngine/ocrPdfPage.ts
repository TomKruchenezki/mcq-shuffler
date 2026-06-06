export async function ocrPdfPage(
  worker: { recognize(image: HTMLCanvasElement): Promise<{ data: { text: string } }> },
  canvas: HTMLCanvasElement,
): Promise<string> {
  const { data } = await worker.recognize(canvas)
  return data.text
}
