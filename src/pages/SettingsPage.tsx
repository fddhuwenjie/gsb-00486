import { useState, useEffect } from 'react';
import {
  Settings,
  Globe,
  Ruler,
  ChevronRight,
  Check,
} from 'lucide-react';
import type { Language, UnitSystem } from '@shared/types';

const languages: { code: Language; label: string; flag: string }[] = [
  { code: 'zh', label: '简体中文', flag: '🇨🇳' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
];

const unitSystems: { system: UnitSystem; label: string; description: string }[] = [
  { system: 'metric', label: '公制', description: '克、毫升、摄氏度' },
  { system: 'imperial', label: '英制', description: '盎司、杯、华氏度' },
];

export default function SettingsPage() {
  const [language, setLanguage] = useState<Language>('zh');
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedLang = localStorage.getItem('language') as Language;
    const savedUnit = localStorage.getItem('unitSystem') as UnitSystem;
    if (savedLang) setLanguage(savedLang);
    if (savedUnit) setUnitSystem(savedUnit);
  }, []);

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('language', lang);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleUnitSystemChange = (system: UnitSystem) => {
    setUnitSystem(system);
    localStorage.setItem('unitSystem', system);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
          <Settings className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">设置</h1>
          <p className="text-gray-500 text-sm">个性化你的体验</p>
        </div>
      </div>

      {saved && (
        <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
          <Check className="w-4 h-4" />
          设置已保存
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-orange-500" />
            <h2 className="font-bold text-gray-800">语言</h2>
          </div>
        </div>

        <div className="divide-y divide-gray-50">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{lang.flag}</span>
                <span className="font-medium text-gray-700">{lang.label}</span>
              </div>
              {language === lang.code ? (
                <Check className="w-5 h-5 text-orange-500" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-300" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <Ruler className="w-5 h-5 text-orange-500" />
            <h2 className="font-bold text-gray-800">度量衡单位</h2>
          </div>
        </div>

        <div className="divide-y divide-gray-50">
          {unitSystems.map((system) => (
            <button
              key={system.system}
              onClick={() => handleUnitSystemChange(system.system)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
            >
              <div>
                <p className="font-medium text-gray-700">{system.label}</p>
                <p className="text-sm text-gray-400 mt-0.5">{system.description}</p>
              </div>
              {unitSystem === system.system ? (
                <Check className="w-5 h-5 text-orange-500 flex-shrink-0" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gray-50 rounded-2xl p-5">
        <p className="text-sm text-gray-500 text-center">
          味知食谱 v1.0 · 用心烹饪每一道菜
        </p>
      </div>
    </div>
  );
}
