/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  Sparkles,
  Trash2,
  X,
  RotateCcw
} from 'lucide-react';

interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

interface Task {
  id: string;
  columnId: string;
  title: string;
  description: string;
  dueDate?: string;
  category?: string;
  subtasks: SubTask[];
  createdAt: string;
}

interface Column {
  id: string;
  title: string;
  color: string;
}

const DEFAULT_COLUMNS: Column[] = [
  { id: 'todo', title: 'Tugasan Baru', color: 'indigo' },
  { id: 'progress', title: 'Sedang Berjalan', color: 'amber' },
  { id: 'done', title: 'Selesai', color: 'emerald' }
];

const DEFAULT_TASKS: Task[] = [
  {
    id: 'task-1',
    columnId: 'todo',
    title: 'Sediakan slaid pembentangan suku tahunan',
    description: 'Kumpul data kewangan dari jabatan perakaunan untuk dibentang minggu ini.',
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    category: 'Kerja',
    subtasks: [
      { id: 'sub-1-1', title: 'Kumpul laporan jualan bulanan', completed: true },
      { id: 'sub-1-2', title: 'Draf slaid ringkasan eksekutif', completed: false }
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: 'task-2',
    columnId: 'todo',
    title: 'Rancang sarapan sihat mingguan',
    description: 'Fokus kepada makanan tinggi protein untuk diet bertenaga.',
    category: 'Kesihatan',
    subtasks: [],
    createdAt: new Date().toISOString()
  },
  {
    id: 'task-3',
    columnId: 'progress',
    title: 'Uji susun atur papan Kanban BijakAtur',
    description: 'Memastikan susun atur responsif dan kemas pada semua jenis peranti.',
    dueDate: new Date().toISOString().split('T')[0],
    category: 'Sistem',
    subtasks: [
      { id: 'sub-3-1', title: 'Uji sistem seret & letak', completed: true },
      { id: 'sub-3-2', title: 'Simpan ke LocalStorage', completed: true }
    ],
    createdAt: new Date().toISOString()
  }
];

export default function App() {
  // Persisted state
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('bijak_tasks');
    return saved ? JSON.parse(saved) : DEFAULT_TASKS;
  });

  const [columns, setColumns] = useState<Column[]>(() => {
    const saved = localStorage.getItem('bijak_columns');
    return saved ? JSON.parse(saved) : DEFAULT_COLUMNS;
  });

  // Modal & Add state
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [quickAddInput, setQuickAddInput] = useState<{ [columnId: string]: string }>({});
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColTitle, setNewColTitle] = useState('');

  // Drag state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [draggedOverColumnId, setDraggedOverColumnId] = useState<string | null>(null);
  const [aiBreakdownLoading, setAiBreakdownLoading] = useState(false);

  // Confirmation States
  const [isConfirmingTaskDelete, setIsConfirmingTaskDelete] = useState(false);
  const [confirmColDeleteId, setConfirmColDeleteId] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem('bijak_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('bijak_columns', JSON.stringify(columns));
  }, [columns]);

  // When activeTask changes, reset task delete confirmation state
  useEffect(() => {
    setIsConfirmingTaskDelete(false);
  }, [activeTask]);

  // confirmReset auto-timeout after 4 seconds
  useEffect(() => {
    if (confirmReset) {
      const timer = setTimeout(() => setConfirmReset(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [confirmReset]);

  // Breakdown subtasks with AI
  const pecahTugasanDenganAI = async (taskObj: Task) => {
    if (!taskObj.title.trim()) return;
    setAiBreakdownLoading(true);
    try {
      const res = await fetch('/api/pecah-tugasan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tajuk: taskObj.title, huraian: taskObj.description })
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.subtasks && Array.isArray(data.subtasks)) {
        const generated: SubTask[] = data.subtasks.map((stText: string, i: number) => ({
          id: `ai-sub-${Date.now()}-${i}`,
          title: stText,
          completed: false
        }));
        
        const updatedTask = {
          ...taskObj,
          subtasks: [...taskObj.subtasks, ...generated]
        };
        setTasks(prev => prev.map(t => t.id === taskObj.id ? updatedTask : t));
        setActiveTask(updatedTask);
      }
    } catch {
      alert("AI sedang sibuk, sila cuba sebentar lagi.");
    } finally {
      setAiBreakdownLoading(false);
    }
  };

  // Add Task Instantly
  const handleQuickAdd = (columnId: string) => {
    const text = quickAddInput[columnId]?.trim();
    if (!text) return;

    const newTask: Task = {
      id: `task-${Date.now()}`,
      columnId,
      title: text,
      description: '',
      subtasks: [],
      createdAt: new Date().toISOString()
    };

    setTasks(prev => [...prev, newTask]);
    setQuickAddInput(prev => ({ ...prev, [columnId]: '' }));
  };

  // Move columns manually
  const moveTaskColumn = (taskId: string, targetColId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, columnId: targetColId } : t));
    if (activeTask && activeTask.id === taskId) {
      setActiveTask(prev => prev ? { ...prev, columnId: targetColId } : null);
    }
  };

  // Drag and Drop
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    setDraggedTaskId(taskId);
  };

  const handleDrop = (e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (taskId) {
      moveTaskColumn(taskId, targetColId);
    }
    setDraggedTaskId(null);
    setDraggedOverColumnId(null);
  };

  // Stats
  const totalTasksCount = tasks.length;
  const doneTasksCount = tasks.filter(t => t.columnId === 'done').length;

  return (
    <div className="h-screen w-screen bg-[#FAFAFA] text-[#1A1A1A] flex flex-col font-sans selection:bg-slate-100 antialiased overflow-hidden">
      
      {/* BULLETPROOF DYNAMIC STYLE INJECTION (Bypasses any browser cache issues instantly!) */}
      <style>{`
        @keyframes custom-fade {
          from {
            background-color: rgba(0, 0, 0, 0);
            backdrop-filter: blur(0px);
          }
          to {
            background-color: rgba(0, 0, 0, 0.25);
            backdrop-filter: blur(4px);
          }
        }
        @keyframes custom-spring {
          0% {
            opacity: 0;
            transform: scale(0.92) translateY(15px);
          }
          70% {
            transform: scale(1.01) translateY(-2px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes custom-pulse-indigo {
          0%, 100% {
            border-color: rgba(99, 102, 241, 0.1);
            background-color: rgba(99, 102, 241, 0.0);
          }
          50% {
            border-color: rgba(99, 102, 241, 0.5);
            background-color: rgba(99, 102, 241, 0.05);
            box-shadow: inset 0 0 12px rgba(99, 102, 241, 0.03);
          }
        }
        @keyframes custom-sparkle {
          0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.8; }
          50% { transform: scale(1.25) rotate(15deg); opacity: 1; filter: drop-shadow(0 0 5px rgba(245,158,11,0.6)); }
        }
        .custom-animate-backdrop {
          animation: custom-fade 0.24s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .custom-animate-modal {
          animation: custom-spring 0.38s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .custom-animate-pulse-drop {
          animation: custom-pulse-indigo 1.2s infinite ease-in-out;
        }
        .custom-animate-sparkle {
          animation: custom-sparkle 1.8s infinite ease-in-out;
        }
        .card-hover-effect {
          transition: transform 0.28s cubic-bezier(0.175, 0.885, 0.32, 1.1), 
                      box-shadow 0.28s ease, 
                      border-color 0.2s ease;
        }
        .card-hover-effect:hover {
          transform: translateY(-4px) scale(1.015);
          box-shadow: 0 10px 20px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.02);
          border-color: #818CF8 !important; /* Vibrant Indigo border on hover */
        }
      `}</style>
      
      {/* ULTRA-MINIMALIST FIXED HEADER */}
      <header className="px-6 py-3 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-[#111] rounded-sm transition-transform duration-500 hover:rotate-180" />
          <span className="text-sm font-bold tracking-tight">BijakAtur</span>
        </div>

        {/* Quiet task status indicator */}
        <div className="text-xs text-slate-400 font-mono tabular-nums">
          {doneTasksCount} / {totalTasksCount} tugasan selesai
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              if (confirmReset) {
                setTasks(DEFAULT_TASKS);
                setColumns(DEFAULT_COLUMNS);
                localStorage.clear();
                setConfirmReset(false);
              } else {
                setConfirmReset(true);
              }
            }}
            className={`text-xs flex items-center gap-1 transition-all duration-300 ${
              confirmReset ? 'text-rose-600 font-bold scale-105 animate-pulse' : 'text-slate-400 hover:text-slate-900'
            }`}
            title={confirmReset ? "Klik sekali lagi untuk mengesahkan set semula" : "Set semula ke data asal"}
          >
            <RotateCcw className={`w-3.5 h-3.5 ${confirmReset ? 'rotate-45 text-rose-500' : ''} transition-transform duration-300`} />
            <span>{confirmReset ? "Sahkan Set Asal?" : "Set Asal"}</span>
          </button>
        </div>
      </header>

      {/* COMPACT KANBAN CANVAS */}
      <main className="flex-1 w-full px-6 py-6 flex flex-col min-h-0 overflow-hidden">
        <div className="flex flex-col md:flex-row gap-5 items-stretch h-full w-full min-h-0 overflow-y-auto md:overflow-y-hidden">
          
          {columns.map((column) => {
            const columnTasks = tasks.filter(t => t.columnId === column.id);
            const isTargetedDrop = draggedOverColumnId === column.id;

            return (
              <div
                key={column.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (draggedOverColumnId !== column.id) setDraggedOverColumnId(column.id);
                }}
                onDragLeave={() => setDraggedOverColumnId(null)}
                onDrop={(e) => handleDrop(e, column.id)}
                className={`w-full md:flex-1 min-w-0 flex flex-col rounded-xl p-3 border border-transparent transition-all duration-300 h-[380px] md:h-full ${
                  isTargetedDrop ? 'custom-animate-pulse-drop border-indigo-300' : 'bg-transparent'
                }`}
              >
                
                {/* Column Name & Count */}
                <div className="flex items-center justify-between mb-3 px-1 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold tracking-tight text-slate-800">{column.title}</span>
                    <span className="text-[10px] font-mono tabular-nums text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 transition-colors duration-300">
                      {columnTasks.length}
                    </span>
                  </div>
                  
                  {/* Delete custom column */}
                  {!['todo', 'progress', 'done'].includes(column.id) && (
                    <div className="flex items-center gap-1 text-[11px]">
                      {confirmColDeleteId === column.id ? (
                        <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                          <button
                            onClick={() => {
                              setTasks(prev => prev.filter(t => t.columnId !== column.id));
                              setColumns(prev => prev.filter(c => c.id !== column.id));
                              setConfirmColDeleteId(null);
                            }}
                            className="text-rose-600 font-bold hover:underline"
                          >
                            Ya
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            onClick={() => setConfirmColDeleteId(null)}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            Tidak
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmColDeleteId(column.id)}
                          className="text-slate-300 hover:text-rose-600 transition-colors p-0.5 rounded-md hover:bg-slate-100"
                          title="Padam lajur"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Instant Entry Input Field */}
                <div className="mb-3 shrink-0">
                  <input
                    type="text"
                    placeholder="Tambah tugasan + Tekan Enter..."
                    value={quickAddInput[column.id] || ''}
                    onChange={(e) => setQuickAddInput(prev => ({ ...prev, [column.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleQuickAdd(column.id);
                    }}
                    className="w-full bg-white border border-slate-100 hover:border-slate-300 focus:border-slate-300 focus:bg-white text-xs px-3 py-2 rounded-lg shadow-2xs outline-none transition-all duration-300"
                  />
                </div>

                {/* Cards Container */}
                <div className="space-y-2.5 flex-1 overflow-y-auto min-h-0 pr-0.5 pb-2">
                  {columnTasks.length === 0 ? (
                    <div className="py-6 text-center border border-dashed border-slate-200 rounded-lg animate-in fade-in duration-300">
                      <p className="text-[10px] text-slate-400">Tiada tugasan</p>
                    </div>
                  ) : (
                    columnTasks.map((task) => {
                      const completedCount = task.subtasks.filter(s => s.completed).length;
                      const totalSub = task.subtasks.length;

                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          onDragEnd={() => {
                            setDraggedTaskId(null);
                            setDraggedOverColumnId(null);
                          }}
                          onClick={() => {
                            setActiveTask(task);
                          }}
                          className={`bg-white border border-slate-200/60 p-3.5 cursor-grab active:cursor-grabbing rounded-xl card-hover-effect ${
                            draggedTaskId === task.id ? 'opacity-20 border-dashed border-indigo-400 scale-95' : 'shadow-2xs'
                          }`}
                        >
                          {/* Title */}
                          <h4 className="text-xs font-semibold text-slate-800 leading-snug">
                            {task.title}
                          </h4>

                          {/* Description teaser */}
                          {task.description && (
                            <p className="text-[11px] text-slate-400 line-clamp-1 mt-1 leading-relaxed">
                              {task.description}
                            </p>
                          )}

                          {/* Simple, unboxed metadata footer with separator dot */}
                          <div className="flex items-center justify-between text-[10px] mt-3 pt-2 border-t border-slate-100 text-slate-400">
                            <div className="flex items-center gap-1.5">
                              {task.category ? (
                                <span className="text-indigo-600 font-semibold">{task.category}</span>
                              ) : (
                                <span className="text-slate-300 italic">Am</span>
                              )}
                            </div>

                            {/* Checklist count without pills */}
                            {totalSub > 0 && (
                              <span className="font-mono text-[9px] text-slate-500">
                                {completedCount}/{totalSub} langkah
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

              </div>
            );
          })}

          {/* MINIMALIST ADD COLUMN TRIGGER */}
          {isAddingColumn ? (
            <div className="w-full md:w-72 md:shrink-0 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3 self-start animate-in fade-in duration-150">
              <input
                type="text"
                placeholder="Nama lajur..."
                value={newColTitle}
                onChange={(e) => setNewColTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (newColTitle.trim()) {
                      setColumns(prev => [...prev, { id: `col-${Date.now()}`, title: newColTitle.trim(), color: 'slate' }]);
                      setNewColTitle('');
                      setIsAddingColumn(false);
                    }
                  }
                }}
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs outline-none"
                autoFocus
              />
              <div className="flex justify-end gap-1.5">
                <button onClick={() => setIsAddingColumn(false)} className="px-2 py-1 text-[10px] text-slate-400 hover:text-slate-650">Batal</button>
                <button 
                  onClick={() => {
                    if (newColTitle.trim()) {
                      setColumns(prev => [...prev, { id: `col-${Date.now()}`, title: newColTitle.trim(), color: 'slate' }]);
                      setNewColTitle('');
                      setIsAddingColumn(false);
                    }
                  }} 
                  className="px-2.5 py-1 bg-slate-900 text-white rounded text-[10px] font-medium hover:bg-slate-800 transition-colors"
                >
                  Tambah
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsAddingColumn(true)}
              className="w-full md:w-72 md:shrink-0 py-4 border border-dashed border-slate-200 hover:border-slate-350 hover:bg-white rounded-xl text-slate-400 hover:text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-300 self-start shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Lajur Kustom</span>
            </button>
          )}

        </div>
      </main>

      {/* MINIMALIST CENTER POPUP MODAL (Clean, elegant, non-blocking) */}
      {activeTask && (
        <div className="fixed inset-0 z-50 p-4 flex items-center justify-center custom-animate-backdrop">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl flex flex-col p-6 max-h-[85vh] custom-animate-modal">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Butiran Tugasan</span>
                <span className="text-[9px] bg-indigo-50 text-indigo-600 rounded px-2 py-0.5 font-bold">
                  Sunting Terus ✍️
                </span>
              </div>
              <button 
                onClick={() => setActiveTask(null)} 
                className="text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg p-1.5 transition-all duration-200"
                title="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4.5 min-h-0 pr-1">
              
              {/* Tajuk Input */}
              <div>
                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Tajuk Tugasan</label>
                <input
                  type="text"
                  value={activeTask.title}
                  onChange={(e) => {
                    const val = e.target.value;
                    setActiveTask(prev => prev ? { ...prev, title: val } : null);
                    setTasks(prev => prev.map(t => t.id === activeTask.id ? { ...t, title: val } : t));
                  }}
                  placeholder="Masukkan tajuk..."
                  className="w-full text-sm font-semibold text-slate-800 leading-snug outline-none border border-slate-100 focus:border-slate-350 focus:bg-white rounded-lg px-2.5 py-1.5 bg-slate-50/20 transition-all font-sans focus:ring-1 focus:ring-indigo-500/15"
                />
              </div>

              {/* Huraian Area */}
              <div>
                <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Huraian</label>
                <textarea
                  value={activeTask.description}
                  onChange={(e) => {
                    const val = e.target.value;
                    setActiveTask(prev => prev ? { ...prev, description: val } : null);
                    setTasks(prev => prev.map(t => t.id === activeTask.id ? { ...t, description: val } : t));
                  }}
                  placeholder="Tiada huraian. Klik di sini untuk menambah huraian tugasan..."
                  rows={2.5}
                  className="w-full text-xs text-slate-500 leading-relaxed outline-none border border-slate-100 focus:border-slate-350 focus:bg-white rounded-lg p-2.5 resize-none bg-slate-50/20 transition-all font-sans focus:ring-1 focus:ring-indigo-500/15"
                />
              </div>

              {/* Grid of Attributes */}
              <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
                
                {/* Category Selection */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Kategori / Tag</span>
                  <input
                    type="text"
                    value={activeTask.category || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setActiveTask(prev => prev ? { ...prev, category: val || undefined } : null);
                      setTasks(prev => prev.map(t => t.id === activeTask.id ? { ...t, category: val || undefined } : t));
                    }}
                    placeholder="Contoh: Kerja, Kesihatan..."
                    className="bg-white border border-slate-200 rounded-md px-2.5 py-1 text-xs outline-none text-slate-700 placeholder:text-slate-300 focus:border-slate-300 w-full font-medium transition-colors"
                  />
                </div>

                {/* Due Date Selection */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Tarikh Akhir</span>
                  <input
                    type="date"
                    value={activeTask.dueDate || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setActiveTask(prev => prev ? { ...prev, dueDate: val || undefined } : null);
                      setTasks(prev => prev.map(t => t.id === activeTask.id ? { ...t, dueDate: val || undefined } : t));
                    }}
                    className="bg-white border border-slate-200 rounded-md px-1.5 py-1 text-xs outline-none cursor-pointer text-slate-700 font-mono w-full hover:border-slate-300"
                  />
                </div>
              </div>

              {/* Checklist Section */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Senarai Tugasan Kecil</span>
                  <button
                    onClick={() => pecahTugasanDenganAI(activeTask)}
                    disabled={aiBreakdownLoading}
                    className="text-[10px] text-indigo-600 font-semibold hover:text-indigo-800 flex items-center gap-1 disabled:opacity-50 transition-colors"
                  >
                    <Sparkles className="w-3 h-3 text-amber-500 custom-animate-sparkle" />
                    {aiBreakdownLoading ? 'Menjana...' : 'Cadangan AI ⚡'}
                  </button>
                </div>

                {/* Inline checklist input */}
                <input
                  type="text"
                  placeholder="Tambah subtugasan baru + Tekan Enter..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                      const val = e.currentTarget.value.trim();
                      const newSub: SubTask = { id: `sub-${Date.now()}`, title: val, completed: false };
                      const updated = { ...activeTask, subtasks: [...activeTask.subtasks, newSub] };
                      setActiveTask(updated);
                      setTasks(prev => prev.map(t => t.id === activeTask.id ? updated : t));
                      e.currentTarget.value = '';
                    }
                  }}
                  className="w-full px-2.5 py-1.5 border border-slate-150 rounded-lg text-xs outline-none mb-2.5 focus:border-slate-350 bg-slate-50/20 focus:bg-white transition-all focus:ring-1 focus:ring-indigo-500/15"
                />

                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {activeTask.subtasks.map(st => (
                    <div key={st.id} className="flex items-center justify-between gap-2 p-1.5 hover:bg-slate-50/80 border border-slate-100 rounded-lg transition-colors">
                      <label className="flex items-center gap-2 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={st.completed}
                          onChange={() => {
                            const updatedSubtasks = activeTask.subtasks.map(s => s.id === st.id ? { ...s, completed: !s.completed } : s);
                            const updated = { ...activeTask, subtasks: updatedSubtasks };
                            setActiveTask(updated);
                            setTasks(prev => prev.map(t => t.id === activeTask.id ? updated : t));
                          }}
                          className="w-3.5 h-3.5 text-indigo-600 border-slate-300 rounded focus:ring-0 cursor-pointer"
                        />
                        <span className={`text-xs text-slate-600 select-none ${st.completed ? 'line-through text-slate-400' : ''} transition-all duration-300`}>
                          {st.title}
                        </span>
                      </label>
                      <button
                        onClick={() => {
                          const updated = { ...activeTask, subtasks: activeTask.subtasks.filter(s => s.id !== st.id) };
                          setActiveTask(updated);
                          setTasks(prev => prev.map(t => t.id === activeTask.id ? updated : t));
                        }}
                        className="text-slate-300 hover:text-rose-600 text-xs p-0.5 rounded-md hover:bg-slate-100 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between shrink-0">
              
              {/* Deletion verification inline */}
              <div className="flex-1 mr-4">
                {isConfirmingTaskDelete ? (
                  <div className="p-2 bg-rose-50 border border-rose-100 rounded-lg flex items-center justify-between gap-2 animate-in fade-in duration-100">
                    <span className="text-[10px] font-semibold text-rose-800">Sahkan padam?</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setTasks(prev => prev.filter(t => t.id !== activeTask.id));
                          setActiveTask(null);
                          setIsConfirmingTaskDelete(false);
                        }}
                        className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded hover:scale-105 active:scale-95 transition-all"
                      >
                        Ya
                      </button>
                      <button
                        onClick={() => setIsConfirmingTaskDelete(false)}
                        className="px-2 py-0.5 bg-white border border-slate-200 text-slate-600 text-[10px] font-medium rounded hover:bg-slate-50 transition-all"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsConfirmingTaskDelete(true)}
                    className="text-xs text-rose-500 hover:text-rose-700 font-semibold hover:bg-rose-50 px-2.5 py-1.5 rounded-lg border border-transparent hover:border-rose-100 transition-all duration-300"
                  >
                    Padam Tugasan
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={activeTask.columnId}
                  onChange={(e) => moveTaskColumn(activeTask.id, e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2 text-xs text-slate-700 cursor-pointer outline-none hover:border-slate-300 hover:bg-white transition-all"
                >
                  {columns.map(col => (
                    <option key={col.id} value={col.id}>{col.title}</option>
                  ))}
                </select>

                <button
                  onClick={() => setActiveTask(null)}
                  className="px-4 py-1.5 bg-slate-900 text-white hover:bg-slate-800 text-xs font-semibold rounded-lg shadow-sm hover:scale-[1.02] active:scale-98 transition-all duration-200"
                >
                  Tutup & Simpan
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* MINIMALIST FIXED FOOTER */}
      <footer className="bg-white border-t border-slate-100 py-3 text-center text-[10px] text-slate-400 shrink-0">
        <div className="max-w-7xl w-full mx-auto px-6 flex items-center justify-between">
          <span>© 2026 BijakAtur. Produktiviti harian dipermudahkan.</span>
          <span>Kuala Lumpur, Malaysia · Gemini 3.8</span>
        </div>
      </footer>

    </div>
  );
}
