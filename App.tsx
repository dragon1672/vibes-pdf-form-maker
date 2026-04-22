import React, { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { v4 as uuidv4 } from 'uuid';
import { Upload, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, AlertCircle, X } from 'lucide-react';

import Sidebar from './components/Sidebar';
import DraggableField from './components/DraggableField';
import { loadPdfDocument, renderPageToCanvas, savePdfWithFields } from './services/pdfService';
import { FormElement, FieldType, PdfPageInfo } from './types';

const DEFAULT_SCALE = 1.5;

const App: React.FC = () => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [originalPdfBytes, setOriginalPdfBytes] = useState<ArrayBuffer | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(DEFAULT_SCALE);
  const [elements, setElements] = useState<FormElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<FieldType | 'select'>('select');
  const [isDownloading, setIsDownloading] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  useEffect(() => {
    if (errorToast) {
      const timer = setTimeout(() => setErrorToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorToast]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageInfo, setPageInfo] = useState<{ [key: number]: PdfPageInfo }>({});

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const bytes = await file.arrayBuffer();
      setOriginalPdfBytes(bytes);
      const loadedPdf = await loadPdfDocument(file);
      setPdfDoc(loadedPdf);
      setTotalPages(loadedPdf.numPages);
      setCurrentPage(0);
      setElements([]);
    }
  };

  useEffect(() => {
    const render = async () => {
      if (!pdfDoc || !canvasRef.current) return;
      const dims = await renderPageToCanvas(pdfDoc, currentPage, canvasRef.current, scale);
      setPageInfo(prev => ({
        ...prev,
        [currentPage]: {
          pageIndex: currentPage,
          width: dims.width,
          height: dims.height,
          scale: scale,
        },
      }));
    };
    render();
  }, [pdfDoc, currentPage, scale]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (activeTool === 'select' || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let width = 120;
    let height = 30;
    if (activeTool === FieldType.CHECKBOX || activeTool === FieldType.RADIO) {
      width = 24;
      height = 24;
    }

    const newElement: FormElement = {
      id: uuidv4(),
      type: activeTool,
      pageIndex: currentPage,
      x,
      y,
      width,
      height,
      name: `Field ${elements.length + 1}`,
      required: false,
      transparent: true,
    };

    setElements([...elements, newElement]);
    setSelectedElementId(newElement.id);
    setActiveTool('select');
  };

  const updateElement = (id: string, updates: Partial<FormElement>) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el));
  };

  const deleteElement = (id: string) => {
    setElements(prev => prev.filter(el => el.id !== id));
    if (selectedElementId === id) setSelectedElementId(null);
  };

  const duplicateElement = (id: string) => {
    const elToDuplicate = elements.find(el => el.id === id);
    if (!elToDuplicate) return;
    const newElement: FormElement = {
      ...elToDuplicate,
      id: uuidv4(),
      name: `${elToDuplicate.name} Copy`,
      x: elToDuplicate.x + 20,
      y: elToDuplicate.y + 20,
    };
    setElements(prev => [...prev, newElement]);
    setSelectedElementId(newElement.id);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (selectedElementId) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
          e.preventDefault();
          duplicateElement(selectedElementId);
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          deleteElement(selectedElementId);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId, elements]);

  const handleDownload = async () => {
    if (!originalPdfBytes) return;
    setIsDownloading(true);
    setErrorToast(null);
    try {
      const modifiedPdfBytes = await savePdfWithFields(originalPdfBytes, elements, pageInfo);
      const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'formflow-interactive.pdf';
      link.click();
    } catch (err: any) {
      console.error("Error saving PDF", err);
      setErrorToast(err.message || String(err));
    } finally {
      setIsDownloading(false);
    }
  };

  const currentElements = elements.filter(el => el.pageIndex === currentPage);
  const selectedElement = elements.find(el => el.id === selectedElementId) || null;

  if (!pdfDoc) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-10 rounded-2xl shadow-2xl max-w-md w-full text-center border border-slate-100">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Upload className="text-blue-500" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">FormFlow</h1>
          <p className="text-slate-500 mb-8 leading-relaxed">
            Upload a PDF to start building your interactive form.
            <br/>
            <span className="text-sm text-slate-400">Add text fields, checkboxes, and radios visually.</span>
          </p>

          <label className="block w-full cursor-pointer group">
            <div className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all shadow-lg shadow-blue-200 group-hover:shadow-blue-300 flex items-center justify-center gap-2">
              <Upload size={20} />
              <span>Select PDF Document</span>
            </div>
            <input type="file" accept="application/pdf" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      {errorToast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-red-50 text-red-800 border border-red-200 shadow-xl rounded-xl p-4 flex items-start gap-3 max-w-sm">
            <div className="mt-0.5 text-red-500">
              <AlertCircle size={20} />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-sm text-red-900">Export Failed</h4>
              <p className="text-sm mt-1 text-red-700 opacity-90 break-words leading-relaxed">{errorToast}</p>
            </div>
            <button
              onClick={() => setErrorToast(null)}
              className="text-red-400 hover:text-red-700 hover:bg-red-100 rounded-md p-1 transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <Sidebar
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        selectedElement={selectedElement}
        updateElement={updateElement}
        deleteElement={deleteElement}
        duplicateElement={duplicateElement}
        onDownload={handleDownload}
        isDownloading={isDownloading}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                disabled={currentPage === 0}
                className="p-2 hover:bg-white rounded-md disabled:opacity-30 transition-colors text-slate-600"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm font-semibold text-slate-700 w-20 text-center">
                {currentPage + 1} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                disabled={currentPage === totalPages - 1}
                className="p-2 hover:bg-white rounded-md disabled:opacity-30 transition-colors text-slate-600"
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="h-6 w-px bg-slate-200 mx-2"></div>
            <div className="flex items-center gap-2">
              <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                <ZoomOut size={18} />
              </button>
              <span className="text-xs font-medium text-slate-500 w-12 text-center">{Math.round(scale * 100)}%</span>
              <button onClick={() => setScale(s => Math.min(3, s + 0.25))} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                <ZoomIn size={18} />
              </button>
            </div>
          </div>

          <div className="text-xs font-medium text-slate-400">
            {elements.length} field{elements.length !== 1 ? 's' : ''} added
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-slate-200/50 p-8 flex justify-center relative">
          <div
            className="relative bg-white shadow-lg border border-slate-200 transition-all duration-200 ease-out"
            ref={containerRef}
            onClick={handleCanvasClick}
            style={{
              width: pageInfo[currentPage]?.width || 'auto',
              height: pageInfo[currentPage]?.height || 'auto',
              cursor: activeTool !== 'select' ? 'crosshair' : 'default',
            }}
          >
            <canvas ref={canvasRef} className="block" />

            {currentElements.map(el => (
              <DraggableField
                key={el.id}
                element={el}
                isSelected={selectedElementId === el.id}
                scale={scale}
                onSelect={(e) => {
                  e.stopPropagation();
                  setSelectedElementId(el.id);
                  setActiveTool('select');
                }}
                onUpdate={updateElement}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
