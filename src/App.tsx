/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Undo, Redo, Copy, ClipboardPaste, Trash2, Save, FileText, 
  Menu, X, ChevronRight, Zap, Database, History, 
  Check, Terminal, Heart, Info, Settings, Type,
  Eraser, Layers, FileDown, Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface HistoryItem {
  id: string;
  text: string;
  timestamp: number;
  name?: string;
}

interface Preset {
  id: string;
  name: string;
  actions: string[];
}

interface Template {
  id: string;
  name: string;
  text: string;
}

// --- Constants ---
const SYMBOLS_DICT = [
  '######', '#####', '####', '###', '##', '#',
  '***', '**', '*', '___', '__', '_', '---',
  '~~', '+', '1.', '>', '-', '```', '`',
  '[', ']', '(', ')', '!', '|', ':', '\\'
];

const EMOJI_REGEX = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;

// --- App Component ---
export default function App() {
  const [text, setText] = useState('');
  const [undoStack, setUndoStack] = useState<string[]>(['']);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'notes' | 'history'>('notes');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  
  // Persisted state
  const [notes, setNotes] = useState<HistoryItem[]>([]);
  const [sessionHistory, setSessionHistory] = useState<HistoryItem[]>([]);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load from localStorage
  useEffect(() => {
    const savedNotes = localStorage.getItem('edit_notes');
    const savedHistory = localStorage.getItem('edit_history');
    if (savedNotes) setNotes(JSON.parse(savedNotes));
    if (savedHistory) setSessionHistory(JSON.parse(savedHistory));
  }, []);

  // Sync with localStorage
  useEffect(() => {
    localStorage.setItem('edit_notes', JSON.stringify(notes));
    localStorage.setItem('edit_history', JSON.stringify(sessionHistory));
  }, [notes, sessionHistory]);

  // --- Handlers ---
  const handleTextChange = (newText: string, shouldAddToStack = true) => {
    if (shouldAddToStack && newText !== text) {
      setUndoStack(prev => [...prev.slice(-49), text]);
      setRedoStack([]);
    }
    setText(newText);
  };

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const undo = () => {
    if (undoStack.length > 0) {
      const prev = undoStack[undoStack.length - 1];
      setRedoStack(prevRedo => [...prevRedo, text]);
      setUndoStack(prevUndo => prevUndo.slice(0, -1));
      setText(prev);
    }
  };

  const redo = () => {
    if (redoStack.length > 0) {
      const next = redoStack[redoStack.length - 1];
      setUndoStack(prevUndo => [...prevUndo, text]);
      setRedoStack(prevRedo => prevRedo.slice(0, -1));
      setText(next);
    }
  };

  const copyToClipboard = async () => {
    if (!text.trim()) return;
    await navigator.clipboard.writeText(text);
    showToast('Текст скопирован');
    
    // Add to auto history
    const newItem = { id: Math.random().toString(36), text, timestamp: Date.now() };
    setSessionHistory(prev => [newItem, ...prev.slice(0, 19)]);
  };

  const pasteFromClipboard = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      handleTextChange(clipboardText);
      showToast('Текст вставлен');
    } catch {
      showToast('Ошибка доступа к буферу', 'error');
    }
  };

  const clearEditor = () => {
    if (!text) return;
    if (text.length > 50) {
      const newItem = { id: Math.random().toString(36), text, timestamp: Date.now() };
      setSessionHistory(prev => [newItem, ...prev.slice(0, 19)]);
    }
    handleTextChange('');
    showToast('Редактор очищен', 'info');
  };

  const saveToNotes = () => {
    if (!text.trim()) return;
    const name = prompt('Название заметки:', `Заметка ${new Date().toLocaleTimeString()}`);
    if (name) {
      const newItem = { id: Math.random().toString(36), text, timestamp: Date.now(), name };
      setNotes(prev => [newItem, ...prev]);
      showToast('Сохранено в заметки');
    }
  };

  // --- Formatting Actions ---
  const applyAction = (action: (t: string) => string) => {
    handleTextChange(action(text));
  };

  const actions = {
    trim: (t: string) => t.split('\n').map(l => l.trim()).join('\n'),
    spaces: (t: string) => t.replace(/[ \t]{2,}/g, ' '),
    lines: (t: string) => t.replace(/\n{3,}/g, '\n\n'),
    oneline: (t: string) => t.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim(),
    upper: (t: string) => t.toUpperCase(),
    lower: (t: string) => t.toLowerCase(),
    title: (t: string) => t.replace(/\S+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase()),
    sentences: (t: string) => t.toLowerCase().replace(/(^|[.!?]\s+)([а-яёa-z])/giu, (_, p, c) => p + c.toUpperCase()),
    suno: (t: string) => t.replace(/\[([^\]]+)\]/g, (m, inner) => {
      const structural = inner.split('|')[0].trim();
      return structural ? `[${structural}]` : m;
    }),
    removeSymbols: (pat: string) => (t: string) => {
      // Escape for regex and handle exact matches
      const ch = pat[0];
      const allSame = pat.split('').every(c => c === ch);
      if (!allSame) return t.split(pat).join('');
      
      const regex = new RegExp(`(?<!${ch})${pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!${ch})`, 'g');
      return t.replace(regex, '');
    },
    removeEmoji: (t: string) => t.replace(EMOJI_REGEX, '')
  };

  // --- Statistics ---
  const stats = useMemo(() => {
    const trimmed = text.trim();
    return {
      chars: text.length,
      words: trimmed ? trimmed.split(/\s+/).length : 0,
      symbols: SYMBOLS_DICT.reduce((acc, pat) => {
        const count = (text.match(new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
        return count > 0 ? acc + 1 : acc;
      }, 0)
    };
  }, [text]);

  // Detected symbols in current text
  const detectedSymbols = useMemo(() => {
    const found = SYMBOLS_DICT.filter(pat => text.includes(pat));
    const hasEmoji = EMOJI_REGEX.test(text);
    return { found, hasEmoji };
  }, [text]);

  // --- Templates & Presets ---
  const [templates, setTemplates] = useState<Template[]>([
    { id: '1', name: 'Suno Track', text: '[Intro]\n[Verse 1]\n{{lyrics}}\n[Chorus]\n{{lyrics}}\n[Bridge]\n[Chorus]\n[Outro]\n[End]' }
  ]);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateData, setTemplateData] = useState<Record<string, string>>({});

  const extractPlaceholders = (t: string) => {
    const matches = t.match(/{{([^}]+)}}/g) || [];
    return Array.from(new Set(matches.map(m => m.replace(/{{|}}/g, ''))));
  };

  const applyTemplate = () => {
    if (!selectedTemplate) return;
    let result = selectedTemplate.text;
    Object.entries(templateData).forEach(([key, val]) => {
      result = result.split(`{{${key}}}`).join(val);
    });
    handleTextChange(result);
    setIsTemplateModalOpen(false);
    showToast('Шаблон применён');
  };

  // --- Export Logic ---
  const getExportData = (format: 'txt' | 'md' | 'html' | 'json') => {
    switch (format) {
      case 'md': return text;
      case 'html': 
        return text
          .replace(/^# (.*$)/gim, '<h1>$1</h1>')
          .replace(/^## (.*$)/gim, '<h2>$1</h2>')
          .replace(/^\*\*\* (.*$)/gim, '<h3>$1</h3>')
          .replace(/\*\*(.*)\*\*/gim, '<b>$1</b>')
          .replace(/\*(.*)\*/gim, '<i>$1</i>')
          .replace(/\n/g, '<br/>');
      case 'json': 
        return JSON.stringify({
          content: text,
          stats: stats,
          timestamp: Date.now()
        }, null, 2);
      case 'txt':
        return text
          .replace(/\[([^\]]+)\]/g, '') // Remove brackets
          .replace(/[*_~`#]/g, '')     // Remove MD markers
          .replace(/!\[.*\]\(.*\)/g, '') // Remove images
          .replace(/\[.*\]\(.*\)/g, '') // Remove links
          .replace(/\s{2,}/g, ' ')      // Clean spaces
          .trim();
      default: return text;
    }
  };

  const copyExport = async (format: any) => {
    const data = getExportData(format);
    await navigator.clipboard.writeText(data);
    showToast(`Скопировано как ${format.toUpperCase()}`);
  };

  const downloadExport = (format: 'txt' | 'md' | 'html' | 'json') => {
    const data = getExportData(format);
    const mime = format === 'json' ? 'application/json' : format === 'html' ? 'text/html' : 'text/plain';
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export-${Date.now()}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Файл .${format} скачан`);
  };

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      
      if (isMod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((isMod && e.shiftKey && e.key.toLowerCase() === 'z') || (isMod && e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        redo();
      }
      if (isMod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveToNotes();
      }
      if (e.altKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setIsExportModalOpen(true);
      }
      if (e.altKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setIsTemplateModalOpen(true);
      }
      if (e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        clearEditor();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [text, undoStack, redoStack, notes, sessionHistory]);

  return (
    <div className="flex h-screen flex-col bg-brand-bg text-brand-text">
      {/* --- HEADER --- */}
      <header className="glass-panel flex flex-shrink-0 items-center justify-between border-b px-4 py-3 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-brand-accent to-brand-indigo shadow-lg shadow-brand-accent/30">
            <Terminal className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">E-dit</h1>
            <p className="text-[10px] font-medium uppercase tracking-widest text-brand-dim">Workspace v3.0</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-4 rounded-lg bg-brand-s2/50 px-4 py-1.5 md:flex">
            <StatItem value={stats.chars} label="симв" />
            <div className="h-4 w-[1px] bg-brand-b2" />
            <StatItem value={stats.words} label="слов" />
          </div>
          
          <button 
            onClick={() => setSidebarOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-b1 bg-brand-s2 text-brand-dim transition-colors hover:bg-brand-s3 hover:text-white lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="flex flex-1 overflow-hidden">
        <section className="flex flex-1 flex-col overflow-hidden">
          {/* toolbar */}
          <div className="no-scrollbar flex flex-shrink-0 gap-2 overflow-x-auto border-b border-brand-b1 bg-brand-s1/50 p-2">
            <ToolbarGroup label="Suno">
              <ToolbarButton label="Only Structure" onClick={() => applyAction(actions.suno)} />
            </ToolbarGroup>
            
            <div className="h-8 w-[1px] bg-brand-b2" />
            
            <ToolbarGroup label="Регистр">
              <ToolbarButton label="АА" onClick={() => applyAction(actions.upper)} />
              <ToolbarButton label="аа" onClick={() => applyAction(actions.lower)} />
              <ToolbarButton label="Аа" onClick={() => applyAction(actions.title)} />
              <ToolbarButton label="Предл." onClick={() => applyAction(actions.sentences)} />
            </ToolbarGroup>

            <div className="h-8 w-[1px] bg-brand-b2" />

            <ToolbarGroup label="Очистка">
              <ToolbarButton label="Пробелы" onClick={() => applyAction(actions.spaces)} />
              <ToolbarButton label="Строки" onClick={() => applyAction(actions.lines)} />
              <ToolbarButton label="Края" onClick={() => applyAction(actions.trim)} />
              <ToolbarButton label="В строку" onClick={() => applyAction(actions.oneline)} />
            </ToolbarGroup>

            <div className="h-8 w-[1px] bg-brand-b2" />

            <ToolbarGroup label="Шаблоны">
              <button 
                onClick={() => setIsTemplateModalOpen(true)}
                className="flex h-8 items-center justify-center rounded-lg border border-brand-indigo/30 bg-brand-indigo/10 px-3 text-[11px] font-bold text-brand-indigo transition-all hover:bg-brand-indigo/20 active:scale-95"
              >
                <FileText className="mr-1.5 h-3.5 w-3.5" /> Библиотека
              </button>
            </ToolbarGroup>
          </div>

          {/* Symbol detection bar */}
          <div className="flex flex-shrink-0 flex-col gap-2 border-b border-brand-b1 bg-brand-s1 p-3">
             <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-muted">
                  <Database className="h-3 w-3" /> Символы
                </span>
                <span className="rounded bg-brand-s2 px-1.5 py-0.5 text-[10px] font-mono text-brand-dim">{detectedSymbols.found.length} найдено</span>
             </div>
             <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                {detectedSymbols.found.length === 0 && !detectedSymbols.hasEmoji && (
                  <span className="py-1 text-xs italic text-brand-muted">Чисто</span>
                )}
                {detectedSymbols.found.map(s => (
                  <SymbolButton key={s} label={s} onClick={() => applyAction(actions.removeSymbols(s))} />
                ))}
                {detectedSymbols.hasEmoji && (
                  <SymbolButton label="😊" onClick={() => applyAction(actions.removeEmoji)} />
                )}
             </div>
          </div>

          {/* Editor */}
          <div className="relative flex-1 overflow-hidden bg-brand-s2">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              className="h-full w-full bg-transparent p-6 font-mono text-sm leading-8 text-brand-text outline-none selection:bg-brand-accent/20 sm:text-base"
              placeholder="Вставьте текст или начните писать..."
              spellCheck={false}
            />
            
            {/* Action History Overlay */}
            <div className="pointer-events-none absolute bottom-4 right-4 flex items-center gap-2 lg:hidden">
               <span className="rounded-full bg-brand-bg/80 px-4 py-1.5 text-[10px] font-bold backdrop-blur-md">
                 {stats.chars} CHARS
               </span>
            </div>
          </div>

          {/* Bottom Controls */}
          <div className="grid grid-cols-6 gap-1 border-t border-brand-b1 bg-brand-s1 p-2 md:grid-cols-7 lg:fixed lg:bottom-12 lg:left-1/2 lg:-translate-x-1/2 lg:rounded-2xl lg:border-brand-b1 lg:p-1.5 lg:shadow-2xl">
            <ActionButton icon={<Undo className="h-4 w-4" />} label="Назад" onClick={undo} disabled={undoStack.length === 0} />
            <ActionButton icon={<Redo className="h-4 w-4" />} label="Вперёд" onClick={redo} disabled={redoStack.length === 0} />
            <ActionButton icon={<ClipboardPaste className="h-5 w-5" />} label="Вставить" onClick={pasteFromClipboard} color="green" />
            <ActionButton icon={<Copy className="h-5 w-5" />} label="Копир." onClick={copyToClipboard} color="blue" />
            <ActionButton icon={<FileDown className="h-5 w-5" />} label="Экспорт" onClick={() => setIsExportModalOpen(true)} className="text-brand-accent border-brand-accent/20" />
            <ActionButton icon={<Trash2 className="h-4 w-4" />} label="Стереть" onClick={clearEditor} color="red" />
            <ActionButton icon={<Save className="h-4 w-4" />} label="Заметка" onClick={saveToNotes} className="hidden md:flex" />
          </div>
        </section>

        {/* --- DESKTOP SIDEBAR --- */}
        <aside className="hidden w-80 flex-shrink-0 border-l border-brand-b1 bg-brand-s1/30 lg:flex lg:flex-col">
          <SidebarContent 
            activeTab={activeTab} 
            setActiveTab={setActiveTab}
            notes={notes}
            history={sessionHistory}
            onRestore={handleTextChange}
            onDeleteNote={(id) => setNotes(prev => prev.filter(n => n.id !== id))}
            onDeleteHistory={(id) => setSessionHistory(prev => prev.filter(h => h.id !== id))}
          />
        </aside>
      </main>

      {/* --- MOBILE SIDEBAR --- */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 z-50 w-full max-w-xs border-l border-brand-b1 bg-brand-s1 shadow-2xl lg:hidden"
            >
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between p-4 border-b border-brand-b1">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-brand-dim">Менеджер данных</h2>
                  <button onClick={() => setSidebarOpen(false)} className="rounded-lg p-2 text-brand-muted hover:bg-brand-s2">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <SidebarContent 
                    activeTab={activeTab} 
                    setActiveTab={setActiveTab}
                    notes={notes}
                    history={sessionHistory}
                    onRestore={(t) => { handleTextChange(t); setSidebarOpen(false); }}
                    onDeleteNote={(id) => setNotes(prev => prev.filter(n => n.id !== id))}
                    onDeleteHistory={(id) => setSessionHistory(prev => prev.filter(h => h.id !== id))}
                  />
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* --- TOAST --- */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className={cn(
              "fixed bottom-24 left-1/2 z-[100] -translate-x-1/2 rounded-full px-6 py-2 text-sm font-bold shadow-2xl",
              toast.type === 'success' && "bg-emerald-500 text-white",
              toast.type === 'info' && "bg-blue-500 text-white",
              toast.type === 'error' && "bg-red-500 text-white"
            )}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- TEMPLATE MODAL --- */}
      <AnimatePresence>
        {isTemplateModalOpen && (
          <div className="fixed inset-0 z-100 flex items-end justify-center p-4 sm:items-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTemplateModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-brand-b1 bg-brand-s1 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-brand-b1 p-6">
                <div>
                  <h3 className="text-xl font-bold text-white">Шаблоны</h3>
                  <p className="text-xs font-semibold text-brand-dim uppercase tracking-widest mt-1">Выберите структуру текста</p>
                </div>
                <button 
                  onClick={() => setIsTemplateModalOpen(false)}
                  className="rounded-full bg-brand-s2 p-2 text-brand-muted hover:text-white"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-6 space-y-4 no-scrollbar">
                {!selectedTemplate ? (
                  templates.map(tpl => (
                    <button
                      key={tpl.id}
                      onClick={() => {
                        setSelectedTemplate(tpl);
                        const phs = extractPlaceholders(tpl.text);
                        const initialData: Record<string, string> = {};
                        phs.forEach(p => initialData[p] = '');
                        setTemplateData(initialData);
                      }}
                      className="w-full flex items-center justify-between rounded-2xl border border-brand-b1 bg-brand-s2/50 p-4 transition-all hover:border-brand-accent/50 hover:bg-brand-s2 group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-s3 text-brand-accent">
                          <FileText className="h-6 w-6" />
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-white uppercase tracking-tight">{tpl.name}</p>
                          <p className="text-[10px] font-bold text-brand-dim uppercase tracking-widest mt-0.5">{extractPlaceholders(tpl.text).length} плейсхолдеров</p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-brand-muted group-hover:text-brand-accent" />
                    </button>
                  ))
                ) : (
                  <div className="space-y-6">
                    <button 
                      onClick={() => setSelectedTemplate(null)}
                      className="text-xs font-bold text-brand-accent uppercase tracking-widest flex items-center gap-1 hover:underline"
                    >
                      ← Назад к списку
                    </button>
                    
                    <div className="space-y-4">
                      {extractPlaceholders(selectedTemplate.text).map(ph => (
                        <div key={ph} className="space-y-2">
                          <label className="text-[10px] font-bold text-brand-dim uppercase tracking-widest">{ph}</label>
                          <input 
                            type="text"
                            value={templateData[ph] || ''}
                            onChange={(e) => setTemplateData(prev => ({ ...prev, [ph]: e.target.value }))}
                            className="w-full rounded-xl border border-brand-b2 bg-brand-s2 px-4 py-3 text-sm text-white outline-none focus:border-brand-accent"
                            placeholder={`Введите ${ph}...`}
                          />
                        </div>
                      ))}
                    </div>

                    <button 
                      onClick={applyTemplate}
                      className="w-full rounded-xl bg-brand-accent py-4 text-sm font-bold text-white shadow-lg shadow-brand-accent/20 transition-all hover:bg-brand-accent/80 active:scale-95"
                    >
                      Вставить в редактор
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- EXPORT MODAL --- */}
      <AnimatePresence>
        {isExportModalOpen && (
          <div className="fixed inset-0 z-100 flex items-end justify-center p-4 sm:items-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsExportModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-brand-b1 bg-brand-s1 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-brand-b1 p-6">
                <div>
                  <h3 className="text-xl font-bold text-white">Экспорт</h3>
                  <p className="text-xs font-semibold text-brand-dim uppercase tracking-widest mt-1">Выберите формат вывода</p>
                </div>
                <button 
                  onClick={() => setIsExportModalOpen(false)}
                  className="rounded-full bg-brand-s2 p-2 text-brand-muted hover:text-white"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-6 space-y-4 no-scrollbar">
                <ExportOption 
                  title="Markdown" 
                  desc="Сохранить оригинальное форматирование"
                  icon={<FileText className="h-5 w-5" />}
                  onCopy={() => copyExport('md')}
                  onDownload={() => downloadExport('md')}
                />
                <ExportOption 
                  title="Plain Text (Clean)" 
                  desc="Убрать [теги] и Markdown разметку"
                  icon={<Type className="h-5 w-5" />}
                  onCopy={() => copyExport('txt')}
                  onDownload={() => downloadExport('txt')}
                />
                <ExportOption 
                  title="HTML Board" 
                  desc="Для вставки в блоги и сайты"
                  icon={<Terminal className="h-5 w-5" />}
                  onCopy={() => copyExport('html')}
                  onDownload={() => downloadExport('html')}
                />
                <ExportOption 
                  title="JSON Structure" 
                  desc="Текст и метаданные для API"
                  icon={<Database className="h-5 w-5" />}
                  onCopy={() => copyExport('json')}
                  onDownload={() => downloadExport('json')}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ExportOption({ title, desc, icon, onCopy, onDownload }: any) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-brand-b1 bg-brand-s2/40 p-4 transition-all hover:bg-brand-s2">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-s3 text-brand-dim">
          {icon}
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-bold text-white">{title}</h4>
          <p className="text-[10px] font-medium text-brand-muted">{desc}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button 
          onClick={onCopy}
          className="flex-1 rounded-lg bg-brand-s3 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-dim hover:bg-brand-b1 hover:text-white"
        >
          Копировать
        </button>
        <button 
          onClick={onDownload}
          className="rounded-lg bg-brand-accent/10 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-brand-accent hover:bg-brand-accent/20"
        >
          Файл
        </button>
      </div>
    </div>
  );
}

// --- Sub-components ---

function StatItem({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-sm font-bold text-white">{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">{label}</span>
    </div>
  );
}

function ToolbarGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 px-2">
      <span className="text-[9px] font-bold uppercase tracking-widest text-brand-muted">{label}</span>
      <div className="flex gap-1.5">
        {children}
      </div>
    </div>
  );
}

function ToolbarButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-8 items-center justify-center rounded-lg border border-brand-b1 bg-brand-s2 px-3 text-[11px] font-bold text-brand-dim transition-all hover:border-brand-b2 hover:bg-brand-s3 hover:text-white active:scale-95"
    >
      {label}
    </button>
  );
}

function SymbolButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-8 items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 font-mono text-sm text-red-400 transition-all hover:bg-red-500/10 active:scale-90"
    >
      <span className="max-w-[80px] overflow-hidden text-ellipsis whitespace-nowrap">{label}</span>
      <Eraser className="h-3 w-3 opacity-60" />
    </button>
  );
}

function ActionButton({ icon, label, onClick, disabled, color, className }: any) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-xl border border-brand-b1 bg-brand-s2 p-2 text-brand-dim transition-all hover:bg-brand-s3 disabled:opacity-30 lg:min-w-[70px] lg:border-transparent lg:bg-transparent lg:hover:bg-white/5",
        color === 'green' && "border-emerald-500/10 text-emerald-500 hover:bg-emerald-500/5",
        color === 'blue' && "border-blue-500/10 bg-blue-500 text-white hover:bg-blue-600 lg:bg-brand-accent",
        color === 'red' && "border-red-500/10 text-red-500 hover:bg-red-500/5",
        className
      )}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}

function SidebarContent({ activeTab, setActiveTab, notes, history, onRestore, onDeleteNote, onDeleteHistory }: any) {
  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4 flex rounded-lg bg-brand-s2 p-1 border border-brand-b1">
        <button 
          onClick={() => setActiveTab('notes')}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-xs font-bold transition-all",
            activeTab === 'notes' ? "bg-brand-s3 text-white shadow-sm" : "text-brand-muted hover:text-brand-dim"
          )}
        >
          <Database className="h-3.5 w-3.5" /> Заметки
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-xs font-bold transition-all",
            activeTab === 'history' ? "bg-brand-s3 text-white shadow-sm" : "text-brand-muted hover:text-brand-dim"
          )}
        >
          <History className="h-3.5 w-3.5" /> История
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-2">
        {activeTab === 'notes' ? (
          notes.length === 0 ? <EmptyState label="Заметок пока нет" /> :
          notes.map((n: any) => (
            <DataCard 
              key={n.id} 
              title={n.name} 
              subtitle={new Date(n.ts || n.timestamp).toLocaleString()} 
              preview={n.text}
              onRestore={() => onRestore(n.text)}
              onDelete={() => onDeleteNote(n.id)}
            />
          ))
        ) : (
          history.length === 0 ? <EmptyState label="История пуста" /> :
          history.map((h: any) => (
            <DataCard 
              key={h.id} 
              title="Авто-сохранение" 
              subtitle={new Date(h.timestamp).toLocaleTimeString()} 
              preview={h.text}
              onRestore={() => onRestore(h.text)}
              onDelete={() => onDeleteHistory(h.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-brand-muted">
      <Layers className="mb-2 h-8 w-8 opacity-20" />
      <span className="text-xs font-medium italic">{label}</span>
    </div>
  );
}

function DataCard({ title, subtitle, preview, onRestore, onDelete }: any) {
  return (
    <div className="group relative rounded-xl border border-brand-b1 bg-brand-s2 p-3 transition-all hover:border-brand-b2 hover:bg-brand-s3">
      <div className="flex flex-col gap-1 pr-8 cursor-pointer" onClick={onRestore}>
        <h4 className="text-xs font-bold text-white line-clamp-1">{title}</h4>
        <p className="text-[10px] font-medium text-brand-dim">{subtitle}</p>
        <p className="mt-1 font-mono text-[10px] text-brand-muted line-clamp-2 leading-relaxed">{preview}</p>
      </div>
      <button 
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="absolute right-2 top-2 rounded-lg p-1.5 text-brand-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      <div className="absolute right-2 bottom-2 rounded-lg p-1.5 text-brand-accent opacity-0 transition-opacity group-hover:opacity-100">
         <ChevronRight className="h-4 w-4" />
      </div>
    </div>
  );
}

