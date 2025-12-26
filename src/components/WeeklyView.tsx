import { useState, useEffect, useMemo, useRef } from 'react';
import { WeeklyGoal } from '../types';
import { getWeekDays, formatDate, generateId } from '../utils';
import { format, isToday, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useFirebase } from '../FirebaseContext';

interface WeeklyViewProps {
  date: Date;
  weekStart: string;
  onDateSelect: (date: Date) => void;
}

interface DragState {
  isDragging: boolean;
  goalId: string | null;
  goalText: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export default function WeeklyView({ date, weekStart, onDateSelect }: WeeklyViewProps) {
  const [newGoalText, setNewGoalText] = useState('');
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    goalId: null,
    goalText: '',
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
  });
  const [dropTargetDate, setDropTargetDate] = useState<Date | null>(null);
  const [showCopiedFeedback, setShowCopiedFeedback] = useState<string | null>(null);
  
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dayRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const weekDays = getWeekDays(date);

  // Firebase에서 실시간 데이터 가져오기
  const { 
    data, 
    addWeeklyGoal, 
    updateWeeklyGoal, 
    deleteWeeklyGoal,
    addTodo 
  } = useFirebase();
  
  // 해당 주의 목표만 필터링
  const goals = useMemo(() => 
    data.weeklyGoals.filter(g => g.weekStart === weekStart).sort((a, b) => a.order - b.order),
    [data.weeklyGoals, weekStart]
  );
  
  // 날짜별 데이터 가져오기
  const getTodosForDate = (dateStr: string) => 
    data.todos.filter(t => t.date === dateStr);
  
  const getTimeBlocksForDate = (dateStr: string) => 
    data.timeBlocks.filter(b => b.date === dateStr);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  const handleAddGoal = () => {
    if (!newGoalText.trim()) return;
    const goal: WeeklyGoal = {
      id: generateId(),
      weekStart,
      text: newGoalText.trim(),
      completed: false,
      order: goals.length,
    };
    addWeeklyGoal(goal);
    setNewGoalText('');
  };

  const handleToggleGoal = (goal: WeeklyGoal) => {
    if (dragState.isDragging) return;
    updateWeeklyGoal({ ...goal, completed: !goal.completed });
  };

  const handleDeleteGoal = (id: string) => {
    deleteWeeklyGoal(id);
  };

  // Long press handlers for drag
  const handleTouchStart = (e: React.TouchEvent, goal: WeeklyGoal) => {
    const touch = e.touches[0];
    longPressTimer.current = setTimeout(() => {
      // Strong haptic feedback when drag mode activates
      if (navigator.vibrate) {
        navigator.vibrate([100, 30, 100]); // 강한 패턴 진동: 틱-틱
      }
      setDragState({
        isDragging: true,
        goalId: goal.id,
        goalText: goal.text,
        startX: touch.clientX,
        startY: touch.clientY,
        currentX: touch.clientX,
        currentY: touch.clientY,
      });
    }, 400); // 400ms long press (조금 더 빠르게)
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (!dragState.isDragging) return;

    const touch = e.touches[0];
    setDragState(prev => ({
      ...prev,
      currentX: touch.clientX,
      currentY: touch.clientY,
    }));

    // Check if over any day button
    let foundTarget: Date | null = null;
    dayRefs.current.forEach((element, dateStr) => {
      const rect = element.getBoundingClientRect();
      if (
        touch.clientX >= rect.left &&
        touch.clientX <= rect.right &&
        touch.clientY >= rect.top &&
        touch.clientY <= rect.bottom
      ) {
        foundTarget = new Date(dateStr);
      }
    });
    
    // Haptic when entering a drop target
    if (foundTarget && !dropTargetDate) {
      if (navigator.vibrate) {
        navigator.vibrate(30); // 짧은 틱 - 날짜 위에 올렸을 때
      }
    }
    setDropTargetDate(foundTarget);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (dragState.isDragging && dropTargetDate && dragState.goalText) {
      // Copy goal to the target date's todo list
      const targetDateStr = formatDate(dropTargetDate);
      const existingTodos = getTodosForDate(targetDateStr);
      
      const newTodo = {
        id: generateId(),
        date: targetDateStr,
        text: dragState.goalText,
        completed: false,
        order: existingTodos.length,
      };
      
      addTodo(newTodo);
      
      // Show feedback
      setShowCopiedFeedback(targetDateStr);
      setTimeout(() => setShowCopiedFeedback(null), 1500);
      
      // Success haptic - 성공적으로 복사됨
      if (navigator.vibrate) {
        navigator.vibrate([50, 100, 50, 100, 50]); // 트리플 틱 - 성공!
      }
    }

    setDragState({
      isDragging: false,
      goalId: null,
      goalText: '',
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
    });
    setDropTargetDate(null);
  };

  // Mouse handlers for desktop
  const handleMouseDown = (e: React.MouseEvent, goal: WeeklyGoal) => {
    longPressTimer.current = setTimeout(() => {
      setDragState({
        isDragging: true,
        goalId: goal.id,
        goalText: goal.text,
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
      });
    }, 500);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (longPressTimer.current && !dragState.isDragging) {
      // Cancel long press if moved too much before trigger
      const target = e.target as HTMLElement;
      if (target) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }

    if (!dragState.isDragging) return;

    setDragState(prev => ({
      ...prev,
      currentX: e.clientX,
      currentY: e.clientY,
    }));

    // Check if over any day button
    let foundTarget: Date | null = null;
    dayRefs.current.forEach((element, dateStr) => {
      const rect = element.getBoundingClientRect();
      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        foundTarget = new Date(dateStr);
      }
    });
    setDropTargetDate(foundTarget);
  };

  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (dragState.isDragging && dropTargetDate && dragState.goalText) {
      const targetDateStr = formatDate(dropTargetDate);
      const existingTodos = getTodosForDate(targetDateStr);
      
      const newTodo = {
        id: generateId(),
        date: targetDateStr,
        text: dragState.goalText,
        completed: false,
        order: existingTodos.length,
      };
      
      addTodo(newTodo);
      
      setShowCopiedFeedback(targetDateStr);
      setTimeout(() => setShowCopiedFeedback(null), 1500);
    }

    setDragState({
      isDragging: false,
      goalId: null,
      goalText: '',
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
    });
    setDropTargetDate(null);
  };

  // Get daily summary
  const getDaySummary = (dayDate: Date) => {
    const dateStr = formatDate(dayDate);
    const todos = getTodosForDate(dateStr);
    const blocks = getTimeBlocksForDate(dateStr);
    const completedTodos = todos.filter(t => t.completed).length;
    const filledBlocks = blocks.filter(b => b.categoryId).length;
    
    return {
      todos,
      todoCount: todos.length,
      completedTodos,
      filledBlocks,
    };
  };

  return (
    <div 
      className="animate-fade-in"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Week Days - Drop Targets */}
      <section className="card">
        <h2 className="card-title">
          이번 주
          {dragState.isDragging && (
            <span style={{ 
              marginLeft: 8, 
              fontSize: '0.75rem', 
              color: 'var(--accent-primary)',
              fontWeight: 400,
            }}>
              ↑ 날짜에 드롭하세요
            </span>
          )}
        </h2>
        <div className="week-days-header">
          {weekDays.map(dayDate => {
            const dateStr = formatDate(dayDate);
            const summary = getDaySummary(dayDate);
            const isDropTarget = dropTargetDate && isSameDay(dayDate, dropTargetDate);
            const justCopied = showCopiedFeedback === dateStr;
            
            return (
              <button
                key={dayDate.toISOString()}
                ref={(el) => {
                  if (el) dayRefs.current.set(dateStr, el);
                }}
                className={`week-day-item ${isToday(dayDate) ? 'today' : ''} ${isSameDay(dayDate, date) ? 'selected' : ''}`}
                onClick={() => !dragState.isDragging && onDateSelect(dayDate)}
                style={{
                  transform: isDropTarget ? 'scale(1.1)' : 'scale(1)',
                  boxShadow: isDropTarget ? '0 0 20px var(--accent-primary)' : 'none',
                  border: isDropTarget ? '2px solid var(--accent-primary)' : 'none',
                  transition: 'all 0.2s ease',
                  background: justCopied ? 'var(--success)' : isDropTarget ? 'var(--accent-glow)' : undefined,
                }}
              >
                <span className="week-day-name">
                  {format(dayDate, 'EEE', { locale: ko })}
                </span>
                <span className="week-day-number">
                  {format(dayDate, 'd')}
                </span>
                {justCopied ? (
                  <span style={{ fontSize: '0.75rem', marginTop: 4 }}>✓</span>
                ) : (
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: 2, 
                    marginTop: 6,
                    width: '100%',
                    minWidth: 0,
                    flex: 1,
                    overflow: 'hidden',
                  }}>
                    {summary.todos.slice(0, 7).map((todo) => (
                      <div
                        key={todo.id}
                        style={{
                          fontSize: '0.5rem',
                          color: todo.completed ? 'var(--text-muted)' : 'var(--text-secondary)',
                          textDecoration: todo.completed ? 'line-through' : 'none',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          textAlign: 'center',
                          padding: '1px 2px',
                          background: todo.completed ? 'transparent' : 'rgba(213, 105, 137, 0.1)',
                          borderRadius: 2,
                          maxWidth: '100%',
                        }}
                      >
                        {todo.text}
                      </div>
                    ))}
                    {summary.todos.length > 7 && (
                      <div style={{ 
                        fontSize: '0.5rem', 
                        color: 'var(--text-muted)',
                        textAlign: 'center',
                      }}>
                        +{summary.todos.length - 7}
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Weekly Goals - Draggable */}
      <section className="card">
        <h2 className="card-title">
          <span>🎯</span>
          주간 목표
          <span style={{ 
            marginLeft: 'auto', 
            fontSize: '0.6875rem', 
            color: 'var(--text-muted)',
            fontWeight: 400,
          }}>
            길게 눌러서 날짜로 드래그
          </span>
        </h2>
        <div className="weekly-goals">
          {goals.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🎯</div>
              <div className="empty-state-text">이번 주 목표를 설정해보세요</div>
            </div>
          ) : (
            goals.map(goal => (
              <div 
                key={goal.id} 
                className={`todo-item ${goal.completed ? 'completed' : ''}`}
                style={{
                  opacity: dragState.goalId === goal.id ? 0.4 : 1,
                  cursor: 'grab',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  touchAction: 'none',
                  transform: dragState.goalId === goal.id ? 'scale(0.95)' : 'scale(1)',
                  background: dragState.goalId === goal.id ? 'var(--accent-glow)' : undefined,
                  borderLeft: dragState.goalId === goal.id ? '3px solid var(--accent-primary)' : undefined,
                  transition: 'all 0.2s ease',
                }}
                onTouchStart={(e) => handleTouchStart(e, goal)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={(e) => handleMouseDown(e, goal)}
              >
                <div
                  className={`todo-checkbox ${goal.completed ? 'checked' : ''}`}
                  onClick={() => handleToggleGoal(goal)}
                >
                  {goal.completed && '✓'}
                </div>
                <span className={`todo-text ${goal.completed ? 'completed' : ''}`}>
                  {goal.text}
                </span>
                <button className="todo-delete" onClick={() => handleDeleteGoal(goal.id)}>
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
        <div className="add-input-container">
          <input
            type="text"
            className="add-input"
            placeholder="새로운 주간 목표 추가..."
            value={newGoalText}
            onChange={e => setNewGoalText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddGoal()}
          />
          <button className="add-btn" onClick={handleAddGoal}>
            +
          </button>
        </div>
      </section>

      {/* Drag Ghost */}
      {dragState.isDragging && (
        <div
          style={{
            position: 'fixed',
            left: dragState.currentX - 80,
            top: dragState.currentY - 25,
            width: 160,
            padding: '10px 16px',
            background: 'var(--accent-primary)',
            color: 'white',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            pointerEvents: 'none',
            zIndex: 1000,
            fontSize: '0.875rem',
            fontWeight: 500,
            textAlign: 'center',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          📋 {dragState.goalText}
        </div>
      )}
    </div>
  );
}
