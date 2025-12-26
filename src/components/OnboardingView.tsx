import { useState } from 'react';

interface OnboardingViewProps {
  onLogin: (name: string) => Promise<{ success: boolean; error?: string }>;
  onRegister: (name: string) => Promise<{ success: boolean; error?: string }>;
}

type Mode = 'login' | 'register';

export default function OnboardingView({ onLogin, onRegister }: OnboardingViewProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const result = mode === 'login' 
        ? await onLogin(name.trim())
        : await onRegister(name.trim());
      
      if (!result.success) {
        setError(result.error || '오류가 발생했습니다');
        setIsSubmitting(false);
      }
      // 성공하면 App에서 자동으로 화면 전환됨
    } catch (err) {
      setError('네트워크 오류가 발생했습니다');
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError(null);
    setName('');
  };

  return (
    <div className="onboarding-container">
      <div className="onboarding-card">
        <div className="onboarding-icon">📅</div>
        <h1 className="onboarding-title">
          {mode === 'login' ? '다시 만나서 반가워요!' : '처음 오셨군요!'}
        </h1>
        <p className="onboarding-subtitle">
          {mode === 'login' 
            ? '등록된 이름으로 로그인하세요'
            : '사용할 이름을 등록하세요'
          }
        </p>

        {/* 모드 전환 탭 */}
        <div className="onboarding-tabs">
          <button 
            className={`onboarding-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); setError(null); }}
            type="button"
          >
            로그인
          </button>
          <button 
            className={`onboarding-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => { setMode('register'); setError(null); }}
            type="button"
          >
            새 계정
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="onboarding-form">
          <div className="onboarding-input-wrapper">
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              placeholder={mode === 'login' ? '등록된 이름' : '새로운 이름'}
              className={`onboarding-input ${error ? 'error' : ''}`}
              autoFocus
              maxLength={20}
            />
            {error && (
              <div className="onboarding-error">
                {error}
              </div>
            )}
          </div>
          
          <button 
            type="submit" 
            className="onboarding-button"
            disabled={!name.trim() || isSubmitting}
          >
            {isSubmitting 
              ? (mode === 'login' ? '로그인 중...' : '등록 중...') 
              : (mode === 'login' ? '로그인' : '계정 만들기')
            }
          </button>
        </form>
        
        <p className="onboarding-hint">
          {mode === 'login' 
            ? <>계정이 없으신가요? <span className="onboarding-link" onClick={toggleMode}>새 계정 만들기</span></>
            : <>이미 계정이 있으신가요? <span className="onboarding-link" onClick={toggleMode}>로그인</span></>
          }
        </p>
      </div>
    </div>
  );
}
