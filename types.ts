export enum FieldType {
  TEXT = 'Text',
  CHECKBOX = 'Checkbox',
  RADIO = 'Radio',
}

export interface FormElement {
  id: string;
  type: FieldType;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  description?: string;
  required: boolean;
  transparent?: boolean;
  options?: string[];
}

export interface PdfPageInfo {
  pageIndex: number;
  width: number;
  height: number;
  scale: number;
}
