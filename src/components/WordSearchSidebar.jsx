'use client';
"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WordSearchSidebar = WordSearchSidebar;
var react_1 = require("react");
var tabs_1 = require("@/components/ui/tabs");
var input_1 = require("@/components/ui/input");
var label_1 = require("@/components/ui/label");
var textarea_1 = require("@/components/ui/textarea");
var button_1 = require("@/components/ui/button");
var select_1 = require("@/components/ui/select");
var checkbox_1 = require("@/components/ui/checkbox");
var slider_field_1 = require("@/components/ui/slider-field");
var lucide_react_1 = require("lucide-react");
var app_context_1 = require("@/lib/app-context");
var publishing_fonts_1 = require("@/lib/publishing-fonts");
var utils_1 = require("@/lib/utils");
var genpuzzle_extension_integration_1 = require("@/lib/genpuzzle-extension-integration");
var LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Arabic'];
var AGE_LEVELS = ['Children (6-8)', 'Children (9-12)', 'Teen', 'Adult', 'Senior'];
// Numeric inputs are provided as sliders for smoother UI control
// Helper for decimal number inputs (for trim size) - text input, no React control during typing
var DecimalInput = function (_a) {
    var value = _a.value, onChange = _a.onChange, placeholder = _a.placeholder, min = _a.min;
    var _b = react_1.default.useState(String(value !== null && value !== void 0 ? value : '')), localValue = _b[0], setLocalValue = _b[1];
    var inputRef = react_1.default.useRef(null);
    var isFocused = react_1.default.useRef(false);
    // Update local value when external value changes (only when not focused)
    react_1.default.useEffect(function () {
        if (!isFocused.current) {
            setLocalValue((value === null || value === void 0 ? void 0 : value.toString()) || '');
        }
    }, [value]);
    var handleFocus = function () {
        isFocused.current = true;
    };
    var handleChange = function (e) {
        // Let user type freely - only update local state
        setLocalValue(e.target.value);
    };
    var handleBlur = function (e) {
        isFocused.current = false;
        var val = e.target.value.trim();
        if (val === '') {
            setLocalValue(String(min !== null && min !== void 0 ? min : 0));
            onChange(min !== null && min !== void 0 ? min : 0);
            return;
        }
        var num = parseFloat(val);
        if (isNaN(num)) {
            num = min !== null && min !== void 0 ? min : 0;
        }
        if (min !== undefined && num < min)
            num = min;
        setLocalValue(String(num));
        onChange(num);
    };
    return (<input ref={inputRef} type="text" inputMode="decimal" value={localValue} onFocus={handleFocus} onChange={handleChange} onBlur={handleBlur} placeholder={placeholder} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"/>);
};
/** Integer input — defers min/max clamping until blur so values like "10" can be typed. */
var IntegerInput = function (_a) {
    var value = _a.value, onChange = _a.onChange, min = _a.min, max = _a.max, className = _a.className;
    var _b = react_1.default.useState(String(value !== null && value !== void 0 ? value : '')), localValue = _b[0], setLocalValue = _b[1];
    var isFocused = react_1.default.useRef(false);
    react_1.default.useEffect(function () {
        if (!isFocused.current) {
            setLocalValue(String(value !== null && value !== void 0 ? value : ''));
        }
    }, [value]);
    var commitValue = function (raw) {
        var trimmed = raw.trim();
        var fallback = min !== null && min !== void 0 ? min : 0;
        if (trimmed === '') {
            var next = fallback;
            setLocalValue(String(next));
            onChange(next);
            return;
        }
        var num = parseInt(trimmed, 10);
        if (Number.isNaN(num)) {
            num = fallback;
        }
        if (min !== undefined && num < min)
            num = min;
        if (max !== undefined && num > max)
            num = max;
        setLocalValue(String(num));
        onChange(num);
    };
    return (<input_1.Input type="text" inputMode="numeric" value={localValue} className={className} onFocus={function () {
            isFocused.current = true;
        }} onChange={function (e) {
            var next = e.target.value;
            if (next === '' || /^\d+$/.test(next)) {
                setLocalValue(next);
            }
        }} onBlur={function (e) {
            isFocused.current = false;
            commitValue(e.target.value);
        }} onKeyDown={function (e) {
            if (e.key === 'Enter') {
                isFocused.current = false;
                commitValue(e.target.value);
                e.target.blur();
            }
        }}/>);
};
function ColorInput(_a) {
    var label = _a.label, value = _a.value, onChange = _a.onChange, _b = _a.disabled, disabled = _b === void 0 ? false : _b;
    return (<div className={(0, utils_1.cn)('flex items-center gap-3 p-3 rounded-lg dark:from-slate-700 dark:to-slate-600 dark:border-slate-600 transition-all duration-200 border', disabled && 'opacity-50 pointer-events-none')} style={{ background: "linear-gradient(to right, #F0F5F6, #F0F5F6)" }}>
      <div className="flex-1">
        <label_1.Label className={(0, utils_1.cn)('text-sm font-medium', disabled ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200')}>{label}</label_1.Label>
        <div className="flex items-center gap-2 mt-1">
          <input_1.Input type="color" value={value} onChange={function (e) { return onChange(e.target.value); }} className="w-14 h-10 p-1 cursor-pointer border-2 border-blue-300 dark:border-slate-500 rounded-lg hover:shadow-lg transition-shadow duration-200" disabled={disabled}/>
          <input_1.Input value={value} onChange={function (e) { return onChange(e.target.value); }} className="flex-1 font-mono text-sm border-gray-300 dark:border-slate-600 focus:border-blue-400 focus:ring-blue-400/20 hover:border-blue-300 transition-colors duration-200" placeholder="#000000" disabled={disabled}/>
        </div>
      </div>
    </div>);
}
function BackgroundImageControl(_a) {
    var label = _a.label, image = _a.image, opacity = _a.opacity, fit = _a.fit, onImageChange = _a.onImageChange, onOpacityChange = _a.onOpacityChange, onFitChange = _a.onFitChange, onRemove = _a.onRemove;
    var fileInputRef = react_1.default.useRef(null);
    var handleFileChange = function (e) {
        var _a;
        var file = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
        if (!file)
            return;
        var reader = new FileReader();
        reader.onloadend = function () {
            if (typeof reader.result === 'string') {
                onImageChange(reader.result);
            }
        };
        reader.readAsDataURL(file);
    };
    return (<div className="p-3 bg-white dark:bg-slate-700/50 rounded-lg border border-gray-200 dark:border-slate-700 space-y-3">
      <div className="flex items-center justify-between">
        <label_1.Label className="text-xs font-semibold text-gray-700 dark:text-gray-200">{label} Image</label_1.Label>
        {image && (<button_1.Button type="button" variant="ghost" size="sm" onClick={onRemove} className="h-8 px-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
            <lucide_react_1.Trash2 className="w-3.5 h-3.5 mr-1"/>
            Remove
          </button_1.Button>)}
      </div>

      {!image ? (<div>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg, image/jpg" className="hidden"/>
          <button_1.Button type="button" variant="outline" onClick={function () { var _a; return (_a = fileInputRef.current) === null || _a === void 0 ? void 0 : _a.click(); }} className="w-full h-16 border-dashed border-2 border-gray-300 dark:border-slate-600 hover:border-blue-400 hover:bg-blue-50/10 transition-all flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-blue-500">
            <lucide_react_1.Upload className="w-5 h-5"/>
            <span className="text-xs font-medium">Upload Background Image</span>
          </button_1.Button>
        </div>) : (<div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded border border-gray-200 dark:border-slate-600 bg-gray-100 dark:bg-slate-800 bg-center bg-no-repeat bg-contain" style={{ backgroundImage: "url(".concat(image, ")") }}/>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-500 truncate">Background Image Active</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
                  {fit ? fit.charAt(0).toUpperCase() + fit.slice(1) : 'Cover'}
                </span>
                <span className="text-[10px] bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
                  {opacity !== null && opacity !== void 0 ? opacity : 100}% Opacity
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label_1.Label className="text-[11px] text-gray-500">Image Fit</label_1.Label>
              <select_1.Select value={fit || 'cover'} onValueChange={function (val) { return onFitChange(val); }}>
                <select_1.SelectTrigger className="h-8 text-xs"><select_1.SelectValue /></select_1.SelectTrigger>
                <select_1.SelectContent>
                  <select_1.SelectItem value="cover" className="text-xs">Cover</select_1.SelectItem>
                  <select_1.SelectItem value="contain" className="text-xs">Contain</select_1.SelectItem>
                  <select_1.SelectItem value="stretch" className="text-xs">Stretch</select_1.SelectItem>
                </select_1.SelectContent>
              </select_1.Select>
            </div>

            <div className="space-y-1">
              <slider_field_1.SliderField label="Opacity" value={opacity !== null && opacity !== void 0 ? opacity : 100} onValueChange={onOpacityChange} min={0} max={100} step={1} format="percent"/>
            </div>
          </div>
        </div>)}
    </div>);
}
// Icon components (modern, animated, two-tone)
function Book(_a) {
    var className = _a.className;
    return (<svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path className="icon-base" d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path className="icon-base" d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <g className="icon-accent">
        <rect x="5" y="6" width="6" height="2" rx="0.8" fill="#0EA5E9" opacity="0.95"/>
      </g>
    </svg>);
}
function Grid3X3(_a) {
    var className = _a.className;
    return (<svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.6" rx="1"/>
      <rect x="14" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.6" rx="1"/>
      <rect x="14" y="14" width="7" height="7" stroke="currentColor" strokeWidth="1.6" rx="1"/>
      <rect x="3" y="14" width="7" height="7" stroke="currentColor" strokeWidth="1.6" rx="1"/>
      <circle className="icon-accent" cx="12" cy="12" r="2" fill="#0EA5E9" opacity="0.95"/>
    </svg>);
}
function Type(_a) {
    var className = _a.className;
    return (<svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 7V4H20V7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 20H15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 4V20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <g className="icon-accent">
        <circle cx="12" cy="6" r="1.4" fill="#0EA5E9" opacity="0.95"/>
      </g>
    </svg>);
}
function List(_a) {
    var className = _a.className;
    return (<svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 6H21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M8 12H21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M8 18H21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <g className="icon-accent">
        <circle cx="3" cy="6" r="1.6" fill="#0EA5E9"/>
        <circle cx="3" cy="12" r="1.6" fill="#0EA5E9"/>
        <circle cx="3" cy="18" r="1.6" fill="#0EA5E9"/>
      </g>
    </svg>);
}
function Palette(_a) {
    var className = _a.className;
    return (<svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <g className="icon-accent">
        <circle cx="8.5" cy="7.5" r="1.2" fill="#0EA5E9"/>
        <circle cx="13.5" cy="6.5" r="1.2" fill="#0EA5E9"/>
        <circle cx="17.5" cy="10.5" r="1.2" fill="#0EA5E9"/>
      </g>
    </svg>);
}
function Sparkles(_a) {
    var className = _a.className;
    return (<svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <g className="icon-accent">
        <path d="M6 4 L7.2 6.8 L10 8 L7.2 9.2 L6 12 L4.8 9.2 L2 8 L4.8 6.8 Z" fill="#0EA5E9" opacity="0.95"/>
      </g>
    </svg>);
}
/** Bulletproof Word List Textarea: Handles Space and Enter keys even with global event listeners */
function WordListTextarea(_a) {
    var value = _a.value, onChange = _a.onChange;
    var textareaRef = react_1.default.useRef(null);
    var _b = react_1.default.useState(value), displayValue = _b[0], setDisplayValue = _b[1];
    react_1.default.useEffect(function () {
        setDisplayValue(value);
        if (textareaRef.current && document.activeElement !== textareaRef.current) {
            // Only update textarea value if it's not currently being edited
            textareaRef.current.value = value;
        }
    }, [value]);
    var handleKeyDown = function (e) {
        var _a, _b;
        if (e.key === 'Enter' || e.key === ' ') {
            // CRITICAL: stop propagation to prevent global event listeners from interfering
            e.stopPropagation();
            // NOTE: Do NOT call preventDefault() - we want the browser to insert the character
            var textarea = textareaRef.current;
            if (!textarea)
                return;
            // Also prevent the event from bubbling to parent containers
            (_b = (_a = e.nativeEvent).stopImmediatePropagation) === null || _b === void 0 ? void 0 : _b.call(_a);
        }
    };
    var handleChange = function (e) {
        var newValue = e.target.value;
        setDisplayValue(newValue);
        onChange(newValue);
    };
    return (<div className="space-y-2">
      <label_1.Label className="text-sm font-medium">Your Words</label_1.Label>
      <textarea_1.Textarea ref={textareaRef} value={displayValue} onChange={handleChange} onKeyDown={handleKeyDown} placeholder="Enter one word per line..." className="h-28"/>
    </div>);
}
function WordSearchSidebar() {
    var _this = this;
    var _a, _b, _c, _d, _e;
    var _f = (0, app_context_1.useApp)(), wordSearchSettings = _f.wordSearchSettings, updateWordSearchSettings = _f.updateWordSearchSettings, titleWords = _f.titleWords, setTitleWords = _f.setTitleWords, generatePuzzle = _f.generatePuzzle, savePuzzle = _f.savePuzzle, validationError = _f.validationError, puzzleGridScale = _f.puzzleGridScale, setPuzzleGridScale = _f.setPuzzleGridScale, titleToAnswerGap = _f.titleToAnswerGap, setTitleToAnswerGap = _f.setTitleToAnswerGap, solutionToSolutionGap = _f.solutionToSolutionGap, setSolutionToSolutionGap = _f.setSolutionToSolutionGap, pageMargin = _f.pageMargin, setPageMargin = _f.setPageMargin, bookSettings = _f.bookSettings, documentPages = _f.documentPages, activeDocumentPageId = _f.activeDocumentPageId, setActiveDocumentPageId = _f.setActiveDocumentPageId, addDocumentPage = _f.addDocumentPage, removeDocumentPage = _f.removeDocumentPage, moveDocumentPage = _f.moveDocumentPage, activeDocumentPage = _f.activeDocumentPage;
    // Local state for AI word generation loading
    var _g = react_1.default.useState(false), isGeneratingWordsFromExtension = _g[0], setIsGeneratingWordsFromExtension = _g[1];
    var _h = react_1.default.useState('word-search'), newModuleType = _h[0], setNewModuleType = _h[1];
    // Collapsed/expanded sidebar state
    var _j = react_1.default.useState(false), collapsed = _j[0], setCollapsed = _j[1];
    // Track currently active tab so clicking the same tab can toggle collapse
    var _k = react_1.default.useState('book'), activeTab = _k[0], setActiveTab = _k[1];
    var moduleIsWordSearch = (activeDocumentPage === null || activeDocumentPage === void 0 ? void 0 : activeDocumentPage.moduleType) === 'word-search';
    // Chrome Extension Integration for AI Word Generation
    var _l = (0, genpuzzle_extension_integration_1.useWordGeneration)(), generateWordsFromExtension = _l.generateWords, isGeneratingWords = _l.isLoading, generatedWordsData = _l.data, generationError = _l.error;
    var handleTabChange = function (value) {
        // When switching tabs, set active tab and ensure sidebar is expanded
        setActiveTab(value);
        setCollapsed(false);
    };
    var handleTriggerClick = function (value) {
        // If user clicks the already-active tab, toggle collapse/expand
        if (activeTab === value) {
            setCollapsed(function (prev) { return !prev; });
        }
        // Otherwise do nothing here; onValueChange will fire and open the panel
    };
    var handleTriggerPointerDown = function (e, value) {
        // pointerdown fires before Radix's onValueChange; use it to detect clicks on the
        // currently-active tab and toggle collapse without letting Radix re-select.
        if (activeTab === value) {
            e.preventDefault();
            setCollapsed(function (prev) { return !prev; });
        }
    };
    // Handle generated words - update the word list when words are received from extension
    react_1.default.useEffect(function () {
        if (generatedWordsData && generatedWordsData.words) {
            // Extract all words from the structured response
            var allWords_1 = [];
            generatedWordsData.words.forEach(function (item) {
                if (item.words && Array.isArray(item.words)) {
                    allWords_1.push.apply(allWords_1, item.words);
                }
            });
            if (allWords_1.length > 0) {
                console.log('[WordSearchSidebar] Updated word list with', allWords_1.length, 'words');
                setTitleWords(__assign(__assign({}, titleWords), { words: allWords_1 }));
            }
        }
    }, [generatedWordsData, titleWords, setTitleWords]);
    var bookCanvas = wordSearchSettings.bookCanvas, core = wordSearchSettings.core, typography = wordSearchSettings.typography, wordList = wordSearchSettings.wordList, colors = wordSearchSettings.colors;
    var updateBookCanvas = react_1.default.useCallback(function (updates) {
        updateWordSearchSettings({ bookCanvas: __assign(__assign({}, bookCanvas), updates) });
    }, [bookCanvas, updateWordSearchSettings]);
    var updateCore = react_1.default.useCallback(function (updates) {
        updateWordSearchSettings({ core: __assign(__assign({}, core), updates) });
    }, [core, updateWordSearchSettings]);
    var updateTypography = react_1.default.useCallback(function (updates) {
        updateWordSearchSettings({ typography: __assign(__assign({}, typography), updates) });
    }, [typography, updateWordSearchSettings]);
    var updateWordListSettings = react_1.default.useCallback(function (updates) {
        updateWordSearchSettings({ wordList: __assign(__assign({}, wordList), updates) });
    }, [wordList, updateWordSearchSettings]);
    var customTitleLines = react_1.default.useMemo(function () {
        if (typography.selectTitleOption !== 'custom')
            return 0;
        return typography.titleText
            .split('\n')
            .map(function (line) { return line.trim(); })
            .filter(function (line) { return line.length > 0; }).length;
    }, [typography.selectTitleOption, typography.titleText]);
    var missingCustomTitles = Math.max(0, (core.numberOfPuzzles || 0) - customTitleLines);
    var gridMaxWordLength = Math.max(core.lettersAcross || 0, core.lettersDown || 0, 3);
    react_1.default.useEffect(function () {
        if (wordList.aiMaxWordLength > gridMaxWordLength) {
            updateWordListSettings({ aiMaxWordLength: gridMaxWordLength });
        }
    }, [core.lettersAcross, core.lettersDown, gridMaxWordLength, updateWordListSettings, wordList.aiMaxWordLength]);
    var updateColors = react_1.default.useCallback(function (updates) {
        updateWordSearchSettings({ colors: __assign(__assign({}, colors), updates) });
    }, [colors, updateWordSearchSettings]);
    var defaultsInitialized = react_1.default.useRef(false);
    react_1.default.useEffect(function () {
        if (defaultsInitialized.current)
            return;
        var trimDefaults = bookCanvas.trimSizePreset === '8_5X11IN' && bookCanvas.useCustomTrim === false;
        var titleDefaults = typography.selectTitleOption === 'custom';
        var numberingDefaults = typography.puzzleNumberingStyle === 'prefix';
        if (!trimDefaults) {
            updateBookCanvas({ trimSizePreset: '8_5X11IN', customWidth: 8.5, customHeight: 11, useCustomTrim: false });
        }
        if (!titleDefaults) {
            updateTypography({ selectTitleOption: 'custom' });
        }
        if (!numberingDefaults) {
            updateTypography({ puzzleNumberingStyle: 'prefix' });
        }
        defaultsInitialized.current = true;
    }, [bookCanvas.trimSizePreset, bookCanvas.useCustomTrim, typography.selectTitleOption, typography.puzzleNumberingStyle, updateBookCanvas, updateTypography]);
    // If the AI-generated theme changes, update the titleText only when the
    // current mode is already `custom`. This preserves explicit user choices
    // for `one-custom-title` and `none`.
    react_1.default.useEffect(function () {
        if (!wordList.aiTheme)
            return;
        if (typography.selectTitleOption === 'custom' && typography.titleText !== wordList.aiTheme) {
            updateTypography({ titleText: wordList.aiTheme });
        }
    }, [wordList.aiTheme, typography.selectTitleOption, typography.titleText, updateTypography]);
    var updatePuzzlePageColors = function (updates) {
        updateColors({
            puzzlePage: __assign(__assign({}, colors.puzzlePage), updates),
        });
    };
    var updateAnswerPageColors = function (updates) {
        updateColors({
            answerPage: __assign(__assign({}, colors.answerPage), updates),
        });
    };
    // Handle PASTE_DATA from extension - switch mode and inject formatted text
    react_1.default.useEffect(function () {
        var unsubscribe = (0, genpuzzle_extension_integration_1.onPasteData)(function (formattedText) {
            console.log('[WordSearchSidebar] Received PASTE_DATA with', formattedText.split('\n').length, 'lines');
            // Step 1: Switch to manual mode
            console.log('[WordSearchSidebar] Switching to manual word entry mode');
            updateWordListSettings({ selectWordListOption: 'manual' });
            // Step 2: Convert vertical format back to word array
            var words = formattedText
                .split('\n')
                .map(function (w) { return w.trim(); })
                .filter(function (w) { return w.length > 0; });
            if (words.length > 0) {
                console.log('[WordSearchSidebar] Injecting', words.length, 'words into word list');
                // Step 3: Update titleWords with the pasted words
                setTitleWords(__assign(__assign({}, titleWords), { words: words }));
            }
        });
        return unsubscribe;
    }, [titleWords, setTitleWords, updateWordListSettings]);
    // Handle PASTE_FUN_FACTS from extension - inject fun facts into typography
    react_1.default.useEffect(function () {
        var unsubscribe = (0, genpuzzle_extension_integration_1.onPasteFunFacts)(function (funFactsText) {
            console.log('[WordSearchSidebar] Received PASTE_FUN_FACTS with', funFactsText.split('\n').length, 'facts');
            if (funFactsText && funFactsText.length > 0) {
                console.log('[WordSearchSidebar] Injecting fun facts into funFactsText');
                // Update typography with the pasted fun facts
                updateTypography({
                    funFactsText: funFactsText
                });
            }
        });
        return unsubscribe;
    }, [updateTypography]);
    var handleSave = function () {
        var name = "".concat(titleWords.title || 'word-search', " - ").concat(new Date().toLocaleDateString());
        savePuzzle(name);
    };
    // Handler for AI word generation from extension
    // Track if a generation is already in progress to prevent double calls
    var isGenerationInProgress = react_1.default.useRef(false);
    // SPEC 1: State for inline theme validation error messages
    var _m = (0, react_1.useState)(""), themeError = _m[0], setThemeError = _m[1];
    var _o = (0, react_1.useState)(false), showExtensionMissingPrompt = _o[0], setShowExtensionMissingPrompt = _o[1];
    // SPEC 1: computeThemeValidation remains for informational purposes only (do not auto-apply error state)
    var computeThemeValidation = react_1.default.useMemo(function () {
        if (!wordList.aiTheme.trim()) {
            return { enteredThemesCount: 0, requiredPuzzles: 0, isDisabled: true, errorMsg: "" };
        }
        var enteredThemesCount = wordList.aiTheme
            .split('\n')
            .map(function (line) { return line.trim(); })
            .filter(function (line) { return line.length > 0; }).length;
        var requiredPuzzles = (core && core.numberOfPuzzles) ? core.numberOfPuzzles : 0;
        var isDisabled = enteredThemesCount < requiredPuzzles;
        var errorMsg = isDisabled
            ? "Need ".concat(requiredPuzzles - enteredThemesCount, " more theme(s)")
            : "";
        return { enteredThemesCount: enteredThemesCount, requiredPuzzles: requiredPuzzles, isDisabled: isDisabled, errorMsg: errorMsg };
    }, [wordList.aiTheme, core]);
    // Restore live themeError from computeThemeValidation so the alert appears under the button
    react_1.default.useEffect(function () {
        if (themeError === "Ready" && !computeThemeValidation.errorMsg) {
            return;
        }
        setThemeError(computeThemeValidation.errorMsg);
    }, [computeThemeValidation.errorMsg, themeError]);
    // Poll for extension availability and hide missing prompt when installed
    react_1.default.useEffect(function () {
        var mounted = true;
        var interval = setInterval(function () { return __awaiter(_this, void 0, void 0, function () {
            var available, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, (0, genpuzzle_extension_integration_1.isExtensionAvailable)()];
                    case 1:
                        available = _a.sent();
                        if (mounted && available) {
                            setShowExtensionMissingPrompt(false);
                            clearInterval(interval);
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        e_1 = _a.sent();
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); }, 2000);
        // also check immediately once
        (function () { return __awaiter(_this, void 0, void 0, function () {
            var available, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, (0, genpuzzle_extension_integration_1.isExtensionAvailable)()];
                    case 1:
                        available = _b.sent();
                        if (mounted && available) {
                            setShowExtensionMissingPrompt(false);
                            clearInterval(interval);
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        _a = _b.sent();
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        }); })();
        return function () {
            mounted = false;
            clearInterval(interval);
        };
    }, []);
    react_1.default.useEffect(function () {
        var handleSuccess = function () {
            setThemeError("Ready");
            setIsGeneratingWordsFromExtension(false);
            isGenerationInProgress.current = false;
            console.log('[WordSearchSidebar] EXTENSION_GENERATION_SUCCESS received; local state reset.');
        };
        window.addEventListener("EXTENSION_GENERATION_SUCCESS", handleSuccess);
        return function () { return window.removeEventListener("EXTENSION_GENERATION_SUCCESS", handleSuccess); };
    }, []);
    /**
     * REQUIREMENT 4: Parse words from both horizontal and vertical formats
     * Detects format automatically:
     * - Horizontal: "Word, word, word, word..."
     * - Vertical: "Word\nWord\nWord..."
     */
    var parseWordListFromBothFormats = function (value) {
        if (!value || value.trim().length === 0)
            return [];
        // Check if content contains commas (horizontal format indicator)
        if (value.includes(',')) {
            // Horizontal format: split by commas
            var words = value
                .split(',')
                .map(function (w) { return w.trim(); })
                .filter(function (w) { return w.length > 0; });
            console.log('[WordSearchSidebar] Parsed horizontal format:', words.length, 'words');
            return words;
        }
        else {
            // Vertical format: split by newlines
            var words = value
                .split('\n')
                .map(function (w) { return w.trim(); })
                .filter(function (w) { return w.length > 0; });
            console.log('[WordSearchSidebar] Parsed vertical format:', words.length, 'words');
            return words;
        }
    };
    // Theme history management - tracks submitted themes to prevent repetition
    var getThemeHistory = function () {
        if (typeof window === 'undefined')
            return [];
        try {
            var stored = localStorage.getItem('genpuzzle_theme_history');
            return stored ? JSON.parse(stored) : [];
        }
        catch (e) {
            console.warn('[WordSearchSidebar] Failed to load theme history:', e);
            return [];
        }
    };
    var addThemesToHistory = function (themes) {
        if (typeof window === 'undefined' || themes.length === 0)
            return;
        try {
            var existing = getThemeHistory();
            var combined = __spreadArray(__spreadArray([], themes, true), existing, true);
            // Keep only unique themes, limited to 500
            var unique = Array.from(new Set(combined)).slice(0, 500);
            localStorage.setItem('genpuzzle_theme_history', JSON.stringify(unique));
        }
        catch (e) {
            console.warn('[WordSearchSidebar] Failed to save theme history:', e);
        }
    };
    var getSubmittedThemesExamples = function (numberOfPuzzles) {
        var history = getThemeHistory();
        var toInclude = Math.min(numberOfPuzzles, history.length);
        if (toInclude === 0)
            return '';
        var examples = history.slice(0, toInclude);
        return "\n### PREVIOUSLY SUBMITTED THEMES (DO NOT REPEAT - Use only as reference for niche/style):\n".concat(examples.map(function (t, i) { return "- ".concat(t); }).join('\n'));
    };
    var handleGenerateWordsFromAI = function () { return __awaiter(_this, void 0, void 0, function () {
        var available, e_2, requiredPuzzles, enteredThemesCount, missingCount, numberOfPuzzles, wordsPerPuzzle, maxLength, caseValue, charCase, ageLevel, language, theme, validationErrors, allThemes, limitedThemes, finalTheme, dynamicPrompt, queueResponse_1, responseReceived_1, responseListener_1, err_1, errorMessage;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    // STRICT DOM-BASED PRE-SUBMISSION VALIDATION (run immediately at handler start)
                    // Extract values directly from DOM elements to ensure accurate submission criteria
                    console.log('[WordSearchSidebar] Starting DOM-based pre-submission validation...');
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, (0, genpuzzle_extension_integration_1.isExtensionAvailable)()];
                case 2:
                    available = _b.sent();
                    if (!available) {
                        console.warn('[WordSearchSidebar] GenPuzzle extension not available - showing download prompt');
                        setShowExtensionMissingPrompt(true);
                        setIsGeneratingWordsFromExtension(false);
                        isGenerationInProgress.current = false;
                        return [2 /*return*/];
                    }
                    // Hide prompt if it was previously shown
                    if (showExtensionMissingPrompt)
                        setShowExtensionMissingPrompt(false);
                    return [3 /*break*/, 4];
                case 3:
                    e_2 = _b.sent();
                    console.warn('[WordSearchSidebar] Error checking extension availability', e_2);
                    return [3 /*break*/, 4];
                case 4:
                    requiredPuzzles = (core === null || core === void 0 ? void 0 : core.numberOfPuzzles) || 0;
                    console.log('[WordSearchSidebar] Required puzzles from state:', requiredPuzzles);
                    enteredThemesCount = wordList.aiTheme
                        .split('\n')
                        .map(function (line) { return line.trim(); })
                        .filter(function (line) { return line.length > 0; }).length;
                    console.log('[WordSearchSidebar] Entered themes count from state:', enteredThemesCount);
                    // Rule Matrix: If insufficient themes, set error and ABORT immediately (do not modify other state)
                    if (enteredThemesCount < requiredPuzzles) {
                        missingCount = requiredPuzzles - enteredThemesCount;
                        console.error('[WordSearchSidebar] ❌ VALIDATION FAILED: Insufficient themes');
                        setThemeError('Need ' + missingCount + ' more themes');
                        return [2 /*return*/]; // STRICT ABORT — do not proceed further
                    }
                    // Passed validation — clear any previous error
                    setThemeError('');
                    // Guard against double-calls from rapid clicks or React re-renders
                    if (isGenerationInProgress.current) {
                        console.warn('[WordSearchSidebar] Generation already in progress, ignoring duplicate call');
                        return [2 /*return*/];
                    }
                    // CRITICAL: Ensure all required state objects are initialized before proceeding
                    if (!wordSearchSettings || !wordList || !core) {
                        console.error('[WordSearchSidebar] INITIALIZATION ERROR: State objects not ready', {
                            hasWordSearchSettings: !!wordSearchSettings,
                            hasWordList: !!wordList,
                            hasCore: !!core
                        });
                        alert('Settings not yet loaded. Please wait a moment and try again.');
                        return [2 /*return*/];
                    }
                    if (!wordList.aiTheme || !wordList.aiTheme.trim()) {
                        alert('Please enter a theme for word generation');
                        return [2 /*return*/];
                    }
                    _b.label = 5;
                case 5:
                    _b.trys.push([5, 7, , 8]);
                    // Mark generation as in progress BEFORE any async operations
                    isGenerationInProgress.current = true;
                    setIsGeneratingWordsFromExtension(true);
                    // REQUIREMENT 1: Immediately switch Word Source from 'ai' to 'manual'
                    // This happens before the extension navigates to Gemini
                    console.log('[WordSearchSidebar] Switching Word Source to manual mode');
                    updateWordListSettings({ selectWordListOption: 'manual' });
                    // Enable "Add Fun Facts / Quotes" checkbox so fun facts will be populated automatically
                    console.log('[WordSearchSidebar] Enabling Add Fun Facts / Quotes');
                    updateTypography({ includeFunFacts: true });
                    numberOfPuzzles = (core && core.numberOfPuzzles) ? Math.max(1, core.numberOfPuzzles) : 10;
                    wordsPerPuzzle = (wordList && wordList.wordsPerPuzzle) ? Math.max(1, wordList.wordsPerPuzzle) : 10;
                    maxLength = (wordList && wordList.aiMaxWordLength) ? Math.max(1, wordList.aiMaxWordLength) : 15;
                    caseValue = (wordList && wordList.wordListCase) ? wordList.wordListCase : 'mixed';
                    charCase = caseValue === 'upper' ? 'UPPERCASE' : caseValue === 'lower' ? 'lowercase' : 'mixed case';
                    ageLevel = (wordList && wordList.aiAgeLevel) ? wordList.aiAgeLevel : 'Adult';
                    language = (wordList && wordList.aiLanguage) ? wordList.aiLanguage : 'English';
                    theme = (wordList && wordList.aiTheme) ? wordList.aiTheme.trim() : 'General Theme';
                    validationErrors = [];
                    if (!numberOfPuzzles || numberOfPuzzles <= 0) {
                        validationErrors.push('numberOfPuzzles must be a positive number');
                    }
                    if (!wordsPerPuzzle || wordsPerPuzzle <= 0) {
                        validationErrors.push('wordsPerPuzzle must be a positive number');
                    }
                    if (!maxLength || maxLength <= 0) {
                        validationErrors.push('maxLength must be a positive number');
                    }
                    if (!charCase || charCase === 'undefined') {
                        validationErrors.push('charCase is invalid');
                    }
                    if (!ageLevel || ageLevel === 'undefined') {
                        validationErrors.push('ageLevel is invalid');
                    }
                    if (!language || language === 'undefined') {
                        validationErrors.push('language is invalid');
                    }
                    if (!theme || theme === 'undefined') {
                        validationErrors.push('theme is invalid or empty');
                    }
                    if (validationErrors.length > 0) {
                        throw new Error('Validation failed: ' + validationErrors.join(', '));
                    }
                    allThemes = theme
                        .split('\n')
                        .map(function (line) { return line.trim(); })
                        .filter(function (line) { return line.length > 0; });
                    limitedThemes = allThemes.slice(0, numberOfPuzzles);
                    finalTheme = limitedThemes.join('\n');
                    console.log('[WordSearchSidebar] Theme limiting: extracted', allThemes.length, 'themes, using first', limitedThemes.length, 'for', numberOfPuzzles, 'puzzles');
                    dynamicPrompt = "Generate ".concat(String(numberOfPuzzles), " word list for themes below, each word list should sorted alphabetically and containing exactly ").concat(String(wordsPerPuzzle), " words, generate fun fact for each theme (90-95 characters for each theme)\n\n    Word Constraints: Max ").concat(String(maxLength), " letters, ").concat(String(charCase), ". Unique, non-duplicated words. No numbers allowed in the word lists (words must not contain digits).\n    Target Audience: ").concat(String(ageLevel), ".\n    Language: ").concat(String(language), ".\n    Multi-word Rule: Make sure to add space between words when we have 2 words based.\n\n    ### THEMES TO GENERATE:\n    ").concat(finalTheme, "\n\n    ### CRITICAL RULES:\n    1. Do NOT reuse, copy, or repeat any words or titles shown in previously submitted themes or example format section below.\n    2. Every single puzzle must have a completely unique, new title and a brand new list of words based strictly on the themes listed in \"THEMES TO GENERATE\" section above.\n    3. Output ONLY the raw puzzle data. No chat, no markdown formatting like ** or bolding, and no part numbers.\n    4. No numbers allowed in the words lists \u2014 words must contain only alphabetic characters (remove any entries that include digits).\n\n    ### EXCLUSIVE OUTPUT FORMAT (Follow this structure exactly):\n    -Theme 1 Title\n\n    word, word, word, word, word, ...\n\n    -Fun fact: write fun fact here\n\n    -Theme 2 Title\n\n    word, word, word, word, word, ...\n\n    -Fun fact: write fun fact here\n\n    -Theme 3 Title\n\n    word, word, word, word, word, ...\n\n    -Fun fact: write fun fact here");
                    // Final safeguard: verify the prompt does not contain the string "undefined"
                    if (dynamicPrompt.includes('undefined')) {
                        throw new Error('CRITICAL: Prompt contains the string "undefined" - this will break Gemini injection. Check state variables.');
                    }
                    console.log('[WordSearchSidebar] Queueing prompt in extension...', { numberOfPuzzles: numberOfPuzzles, wordsPerPuzzle: wordsPerPuzzle, maxLength: maxLength, charCase: charCase, ageLevel: ageLevel, language: language, finalTheme: finalTheme });
                    return [4 /*yield*/, (0, genpuzzle_extension_integration_1.queuePrompt)({
                            prompt: dynamicPrompt,
                            provider: 'gemini',
                        })];
                case 6:
                    queueResponse_1 = _b.sent();
                    if (!queueResponse_1.success) {
                        throw new Error(queueResponse_1.error || 'Failed to queue prompt');
                    }
                    console.log('[WordSearchSidebar] Prompt queued successfully, requestId:', queueResponse_1.requestId);
                    responseReceived_1 = false;
                    responseListener_1 = function (message) {
                        var _a;
                        if (!responseReceived_1 &&
                            (message === null || message === void 0 ? void 0 : message.type) === "RESPONSE_RECEIVED" &&
                            (message === null || message === void 0 ? void 0 : message.requestId) === queueResponse_1.requestId &&
                            ((message === null || message === void 0 ? void 0 : message.action) === "GENERATE_WORDS" || (message === null || message === void 0 ? void 0 : message.action) === "GENERATE_CONTENT") &&
                            (message === null || message === void 0 ? void 0 : message.dataType) === "text") {
                            responseReceived_1 = true;
                            console.log('[WordSearchSidebar] Received response for requestId:', queueResponse_1.requestId, message);
                            // Extract words and update state
                            if (message.words && message.words.length > 0) {
                                var allWords_2 = [];
                                var submittedThemes_1 = [];
                                message.words.forEach(function (item) {
                                    if (item.words && Array.isArray(item.words)) {
                                        allWords_2.push.apply(allWords_2, item.words);
                                    }
                                    // Track the theme for history
                                    if (item.theme) {
                                        submittedThemes_1.push(item.theme);
                                    }
                                });
                                // Save submitted themes to history for future prompts
                                if (submittedThemes_1.length > 0) {
                                    addThemesToHistory(submittedThemes_1);
                                    console.log('[WordSearchSidebar] Added', submittedThemes_1.length, 'themes to history');
                                }
                                if (allWords_2.length > 0) {
                                    console.log('[WordSearchSidebar] Updated word list with', allWords_2.length, 'words');
                                    setTitleWords(__assign(__assign({}, titleWords), { words: allWords_2 }));
                                }
                            }
                            // Clean up listener and reset generation guard
                            if (typeof chrome !== 'undefined' && ((_a = chrome === null || chrome === void 0 ? void 0 : chrome.runtime) === null || _a === void 0 ? void 0 : _a.onMessage)) {
                                chrome.runtime.onMessage.removeListener(responseListener_1);
                            }
                            setIsGeneratingWordsFromExtension(false);
                            isGenerationInProgress.current = false; // IMPORTANT: Reset guard after response
                            // Clear the "Ready" message after 2 seconds so user can generate again
                            setTimeout(function () {
                                setThemeError('');
                            }, 2000);
                        }
                    };
                    // Add listener using chrome API if available
                    if (typeof chrome !== 'undefined' && ((_a = chrome === null || chrome === void 0 ? void 0 : chrome.runtime) === null || _a === void 0 ? void 0 : _a.onMessage)) {
                        chrome.runtime.onMessage.addListener(responseListener_1);
                    }
                    return [3 /*break*/, 8];
                case 7:
                    err_1 = _b.sent();
                    errorMessage = err_1 instanceof Error ? err_1.message : String(err_1);
                    console.error('[WordSearchSidebar] Failed to generate words:', errorMessage);
                    alert("Failed to generate words: ".concat(errorMessage));
                    setIsGeneratingWordsFromExtension(false);
                    isGenerationInProgress.current = false; // IMPORTANT: Reset guard on error
                    return [3 /*break*/, 8];
                case 8: return [2 /*return*/];
            }
        });
    }); };
    var requiredWords = core.numberOfPuzzles * wordList.wordsPerPuzzle;
    var wordCount = titleWords.words.length;
    return (<div className={"relative transition-all duration-300 h-full bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 border-r border-gray-200 dark:border-slate-800 flex flex-col shadow-lg overflow-visible ".concat(collapsed ? 'w-28' : 'w-96')}>
      <button type="button" aria-expanded={!collapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={function () { return setCollapsed(function (c) { return !c; }); }} className="absolute top-1/2 -right-4 z-50 flex items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm transition duration-150 ease-out hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400" style={{
            transform: 'translateY(-50%)',
            width: 40,
            height: 40,
        }}>
        <lucide_react_1.ChevronRight className={"w-5 h-5 transition-transform duration-200 ".concat(collapsed ? 'rotate-0' : 'rotate-180')}/>
      </button>
      <style>{"\n        /* Modern tab styling */\n        [role=\"tablist\"] {\n          display: flex;\n          flex-direction: column;\n          justify-content: flex-start;\n          gap: 2rem;\n          padding: 8px;\n          background: transparent;\n          border-right: 2px solid rgba(226, 232, 240, 0.8);\n        }\n        \n        button[role=\"tab\"] {\n          flex: 0;\n          width: 4.25rem;\n          min-height: 4.25rem;\n          height: auto;\n          min-width: auto;\n          padding: 0.5rem 0;\n          border-radius: 0; /* square corners */\n          font-weight: 500;\n          transition: all 200ms ease-out;\n          border: 2px solid transparent;\n          background: white;\n          color: #64748b;\n          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);\n          display: inline-flex;\n          align-items: center;\n          justify-content: center;\n          flex-direction: column;\n        }\n        \n        button[role=\"tab\"]:hover {\n          background: linear-gradient(135deg, #eef2ff 0%, #dbeafe 100%);\n          color: #0ea5e9;\n          box-shadow: 0 4px 12px rgba(14, 165, 233, 0.12);\n          transform: translateY(-1px);\n        }\n        \n        button[role=\"tab\"][data-state=\"active\"] {\n          background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);\n          color: #0369a1; /* darker blue when active */\n          border-color: rgba(14,165,233,0.14);\n          box-shadow: 0 8px 18px rgba(14,165,233,0.18);\n        }\n\n        /* Icon and accent animations */\n        button[role=\"tab\"] svg { transition: transform 260ms cubic-bezier(.2,.9,.2,1), opacity 180ms ease; transform-origin: center center; display: block; margin: 0 auto; }\n        button[role=\"tab\"]:hover svg { transform: scale(1.03); }\n        button[role=\"tab\"][data-state=\"active\"] svg { transform: scale(1.08); }\n\n        button[role=\"tab\"] svg .icon-accent { opacity: 0; transform-origin: center; transition: opacity 240ms ease, transform 320ms cubic-bezier(.2,.9,.2,1); }\n        button[role=\"tab\"][data-state=\"active\"] svg .icon-accent { opacity: 1; transform: scale(1.06); animation: gp-pulse 1.6s ease-in-out infinite; }\n\n        @keyframes gp-pulse {\n          0% { transform: scale(1); }\n          50% { transform: scale(1.08); }\n          100% { transform: scale(1); }\n        }\n\n        [role=\"tabpanel\"] {\n          background: transparent;\n          animation: slideDown 300ms ease-out;\n        }\n        \n        @keyframes slideDown {\n          from {\n            opacity: 0;\n            transform: translateY(-10px);\n          }\n          to {\n            opacity: 1;\n            transform: translateY(0);\n          }\n        }\n      "}</style>

      <div className="flex flex-col gap-3 p-3 border-b border-gray-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/80">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Document Pages</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{documentPages.length} page{documentPages.length === 1 ? '' : 's'}</p>
          </div>
          <div className="flex items-center gap-2">
            <select_1.Select value={newModuleType} onValueChange={function (value) { return setNewModuleType(value); }}>
              <select_1.SelectTrigger className="h-9 min-w-[130px] rounded-md text-sm">
                <select_1.SelectValue placeholder="Module type"/>
              </select_1.SelectTrigger>
              <select_1.SelectContent>
                <select_1.SelectItem value="title-page">Title Page</select_1.SelectItem>
                <select_1.SelectItem value="table-of-contents">Table of Contents</select_1.SelectItem>
                <select_1.SelectItem value="copyright">Copyright</select_1.SelectItem>
                <select_1.SelectItem value="instructions">Instructions</select_1.SelectItem>
                <select_1.SelectItem value="word-search">Word Search</select_1.SelectItem>
                <select_1.SelectItem value="sudoku">Sudoku</select_1.SelectItem>
                <select_1.SelectItem value="crossword">Crossword</select_1.SelectItem>
                <select_1.SelectItem value="maze">Maze</select_1.SelectItem>
                <select_1.SelectItem value="cryptogram">Cryptogram</select_1.SelectItem>
                <select_1.SelectItem value="word-scramble">Word Scramble</select_1.SelectItem>
              </select_1.SelectContent>
            </select_1.Select>
            <button_1.Button variant="secondary" size="sm" onClick={function () { return addDocumentPage(newModuleType); }}>
              <lucide_react_1.Plus className="w-3.5 h-3.5"/> Add
            </button_1.Button>
          </div>
        </div>

        <div className="space-y-2 overflow-y-auto max-h-44 pr-1">
          {documentPages.map(function (page, index) { return (<button key={page.id} type="button" onClick={function () { return setActiveDocumentPageId(page.id); }} className={(0, utils_1.cn)('w-full rounded-2xl border px-3 py-2 text-left transition duration-150 flex items-center justify-between gap-3', activeDocumentPageId === page.id
                ? 'border-sky-500 bg-sky-50 text-slate-900'
                : 'border-transparent bg-slate-50 hover:border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700')}>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{page.name}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{page.moduleType.replace('-', ' ')}</p>
              </div>
              <div className="flex items-center gap-1">
                <button_1.Button type="button" variant="ghost" size="icon" aria-label="Move up" onClick={function (e) {
                e.stopPropagation();
                moveDocumentPage(page.id, 'up');
            }} className="h-8 w-8">
                  <lucide_react_1.ChevronUp className="w-4 h-4"/>
                </button_1.Button>
                <button_1.Button type="button" variant="ghost" size="icon" aria-label="Move down" onClick={function (e) {
                e.stopPropagation();
                moveDocumentPage(page.id, 'down');
            }} className="h-8 w-8">
                  <lucide_react_1.ChevronDown className="w-4 h-4"/>
                </button_1.Button>
                <button_1.Button type="button" variant="ghost" size="icon" aria-label="Delete page" onClick={function (e) {
                e.stopPropagation();
                removeDocumentPage(page.id);
            }} className="h-8 w-8">
                  <lucide_react_1.Trash2 className="w-4 h-4 text-rose-500"/>
                </button_1.Button>
              </div>
            </button>); })}
        </div>
      </div>

      {moduleIsWordSearch ? (<tabs_1.Tabs defaultValue="book" orientation="vertical" className="w-full flex-1 flex min-h-0" onValueChange={handleTabChange}>
        <tabs_1.TabsList className="flex h-auto flex-col w-24 gap-3 bg-transparent shrink-0">
          <tabs_1.TabsTrigger value="book" title="Book" className="transition-all duration-200" onPointerDown={function (e) { return handleTriggerPointerDown(e, 'book'); }}>
            <Book className="w-6 h-6"/>
          </tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="design" title="Design" className="transition-all duration-200" onPointerDown={function (e) { return handleTriggerPointerDown(e, 'design'); }}>
            <Type className="w-6 h-6"/>
          </tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="words" title="Words" className="transition-all duration-200" onPointerDown={function (e) { return handleTriggerPointerDown(e, 'words'); }}>
            <List className="w-6 h-6"/>
          </tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="puzzle" title="Puzzle" className="transition-all duration-200" onPointerDown={function (e) { return handleTriggerPointerDown(e, 'puzzle'); }}>
            <Grid3X3 className="w-6 h-6"/>
          </tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="colors" title="Colors" className="transition-all duration-200" onPointerDown={function (e) { return handleTriggerPointerDown(e, 'colors'); }}>
            <Palette className="w-6 h-6"/>
          </tabs_1.TabsTrigger>
        </tabs_1.TabsList>

        {/* ==================== PUZZLE SETTINGS ==================== */}
        <tabs_1.TabsContent value="puzzle" style={{ height: 'calc(100vh - 100px)', overflowY: 'auto' }} className={(0, utils_1.cn)('flex-1 min-h-0 p-4 space-y-6 bg-gradient-to-b from-white to-gray-50 dark:from-slate-800 dark:to-slate-850 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 m-2', collapsed && 'hidden')}>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">Puzzle Settings</h3>
              <button_1.Button variant="outline" size="sm" onClick={handleSave} className="transition-all duration-200 border-gray-300 dark:border-slate-600">
                <lucide_react_1.Save className="w-4 h-4 mr-2"/>Save
              </button_1.Button>
            </div>

            {/* Grid Size */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label_1.Label className="text-sm font-medium">Grid Size</label_1.Label>
                <span className="text-sm text-gray-600">{core.lettersAcross} x {core.lettersDown}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <slider_field_1.SliderField label="Letters Across" value={core.lettersAcross} onValueChange={function (v) { return updateCore({ lettersAcross: v }); }} min={8} max={30} step={1}/>
                <slider_field_1.SliderField label="Letters Down" value={core.lettersDown} onValueChange={function (v) { return updateCore({ lettersDown: v }); }} min={8} max={30} step={1}/>
              </div>
              {/* Puzzle Grid Scale Controls */}
              <div className="border-t pt-3">
                <label_1.Label className="text-xs text-gray-500 mb-2 block">Puzzle Grid Scale</label_1.Label>
                <div className="flex items-center gap-1 border border-gray-200 rounded-md">
                  <button_1.Button variant="ghost" size="sm" onClick={function () { return setPuzzleGridScale(Math.max(puzzleGridScale - 10, 50)); }} title="Shrink Grid">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><circle cx="11" cy="11" r="8"></circle><line x1="21" x2="16.65" y1="21" y2="16.65"></line><line x1="8" x2="14" y1="11" y2="11"></line></svg>
                  </button_1.Button>
                  <span className="px-2 text-sm font-medium min-w-[70px] text-center" title="Puzzle Grid Scale">
                    Grid: {puzzleGridScale}%
                  </span>
                  <button_1.Button variant="ghost" size="sm" onClick={function () { return setPuzzleGridScale(Math.min(puzzleGridScale + 10, 200)); }} title="Enlarge Grid">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><circle cx="11" cy="11" r="8"></circle><line x1="21" x2="16.65" y1="21" y2="16.65"></line><line x1="11" x2="11" y1="8" y2="14"></line><line x1="8" x2="14" y1="11" y2="11"></line></svg>
                  </button_1.Button>
                </div>
              </div>
            </div>

            {/* Allowed Directions */}
            <div className="space-y-3">
              <label_1.Label className="text-sm font-medium">Word Directions</label_1.Label>
              <div className="grid grid-cols-4 gap-2">
                <DirectionCheckbox label="Right" checked={core.allowRight} onCheckedChange={function (v) { return updateCore({ allowRight: v }); }}/>
                <DirectionCheckbox label="Left" checked={core.allowLeft} onCheckedChange={function (v) { return updateCore({ allowLeft: v }); }}/>
                <DirectionCheckbox label="Down" checked={core.allowDown} onCheckedChange={function (v) { return updateCore({ allowDown: v }); }}/>
                <DirectionCheckbox label="Up" checked={core.allowUp} onCheckedChange={function (v) { return updateCore({ allowUp: v }); }}/>
                <DirectionCheckbox label="Diag Down" checked={core.allowDiagonalDown} onCheckedChange={function (v) { return updateCore({ allowDiagonalDown: v }); }}/>
                <DirectionCheckbox label="Diag Up" checked={core.allowDiagonalUp} onCheckedChange={function (v) { return updateCore({ allowDiagonalUp: v }); }}/>
                <DirectionCheckbox label="Diag Down Rev" checked={core.allowDiagonalDownReverse} onCheckedChange={function (v) { return updateCore({ allowDiagonalDownReverse: v }); }}/>
                <DirectionCheckbox label="Diag Up Rev" checked={core.allowDiagonalUpReverse} onCheckedChange={function (v) { return updateCore({ allowDiagonalUpReverse: v }); }}/>
              </div>
            </div>

            {/* Grid Options */}
            <div className="space-y-3">
              <label_1.Label className="text-sm font-medium">Grid Options</label_1.Label>
              <div className="space-y-2">
                <CheckboxItem label="No Box Around Puzzle" checked={core.noBoxAroundPuzzle} onCheckedChange={function (v) { return updateCore({ noBoxAroundPuzzle: v }); }}/>
                <slider_field_1.SliderField label="Border Stroke Thickness" value={core.borderStrokeThickness} onValueChange={function (v) { return updateCore({ borderStrokeThickness: v }); }} min={1} max={10} step={1} format="px"/>
                <slider_field_1.SliderField label="Border Corner Radius" value={core.borderCornerRadius} onValueChange={function (v) { return updateCore({ borderCornerRadius: v }); }} min={0} max={40} step={1} format="px"/>
                <slider_field_1.SliderField label="Puzzle Border Padding" value={core.gridBorderPadding} onValueChange={function (v) { return updateCore({ gridBorderPadding: v }); }} min={0} max={40} step={1} format="px"/>
                <slider_field_1.SliderField label="Solution Border Padding" value={core.solutionGridBorderPadding} onValueChange={function (v) { return updateCore({ solutionGridBorderPadding: v }); }} min={0} max={8} step={1} format="px"/>
              </div>
            </div>

            {/* Grid Letters */}
            <div className="space-y-3">
              <label_1.Label className="text-sm font-medium">Grid Letters</label_1.Label>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label_1.Label className="text-xs text-gray-500">Font</label_1.Label>
                  <select_1.Select value={typography.puzzleGridFontFamily} onValueChange={function (value) { return updateTypography({ puzzleGridFontFamily: value }); }}>
                    <select_1.SelectTrigger><select_1.SelectValue /></select_1.SelectTrigger>
                    <select_1.SelectContent>
                      {publishing_fonts_1.PUBLISHING_FONTS.map(function (font) { return <select_1.SelectItem key={font} value={font} style={{ fontFamily: font }}>{font}</select_1.SelectItem>; })}
                    </select_1.SelectContent>
                  </select_1.Select>
                </div>
                <slider_field_1.SliderField label="Puzzle Font Size" value={typography.puzzleGridFontSize} onValueChange={function (v) { return updateTypography({ puzzleGridFontSize: v }); }} min={8} max={50} step={1} format="px"/>
                <slider_field_1.SliderField label="Solution Font Size" value={typography.answerGridFontSize} onValueChange={function (v) { return updateTypography({ answerGridFontSize: v, setFontSizeForAnswerPages: true }); }} min={8} max={50} step={1} format="px"/>
              </div>
            </div>

            {/* Custom Letters removed per request */}

            {/* Solution Marking Style */}
            <div className="space-y-3">
              <label_1.Label className="text-sm font-medium">Solution Marking</label_1.Label>
              <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                <ColorInput label="Highlight Color" value={colors.answerPage.solutionFrameColor} onChange={function (v) { return updateAnswerPageColors({ solutionFrameColor: v }); }}/>
                <div className="grid grid-cols-2 gap-3">
                  <slider_field_1.SliderField label="Thickness" value={colors.answerPage.solutionStrokeThickness} onValueChange={function (v) { return updateAnswerPageColors({ solutionStrokeThickness: v }); }} min={1} max={15} step={1} format="px"/>
                  <slider_field_1.SliderField label="Transparency" value={(_a = colors.answerPage.solutionHighlightAlpha) !== null && _a !== void 0 ? _a : 30} onValueChange={function (v) { return updateAnswerPageColors({ solutionHighlightAlpha: v }); }} min={0} max={100} step={1} format="percent"/>
                </div>
              </div>
            </div>
          </div>
        </tabs_1.TabsContent>

        {/* ==================== DESIGN SETTINGS ==================== */}
        <tabs_1.TabsContent value="design" style={{ height: 'calc(100vh - 100px)', overflowY: 'auto' }} className={(0, utils_1.cn)('flex-1 min-h-0 p-4 space-y-6 bg-gradient-to-b from-white to-gray-50 dark:from-slate-800 dark:to-slate-850 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 m-2', collapsed && 'hidden')}>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-gray-900">Design Settings</h3>
              <button_1.Button variant="outline" size="sm" onClick={handleSave}>
                <lucide_react_1.Save className="w-4 h-4 mr-2"/>Save
              </button_1.Button>
            </div>

            {/* Title Options */}
            <div className="space-y-3">
              <label_1.Label className="text-sm font-medium">Title</label_1.Label>
              <select_1.Select value={typography.selectTitleOption} onValueChange={function (value) {
                var updates = { selectTitleOption: value };
                // When switching to "one-custom-title", extract only the first line
                if (value === 'one-custom-title' && typography.titleText) {
                    var firstLine = typography.titleText.split('\n')[0] || 'Word Search';
                    updates.titleText = firstLine;
                }
                // When switching to "custom", keep multiline text as-is
                // When switching to "none", clear the title text
                if (value === 'none') {
                    updates.titleText = '';
                }
                updateTypography(updates);
            }}>
                <select_1.SelectTrigger><select_1.SelectValue /></select_1.SelectTrigger>
                <select_1.SelectContent>
                  <select_1.SelectItem value="one-custom-title">One Custom Title</select_1.SelectItem>
                  <select_1.SelectItem value="custom">Custom Title Per Puzzle</select_1.SelectItem>
                  <select_1.SelectItem value="none">No Title</select_1.SelectItem>
                </select_1.SelectContent>
              </select_1.Select>

              {typography.selectTitleOption === 'one-custom-title' && (<div className="space-y-2">
                  <input_1.Input value={typography.titleText} onChange={function (e) {
                    var inputValue = e.target.value;
                    updateTypography({ titleText: inputValue });
                    if (wordList.aiTheme !== inputValue) {
                        updateWordListSettings({ aiTheme: inputValue });
                    }
                }} placeholder="Enter the master title for all puzzles..."/>
                  <p className="text-xs text-gray-500">This title will be used for all puzzle pages.</p>
                </div>)}

              {typography.selectTitleOption === 'custom' && (<div className="space-y-2">
                  <textarea_1.Textarea value={typography.titleText} onChange={function (e) {
                    var inputValue = e.target.value;
                    updateTypography({ titleText: inputValue });
                    if (wordList.aiTheme !== inputValue) {
                        updateWordListSettings({ aiTheme: inputValue });
                    }
                }} placeholder="Enter one title per line..." className="h-28"/>
                  <p className="text-xs text-gray-500">Enter one title per line. The first line is for Puzzle 1, the second for Puzzle 2, etc.</p>
                  {missingCustomTitles > 0 && (<p className="text-sm font-medium text-rose-700">
                      {missingCustomTitles} more needed
                    </p>)}
                </div>)}

              {typography.selectTitleOption !== 'none' && (<div className="space-y-2 pt-2 border-t">
                  <label_1.Label className="text-sm font-medium">Puzzle Numbering Style</label_1.Label>
                  <select_1.Select value={typography.puzzleNumberingStyle} onValueChange={function (value) { return updateTypography({ puzzleNumberingStyle: value }); }}>
                    <select_1.SelectTrigger><select_1.SelectValue /></select_1.SelectTrigger>
                    <select_1.SelectContent>
                      <select_1.SelectItem value="none">None</select_1.SelectItem>
                      <select_1.SelectItem value="prefix">Prefix (1. Title)</select_1.SelectItem>
                      <select_1.SelectItem value="suffix">Suffix (Title #1)</select_1.SelectItem>
                    </select_1.SelectContent>
                  </select_1.Select>
                  <p className="text-xs text-gray-500">Choose how to display puzzle numbers with titles.</p>
                </div>)}
            </div>

            {/* Fonts */}
            <div className="space-y-3">
              <label_1.Label className="text-sm font-medium">Fonts</label_1.Label>
              <div>
                <label_1.Label className="text-xs text-gray-500">Title Font</label_1.Label>
                <select_1.Select value={typography.puzzleTitleFontFamily} onValueChange={function (value) { return updateTypography({ puzzleTitleFontFamily: value }); }}>
                  <select_1.SelectTrigger><select_1.SelectValue /></select_1.SelectTrigger>
                  <select_1.SelectContent>
                    {publishing_fonts_1.PUBLISHING_FONTS.map(function (font) { return <select_1.SelectItem key={font} value={font} style={{ fontFamily: font }}>{font}</select_1.SelectItem>; })}
                  </select_1.SelectContent>
                </select_1.Select>
              </div>
            </div>

            {/* Font Sizes */}
            <div className="space-y-3">
              <label_1.Label className="text-sm font-medium">Font Sizes</label_1.Label>
              <div className="grid grid-cols-2 gap-3">
                <slider_field_1.SliderField label="Title Size" value={typography.puzzleTitleFontSize} onValueChange={function (v) { return updateTypography({ puzzleTitleFontSize: v }); }} min={8} max={50} step={1} format="px"/>
                <slider_field_1.SliderField label="Subtitle Size" value={typography.subtitleFontSize} onValueChange={function (v) { return updateTypography({ subtitleFontSize: v }); }} min={10} max={24} step={1} format="px" disabled={!typography.includeFunFacts}/>
                <slider_field_1.SliderField label="Subtitle Box Margin" value={typography.subtitleBoxMargin} onValueChange={function (v) { return updateTypography({ subtitleBoxMargin: v }); }} min={0} max={100} step={1} format="pt" disabled={!typography.includeFunFacts}/>
              </div>
            </div>

            {/* Grid Text */}
            <div className="space-y-3">
              <label_1.Label className="text-sm font-medium">Grid Text Style</label_1.Label>
              <select_1.Select value={typography.puzzleGridCase} onValueChange={function (value) { return updateTypography({ puzzleGridCase: value }); }}>
                <select_1.SelectTrigger><select_1.SelectValue /></select_1.SelectTrigger>
                <select_1.SelectContent>
                  <select_1.SelectItem value="upper">UPPERCASE</select_1.SelectItem>
                  <select_1.SelectItem value="lower">lowercase</select_1.SelectItem>
                </select_1.SelectContent>
              </select_1.Select>
            </div>

            {/* Spacing */}
            <div className="space-y-3">
              <label_1.Label className="text-sm font-medium">Spacing</label_1.Label>
              <div className="grid grid-cols-2 gap-3">
                <slider_field_1.SliderField label="Title Start At" value={typography.titleStartAt} onValueChange={function (v) { return updateTypography({ titleStartAt: v }); }} min={0} max={200} step={1} format="px"/>
                <slider_field_1.SliderField label="Title to Subtitle" value={typography.subtitleToTitleGap} onValueChange={function (v) { return updateTypography({ subtitleToTitleGap: v }); }} min={0} max={100} step={1} format="px" disabled={!typography.includeFunFacts}/>
                <slider_field_1.SliderField label="Subtitle to Puzzle" value={typography.subtitleToPuzzleGap} onValueChange={function (v) { return updateTypography({ subtitleToPuzzleGap: v }); }} min={0} max={100} step={1} format="px" disabled={!typography.includeFunFacts}/>
                <slider_field_1.SliderField label="Puzzle to Word List" value={typography.spaceBetweenPuzzleAndWordList} onValueChange={function (v) { return updateTypography({ spaceBetweenPuzzleAndWordList: v }); }} min={0} max={100} step={1} format="px"/>

              </div>
            </div>

            {/* Layout Margins */}
            <div className="space-y-3">
              <label_1.Label className="text-sm font-medium">Page Layout</label_1.Label>
              <div className="grid grid-cols-2 gap-3">
                <slider_field_1.SliderField label="Title to Answer" value={titleToAnswerGap} onValueChange={setTitleToAnswerGap} min={0} max={100} step={1} format="px"/>
                <slider_field_1.SliderField label="Solution to Solution" value={solutionToSolutionGap} onValueChange={setSolutionToSolutionGap} min={6} max={80} step={1} format="px"/>
                <slider_field_1.SliderField label="Solution Page Margin" value={pageMargin} onValueChange={setPageMargin} min={10} max={100} step={5} format="px"/>
              </div>
              <p className="text-xs text-gray-500">Solution Page Margin controls distance from solution page edges only (KDP safe zone).</p>
            </div>

            <div className="space-y-3">
              <label_1.Label className="text-sm font-medium">Answer Page Title</label_1.Label>
              <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                <div className="space-y-2">
                  <label_1.Label className="text-sm font-medium">Solution Title Style</label_1.Label>
                  <select_1.Select value={typography.solutionTitleStyle} onValueChange={function (value) {
                if (value === 'same_as_puzzle') {
                    updateTypography({ solutionTitleStyle: value, solutionNumberingStyle: 'none' });
                }
                else {
                    updateTypography({ solutionTitleStyle: value });
                }
            }}>
                    <select_1.SelectTrigger><select_1.SelectValue /></select_1.SelectTrigger>
                    <select_1.SelectContent>
                      <select_1.SelectItem value="same_as_puzzle">Same as Puzzle</select_1.SelectItem>
                      <select_1.SelectItem value="custom">Custom Title</select_1.SelectItem>
                    </select_1.SelectContent>
                  </select_1.Select>
                </div>

                {typography.solutionTitleStyle === 'custom' && (<>
                    <div className="space-y-2">
                      <label_1.Label className="text-sm font-medium">Custom Solution Title</label_1.Label>
                      <input_1.Input value={typography.customSolutionTitle} onChange={function (e) { return updateTypography({ customSolutionTitle: e.target.value }); }} placeholder="Enter solution title..."/>
                    </div>

                    <div className="space-y-2">
                      <label_1.Label className="text-sm font-medium">Solution Numbering Style</label_1.Label>
                      <select_1.Select value={typography.solutionNumberingStyle} onValueChange={function (value) { return updateTypography({ solutionNumberingStyle: value }); }}>
                        <select_1.SelectTrigger><select_1.SelectValue /></select_1.SelectTrigger>
                        <select_1.SelectContent>
                          <select_1.SelectItem value="none">None</select_1.SelectItem>
                          <select_1.SelectItem value="prefix">Prefix (1. Title)</select_1.SelectItem>
                          <select_1.SelectItem value="suffix">Suffix (Title #1)</select_1.SelectItem>
                        </select_1.SelectContent>
                      </select_1.Select>
                    </div>
                  </>)}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label_1.Label className="text-xs text-gray-500">Font</label_1.Label>
                    <select_1.Select value={colors.answerPage.answerTitleFontFamily} onValueChange={function (value) { return updateAnswerPageColors({ answerTitleFontFamily: value }); }}>
                      <select_1.SelectTrigger><select_1.SelectValue /></select_1.SelectTrigger>
                      <select_1.SelectContent>
                        {publishing_fonts_1.PUBLISHING_FONTS.map(function (font) { return <select_1.SelectItem key={font} value={font} style={{ fontFamily: font }}>{font}</select_1.SelectItem>; })}
                      </select_1.SelectContent>
                    </select_1.Select>
                  </div>
                  <slider_field_1.SliderField label="Size" value={colors.answerPage.answerTitleFontSize} onValueChange={function (v) { return updateAnswerPageColors({ answerTitleFontSize: v }); }} min={8} max={50} step={1} format="px"/>
                </div>
              </div>
            </div>

            {/* Answer Page Fonts */}
            <div className="space-y-3">
              <label_1.Label className="text-sm font-medium">Answer Page Fonts</label_1.Label>
              <div className="flex items-center space-x-2">
                <checkbox_1.Checkbox id="setAnswerFont" checked={typography.setFontForAnswerPages} onCheckedChange={function (checked) { return updateTypography({ setFontForAnswerPages: checked === true }); }}/>
                <label_1.Label htmlFor="setAnswerFont" className="text-sm font-normal">Custom Font</label_1.Label>
              </div>
              {typography.setFontForAnswerPages && (<select_1.Select value={typography.answerGridFontFamily} onValueChange={function (value) { return updateTypography({ answerGridFontFamily: value }); }}>
                  <select_1.SelectTrigger><select_1.SelectValue /></select_1.SelectTrigger>
                  <select_1.SelectContent>
                    {publishing_fonts_1.PUBLISHING_FONTS.map(function (font) { return <select_1.SelectItem key={font} value={font} style={{ fontFamily: font }}>{font}</select_1.SelectItem>; })}
                  </select_1.SelectContent>
                </select_1.Select>)}
            </div>
          </div>
        </tabs_1.TabsContent>

        {/* ==================== WORD LIST SETTINGS ==================== */}
        <tabs_1.TabsContent value="words" style={{ height: 'calc(100vh - 100px)', overflowY: 'auto' }} className={(0, utils_1.cn)('flex-1 min-h-0 p-4 space-y-6 bg-gradient-to-b from-white to-gray-50 dark:from-slate-800 dark:to-slate-850 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 m-2', collapsed && 'hidden')} onKeyDown={function (e) {
                var _a;
                // Allow Enter key to work in textareas without triggering tab navigation
                if (e.key === 'Enter' && ((_a = e.target) === null || _a === void 0 ? void 0 : _a.tagName) === 'TEXTAREA') {
                    e.stopPropagation();
                }
            }}>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-gray-900">Word List Settings</h3>
              <button_1.Button variant="outline" size="sm" onClick={handleSave}>
                <lucide_react_1.Save className="w-4 h-4 mr-2"/>Save
              </button_1.Button>
            </div>

            {/* Words Per Puzzle */}
            <div className="space-y-2">
              <label_1.Label className="text-sm font-medium">Words Per Puzzle</label_1.Label>
              <IntegerInput value={wordList.wordsPerPuzzle} onChange={function (v) { return updateWordListSettings({ wordsPerPuzzle: v }); }} min={3} max={50}/>
              <p className="text-xs text-gray-500">
                Total needed: {requiredWords} ({core.numberOfPuzzles} x {wordList.wordsPerPuzzle})
              </p>
            </div>

            {/* Word Source */}
            <div className="space-y-3">
                  <label_1.Label className="text-sm font-medium">Word Source</label_1.Label>
                  <select_1.Select value={wordList.selectWordListOption} onValueChange={function (value) { return updateWordListSettings({ selectWordListOption: value }); }}>
                    <select_1.SelectTrigger><select_1.SelectValue /></select_1.SelectTrigger>
                    <select_1.SelectContent>
                      <select_1.SelectItem value="manual">Enter Words Manually</select_1.SelectItem>
                      <select_1.SelectItem value="ai">Use AI to Generate</select_1.SelectItem>
                    </select_1.SelectContent>
                  </select_1.Select>
                </div>

                {/* AI Generation */}
                {wordList.selectWordListOption === 'ai' && (<div className="space-y-3 p-3 rounded-lg border" style={{ background: "rgba(34, 118, 180, 0.08)" }}>
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4" style={{ color: "#404040" }}/>
                      <label_1.Label className="text-sm font-medium" style={{ color: "#404040" }}>AI Word Generation</label_1.Label>
                    </div>
                    <div>
                      <label_1.Label className="text-xs text-gray-500">Themes (one per line)</label_1.Label>
                      <textarea_1.Textarea value={wordList.aiTheme} onChange={function (e) {
                        var inputValue = e.target.value;
                        updateWordListSettings({ aiTheme: inputValue });
                        if (typography.titleText !== inputValue || typography.selectTitleOption !== 'custom') {
                            updateTypography({ selectTitleOption: 'custom', titleText: inputValue });
                        }
                    }} placeholder="Animals\nSpace\nFood..." className="h-20"/>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label_1.Label className="text-xs text-gray-500">Language</label_1.Label>
                        <select_1.Select value={wordList.aiLanguage} onValueChange={function (value) { return updateWordListSettings({ aiLanguage: value }); }}>
                          <select_1.SelectTrigger><select_1.SelectValue /></select_1.SelectTrigger>
                          <select_1.SelectContent>
                            {LANGUAGES.map(function (lang) { return <select_1.SelectItem key={lang} value={lang}>{lang}</select_1.SelectItem>; })}
                          </select_1.SelectContent>
                        </select_1.Select>
                      </div>
                      <div>
                        <label_1.Label className="text-xs text-gray-500">Age Level</label_1.Label>
                        <select_1.Select value={wordList.aiAgeLevel} onValueChange={function (value) { return updateWordListSettings({ aiAgeLevel: value }); }}>
                          <select_1.SelectTrigger><select_1.SelectValue /></select_1.SelectTrigger>
                          <select_1.SelectContent>
                            {AGE_LEVELS.map(function (age) { return <select_1.SelectItem key={age} value={age}>{age}</select_1.SelectItem>; })}
                          </select_1.SelectContent>
                        </select_1.Select>
                      </div>
                      <slider_field_1.SliderField label="Max Length" value={wordList.aiMaxWordLength} onValueChange={function (v) { return updateWordListSettings({ aiMaxWordLength: v }); }} min={3} max={gridMaxWordLength} step={1}/>
                    </div>

                    {/* Generate Words Button */}
                    <button_1.Button onClick={handleGenerateWordsFromAI} disabled={computeThemeValidation.isDisabled} className="w-full cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full" style={{
                        background: computeThemeValidation.isDisabled ? '#d1d5db' : '#2276b4',
                        color: 'white',
                    }}>
                      <lucide_react_1.Zap className="w-4 h-4 mr-2"/>
                      Generate Words with AI
                    </button_1.Button>

                    {/* SPEC 1: Inline theme validation error display directly under the button */}
                    {themeError && (<p style={{ color: themeError === "Ready" ? "green" : "red", fontSize: "12px", marginTop: "4px" }}>
                        {themeError}
                      </p>)}

                    {/* Error message: show download prompt when Chrome extension API is missing */}
                    {showExtensionMissingPrompt && ((function () {
                        var genPuzzleExtensionUrl = 'https://chromewebstore.google.com/detail/genpuzzle/pkokhbpdkolfhcbbghmopfcfbiamioie';
                        return (<div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                            <div>GenPuzzle Chrome extension not detected. Install the extension to use AI word generation.</div>
                            <div className="mt-2">
                              <button_1.Button onClick={function () { return window.open(genPuzzleExtensionUrl, '_blank'); }} variant="outline">
                                Download GenPuzzle Extension
                              </button_1.Button>
                            </div>
                          </div>);
                    })())}
                    {generationError && ((function () {
                        var missingExtension = typeof generationError === 'string' && generationError.includes('Chrome extension API not available');
                        var genPuzzleExtensionUrl = 'https://chromewebstore.google.com/detail/genpuzzle/pkokhbpdkolfhcbbghmopfcfbiamioie';
                        if (missingExtension) {
                            return (<div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                              <div>Failed to generate words: Chrome extension API not available. Make sure the extension is installed.</div>
                              <div className="mt-2">
                                <button_1.Button onClick={function () { return window.open(genPuzzleExtensionUrl, '_blank'); }} variant="outline">
                                  Download GenPuzzle Extension
                                </button_1.Button>
                              </div>
                            </div>);
                        }
                        return (<div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                            <strong>Error:</strong> {generationError}
                          </div>);
                    })())}

                    {/* Success message */}
                    {generatedWordsData && generatedWordsData.words && (<div className="p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                        <strong>✓ Success!</strong> Generated {generatedWordsData.words.reduce(function (total, item) { var _a; return total + (((_a = item.words) === null || _a === void 0 ? void 0 : _a.length) || 0); }, 0)} words
                      </div>)}
                  </div>)}

                {/* Manual Word Input */}
                {wordList.selectWordListOption === 'manual' && (<>
                    <WordListTextarea value={titleWords.words.join('\n')} onChange={function (value) {
                        // REQUIREMENT 4: Parse both horizontal and vertical formats
                        var words = parseWordListFromBothFormats(value);
                        setTitleWords(__assign(__assign({}, titleWords), { words: words }));
                    }}/>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">
                        Enter one word per line. {wordCount} words {wordCount >= requiredWords ? (<span className="text-green-600 flex items-center gap-1 inline"><lucide_react_1.CheckCircle className="w-3 h-3"/> Ready</span>) : (<span className="text-red-500 flex items-center gap-1 inline"><lucide_react_1.AlertCircle className="w-3 h-3"/> Need {requiredWords - wordCount} more</span>)}
                      </p>
                    </div>

                    {/* Fun Facts / Quotes Section 1 */}
                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex items-center space-x-2">
                        <checkbox_1.Checkbox id="includeFunFacts1" checked={typography.includeFunFacts} onCheckedChange={function (checked) { return updateTypography({ includeFunFacts: checked === true }); }}/>
                        <label_1.Label htmlFor="includeFunFacts1" className="text-sm font-medium">Add Fun Facts / Quotes</label_1.Label>
                      </div>

                      {typography.includeFunFacts && (<>
                          <textarea_1.Textarea value={typography.funFactsText} onChange={function (e) { return updateTypography({ funFactsText: e.target.value }); }} placeholder="Enter one fun fact or quote per line..." className="h-28"/>
                          <p className="text-xs text-gray-500">Enter one fun fact or quote per line. Each line appears under the corresponding puzzle (Line 1 under Puzzle 1, Line 2 under Puzzle 2, etc.)</p>
                        </>)}
                    </div>


                  </>)}

                {/* List Formatting */}
                <div className="space-y-3">
                  <label_1.Label className="text-sm font-medium">Word List Formatting</label_1.Label>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label_1.Label className="text-xs text-gray-500">Font</label_1.Label>
                      <select_1.Select value={wordList.wordListFontFamily} onValueChange={function (value) { return updateWordListSettings({ wordListFontFamily: value }); }}>
                        <select_1.SelectTrigger><select_1.SelectValue /></select_1.SelectTrigger>
                        <select_1.SelectContent>
                          {publishing_fonts_1.PUBLISHING_FONTS.map(function (font) { return <select_1.SelectItem key={font} value={font} style={{ fontFamily: font }}>{font}</select_1.SelectItem>; })}
                        </select_1.SelectContent>
                      </select_1.Select>
                    </div>
                    <slider_field_1.SliderField label="Font Size" value={wordList.wordListFontSize} onValueChange={function (v) { return updateWordListSettings({ wordListFontSize: v }); }} min={8} max={50} step={1} format="px"/>
                    <div>
                      <label_1.Label className="text-xs text-gray-500">Case</label_1.Label>
                      <select_1.Select value={wordList.wordListCase} onValueChange={function (value) { return updateWordListSettings({ wordListCase: value }); }}>
                        <select_1.SelectTrigger><select_1.SelectValue /></select_1.SelectTrigger>
                        <select_1.SelectContent>
                          <select_1.SelectItem value="upper">UPPERCASE</select_1.SelectItem>
                          <select_1.SelectItem value="lower">lowercase</select_1.SelectItem>
                          <select_1.SelectItem value="title">Title Case</select_1.SelectItem>
                        </select_1.SelectContent>
                      </select_1.Select>
                    </div>
                  </div>
                </div>

                {/* Layout */}
                <div className="space-y-3">
                  <label_1.Label className="text-sm font-medium">Layout</label_1.Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label_1.Label className="text-xs text-gray-500">Direction</label_1.Label>
                      <select_1.Select value={wordList.wordListDirection} onValueChange={function (value) { return updateWordListSettings({ wordListDirection: value }); }}>
                        <select_1.SelectTrigger><select_1.SelectValue /></select_1.SelectTrigger>
                        <select_1.SelectContent>
                          <select_1.SelectItem value="vertical">Vertical</select_1.SelectItem>
                          <select_1.SelectItem value="horizontal">Horizontal</select_1.SelectItem>
                        </select_1.SelectContent>
                      </select_1.Select>
                    </div>
                    <div>
                      <label_1.Label className="text-xs text-gray-500">Columns</label_1.Label>
                      <select_1.Select value={wordList.wordListColumns.toString()} onValueChange={function (value) { return updateWordListSettings({ wordListColumns: parseInt(value) }); }}>
                        <select_1.SelectTrigger><select_1.SelectValue /></select_1.SelectTrigger>
                        <select_1.SelectContent>
                          {[1, 2, 3, 4].map(function (n) { return <select_1.SelectItem key={n} value={n.toString()}>{n} Column{n > 1 ? 's' : ''}</select_1.SelectItem>; })}
                        </select_1.SelectContent>
                      </select_1.Select>
                    </div>
                    <slider_field_1.SliderField label="Spaces Between Words Horizontally" value={(_c = (_b = wordList.wordSpacingHorizontal) !== null && _b !== void 0 ? _b : wordList.wordListGap) !== null && _c !== void 0 ? _c : 50} onValueChange={function (v) { return updateWordListSettings({ wordSpacingHorizontal: v }); }} min={0} max={100} step={1} format="px"/>
                    <slider_field_1.SliderField label="Spaces Between Words Vertically" value={(_e = (_d = wordList.wordSpacingVertical) !== null && _d !== void 0 ? _d : wordList.wordListGap) !== null && _e !== void 0 ? _e : 8} onValueChange={function (v) { return updateWordListSettings({ wordSpacingVertical: v }); }} min={0} max={40} step={1} format="px"/>
                  </div>
                </div>

                {/* Modifiers */}
                <div className="space-y-2">
                  <label_1.Label className="text-sm font-medium">Options</label_1.Label>
                  <div className="space-y-2">
                    <CheckboxItem label="Don't Alphabetize" checked={wordList.dontAlphabetize} onCheckedChange={function (v) { return updateWordListSettings({ dontAlphabetize: v }); }}/>
                    <CheckboxItem label="Add Checkboxes" checked={wordList.addCheckboxes} onCheckedChange={function (v) { return updateWordListSettings({ addCheckboxes: v }); }}/>
                  </div>
                </div>
          </div>
        </tabs_1.TabsContent>

        {/* ==================== COLOR SETTINGS ==================== */}
        <tabs_1.TabsContent value="colors" style={{ height: 'calc(100vh - 100px)', overflowY: 'auto' }} className={(0, utils_1.cn)('flex-1 min-h-0 p-4 space-y-6 bg-gradient-to-b from-white to-gray-50 dark:from-slate-800 dark:to-slate-850 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 m-2', collapsed && 'hidden')}>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-gray-900">Color Settings</h3>
              <button_1.Button variant="outline" size="sm" onClick={handleSave}>
                <lucide_react_1.Save className="w-4 h-4 mr-2"/>Save
              </button_1.Button>
            </div>

            {/* Puzzle Page Colors */}
            <div className="space-y-3">
              <label_1.Label className="text-sm font-medium">Puzzle Page</label_1.Label>
              <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                <ColorInput label="Background" value={colors.puzzlePage.backgroundColor} onChange={function (v) { return updatePuzzlePageColors({ backgroundColor: v }); }}/>
                <BackgroundImageControl label="Puzzle Page" image={colors.puzzlePage.backgroundImage} opacity={colors.puzzlePage.backgroundImageOpacity} fit={colors.puzzlePage.backgroundImageFit} onImageChange={function (base64) { return updatePuzzlePageColors({ backgroundImage: base64 }); }} onOpacityChange={function (v) { return updatePuzzlePageColors({ backgroundImageOpacity: v }); }} onFitChange={function (v) { return updatePuzzlePageColors({ backgroundImageFit: v }); }} onRemove={function () { return updatePuzzlePageColors({ backgroundImage: undefined }); }}/>
                <ColorInput label="Title" value={colors.puzzlePage.titleColor} onChange={function (v) { return updatePuzzlePageColors({ titleColor: v }); }}/>
                <ColorInput label="Subtitle" value={colors.puzzlePage.subtitleColor} onChange={function (v) { return updatePuzzlePageColors({ subtitleColor: v }); }} disabled={!typography.includeFunFacts}/>
                <ColorInput label="Box" value={colors.puzzlePage.boxColor} onChange={function (v) { return updatePuzzlePageColors({ boxColor: v }); }}/>
                <ColorInput label="Puzzle Letters" value={colors.puzzlePage.puzzleColor} onChange={function (v) { return updatePuzzlePageColors({ puzzleColor: v }); }}/>
                <ColorInput label="Word List" value={colors.puzzlePage.wordListColor} onChange={function (v) { return updatePuzzlePageColors({ wordListColor: v }); }}/>
              </div>
            </div>

            {/* Answer Page Colors */}
            <div className="space-y-3">
              <label_1.Label className="text-sm font-medium">Answer Page</label_1.Label>
              <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                <ColorInput label="Background" value={colors.answerPage.backgroundColor} onChange={function (v) { return updateAnswerPageColors({ backgroundColor: v }); }}/>
                <BackgroundImageControl label="Answer Page" image={colors.answerPage.backgroundImage} opacity={colors.answerPage.backgroundImageOpacity} fit={colors.answerPage.backgroundImageFit} onImageChange={function (base64) { return updateAnswerPageColors({ backgroundImage: base64 }); }} onOpacityChange={function (v) { return updateAnswerPageColors({ backgroundImageOpacity: v }); }} onFitChange={function (v) { return updateAnswerPageColors({ backgroundImageFit: v }); }} onRemove={function () { return updateAnswerPageColors({ backgroundImage: undefined }); }}/>
                <ColorInput label="Title" value={colors.answerPage.titleColor} onChange={function (v) { return updateAnswerPageColors({ titleColor: v }); }}/>
                <ColorInput label="Box" value={colors.answerPage.boxColor} onChange={function (v) { return updateAnswerPageColors({ boxColor: v }); }}/>
              </div>
            </div>

            <button_1.Button variant="outline" onClick={function () { return updateColors({
                puzzlePage: { backgroundColor: '#ffffff', titleColor: '#1f2937', subtitleColor: '#6b7280', boxColor: '#1f2937', puzzleColor: '#1f2937', wordListTitleColor: '#374151', wordListColor: '#4b5563', backgroundImage: undefined, backgroundImageOpacity: 100, backgroundImageFit: 'cover' },
                answerPage: { backgroundColor: '#ffffff', titleColor: '#1f2937', boxColor: '#1f2937', lettersInSolutionColor: '#22c55e', lettersNotInSolutionColor: '#d1d5db', solutionStrokeThickness: 12, solutionStrokePadding: 2, solutionFrameColor: '#22c55e', solutionFrameStyle: 'rounded', solutionFrameRadius: 6, solutionHighlightAlpha: 30, onlyHighlightWordListWords: false, answerTitlePrefix: 'Solution', answerTitleFontFamily: 'Arial', answerTitleFontSize: 20, answerTitleAlignment: 'center', showAnswerNumber: true, backgroundImage: undefined, backgroundImageOpacity: 100, backgroundImageFit: 'cover' }
            }); }} className="w-full hover:bg-gradient-to-r hover:from-gray-100 hover:to-gray-200 dark:hover:from-slate-700 dark:hover:to-slate-600 transition-all duration-200 border-gray-300 dark:border-slate-600">
              Reset Colors
            </button_1.Button>
          </div>
        </tabs_1.TabsContent>

        {/* ==================== BOOK SETTINGS ==================== */}
        <tabs_1.TabsContent value="book" style={{ height: 'calc(100vh - 100px)', overflowY: 'auto' }} className={(0, utils_1.cn)('flex-1 min-h-0 p-4 space-y-6 bg-gradient-to-b from-white to-gray-50 dark:from-slate-800 dark:to-slate-850 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 m-2', collapsed && 'hidden')}>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-gray-900">Book Settings</h3>
              <button_1.Button variant="outline" size="sm" onClick={handleSave}>
                <lucide_react_1.Save className="w-4 h-4 mr-2"/>Save
              </button_1.Button>
            </div>

            {/* Quantity */}
            <div className="space-y-3">
              <label_1.Label className="text-sm font-medium">Quantity</label_1.Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label_1.Label className="text-xs text-gray-500">Number of Puzzles</label_1.Label>
                  <IntegerInput value={core.numberOfPuzzles} onChange={function (value) { return updateCore({ numberOfPuzzles: value }); }} min={1} max={1000}/>
                </div>
                <div>
                  <label_1.Label className="text-xs text-gray-500">Starting Number</label_1.Label>
                  <IntegerInput value={core.puzzlesStartingNumber} onChange={function (value) { return updateCore({ puzzlesStartingNumber: value }); }} min={1}/>
                </div>
              </div>
            </div>

            {/* Measurement Units */}
            <div className="space-y-1">
              <label_1.Label className="text-sm font-medium">Measurement Units</label_1.Label>
              <select_1.Select value={bookCanvas.measurementUnits || 'INCHES'} onValueChange={function (value) { return updateBookCanvas({ measurementUnits: value }); }}>
                <select_1.SelectTrigger><select_1.SelectValue /></select_1.SelectTrigger>
                <select_1.SelectContent>
                  <select_1.SelectItem value="INCHES">Inches</select_1.SelectItem>
                  <select_1.SelectItem value="CENTIMETERS">Centimeters</select_1.SelectItem>
                </select_1.SelectContent>
              </select_1.Select>
            </div>

            {/* Custom Trim Size */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <checkbox_1.Checkbox id="useCustomTrim" checked={bookCanvas.useCustomTrim} onCheckedChange={function (checked) { return updateBookCanvas({ useCustomTrim: checked === true }); }}/>
                <label_1.Label htmlFor="useCustomTrim" className="text-sm font-normal">Custom Trim Size</label_1.Label>
              </div>

              {bookCanvas.useCustomTrim && (<div className="pl-6 grid grid-cols-2 gap-3">
                  <div>
                    <label_1.Label className="text-xs text-gray-500">Width ({bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'})</label_1.Label>
                    <DecimalInput value={bookCanvas.measurementUnits === 'CENTIMETERS' ? (bookCanvas.customWidth || 0) * 2.54 : (bookCanvas.customWidth || 0)} onChange={function (val) {
                    var inchesValue = bookCanvas.measurementUnits === 'CENTIMETERS' ? val / 2.54 : val;
                    updateBookCanvas({ customWidth: inchesValue });
                }} placeholder={bookCanvas.measurementUnits === 'CENTIMETERS' ? '21.59' : '8.5'} min={0}/>
                  </div>
                  <div>
                    <label_1.Label className="text-xs text-gray-500">Length ({bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'})</label_1.Label>
                    <DecimalInput value={bookCanvas.measurementUnits === 'CENTIMETERS' ? (bookCanvas.customHeight || 0) * 2.54 : (bookCanvas.customHeight || 0)} onChange={function (val) {
                    var inchesValue = bookCanvas.measurementUnits === 'CENTIMETERS' ? val / 2.54 : val;
                    updateBookCanvas({ customHeight: inchesValue });
                }} placeholder={bookCanvas.measurementUnits === 'CENTIMETERS' ? '27.94' : '11'} min={0}/>
                  </div>
                </div>)}
            </div>

            {/* Trim Size */}
            {!bookCanvas.useCustomTrim && (<div className="space-y-2">
                <label_1.Label className="text-sm font-medium">Trim Size</label_1.Label>
                <select_1.Select value={bookCanvas.trimSizePreset || ''} onValueChange={function (value) {
                    if (value) {
                        // Set dimensions based on preset (in inches)
                        var presets = {
                            '5X8IN': { width: 5, height: 8 },
                            '5_25X8IN': { width: 5.25, height: 8 },
                            '5_5X8_5IN': { width: 5.5, height: 8.5 },
                            '6X9IN': { width: 6, height: 9 },
                            '5_06X7_81IN': { width: 5.06, height: 7.81 },
                            '6_14X9_21IN': { width: 6.14, height: 9.21 },
                            '6_69X9_61IN': { width: 6.69, height: 9.61 },
                            '7X10IN': { width: 7, height: 10 },
                            '7_44X9_69IN': { width: 7.44, height: 9.69 },
                            '7_5X9_25IN': { width: 7.5, height: 9.25 },
                            '8X10IN': { width: 8, height: 10 },
                            '8_5X11IN': { width: 8.5, height: 11 },
                            '8_27X11_69IN': { width: 8.27, height: 11.69 },
                            '8_25X6IN': { width: 8.25, height: 6 },
                            '8_25X8_25IN': { width: 8.25, height: 8.25 },
                            '8_5X8_5IN': { width: 8.5, height: 8.5 },
                        };
                        var dims = presets[value];
                        if (dims) {
                            updateBookCanvas({ trimSizePreset: value, customWidth: dims.width, customHeight: dims.height });
                        }
                    }
                }}>
                  <select_1.SelectTrigger><select_1.SelectValue placeholder="Select a trim size"/></select_1.SelectTrigger>
                  <select_1.SelectContent>
                    <select_1.SelectItem value="5X8IN">{bookCanvas.measurementUnits === 'CENTIMETERS' ? '12.7 x 20.32' : '5 x 8'} {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}</select_1.SelectItem>
                    <select_1.SelectItem value="5_25X8IN">{bookCanvas.measurementUnits === 'CENTIMETERS' ? '13.34 x 20.32' : '5.25 x 8'} {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}</select_1.SelectItem>
                    <select_1.SelectItem value="5_5X8_5IN">{bookCanvas.measurementUnits === 'CENTIMETERS' ? '13.97 x 21.59' : '5.5 x 8.5'} {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}</select_1.SelectItem>
                    <select_1.SelectItem value="6X9IN">{bookCanvas.measurementUnits === 'CENTIMETERS' ? '15.24 x 22.86' : '6 x 9'} {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}</select_1.SelectItem>
                    <select_1.SelectItem value="5_06X7_81IN">{bookCanvas.measurementUnits === 'CENTIMETERS' ? '12.85 x 19.84' : '5.06 x 7.81'} {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}</select_1.SelectItem>
                    <select_1.SelectItem value="6_14X9_21IN">{bookCanvas.measurementUnits === 'CENTIMETERS' ? '15.6 x 23.39' : '6.14 x 9.21'} {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}</select_1.SelectItem>
                    <select_1.SelectItem value="6_69X9_61IN">{bookCanvas.measurementUnits === 'CENTIMETERS' ? '16.99 x 24.4' : '6.69 x 9.61'} {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}</select_1.SelectItem>
                    <select_1.SelectItem value="7X10IN">{bookCanvas.measurementUnits === 'CENTIMETERS' ? '17.78 x 25.4' : '7 x 10'} {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}</select_1.SelectItem>
                    <select_1.SelectItem value="7_44X9_69IN">{bookCanvas.measurementUnits === 'CENTIMETERS' ? '18.9 x 24.61' : '7.44 x 9.69'} {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}</select_1.SelectItem>
                    <select_1.SelectItem value="7_5X9_25IN">{bookCanvas.measurementUnits === 'CENTIMETERS' ? '19.05 x 23.5' : '7.5 x 9.25'} {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}</select_1.SelectItem>
                    <select_1.SelectItem value="8X10IN">{bookCanvas.measurementUnits === 'CENTIMETERS' ? '20.32 x 25.4' : '8 x 10'} {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}</select_1.SelectItem>
                    <select_1.SelectItem value="8_5X11IN">{bookCanvas.measurementUnits === 'CENTIMETERS' ? '21.59 x 27.94' : '8.5 x 11'} {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}</select_1.SelectItem>
                    <select_1.SelectItem value="8_27X11_69IN">{bookCanvas.measurementUnits === 'CENTIMETERS' ? '21 x 29.7' : '8.27 x 11.69'} {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}</select_1.SelectItem>
                    <select_1.SelectItem value="8_25X6IN">{bookCanvas.measurementUnits === 'CENTIMETERS' ? '20.96 x 15.24' : '8.25 x 6'} {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}</select_1.SelectItem>
                    <select_1.SelectItem value="8_25X8_25IN">{bookCanvas.measurementUnits === 'CENTIMETERS' ? '20.96 x 20.96' : '8.25 x 8.25'} {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}</select_1.SelectItem>
                    <select_1.SelectItem value="8_5X8_5IN">{bookCanvas.measurementUnits === 'CENTIMETERS' ? '21.59 x 21.59' : '8.5 x 8.5'} {bookCanvas.measurementUnits === 'CENTIMETERS' ? 'cm' : 'in'}</select_1.SelectItem>
                  </select_1.SelectContent>
                </select_1.Select>
              </div>)}

            {/* Answers Per Page */}
            <div className="space-y-1">
              <label_1.Label className="text-sm font-medium">Answers Per Page</label_1.Label>
              <select_1.Select value={bookCanvas.answersPerPage.toString()} onValueChange={function (value) { return updateBookCanvas({ answersPerPage: parseInt(value) }); }}>
                <select_1.SelectTrigger><select_1.SelectValue /></select_1.SelectTrigger>
                <select_1.SelectContent>
                  {[1, 2, 4].map(function (n) { return <select_1.SelectItem key={n} value={n.toString()}>{n} Solution{n > 1 ? 's' : ''}</select_1.SelectItem>; })}
                </select_1.SelectContent>
              </select_1.Select>
            </div>

          </div>
        </tabs_1.TabsContent>
      </tabs_1.Tabs>) : null}
    </div>);
}
// Helper components
function CheckboxItem(_a) {
    var label = _a.label, checked = _a.checked, onCheckedChange = _a.onCheckedChange;
    return (<div className="flex items-center space-x-2">
      <checkbox_1.Checkbox id={label} checked={checked} onCheckedChange={onCheckedChange}/>
      <label_1.Label htmlFor={label} className="text-sm font-normal cursor-pointer">{label}</label_1.Label>
    </div>);
}
function DirectionCheckbox(_a) {
    var label = _a.label, checked = _a.checked, onCheckedChange = _a.onCheckedChange;
    return (<button onClick={function () { return onCheckedChange(!checked); }} className={"px-2 py-1.5 text-xs font-semibold rounded-lg border-2 transition-all duration-200 transform hover:scale-110 active:scale-95 ".concat(checked ? 'text-white' : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-slate-600 dark:hover:bg-slate-600')} style={checked ? { background: "linear-gradient(to right, #404040, #1a5a8c)", boxShadow: "0 0 12px rgba(34, 118, 180, 0.3)" } : {}}>
      {label}
    </button>);
}
