import { useState, useMemo, useRef, useEffect } from 'react';
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

interface DragState {
  isDragging: boolean;
  startSlot: number | null;
  endSlot: number | null;
}

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
  const [selectedSlotRange, setSelectedSlotRange] = useState<{ start: number; end: number } | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [newTodoText, setNewTodoText] = useState('');
  const [lastSelectedNote, setLastSelectedNote] = useState<string>(''); // 마지막으로 선택한 할일
  
  // 드래그 관련 상태
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    startSlot: null,
    endSlot: null,
  });
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slotRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  
  // Firebase에서 실시간 데이터 가져오기
  const { 
    data, 
    currentUser,
    updateTimeBlock, 
    addTodo, 
    updateTodo, 
    deleteTodo 
  } = useFirebase();
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);
  
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
    if (dragState.isDragging) return;
    
    const block = getMyBlockForSlot(slot);
    setSelectedBlock(block);
    setSelectedSlotRange(null);
    setIsPickerOpen(true);
  };

  // 드래그 핸들러들
  const handleTouchStart = (_e: React.TouchEvent, slot: number) => {
    longPressTimer.current = setTimeout(() => {
      // 햅틱 피드백
      if (navigator.vibrate) {
        navigator.vibrate([100, 30, 100]);
      }
      setDragState({
        isDragging: true,
        startSlot: slot,
        endSlot: slot,
      });
    }, 400);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (!dragState.isDragging) return;

    const touch = e.touches[0];
    
    // 현재 터치 위치에 해당하는 슬롯 찾기
    let foundSlot: number | null = null;
    slotRefs.current.forEach((element, slotNum) => {
      const rect = element.getBoundingClientRect();
      if (
        touch.clientY >= rect.top &&
        touch.clientY <= rect.bottom
      ) {
        foundSlot = slotNum;
      }
    });

    if (foundSlot !== null && foundSlot !== dragState.endSlot) {
      // 햅틱 피드백
      if (navigator.vibrate) {
        navigator.vibrate(20);
      }
      setDragState(prev => ({
        ...prev,
        endSlot: foundSlot,
      }));
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (dragState.isDragging && dragState.startSlot !== null && dragState.endSlot !== null) {
      const start = Math.min(dragState.startSlot, dragState.endSlot);
      const end = Math.max(dragState.startSlot, dragState.endSlot);
      
      // 드래그 시작점 슬롯의 할일 또는 마지막 선택한 할일 사용
      const startBlock = getMyBlockForSlot(dragState.startSlot);
      const noteToFill = startBlock.note?.trim() || lastSelectedNote;
      
      if (noteToFill) {
        // 선택된 범위 전체를 할일로 채움
        for (let slot = start; slot <= end; slot++) {
          const block = getMyBlockForSlot(slot);
          const updated = { ...block, note: noteToFill };
          updateTimeBlock(updated);
        }
        
        // 햅틱 피드백
        if (navigator.vibrate) {
          navigator.vibrate([50, 100, 50]);
        }
      }
    }

    setDragState({
      isDragging: false,
      startSlot: null,
      endSlot: null,
    });
  };

  // 마우스 핸들러 (데스크톱)
  const handleMouseDown = (_e: React.MouseEvent, slot: number) => {
    longPressTimer.current = setTimeout(() => {
      setDragState({
        isDragging: true,
        startSlot: slot,
        endSlot: slot,
      });
    }, 400);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (longPressTimer.current && !dragState.isDragging) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (!dragState.isDragging) return;

    // 현재 마우스 위치에 해당하는 슬롯 찾기
    let foundSlot: number | null = null;
    slotRefs.current.forEach((element, slotNum) => {
      const rect = element.getBoundingClientRect();
      if (
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        foundSlot = slotNum;
      }
    });

    if (foundSlot !== null && foundSlot !== dragState.endSlot) {
      setDragState(prev => ({
        ...prev,
        endSlot: foundSlot,
      }));
    }
  };

  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (dragState.isDragging && dragState.startSlot !== null && dragState.endSlot !== null) {
      const start = Math.min(dragState.startSlot, dragState.endSlot);
      const end = Math.max(dragState.startSlot, dragState.endSlot);
      
      // 드래그 시작점 슬롯의 할일 또는 마지막 선택한 할일 사용
      const startBlock = getMyBlockForSlot(dragState.startSlot);
      const noteToFill = startBlock.note?.trim() || lastSelectedNote;
      
      if (noteToFill) {
        // 선택된 범위 전체를 할일로 채움
        for (let slot = start; slot <= end; slot++) {
          const block = getMyBlockForSlot(slot);
          const updated = { ...block, note: noteToFill };
          updateTimeBlock(updated);
        }
      }
    }

    setDragState({
      isDragging: false,
      startSlot: null,
      endSlot: null,
    });
  };

  // 슬롯이 드래그 범위 안에 있는지 확인
  const isSlotInDragRange = (slot: number): boolean => {
    if (!dragState.isDragging || dragState.startSlot === null || dragState.endSlot === null) {
      return false;
    }
    const start = Math.min(dragState.startSlot, dragState.endSlot);
    const end = Math.max(dragState.startSlot, dragState.endSlot);
    return slot >= start && slot <= end;
  };

  // 투두 선택 시 타임슬롯에 설정 (교체)
  const handleTodoSelect = (todo: Todo) => {
    if (!selectedBlock) return;
    
    // 마지막 선택한 할일 저장 (드래그 채우기용)
    setLastSelectedNote(todo.text);
    
    // 범위 선택된 경우 모든 슬롯에 적용
    if (selectedSlotRange) {
      for (let slot = selectedSlotRange.start; slot <= selectedSlotRange.end; slot++) {
        const block = getMyBlockForSlot(slot);
        const updated = { ...block, note: todo.text };
        updateTimeBlock(updated);
      }
    } else {
      // 단일 슬롯
      const updated = { ...selectedBlock, note: todo.text };
      updateTimeBlock(updated);
    }
    
    // 햅틱 피드백
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
    
    // 창 닫기
    setIsPickerOpen(false);
    setSelectedBlock(null);
    setSelectedSlotRange(null);
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
    if (selectedBlock && selectedBlock.note) {
      // 마지막 선택한 할일 저장 (드래그 채우기용)
      setLastSelectedNote(selectedBlock.note);
      
      // 범위 선택된 경우 모든 슬롯에 적용
      if (selectedSlotRange) {
        for (let slot = selectedSlotRange.start; slot <= selectedSlotRange.end; slot++) {
          const block = getMyBlockForSlot(slot);
          const updated = { ...block, note: selectedBlock.note };
          updateTimeBlock(updated);
        }
      } else {
        updateTimeBlock(selectedBlock);
      }
    }
    setIsPickerOpen(false);
    setSelectedBlock(null);
    setSelectedSlotRange(null);
  };

  const handleClearNote = () => {
    if (!selectedBlock) return;
    
    // 범위 선택된 경우 모든 슬롯 비우기
    if (selectedSlotRange) {
      for (let slot = selectedSlotRange.start; slot <= selectedSlotRange.end; slot++) {
        const block = getMyBlockForSlot(slot);
        const updated = { ...block, note: '', categoryId: null };
        updateTimeBlock(updated);
      }
      setSelectedBlock({ ...selectedBlock, note: '', categoryId: null });
    } else {
      const updated = { ...selectedBlock, note: '', categoryId: null };
      setSelectedBlock(updated);
      updateTimeBlock(updated);
    }
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
        background: 'var(--accent-glow)',
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
        <section 
          className="card"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div className="time-blocks">
            {TIME_SLOTS.map(slot => {
              const myBlock = getMyBlockForSlot(slot);
              const othersBlocks = getOthersBlocksForSlot(slot);
              const hasMyContent = myBlock.note?.trim().length > 0;
              const hasOthersContent = othersBlocks.length > 0;
              const isInDragRange = isSlotInDragRange(slot);
              
              return (
                <div 
                  key={slot} 
                  ref={(el) => {
                    if (el) slotRefs.current.set(slot, el);
                  }}
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
                      onTouchStart={(e) => handleTouchStart(e, slot)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                      onMouseDown={(e) => handleMouseDown(e, slot)}
                      style={{
                        background: isInDragRange 
                          ? 'var(--accent-primary)' 
                          : hasMyContent 
                            ? 'var(--accent-glow)' 
                            : undefined,
                        minHeight: 36,
                        transition: 'background 0.15s ease',
                        cursor: 'pointer',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        touchAction: 'none',
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
                    
                    {/* 타인의 time blocks - 가로 2열 배치 */}
                    {othersBlocks.length > 0 && (
                      <div style={{ 
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        gap: 4,
                      }}>
                        {othersBlocks.map(block => (
                      <div
                        key={block.id}
                        className="time-block-other"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 8px',
                          background: block.userColor ? `${block.userColor}15` : 'var(--accent-glow)',
                          borderRadius: 20,
                          fontSize: '0.75rem',
                          width: 'fit-content',
                          height: 'fit-content',
                          marginBottom: 4,
                          marginLeft: 4,                          
                        }}
                      >
                        {/* 왼쪽 원기둥 (카테고리 바) - 내 것과 같은 크기 */}
                        <div
                          style={{
                            width: 8,
                            height: 16,
                            borderRadius: 10,
                            backgroundColor: block.userColor || 'var(--accent-primary)',
                            flexShrink: 0,
                          }}
                        />
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
                    )}
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
              onKeyDown={e => e.key === 'Enter' && !e.nativeEvent.isComposing && handleAddTodo()}
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
            {selectedSlotRange 
              ? `${formatSlotTime(selectedSlotRange.start)} ~ ${formatSlotTime(selectedSlotRange.end + 1)}`
              : selectedBlock && formatSlotTime(selectedBlock.hour)
            }
            {selectedSlotRange && (
              <span style={{ 
                fontSize: '0.75rem', 
                color: 'var(--accent-primary)', 
                marginLeft: 8,
                fontWeight: 400,
              }}>
                ({selectedSlotRange.end - selectedSlotRange.start + 1}칸 선택됨)
              </span>
            )}
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
