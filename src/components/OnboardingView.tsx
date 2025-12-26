import { useState } from 'react';

interface OnboardingViewProps {
  onComplete: (name: string) => void;
}

export default function OnboardingView({ onComplete }: OnboardingViewProps) {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setIsSubmitting(true);
    onComplete(name.trim());
  };

  return (
    <div className="onboarding-container">
      <div className="onboarding-card">
        <div className="onboarding-icon">📅</div>
        <h1 className="onboarding-title">환영합니다!</h1>
        <p className="onboarding-subtitle">
          일정을 관리하고 공유할 수 있는<br />
          스케줄러입니다
        </p>
        
        <form onSubmit={handleSubmit} className="onboarding-form">
          <div className="onboarding-input-wrapper">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름을 입력하세요"
              className="onboarding-input"
              autoFocus
              maxLength={20}
            />
          </div>
          
          <button 
            type="submit" 
            className="onboarding-button"
            disabled={!name.trim() || isSubmitting}
          >
            {isSubmitting ? '시작하는 중...' : '시작하기'}
          </button>
        </form>
        
        <p className="onboarding-hint">
          이 이름은 일정을 공유할 때 상대방에게 보여집니다
        </p>
      </div>
    </div>
  );
}

