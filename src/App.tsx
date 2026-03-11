/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  Search, 
  ChevronDown, 
  Image as ImageIcon, 
  ExternalLink, 
  Loader2,
  Sparkles,
  LayoutGrid,
  Settings,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI, Type } from "@google/genai";
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utils ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface VisualDirection {
  label: string;
  keyword: string;
  imageUrl?: string;
}

interface AnalysisResult {
  keywords: {
    artstation: string[];
    pinterest: string[];
  };
  visualDirections: VisualDirection[];
  groundingLinks?: { title: string; uri: string }[];
}

// --- Gemini Service ---
async function analyzeReference(
  role: string,
  description: string,
  platform: 'pinterest' | 'artstation',
  imageData?: string,
  customApiKey?: string
): Promise<AnalysisResult> {
  const finalApiKey = customApiKey || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '');
  if (!finalApiKey) {
    throw new Error("API Key is missing. Please set it in settings.");
  }
  const ai = new GoogleGenAI({ apiKey: finalApiKey });
  const model = "gemini-3-flash-preview";

  const prompt = `你是一个顶尖的视觉搜索专家和${role}。
请根据用户提供的参考图（或描述），从 6 个不同的视觉权重方向（如：构图布局、色彩氛围、材质细节、光影表现、设计逻辑、创意概念）进行深度分析。

你的任务是：
1. 为每个方向（n1-n6）提供一个最能在 ${platform === 'pinterest' ? 'Pinterest' : 'ArtStation'} 上触发高质量视觉反馈的英文搜索关键词。
2. 另外生成两组专门的搜索关键词列表：
   - "artstation_keywords": 6个最适合在 ArtStation 搜索的专业术语或风格词（英文）。
   - "pinterest_keywords": 6个最适合在 Pinterest 搜索的描述性词汇（英文）。

角色: ${role}
描述: ${description}
目标平台: ${platform}

请返回以下 JSON 格式的数据：
{
  "keywords": { 
    "artstation": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6"], 
    "pinterest": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6"] 
  },
  "visualDirections": [
    { "label": "权重方向1名称", "keyword": "英文搜索词" },
    { "label": "权重方向2名称", "keyword": "英文搜索词" },
    { "label": "权重方向3名称", "keyword": "英文搜索词" },
    { "label": "权重方向4名称", "keyword": "英文搜索词" },
    { "label": "权重方向5名称", "keyword": "英文搜索词" },
    { "label": "权重方向6名称", "keyword": "英文搜索词" }
  ]
}

注意：
1. 关键词必须是英文，且极其精准。
2. 分析权重必须紧扣 ${role} 的专业视角。
3. 响应速度至关重要，请尽快完成分析并返回结果。`;

  const contents: any[] = [{ text: prompt }];
  if (imageData) {
    contents.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: imageData.split(",")[1],
      },
    });
  }

  const response = await ai.models.generateContent({
    model,
    contents: { parts: contents },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          keywords: {
            type: Type.OBJECT,
            properties: {
              artstation: { type: Type.ARRAY, items: { type: Type.STRING } },
              pinterest: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["artstation", "pinterest"],
          },
          visualDirections: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                keyword: { type: Type.STRING },
              },
              required: ["label", "keyword"],
            },
          },
        },
        required: ["keywords", "visualDirections"],
      },
    },
  });

  const result = JSON.parse(response.text || "{}");
  
  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (groundingChunks) {
    result.groundingLinks = groundingChunks
      .filter((chunk: any) => chunk.web)
      .map((chunk: any) => ({
        title: chunk.web.title,
        uri: chunk.web.uri
      }));
  }

  return result;
}

// --- Main App ---
const ROLES = [
  "平面设计师 (Graphic Designer)",
  "产品包装设计师 (Packaging Designer)",
  "品牌设计师 (Brand Designer)",
  "摄影师(Photographer)",
  "游戏场景美术 (Environment Art)",
  "游戏角色设计 (Character Design)",
  "游戏UI美术 (UI Art)",
  "游戏概念美术 (Concept Art)"
];

const EXAMPLES = [
  "赛博朋克风格的城市街道，霓虹灯光与雨夜反射，高科技低生活感",
  "暗黑奇幻风格的BOSS角色，巨大的骨质铠甲与幽蓝魂火",
  "极简主义风格的科幻游戏UI，半透明磨砂质感与动态线条",
  "史诗感十足的遗迹场景，巨大的石像与藤蔓缠绕，丁达尔效应"
];

