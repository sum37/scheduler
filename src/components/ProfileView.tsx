import { useState, useEffect, useCallback } from 'react';
import { Category } from '../types';
import { getWeekDays, formatDate } from '../utils';
import { format, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  getCategories,
  getWeeklyStats,
  getTimeBlocksForDate,
} from '../store';
import { useFirebase } from '../FirebaseContext';

interface ProfileViewProps {
  date: Date;
  weekStart: string;
}

// 테마 옵션
const THEMES = [
  { id: 'mint', name: '민트', emoji: '🌿', color: '#6ea89e' },
  { id: 'pink', name: '핑크', emoji: '🩷', color: '#c97390' },
  { id: 'blue', name: '블루', emoji: '💙', color: '#6a9ec9' },
  { id: 'yellow', name: '옐로우', emoji: '💛', color: '#c9a86a' },
  { id: 'purple', name: '퍼플', emoji: '💜', color: '#a06ac4' },
];

const THEME_STORAGE_KEY = 'calendar_theme';

export default function ProfileView({ date, weekStart }: ProfileViewProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<{ categoryId: string; hours: number }[]>([]);
  const weekDays = getWeekDays(date);
  
  // 테마 상태
  const [currentTheme, setCurrentTheme] = useState<string>(() => {
    return localStorage.getItem(THEME_STORAGE_KEY) || 'mint';
  });
  
  // Firebase 공유 관련
  const { isConnected, roomCode, roomUsers, currentUser, logout, createRoom, joinRoom, leaveRoom } = useFirebase();
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [showCopySuccess, setShowCopySuccess] = useState(false);

  // 테마 적용
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
  }, [currentTheme]);

  // 초기 테마 로드
  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'mint';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const handleThemeChange = (themeId: string) => {
    setCurrentTheme(themeId);
    if (navigator.vibrate) navigator.vibrate(30);
  };

  const loadData = useCallback(() => {
    setCategories(getCategories());
    setStats(getWeeklyStats(weekStart));
  }, [weekStart]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getCategoryById = (id: string): Category | undefined => {
    return categories.find(c => c.id === id);
  };

  const totalHours = stats.reduce((sum, s) => sum + s.hours, 0);
  const maxHours = Math.max(...stats.map(s => s.hours), 1);

  // 공유 룸 생성
  const handleCreateRoom = async () => {
    setIsCreatingRoom(true);
    try {
      const code = await createRoom();
      if (navigator.vibrate) navigator.vibrate(50);
      // 자동으로 클립보드에 복사
      await navigator.clipboard.writeText(code);
      setShowCopySuccess(true);
      setTimeout(() => setShowCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to create room:', error);
      alert('공유 생성에 실패했습니다. Firebase 설정을 확인해주세요.');
    }
    setIsCreatingRoom(false);
  };

  // 공유 룸 참가
  const handleJoinRoom = async () => {
    if (!joinCodeInput.trim()) return;
    setIsJoiningRoom(true);
    try {
      const success = await joinRoom(joinCodeInput);
      if (success) {
        if (navigator.vibrate) navigator.vibrate(50);
        setJoinCodeInput('');
      } else {
        alert('코드가 올바르지 않습니다.');
      }
    } catch (error) {
      console.error('Failed to join room:', error);
      alert('참가에 실패했습니다.');
    }
    setIsJoiningRoom(false);
  };

  // 코드 복사
  const handleCopyCode = async () => {
    if (roomCode) {
      await navigator.clipboard.writeText(roomCode);
      setShowCopySuccess(true);
      if (navigator.vibrate) navigator.vibrate(30);
      setTimeout(() => setShowCopySuccess(false), 2000);
    }
  };

  // Get daily category breakdown (30분 단위)
  const getDailyStats = (dayDate: Date) => {
    const dateStr = formatDate(dayDate);
    const blocks = getTimeBlocksForDate(dateStr);
    const categoryCount: Record<string, number> = {};
    
    blocks.forEach(block => {
      if (block.categoryId) {
        categoryCount[block.categoryId] = (categoryCount[block.categoryId] || 0) + 0.5;
      }
    });

    return Object.entries(categoryCount).map(([categoryId, hours]) => ({
      categoryId,
      hours,
    }));
  };

  return (
    <div className="animate-fade-in">
      {/* Sync Section - 가장 위로 */}
      <section className="card">
        <h2 className="card-title">
          <span>🔗</span>
          캘린더 공유
        </h2>
        
        {roomCode ? (
          // 연결됨
          <div className="sync-section">
            <div className="sync-status connected">
              <span className="sync-status-dot" />
              <span>{isConnected ? '실시간 동기화 중' : '연결 중...'}</span>
            </div>
            
            <div className="sync-code-display">
              <span className="sync-code-label">공유 코드</span>
              <div className="sync-code-value" onClick={handleCopyCode}>
                <span className="sync-code-text">{roomCode}</span>
                <span className="sync-copy-icon">{showCopySuccess ? '✓' : '📋'}</span>
              </div>
              {showCopySuccess && (
                <span className="sync-copy-toast">복사됨!</span>
              )}
            </div>
            
            <p className="sync-hint">
              💕 상대방에게 이 코드를 공유하세요!
            </p>
            
            {roomUsers.length > 0 && (
              <div className="sync-users">
                <div className="sync-users-label">참가자 ({roomUsers.length}명)</div>
                <div className="sync-users-list">
                  {roomUsers.map(user => (
                    <div 
                      key={user.id} 
                      className="sync-user-item"
                      style={{ borderColor: user.color }}
                    >
                      <span 
                        className="sync-user-dot" 
                        style={{ backgroundColor: user.color }}
                      />
                      <span className="sync-user-name">
                        {user.name || '이름 없음'}
                        {user.id === currentUser?.id && ' (나)'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <button 
              className="sync-leave-btn"
              onClick={leaveRoom}
            >
              공유 해제
            </button>
          </div>
        ) : (
          // 연결 안됨
          <div className="sync-section">
            <p className="sync-description">
              커플, 가족, 친구와 캘린더를 실시간으로 공유하세요!
            </p>
            
            <div className="sync-actions">
              <button 
                className="sync-create-btn"
                onClick={handleCreateRoom}
                disabled={isCreatingRoom}
              >
                {isCreatingRoom ? '생성 중...' : '✨ 새 공유 만들기'}
              </button>
              
              <div className="sync-divider">
                <span>또는</span>
              </div>
              
              <div className="sync-join-section">
                <input
                  type="text"
                  className="sync-join-input"
                  placeholder="공유 코드 입력"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  maxLength={6}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleJoinRoom();
                  }}
                />
                <button 
                  className="sync-join-btn"
                  onClick={handleJoinRoom}
                  disabled={isJoiningRoom || !joinCodeInput.trim()}
                >
                  {isJoiningRoom ? '...' : '참가'}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Profile Section */}
      <section className="card">
        <h2 className="card-title">
          <span>👤</span>
          프로필
        </h2>
        
        <div className="profile-section">
          <div className="profile-item">
            <label className="profile-label">이름</label>
            <div className="profile-name-display" style={{ cursor: 'default' }}>
              <span style={{ 
                display: 'inline-block',
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: currentUser?.color || 'var(--accent-primary)',
                marginRight: 8
              }} />
              {currentUser?.name || ''}
            </div>
          </div>
        </div>
      </section>

      {/* Theme Selection */}
      <section className="card">
        <h2 className="card-title">
          <span>🎨</span>
          테마 색상
        </h2>
        
        <div style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}>
          {THEMES.map(theme => (
            <button
              key={theme.id}
              onClick={() => handleThemeChange(theme.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                padding: '16px 20px',
                background: currentTheme === theme.id ? theme.color + '20' : 'var(--bg-tertiary)',
                border: currentTheme === theme.id ? `2px solid ${theme.color}` : '2px solid transparent',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                minWidth: 70,
              }}
            >
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                backgroundColor: theme.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                boxShadow: currentTheme === theme.id 
                  ? `0 0 16px ${theme.color}50` 
                  : 'none',
              }}>
                {theme.emoji}
              </div>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: currentTheme === theme.id ? 600 : 400,
                color: currentTheme === theme.id ? theme.color : 'var(--text-secondary)',
              }}>
                {theme.name}
              </span>
              {currentTheme === theme.id && (
                <span style={{
                  fontSize: '0.625rem',
                  color: theme.color,
                  fontWeight: 500,
                }}>
                  ✓ 선택됨
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Weekly Total */}
      <section className="card">
        <h2 className="card-title">
          <span>📊</span>
          주간 통계
        </h2>
        
        {stats.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📈</div>
            <div className="empty-state-text">아직 기록된 시간이 없습니다</div>
          </div>
        ) : (
          <>
            <div className="stats-chart">
              {stats
                .sort((a, b) => b.hours - a.hours)
                .map(stat => {
                  const category = getCategoryById(stat.categoryId);
                  if (!category) return null;
                  const percentage = (stat.hours / maxHours) * 100;
                  
                  return (
                    <div key={stat.categoryId} className="stats-bar-container">
                      <div className="stats-bar-label">
                        <span className="stats-bar-label-icon">{category.icon}</span>
                        <span>{category.name}</span>
                      </div>
                      <div className="stats-bar-wrapper">
                        <div
                          className="stats-bar"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: category.color,
                          }}
                        />
                      </div>
                      <span className="stats-bar-hours">{stat.hours % 1 === 0 ? stat.hours : stat.hours.toFixed(1)}h</span>
                    </div>
                  );
                })}
            </div>
            
            <div className="stats-total">
              <span className="stats-total-label">총 기록 시간</span>
              <span className="stats-total-value">{totalHours % 1 === 0 ? totalHours : totalHours.toFixed(1)}시간</span>
            </div>
          </>
        )}
      </section>

      {/* Daily Breakdown */}
      <section className="card">
        <h2 className="card-title">
          <span>📅</span>
          일별 현황
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {weekDays.map(dayDate => {
            const dayStats = getDailyStats(dayDate);
            const dayTotal = dayStats.reduce((sum, s) => sum + s.hours, 0);
            
            return (
              <div 
                key={dayDate.toISOString()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px',
                  background: isToday(dayDate) ? 'var(--accent-glow)' : 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-md)',
                  borderLeft: isToday(dayDate) ? '3px solid var(--accent-primary)' : 'none',
                }}
              >
                <div style={{ 
                  minWidth: 50, 
                  textAlign: 'center',
                }}>
                  <div style={{ 
                    fontSize: '0.625rem', 
                    color: 'var(--text-muted)',
                    marginBottom: 2,
                  }}>
                    {format(dayDate, 'EEE', { locale: ko })}
                  </div>
                  <div style={{ 
                    fontSize: '1rem', 
                    fontWeight: 500,
                    color: isToday(dayDate) ? 'var(--accent-primary)' : 'var(--text-primary)',
                  }}>
                    {format(dayDate, 'd')}
                  </div>
                </div>
                
                <div style={{ 
                  flex: 1, 
                  display: 'flex', 
                  gap: 4, 
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}>
                  {dayTotal === 0 ? (
                    <span style={{ 
                      fontSize: '0.75rem', 
                      color: 'var(--text-muted)',
                      fontStyle: 'italic',
                    }}>
                      기록 없음
                    </span>
                  ) : (
                    dayStats
                      .sort((a, b) => b.hours - a.hours)
                      .map(stat => {
                        const category = getCategoryById(stat.categoryId);
                        if (!category) return null;
                        return (
                          <div
                            key={stat.categoryId}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '4px 8px',
                              background: category.color + '30',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.75rem',
                            }}
                          >
                            <span>{category.icon}</span>
                            <span style={{ color: category.color, fontWeight: 500 }}>
                              {stat.hours % 1 === 0 ? stat.hours : stat.hours.toFixed(1)}h
                            </span>
                          </div>
                        );
                      })
                  )}
                </div>
                
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.875rem',
                  color: dayTotal > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: 500,
                }}>
                  {dayTotal % 1 === 0 ? dayTotal : dayTotal.toFixed(1)}h
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Pie Chart Visual */}
      {stats.length > 0 && (
        <section className="card">
          <h2 className="card-title">
            <span>🥧</span>
            카테고리별 비율
          </h2>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            {stats
              .sort((a, b) => b.hours - a.hours)
              .map(stat => {
                const category = getCategoryById(stat.categoryId);
                if (!category) return null;
                const percentage = Math.round((stat.hours / totalHours) * 100);
                
                return (
                  <div 
                    key={stat.categoryId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      backgroundColor: category.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1rem',
                    }}>
                      {category.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontSize: '0.875rem', 
                        fontWeight: 500,
                        marginBottom: 4,
                      }}>
                        {category.name}
                      </div>
                      <div style={{
                        height: 6,
                        background: 'var(--bg-secondary)',
                        borderRadius: 3,
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${percentage}%`,
                          backgroundColor: category.color,
                          borderRadius: 3,
                          transition: 'width 0.5s ease',
                        }} />
                      </div>
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      color: category.color,
                      minWidth: 45,
                      textAlign: 'right',
                    }}>
                      {percentage}%
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {/* 로그아웃 섹션 */}
      <section style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--border-light)' }}>
        <button className="logout-button" onClick={logout}>
          로그아웃
        </button>
        <p style={{ 
          fontSize: '0.75rem', 
          color: 'var(--text-muted)', 
          textAlign: 'center',
          marginTop: 8 
        }}>
          로그아웃하면 이름과 공유 정보가 삭제됩니다
        </p>
      </section>
    </div>
  );
}


