import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { FormElement, FieldType } from '../types';

const pdfjs = (pdfjsLib as any).default ?? pdfjsLib;

export const loadPdfDocument = async (file: File): Promise<pdfjsLib.PDFDocumentProxy> => {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument(arrayBuffer);
  return loadingTask.promise;
};

export const renderPageToCanvas = async (
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageIndex: number,
  canvas: HTMLCanvasElement,
  scale: number = 1.5
): Promise<{ width: number; height: number }> => {
  const page = await pdfDoc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale });

  canvas.height = viewport.height;
  canvas.width = viewport.width;

  const renderContext = {
    canvasContext: canvas.getContext('2d') as CanvasRenderingContext2D,
    viewport: viewport,
  };

  await page.render(renderContext as any).promise;
  return { width: viewport.width, height: viewport.height };
};

export const savePdfWithFields = async (
  originalPdfBytes: ArrayBuffer,
  elements: FormElement[],
  pageInfo: { [pageIndex: number]: { width: number; height: number; scale: number } }
): Promise<Uint8Array> => {
  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  const form = pdfDoc.getForm();

  const elementsByPage: { [key: number]: FormElement[] } = {};
  elements.forEach((el) => {
    if (!elementsByPage[el.pageIndex]) elementsByPage[el.pageIndex] = [];
    elementsByPage[el.pageIndex].push(el);
  });

  for (const pageIndexStr of Object.keys(elementsByPage)) {
    const pageIndex = parseInt(pageIndexStr, 10);
    const page = pdfDoc.getPage(pageIndex);
    const pageElements = elementsByPage[pageIndex];
    const currentInfo = pageInfo[pageIndex];

    if (!currentInfo) continue;

    const { scale } = currentInfo;

    for (const el of pageElements) {
      const pdfWidth = el.width / scale;
      const pdfHeight = el.height / scale;
      const unscaledVisualX = el.x / scale;
      const unscaledVisualY = el.y / scale;
      const cropBox = page.getCropBox();
      const unscaledHeight = currentInfo.height / scale;
      const pdfX = cropBox.x + unscaledVisualX;
      const pdfY = cropBox.y + unscaledHeight - unscaledVisualY - pdfHeight;

      const fieldName = el.name || `field_${el.id}`;

      if (el.type === FieldType.TEXT) {
        const textField = form.createTextField(fieldName);
        textField.setText('');
        const appearance: any = { x: pdfX, y: pdfY, width: pdfWidth, height: pdfHeight };
        if (el.transparent) {
          appearance.borderWidth = 0;
          appearance.backgroundColor = undefined;
          appearance.borderColor = undefined;
        }
        textField.addToPage(page, appearance);
        if (el.required) textField.enableRequired();
      } else if (el.type === FieldType.CHECKBOX) {
        const checkBox = form.createCheckBox(fieldName);
        const appearance: any = { x: pdfX, y: pdfY, width: pdfWidth, height: pdfHeight };
        if (el.transparent) {
          appearance.borderWidth = 0;
          appearance.backgroundColor = undefined;
          appearance.borderColor = undefined;
        }
        checkBox.addToPage(page, appearance);
        if (el.required) checkBox.enableRequired();
      } else if (el.type === FieldType.RADIO) {
        const radioGroup = form.createRadioGroup(fieldName);
        const appearance: any = { x: pdfX, y: pdfY, width: pdfWidth, height: pdfHeight };
        if (el.transparent) {
          appearance.borderWidth = 0;
          appearance.backgroundColor = undefined;
          appearance.borderColor = undefined;
        }
        radioGroup.addOptionToPage('Yes', page, appearance);
      }
    }
  }

  return pdfDoc.save();
};
