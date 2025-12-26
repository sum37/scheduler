import { useState, useMemo } from 'react';
import { TimeBlock, Todo } from '../types';
import { generateId } from '../utils';
import { useFirebase } from '../FirebaseContext';

interface DailyViewProps {
  date: Date;
  dateString: string;
}

type SubTab = 'timetable' | 'todo';

// 30분 단위 슬롯 (09:00 ~ 24:00, slot 18-47)
const TIME_SLOTS = Array.from({ length: 30 }, (_, i) => i + 18);

function formatSlotTime(slot: number): string {
  const hour = Math.floor(slot / 2);
  const minute = (slot % 2) * 30;
  const period = hour < 12 ? '오전' : '오후';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${period} ${displayHour}:${minute === 0 ? '00' : '30'}`;
}

function formatSlotTimeShort(slot: number): string {
  const hour = Math.floor(slot / 2);
  const minute = (slot % 2) * 30;
  return `${hour.toString().padStart(2, '0')}:${minute === 0 ? '00' : '30'}`;
}

export default function DailyView({ dateString }: DailyViewProps) {
  const [subTab, setSubTab] = useState<SubTab>('timetable');
  const [selectedBlock, setSelectedBlock] = useState<TimeBlock | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [newTodoText, setNewTodoText] = useState('');
  
  // Firebase에서 실시간 데이터 가져오기
  const { 
    data, 
    currentUser,
    updateTimeBlock, 
    addTodo, 
    updateTodo, 
    deleteTodo 
  } = useFirebase();
  
  // 해당 날짜의 데이터만 필터링
  const timeBlocks = useMemo(() => 
    data.timeBlocks.filter(b => b.date === dateString),
    [data.timeBlocks, dateString]
  );
  
  // 내 time blocks와 타인의 time blocks 구분
  const myTimeBlocks = useMemo(() => 
    timeBlocks.filter(b => b.userId === currentUser?.id),
    [timeBlocks, currentUser]
  );
  
  const othersTimeBlocks = useMemo(() => 
    timeBlocks.filter(b => b.userId && b.userId !== currentUser?.id),
    [timeBlocks, currentUser]
  );
  
  const todos = useMemo(() => 
    data.todos.filter(t => t.date === dateString).sort((a, b) => a.order - b.order),
    [data.todos, dateString]
  );

  // 30분 슬롯에 해당하는 내 블록 가져오기
  const getMyBlockForSlot = (slot: number): TimeBlock => {
    const existing = myTimeBlocks.find(b => b.hour === slot);
    if (existing) return existing;
    return {
      id: generateId(),
      date: dateString,
      hour: slot,
      categoryId: null,
      note: '',
      userId: currentUser?.id,
    };
  };
  
  // 30분 슬롯에 해당하는 타인의 블록들 가져오기
  const getOthersBlocksForSlot = (slot: number): TimeBlock[] => {
    return othersTimeBlocks.filter(b => b.hour === slot && b.note?.trim());
  };

  const handleBlockClick = (slot: number) => {
    const block = getMyBlockForSlot(slot);
    setSelectedBlock(block);
    setIsPickerOpen(true);
  };

  // 투두 선택 시 타임슬롯에 설정 (교체)
  const handleTodoSelect = (todo: Todo) => {
    if (!selectedBlock) return;
    
    // 기존 할일을 교체
    const updated = { ...selectedBlock, note: todo.text };
    updateTimeBlock(updated);
    
    // 햅틱 피드백
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
    
    // 창 닫기
    setIsPickerOpen(false);
    setSelectedBlock(null);
  };

  const handleNoteChange = (note: string) => {
    if (!selectedBlock) return;
    setSelectedBlock({ ...selectedBlock, note });
  };

  const handleNoteSave = () => {
    if (!selectedBlock) return;
    updateTimeBlock(selectedBlock);
  };

  const handleClosePicker = () => {
    if (selectedBlock) {
      updateTimeBlock(selectedBlock);
    }
    setIsPickerOpen(false);
    setSelectedBlock(null);
  };

  const handleClearNote = () => {
    if (!selectedBlock) return;
    const updated = { ...selectedBlock, note: '', categoryId: null };
    setSelectedBlock(updated);
    updateTimeBlock(updated);
  };

  const handleAddTodo = () => {
    if (!newTodoText.trim()) return;
    const todo: Todo = {
      id: generateId(),
      date: dateString,
      text: newTodoText.trim(),
      completed: false,
      order: todos.length,
    };
    addTodo(todo);
    setNewTodoText('');
  };

  const handleToggleTodo = (todo: Todo) => {
    updateTodo({ ...todo, completed: !todo.completed });
  };

  const handleDeleteTodo = (id: string) => {
    deleteTodo(id);
  };

  // 미완료 투두만 필터링
  const incompleteTodos = todos.filter(t => !t.completed);

  return (
    <div className="animate-fade-in">
      {/* Sub Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: 16,
        background: 'var(--bg-tertiary)',
        padding: 4,
        borderRadius: 'var(--radius-md)',
      }}>
        <button
          onClick={() => setSubTab('timetable')}
          style={{
            flex: 1,
            padding: '10px 16px',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            background: subTab === 'timetable' ? 'var(--accent-primary)' : 'transparent',
            color: subTab === 'timetable' ? 'white' : 'var(--text-secondary)',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Time Table
        </button>
        <button
          onClick={() => setSubTab('todo')}
          style={{
            flex: 1,
            padding: '10px 16px',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            background: subTab === 'todo' ? 'var(--accent-primary)' : 'transparent',
            color: subTab === 'todo' ? 'white' : 'var(--text-secondary)',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontFamily: 'var(--font-sans)',
          }}
        >
          Todo List
        </button>
      </div>

      {/* Timetable Tab */}
      {subTab === 'timetable' && (
        <section className="card">
          <div className="time-blocks">
            {TIME_SLOTS.map(slot => {
              const myBlock = getMyBlockForSlot(slot);
              const othersBlocks = getOthersBlocksForSlot(slot);
              const hasMyContent = myBlock.note?.trim().length > 0;
              const hasOthersContent = othersBlocks.length > 0;
              
              return (
                <div 
                  key={slot} 
                  className="time-block"
                  style={{
                    minHeight: hasOthersContent ? 'auto' : undefined,
                  }}
                >
                  <div 
                    className="time-block-hour"
                    style={{
                      fontSize: '0.6875rem',
                    }}
                  >
                    {formatSlotTimeShort(slot)}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {/* 내 time block */}
                    <div
                      className="time-block-content"
                      onClick={() => handleBlockClick(slot)}
                      style={{
                        background: hasMyContent ? 'var(--accent-glow)' : undefined,
                        minHeight: 36,
                      }}
                    >
                      {hasMyContent && (
                        <div
                          className="time-block-category"
                          style={{ 
                            backgroundColor: 'var(--accent-primary)'
                          }}
                        />
                      )}
                      <span 
                        className={`time-block-note ${!hasMyContent ? 'empty' : ''}`}
                        style={{
                          whiteSpace: 'pre-wrap',
                          lineHeight: 1.4,
                        }}
                      >
                        {myBlock.note || ''}
                      </span>
                    </div>
                    
                    {/* 타인의 time blocks */}
                    {othersBlocks.map(block => (
                      <div
                        key={block.id}
                        className="time-block-other"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 10px',
                          background: block.userColor ? `${block.userColor}20` : 'rgba(110, 168, 158, 0.1)',
                          borderRadius: 'var(--radius-sm)',
                          borderLeft: `3px solid ${block.userColor || 'var(--accent-primary)'}`,
                          fontSize: '0.75rem',
                        }}
                      >
                        <span 
                          style={{ 
                            fontWeight: 600, 
                            color: block.userColor || 'var(--accent-primary)',
                            flexShrink: 0,
                          }}
                        >
                          {block.userName || '익명'}
                        </span>
                        <span style={{ color: 'var(--text-secondary)', flex: 1 }}>
                          {block.note}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Todo Tab */}
      {subTab === 'todo' && (
        <section className="card">
          <div className="add-input-container" style={{ marginBottom: todos.length > 0 ? 12 : 0 }}>
            <input
              type="text"
              className="add-input"
              placeholder="새로운 할 일 추가..."
              value={newTodoText}
              onChange={e => setNewTodoText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddTodo()}
            />
            <button className="add-btn" onClick={handleAddTodo}>
              +
            </button>
          </div>
          {todos.length > 0 && (
            <div className="todo-list">
              {todos.map(todo => (
                <div key={todo.id} className={`todo-item ${todo.completed ? 'completed' : ''}`}>
                  <div
                    className={`todo-checkbox ${todo.completed ? 'checked' : ''}`}
                    onClick={() => handleToggleTodo(todo)}
                  >
                    {todo.completed && '✓'}
                  </div>
                  <span className={`todo-text ${todo.completed ? 'completed' : ''}`}>
                    {todo.text}
                  </span>
                  <button className="todo-delete" onClick={() => handleDeleteTodo(todo.id)}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Todo Picker (instead of Category Picker) */}
      <div
        className={`category-picker-backdrop ${isPickerOpen ? 'open' : ''}`}
        onClick={handleClosePicker}
      />
      <div className={`category-picker ${isPickerOpen ? 'open' : ''}`}>
        <div className="category-picker-header">
          <h3 className="category-picker-title">
            {selectedBlock && formatSlotTime(selectedBlock.hour)}
          </h3>
          <button className="category-picker-close" onClick={handleClosePicker}>
            ✕
          </button>
        </div>

        {/* 현재 내용 표시 */}
        {selectedBlock?.note && (
          <div style={{
            padding: 12,
            background: 'var(--accent-glow)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 16,
          }}>
            <div style={{ 
              fontSize: '0.75rem', 
              color: 'var(--text-muted)', 
              marginBottom: 6 
            }}>
              현재 할당된 할일
            </div>
            <div style={{ 
              fontSize: '0.875rem', 
              color: 'var(--text-primary)',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.5,
            }}>
              {selectedBlock.note}
            </div>
            <button
              onClick={handleClearNote}
              style={{
                marginTop: 10,
                padding: '6px 12px',
                background: 'var(--danger)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: 'white',
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              비우기
            </button>
          </div>
        )}

        {/* 투두 리스트 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ 
            fontSize: '0.875rem', 
            fontWeight: 500, 
            color: 'var(--text-secondary)',
            marginBottom: 10,
          }}>
            할일 선택
          </div>
          
          {incompleteTodos.length === 0 ? (
            <div style={{
              padding: 24,
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.875rem',
            }}>
              미완료 할일이 없습니다.<br/>
              투두리스트 탭에서 추가해주세요.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {incompleteTodos.map(todo => (
                <button
                  key={todo.id}
                  onClick={() => handleTodoSelect(todo)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '14px 16px',
                    background: 'var(--bg-tertiary)',
                    border: '2px solid transparent',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'left',
                    fontSize: '0.9375rem',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-sans)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--accent-primary)';
                    e.currentTarget.style.background = 'var(--accent-glow)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'transparent';
                    e.currentTarget.style.background = 'var(--bg-tertiary)';
                  }}
                >
                  <span style={{ 
                    width: 8, 
                    height: 8, 
                    borderRadius: '50%', 
                    background: 'var(--accent-primary)',
                    flexShrink: 0,
                  }} />
                  {todo.text}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 직접 입력 */}
        <div className="note-input-container">
          <label className="note-input-label">직접 입력</label>
          <textarea
            className="note-input"
            rows={2}
            placeholder="할 일을 직접 입력하세요..."
            value={selectedBlock?.note || ''}
            onChange={e => handleNoteChange(e.target.value)}
            onBlur={handleNoteSave}
          />
        </div>
      </div>
    </div>
  );
}
