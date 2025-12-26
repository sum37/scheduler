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

interface StatsViewProps {
  date: Date;
  weekStart: string;
}

export default function StatsView({ date, weekStart }: StatsViewProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<{ categoryId: string; hours: number }[]>([]);
  const weekDays = getWeekDays(date);

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

  // Get daily category breakdown (30분 단위)
  const getDailyStats = (dayDate: Date) => {
    const dateStr = formatDate(dayDate);
    const blocks = getTimeBlocksForDate(dateStr);
    const categoryCount: Record<string, number> = {};
    
    blocks.forEach(block => {
      if (block.categoryId) {
        // 30분 단위이므로 0.5시간씩 추가
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
    </div>
  );
}