export default function App() {
  const [role, setRole] = useState(ROLES[0]);
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [platform, setPlatform] = useState<'pinterest' | 'artstation'>('pinterest');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(() => {
    try {
      return localStorage.getItem('gemini_api_key') || '';
    } catch (e) {
      console.warn('LocalStorage access failed:', e);
      return '';
    }
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const saveApiKey = (key: string) => {
    setApiKey(key);
    try {
      localStorage.setItem('gemini_api_key', key);
    } catch (e) {
      console.warn('Failed to save API Key to localStorage:', e);
    }
    setShowSettings(false);
    setToast('API Key 已保存');
    setTimeout(() => setToast(null), 3000);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('请上传图片文件');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleAnalyze = async () => {
    if (!apiKey) {
      setShowSettings(true);
      setToast('请先设置 Gemini API Key');
      setTimeout(() => setToast(null), 3000);
      return;
    }
    if (!description && !image) return;
    if (isAnalyzing) return;

    setIsAnalyzing(true);
    setResult(null); // Clear previous results

    try {
      const data = await analyzeReference(role, description, platform, image || undefined, apiKey);
      setResult(data);
      
      // Scroll to results
      setTimeout(() => {
        document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error) {
      console.error("Analysis failed:", error);
      alert("分析失败，请稍后重试。");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const openSearch = (platform: 'artstation' | 'pinterest' | 'google', query: string) => {
    const cleanQuery = query.split(' (')[0];
    
    // Copy to clipboard
    navigator.clipboard.writeText(cleanQuery).then(() => {
      setToast(`关键词已复制: ${cleanQuery}`);
      setTimeout(() => setToast(null), 3000);
    });

    let url = '';
    const encodedQuery = encodeURIComponent(cleanQuery);
    if (platform === 'artstation') {
      url = `https://www.artstation.com/search?q=${encodedQuery}&sort_by=relevance&show_all=true`;
    } else if (platform === 'pinterest') {
      url = `https://www.pinterest.com/search/pins/?q=${encodedQuery}`;
    } else if (platform === 'google') {
      url = `https://www.google.com/search?q=${encodedQuery}&tbm=isch`;
    }
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-white text-gray-800 pb-20 selection:bg-pink-100 selection:text-pink-600">
      {/* Header */}
      <header className="pt-16 pb-12 text-center px-4 relative">
        <button 
          onClick={() => setShowSettings(true)}
          className="absolute top-8 right-8 p-2 text-gray-400 hover:text-pink-500 transition-colors"
          title="设置 API Key"
        >
          <Settings className="w-6 h-6" />
        </button>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-2 mb-4"
        >
          <Sparkles className="text-pink-500 w-8 h-8" />
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900">
            PinsRef <span className="text-pink-500">AI</span>
          </h1>
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-gray-500 text-lg mb-2"
        >
          设计师与美术师的 AI 灵感辅助工具
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-gray-400 text-sm"
        >
          获取 Pinterest 和 ArtStation 的精准视觉参考
        </motion.p>
      </header>

      <main className="max-w-4xl mx-auto px-4 space-y-8">
        {/* Role Selector */}
        <div className="space-y-2">
          <label className="text-xs text-gray-400 uppercase tracking-wider font-bold">选择你的身份</label>
          <div className="relative">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 appearance-none focus:outline-none focus:border-pink-500 transition-colors cursor-pointer text-gray-700"
            >
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none w-5 h-5" />
          </div>
        </div>

        {/* Platform Toggle */}
        <div className="space-y-2">
          <label className="text-xs text-gray-400 uppercase tracking-wider font-bold">搜索目标平台</label>
          <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-200">
            <button
              onClick={() => setPlatform('pinterest')}
              className={cn(
                "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
                platform === 'pinterest' ? "bg-white text-red-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
              )}
            >
              Pinterest
            </button>
            <button
              onClick={() => setPlatform('artstation')}
              className={cn(
                "flex-1 py-2 text-sm font-bold rounded-lg transition-all",
                platform === 'artstation' ? "bg-white text-blue-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
              )}
            >
              ArtStation
            </button>
          </div>
        </div>

        {/* Input Area */}
        <div className="space-y-4">
          {/* Image Upload Box */}
          <div 
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "relative border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all group overflow-hidden min-h-[240px]",
              isDragging ? "border-pink-500 bg-pink-50" : "border-gray-200 bg-gray-50 hover:border-pink-300",
              image && "border-solid border-pink-200"
            )}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleImageUpload} 
            />
            {image ? (
              <div className="absolute inset-0 w-full h-full">
                <img src={image} alt="Reference" className="w-full h-full object-cover opacity-60" referrerPolicy="no-referrer" />
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/40 backdrop-blur-[2px]">
                  <ImageIcon className="w-12 h-12 text-pink-500 mb-2" />
                  <span className="text-sm font-bold text-gray-900">点击更换参考图片</span>
                </div>
              </div>
            ) : (
              <>
                <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
                  <ImageIcon className="w-10 h-10 text-gray-300 group-hover:text-pink-400 transition-colors" />
                </div>
                <p className="text-xl font-bold text-gray-700 mb-1">上传参考图片</p>
                <p className="text-sm text-gray-400">支持 JPG, PNG (或仅输入描述)</p>
              </>
            )}
          </div>

          {/* Textarea */}
          <div className="relative">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="描述您的设计构思 (如果没有参考图，请输入详细描述)..."
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-6 py-5 min-h-[140px] focus:outline-none focus:border-pink-500 transition-colors resize-none text-gray-700 placeholder:text-gray-300"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-4">
          <button 
            onClick={handleAnalyze}
            disabled={isAnalyzing || (!description && !image)}
            className={cn(
              "py-5 rounded-xl flex items-center justify-center gap-2 font-bold transition-all shadow-lg active:scale-95",
              isAnalyzing ? "bg-pink-400 text-white cursor-wait" : "bg-pink-500 text-white hover:bg-pink-600 pink-glow"
            )}
          >
            {isAnalyzing ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Search className="w-6 h-6" />
            )}
            搜索参考图 ({platform === 'pinterest' ? 'Pinterest' : 'ArtStation'})
          </button>
        </div>

        {/* Examples */}
        <div className="space-y-4 pt-4">
          <p className="text-center text-xs text-gray-400 font-bold uppercase tracking-widest">试试这些灵感:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {EXAMPLES.map((ex, i) => (
              <button
                key={i}
                onClick={() => setDescription(ex)}
                className="text-left bg-white border border-gray-100 rounded-xl p-4 text-sm text-gray-500 hover:border-pink-200 hover:text-pink-600 transition-all shadow-sm hover:shadow-md"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Results Section */}
        <AnimatePresence>
          {result && (
            <motion.div 
              id="results"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-16 pt-16 border-t border-gray-100"
            >
              {/* Visual Directions Waterfall */}
              {result.visualDirections && (
                <section className="space-y-8">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3 text-gray-900">
                      <div className="w-10 h-10 rounded-full bg-pink-50 flex items-center justify-center">
                        <LayoutGrid className="w-6 h-6 text-pink-500" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">视觉权重分析</h2>
                      </div>
                    </div>
                    {platform === 'artstation' && (
                      <span className="text-[10px] text-gray-400">点击跳转后 Ctrl+V 粘贴搜索</span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {result.visualDirections.map((dir, i) => {
                      const colors = [
                        'bg-[#FF3B30] text-white', // Red
                        'bg-[#007AFF] text-white', // Blue
                        'bg-[#FFCC00] text-black', // Yellow
                        'bg-[#34C759] text-white', // Green
                        'bg-[#5856D6] text-white', // Purple
                        'bg-[#FF9500] text-white', // Orange
                        'bg-[#1D3557] text-white', // Dark Blue
                        'bg-[#E63946] text-white', // Soft Red
                      ];
                      const colorClass = colors[i % colors.length];

                      return (
                        <motion.div
                          key={i}
                          whileHover={{ y: -5 }}
                          className={cn(
                            "group relative aspect-square rounded-2xl overflow-hidden cursor-pointer shadow-sm hover:shadow-2xl transition-all border border-black/5",
                            colorClass
                          )}
                          onClick={() => openSearch(platform, dir.keyword)}
                        >
                          {/* Swiss Style Layout */}
                          <div className="absolute inset-0 p-8 flex flex-col justify-between">
                            <div className="space-y-1">
                              <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">
                                {dir.label}
                              </p>
                              <div className="w-8 h-[2px] bg-current opacity-40" />
                            </div>
                            
                            <div className="relative">
                              <h3 className="text-4xl md:text-5xl font-black tracking-tighter leading-[0.85] uppercase break-words">
                                {dir.keyword}
                              </h3>
                            </div>
                          </div>

                          {/* Grid Decoration */}
                          <div className="absolute top-0 right-0 p-4 opacity-20">
                            <div className="text-[40px] font-black leading-none">0{i + 1}</div>
                          </div>
                          
                          {/* Overlay on Hover */}
                          <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-6 text-center z-20">
                            <p className="text-pink-400 text-xs font-bold uppercase tracking-widest mb-2">{dir.label}</p>
                            <p className="text-white font-bold text-lg mb-4 leading-tight">{dir.keyword}</p>
                            <div className="flex items-center gap-2 text-white/90 text-xs bg-white/20 px-4 py-2 rounded-full backdrop-blur-md border border-white/10">
                              <span>前往 {platform === 'pinterest' ? 'Pinterest' : 'ArtStation'} 搜索</span>
                              <ExternalLink className="w-3 h-3" />
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Search Keywords Section */}
              {result.keywords && (
                <section className="space-y-8">
                  <div className="flex items-center gap-3 text-gray-900">
                    <div className="w-10 h-10 rounded-full bg-pink-50 flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-pink-500" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">根据输入 生成搜索关键词</h2>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* ArtStation Column */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-white">A</span>
                          </div>
                          <h3 className="text-sm font-bold text-gray-600">ArtStation 关键词</h3>
                        </div>
                        <span className="text-[10px] text-gray-400">点击跳转后 Ctrl+V 粘贴搜索</span>
                      </div>
                      <div className="space-y-2">
                        {result.keywords.artstation.map((kw, i) => (
                          <div 
                            key={i} 
                            className="flex items-center gap-2 group cursor-pointer"
                            onClick={() => openSearch('artstation', kw)}
                          >
                            <div className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 group-hover:border-blue-200 group-hover:bg-blue-50/30 transition-all">
                              {kw}
                            </div>
                            <button
                              className="flex items-center gap-1.5 px-3 py-3 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all text-xs font-bold"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>ArtStation</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Pinterest & Google Column */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 px-2">
                        <div className="w-6 h-6 rounded bg-red-600 flex items-center justify-center">
                          <span className="text-[10px] font-bold text-white">P</span>
                        </div>
                        <h3 className="text-sm font-bold text-gray-600">Pinterest 关键词</h3>
                      </div>
                      <div className="space-y-2">
                        {result.keywords.pinterest.map((kw, i) => (
                          <div 
                            key={i} 
                            className="flex items-center gap-2 group cursor-pointer"
                            onClick={() => openSearch('pinterest', kw)}
                          >
                            <div className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 group-hover:border-red-200 group-hover:bg-red-50/30 transition-all">
                              {kw}
                            </div>
                            <div className="flex gap-1.5">
                              <button
                                className="flex items-center gap-1.5 px-3 py-3 rounded-xl bg-red-50 text-red-600 group-hover:bg-red-600 group-hover:text-white transition-all text-xs font-bold"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Pinterest</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="mt-20 text-center text-gray-400 text-xs py-10 border-t border-gray-50">
        <p className="mb-2">© 2026 PinsRef AI - 赋能设计与美术创意</p>
        <p className="mb-2">支持 Pinterest & ArtStation 实时搜索链接，精准提取设计灵感</p>
        <p className="text-gray-300">Created by @Loki_Braccori</p>
      </footer>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">设置 API Key</h2>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              
              <div className="space-y-4">
                <p className="text-sm text-gray-500 leading-relaxed">
                  为了在 GitHub Pages 上运行，您需要提供自己的 <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-pink-500 hover:underline">Gemini API Key</a>。该密钥将仅存储在您的浏览器本地。
                </p>
                
                <div className="space-y-2">
                  <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Gemini API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="粘贴您的 API Key..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-pink-500 text-gray-700"
                  />
                </div>
                
                <button
                  onClick={() => saveApiKey(apiKey)}
                  className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors shadow-lg"
                >
                  保存设置
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className="fixed bottom-10 left-1/2 z-50 bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-white/10 backdrop-blur-md"
          >
            <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
            <span className="text-sm font-medium">{toast}</span>
            <span className="text-[10px] text-gray-400 border-l border-white/20 pl-3">已复制到剪切板</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
