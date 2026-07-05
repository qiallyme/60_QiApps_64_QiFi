import React, { useMemo } from 'react';
import { Download, ExternalLink, FileQuestion, FileText, Image as ImageIcon, X } from 'lucide-react';
import { Attachment } from '../types';

interface AttachmentPreviewModalProps {
  attachment: Attachment | null;
  onClose: () => void;
  titlePrefix?: string;
}

const TEXT_TYPES = [
  'text/',
  'application/json',
  'application/xml',
  'application/csv',
  'application/x-ndjson'
];

function hasExtension(fileName: string, extensions: string[]): boolean {
  const lower = fileName.toLowerCase();
  return extensions.some(ext => lower.endsWith(ext));
}

function decodeTextDataUrl(dataUrl: string): string | null {
  if (!dataUrl.startsWith('data:')) return null;
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) return null;

  const metadata = dataUrl.slice(0, commaIndex);
  const payload = dataUrl.slice(commaIndex + 1);

  try {
    if (metadata.includes(';base64')) {
      const binary = atob(payload);
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    }
    return decodeURIComponent(payload);
  } catch {
    return null;
  }
}

export default function AttachmentPreviewModal({ attachment, onClose, titlePrefix }: AttachmentPreviewModalProps) {
  const textPreview = useMemo(() => {
    if (!attachment) return null;

    const looksText =
      TEXT_TYPES.some(type => attachment.fileType.startsWith(type)) ||
      hasExtension(attachment.fileName, ['.txt', '.csv', '.tsv', '.json', '.xml', '.md', '.log']);

    if (!looksText) return null;
    return decodeTextDataUrl(attachment.dataUrl);
  }, [attachment]);

  if (!attachment) return null;

  const fileType = attachment.fileType || 'Unknown file type';
  const isImage = fileType.startsWith('image/') || attachment.dataUrl.includes('images.unsplash.com');
  const isPdf = fileType === 'application/pdf' || hasExtension(attachment.fileName, ['.pdf']);
  const isOfficeDoc = hasExtension(attachment.fileName, ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx']);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-5xl w-full flex flex-col max-h-[92vh] overflow-hidden shadow-2xl">
        <div className="flex justify-between items-center gap-3 px-4 py-3 border-b border-zinc-800 bg-zinc-950/40">
          <div className="min-w-0 flex items-center gap-2">
            {isImage ? <ImageIcon className="text-emerald-400 shrink-0" size={18} /> : <FileText className="text-emerald-400 shrink-0" size={18} />}
            <div className="min-w-0">
              <h4 className="font-semibold text-zinc-100 text-sm truncate">
                {titlePrefix ? `${titlePrefix}: ` : ''}{attachment.fileName}
              </h4>
              <p className="text-[10px] text-zinc-500 font-mono">
                {fileType} · uploaded {new Date(attachment.uploadedAt).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={attachment.dataUrl}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 text-zinc-400 hover:text-zinc-100 bg-zinc-800/80 hover:bg-zinc-750 border border-zinc-700 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
            >
              <ExternalLink size={12} /> Open
            </a>
            <a
              href={attachment.dataUrl}
              download={attachment.fileName}
              className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-zinc-100 bg-zinc-800/80 hover:bg-zinc-750 border border-zinc-700 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
            >
              <Download size={12} /> Save
            </a>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-white p-1.5 hover:bg-zinc-800 rounded-lg cursor-pointer"
              title="Close preview"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="overflow-auto bg-zinc-950/60 flex-1 min-h-[320px]">
          {isImage && (
            <div className="h-full min-h-[320px] p-4 flex items-center justify-center">
              <img
                src={attachment.dataUrl}
                alt={attachment.fileName}
                referrerPolicy="no-referrer"
                className="max-h-[72vh] max-w-full object-contain rounded-xl border border-zinc-800 shadow-2xl"
              />
            </div>
          )}

          {!isImage && isPdf && (
            <iframe
              title={attachment.fileName}
              src={attachment.dataUrl}
              className="w-full h-[72vh] bg-white"
            />
          )}

          {!isImage && !isPdf && textPreview !== null && (
            <pre className="m-0 p-4 sm:p-6 text-xs leading-relaxed text-zinc-200 whitespace-pre-wrap break-words font-mono">
              {textPreview.slice(0, 200000)}
              {textPreview.length > 200000 ? '\n\n[Preview truncated. Save the file to inspect the full document.]' : ''}
            </pre>
          )}

          {!isImage && !isPdf && textPreview === null && (
            <div className="min-h-[320px] p-8 flex items-center justify-center">
              <div className="text-center max-w-sm space-y-3">
                <FileQuestion size={54} className="mx-auto text-zinc-600" />
                <p className="text-zinc-200 text-sm font-semibold">Preview is not available for this file type.</p>
                <p className="text-zinc-500 text-xs leading-relaxed">
                  {isOfficeDoc
                    ? 'Word, Excel, and PowerPoint files need a document converter before they can render inside QiFi.'
                    : 'This binary document can still be opened in a new tab or saved from this viewer.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {attachment.notes && (
          <div className="p-4 border-t border-zinc-800 bg-zinc-950/30">
            <span className="text-[9px] uppercase font-mono text-zinc-500 block">Notes</span>
            <p className="text-xs text-zinc-300 italic mt-1">{attachment.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
