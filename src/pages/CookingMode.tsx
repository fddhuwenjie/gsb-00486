import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  X,
  Clock,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { Recipe, RecipeStep } from '@shared/types';

export default function CookingMode() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);

  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadRecipe();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (speechSynthesis.speaking) speechSynthesis.cancel();
    };
  }, [id]);

  useEffect(() => {
    if (recipe && recipe.steps.length > 0) {
      const step = recipe.steps[currentStep];
      const extracted = extractMinutes(step.description);
      setTimerSeconds(extracted * 60);
      setTimerRunning(false);
    }
  }, [currentStep, recipe]);

  useEffect(() => {
    if (timerRunning && timerSeconds > 0) {
      timerRef.current = window.setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            setTimerRunning(false);
            playBeep();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning]);

  const loadRecipe = async () => {
    try {
      const data = await api.recipes.get(Number(id));
      setRecipe(data);
    } catch {
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const extractMinutes = (text: string): number => {
    const match = text.match(/(\d+)\s*(分钟|分|min|minutes?)/i);
    return match ? parseInt(match[1], 10) : 5;
  };

  const playBeep = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);

      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 1000;
        osc2.type = 'sine';
        gain2.gain.setValueAtTime(0.3, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc2.start(ctx.currentTime);
        osc2.stop(ctx.currentTime + 0.5);
      }, 600);
    } catch {}
  }, []);

  const toggleTimer = () => {
    setTimerRunning((prev) => !prev);
  };

  const resetTimer = () => {
    setTimerRunning(false);
    if (recipe) {
      const step = recipe.steps[currentStep];
      const extracted = extractMinutes(step.description);
      setTimerSeconds(extracted * 60);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const speakStep = () => {
    if (!recipe) return;
    const step = recipe.steps[currentStep];

    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(step.description);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.9;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    setSpeaking(true);
    speechSynthesis.speak(utterance);
  };

  const goToPrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const goToNextStep = () => {
    if (recipe && currentStep < recipe.steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleTouchStart = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    handleTouchStart.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (handleTouchStart.current === null) return;
    const diff = handleTouchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        goToNextStep();
      } else {
        goToPrevStep();
      }
    }
    handleTouchStart.current = null;
  };

  if (loading || !recipe) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  const step: RecipeStep = recipe.steps[currentStep];
  const progress = ((currentStep + 1) / recipe.steps.length) * 100;
  const timerProgress = timerSeconds > 0
    ? 100 - (timerSeconds / (extractMinutes(step.description) * 60)) * 100
    : 0;

  return (
    <div
      className="fixed inset-0 bg-gray-900 text-white flex flex-col"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800/50 backdrop-blur-sm">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        <div className="text-center">
          <p className="text-xs text-gray-400">步骤 {currentStep + 1} / {recipe.steps.length}</p>
          <p className="text-sm font-medium truncate max-w-[200px]">{recipe.title}</p>
        </div>
        <button
          onClick={speakStep}
          className={`p-2 rounded-full transition-colors ${
            speaking ? 'bg-orange-500 text-white' : 'hover:bg-white/10'
          }`}
        >
          <Volume2 className="w-6 h-6" />
        </button>
      </div>

      <div className="h-1 bg-gray-700">
        <div
          className="h-full bg-orange-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {step.imageUrl && (
          <div className="relative h-1/3 min-h-[200px] bg-gray-800">
            <img
              src={step.imageUrl}
              alt={`步骤${step.order}`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent" />
          </div>
        )}

        <div className="flex-1 flex flex-col justify-center px-6 py-8 overflow-y-auto">
          <div className="mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500/20 text-orange-400 rounded-full text-sm font-medium">
              <span className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold">
                {step.order}
              </span>
              第 {step.order} 步
            </span>
          </div>

          <p className="text-2xl sm:text-3xl font-medium leading-relaxed text-gray-100">
            {step.description}
          </p>
        </div>
      </div>

      <div className="bg-gray-800/50 backdrop-blur-sm px-4 py-4">
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-400" />
            <span className="text-3xl font-mono font-bold tabular-nums">
              {formatTime(timerSeconds)}
            </span>
          </div>
        </div>

        <div className="h-1.5 bg-gray-700 rounded-full mb-4 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              timerSeconds === 0 ? 'bg-green-500' : 'bg-orange-500'
            }`}
            style={{ width: `${timerProgress}%` }}
          />
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={resetTimer}
            className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          <button
            onClick={toggleTimer}
            className={`p-5 rounded-full transition-colors ${
              timerRunning
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-orange-500 hover:bg-orange-600'
            }`}
          >
            {timerRunning ? (
              <Pause className="w-7 h-7" />
            ) : (
              <Play className="w-7 h-7 ml-0.5" />
            )}
          </button>
          <button
            onClick={() => {
              const mins = extractMinutes(step.description);
              setTimerSeconds(mins * 60);
            }}
            className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
          >
            <Clock className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3 bg-gray-800/80">
        <button
          onClick={goToPrevStep}
          disabled={currentStep === 0}
          className={`flex items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
            currentStep === 0
              ? 'text-gray-600 cursor-not-allowed'
              : 'hover:bg-white/10'
          }`}
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm">上一步</span>
        </button>

        <div className="flex gap-1.5">
          {recipe.steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentStep(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === currentStep
                  ? 'w-6 bg-orange-500'
                  : i < currentStep
                    ? 'bg-orange-300'
                    : 'bg-gray-600'
              }`}
            />
          ))}
        </div>

        <button
          onClick={goToNextStep}
          disabled={currentStep === recipe.steps.length - 1}
          className={`flex items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
            currentStep === recipe.steps.length - 1
              ? 'text-gray-600 cursor-not-allowed'
              : 'hover:bg-white/10'
          }`}
        >
          <span className="text-sm">下一步</span>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
