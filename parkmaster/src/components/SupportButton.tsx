'use client';
import { useState } from 'react';
import { LifeBuoy, X, Send, ImageIcon } from 'lucide-react';
import { useStore } from '@/lib/store';
import { SUPPORT_WHATSAPP } from '@/lib/supabase';
import { Btn } from './ui';

export function SupportButton() {
  const { session, addSupportTicket, toast } = useStore();
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const pick = (f: File | null) => {
    setFile(f);
    setPreview(prev => { if (prev) URL.revokeObjectURL(prev); return f ? URL.createObjectURL(f) : null; });
  };

  const send = async () => {
    if (desc.trim().length < 10) { toast('err', 'Describa el problema con al menos 10 caracteres para poder atenderlo.'); return; }
    if (!file) { toast('info', 'Falta la captura de pantalla: es indispensable para atender su requerimiento de inmediato.'); return; }
    const tenantName = session?.tenant?.business_name ?? 'N/A';
    const email = session?.profile.email ?? 'N/A';
    // Copia la imagen al portapapeles para pegarla (Ctrl+V) en el chat de WhatsApp
    try {
      if (navigator.clipboard && 'write' in navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        const blob = file.type === 'image/png' ? file : await createPng(file);
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        toast('ok', 'Captura copiada al portapapeles: pégala (Ctrl+V) en el chat de WhatsApp.');
      }
    } catch { toast('info', 'No se pudo copiar la captura automáticamente: adjúntela manualmente en WhatsApp.'); }
    addSupportTicket(desc.trim(), file.name);
    const text = `Hola Christian, solicito soporte para el parqueadero: ${tenantName}. Usuario: ${email}. Problema: ${desc.trim()}. (Adjunto captura a continuación)`;
    window.open(`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    setOpen(false); setDesc(''); pick(null);
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="fixed bottom-5 right-5 z-40 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-xl px-4 py-3 flex items-center gap-2 font-semibold">
        <LifeBuoy size={20} /><span className="hidden sm:inline">Soporte Técnico Especializado</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl w-full max-w-lg p-5 shadow-2xl max-h-[92vh] overflow-auto">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><LifeBuoy className="text-emerald-600" />Soporte Técnico Especializado</h2>
              <button onClick={() => setOpen(false)} aria-label="Cerrar"><X /></button>
            </div>
            <p className="text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-3 mb-3">
              Para atender tu requerimiento de inmediato, es indispensable adjuntar una captura de pantalla clara donde se observe el error o el inconveniente completo.
            </p>
            <label className="text-xs font-medium text-slate-500">Descripción breve del problema
              <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} maxLength={400} className="block w-full border border-slate-300 rounded-lg px-3 py-2 text-base text-slate-900 mt-1" /></label>
            <label className="mt-3 flex flex-col items-center justify-center gap-1 border-2 border-dashed border-slate-300 rounded-lg p-4 cursor-pointer hover:bg-slate-50 text-sm text-slate-500">
              <ImageIcon />{file ? file.name : 'Cargar captura de pantalla'}
              <input type="file" accept="image/*" className="hidden" onChange={e => pick(e.target.files?.[0] ?? null)} />
            </label>
            {preview && /* eslint-disable-next-line @next/next/no-img-element */ <img src={preview} alt="Vista previa de la captura" className="mt-3 max-h-48 mx-auto rounded border" />}
            <Btn onClick={send} className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white py-3"><Send size={18} />Enviar a WhatsApp de Soporte (318 351 7802)</Btn>
          </div>
        </div>
      )}
    </>
  );
}

async function createPng(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  c.getContext('2d')!.drawImage(bmp, 0, 0);
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('png'))), 'image/png'));
}
