import { useState, useMemo } from 'react';
import { Event, TimeBlock } from '../types';
import { getMonthDays, formatDate, generateId } from '../utils';
import { format, isSameDay } from 'date-fns';
import { useFirebase } from '../FirebaseContext';

interface MonthlyViewProps {
  date: Date;
  onDateSelect: (date: Date) => void;
}

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

// 시간 파싱 함수: "19.5-20.5 수영" -> { start: 39, end: 41, title: "수영" }
function parseScheduleInput(input: string): { start: number; end: number; title: string } | null {
  // 패턴: "시작-끝 제목" 또는 "시작~끝 제목"
  const match = input.match(/^(\d+\.?\d*)\s*[-~]\s*(\d+\.?\d*)\s+(.+)$/);
  if (!match) return null;

  const startTime = parseFloat(match[1]);
  const endTime = parseFloat(match[2]);
  const title = match[3].trim();

  if (isNaN(startTime) || isNaN(endTime) || startTime < 0 || endTime > 24 || startTime >= endTime) {
    return null;
  }

  // 시간을 슬롯으로 변환 (0.5 = 30분)
  // 19.5 -> 슬롯 39 (19:30)
  // 20 -> 슬롯 40 (20:00)
  const startSlot = Math.floor(startTime) * 2 + (startTime % 1 >= 0.5 ? 1 : 0);
  const endSlot = Math.floor(endTime) * 2 + (endTime % 1 >= 0.5 ? 1 : 0);

  return { start: startSlot, end: endSlot, title };
}

// 슬롯을 시간 문자열로 변환
function slotToTimeString(slot: number): string {
  const hour = Math.floor(slot / 2);
  const minute = (slot % 2) * 30;
  return `${hour.toString().padStart(2, '0')}:${minute === 0 ? '00' : '30'}`;
}

// 시간 문자열을 슬롯으로 변환: "19:30" -> 39
function timeStringToSlot(timeStr: string): number {
  const [hour, minute] = timeStr.split(':').map(Number);
  return hour * 2 + (minute >= 30 ? 1 : 0);
}

// 이벤트 시간 파싱: "19:30~20:30" -> { start: 39, end: 41 }
function parseEventTime(time: string): { start: number; end: number } | null {
  const match = time.match(/^(\d{2}:\d{2})~(\d{2}:\d{2})$/);
  if (!match) return null;
  return {
    start: timeStringToSlot(match[1]),
    end: timeStringToSlot(match[2]),
  };
}

export default function MonthlyView({ date, onDateSelect }: MonthlyViewProps) {
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [quickInput, setQuickInput] = useState('');

  const monthDays = getMonthDays(date);
  
  // Firebase에서 실시간 데이터 가져오기
  const { data, addEvent, deleteEvent, updateTimeBlock } = useFirebase();
  
  // 해당 월의 이벤트만 필터링
  const events = useMemo(() => {
    const prefix = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return data.events.filter(e => e.date.startsWith(prefix));
  }, [data.events, date]);

  const getEventsForDay = (dayDate: Date) => {
    const dateStr = formatDate(dayDate);
    return events.filter(e => e.date === dateStr);
  };

  const handleDayClick = (dayDate: Date) => {
    setSelectedDay(dayDate);
    setIsModalOpen(true);
  };

  const handleDayDoubleClick = (dayDate: Date) => {
    onDateSelect(dayDate);
  };

  // 빠른 입력으로 타임테이블에 추가
  const handleQuickAdd = () => {
    if (!quickInput.trim() || !selectedDay) return;

    const parsed = parseScheduleInput(quickInput.trim());
    if (!parsed) {
      alert('형식이 올바르지 않습니다.\n예: "19.5-20.5 수영" 또는 "10-11 점심"');
      return;
    }

    const dateStr = formatDate(selectedDay);
    const { start, end, title } = parsed;

    // 시작 슬롯부터 끝 슬롯 전까지 타임블록 채우기
    for (let slot = start; slot < end; slot++) {
      const block: TimeBlock = {
        id: generateId(),
        date: dateStr,
        hour: slot,
        categoryId: null,
        note: title,
      };
      updateTimeBlock(block);
    }

    // 이벤트에도 추가 (캘린더에 점으로 표시)
    const event: Event = {
      id: generateId(),
      date: dateStr,
      title: title,
      time: `${slotToTimeString(start)}~${slotToTimeString(end)}`,
    };
    addEvent(event);

    setQuickInput('');

    // 햅틱 피드백
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  };

  const handleDeleteEvent = (id: string) => {
    // 삭제할 이벤트 찾기
    const eventToDelete = data.events.find(e => e.id === id);
    
    if (eventToDelete && eventToDelete.time) {
      // 이벤트 시간 파싱
      const timeRange = parseEventTime(eventToDelete.time);
      
      if (timeRange) {
        // 해당 시간대의 타임블록들 비우기
        for (let slot = timeRange.start; slot < timeRange.end; slot++) {
          const existingBlock = data.timeBlocks.find(
            b => b.date === eventToDelete.date && b.hour === slot
          );
          
          if (existingBlock) {
            // 타임블록 비우기
            updateTimeBlock({
              ...existingBlock,
              note: '',
              categoryId: null,
            });
          }
        }
      }
    }
    
    // 이벤트 삭제
    deleteEvent(id);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedDay(null);
    setQuickInput('');
  };

  const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  return (
    <div className="animate-fade-in">
      {/* Calendar Grid */}
      <section className="card">
        <div className="calendar-header">
          {WEEKDAYS.map((day, i) => (
            <div 
              key={day} 
              className="calendar-weekday"
              style={{ 
                color: i === 5 ? 'var(--accent-primary)' : 
                       i === 6 ? 'var(--danger)' : 'var(--text-muted)' 
              }}
            >
              {day}
            </div>
          ))}
        </div>
        <div className="calendar-grid">
          {monthDays.map(({ date: dayDate, isCurrentMonth, isToday }) => {
            const dayEvents = getEventsForDay(dayDate);
            return (
              <button
                key={dayDate.toISOString()}
                className={`calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${selectedDay && isSameDay(dayDate, selectedDay) ? 'selected' : ''}`}
                onClick={() => handleDayClick(dayDate)}
                onDoubleClick={() => handleDayDoubleClick(dayDate)}
              >
                <span className="calendar-day-number">
                  {format(dayDate, 'd')}
                </span>
                {dayEvents.length > 0 && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    width: '100%',
                    overflow: 'hidden',
                    flex: 1,
                  }}>
                    {dayEvents.slice(0, 3).map((event) => (
                      <div
                        key={event.id}
                        style={{
                          fontSize: '0.5rem',
                          color: 'var(--text-secondary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          textAlign: 'center',
                          padding: '1px 2px',
                          background: 'var(--accent-glow)',
                          borderRadius: 2,
                        }}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div style={{ 
                        fontSize: '0.5rem', 
                        color: 'var(--text-muted)',
                        textAlign: 'center',
                      }}>
                        +{dayEvents.length - 3}
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Event Modal */}
      <div className={`modal-overlay ${isModalOpen ? 'open' : ''}`} onClick={handleCloseModal}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3 className="modal-title">
              {selectedDay && format(selectedDay, 'M월 d일')}
            </h3>
            <button className="modal-close" onClick={handleCloseModal}>
              ✕
            </button>
          </div>

          <div className="modal-body">
            {/* Quick Schedule Input */}
            <div className="form-group">
              <label className="form-label">
                ⚡ 빠른 입력
                <span style={{ 
                  fontWeight: 400, 
                  fontSize: '0.75rem', 
                  color: 'var(--text-muted)',
                  marginLeft: 8,
                }}>
                  타임테이블에 자동 추가
                </span>
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="예: 19.5-20.5 수영"
                  value={quickInput}
                  onChange={e => setQuickInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.nativeEvent.isComposing && handleQuickAdd()}
                  style={{ flex: 1 }}
                />
                <button 
                  className="btn" 
                  onClick={handleQuickAdd}
                  disabled={!quickInput.trim()}
                  style={{ padding: '12px 16px' }}
                >
                  추가
                </button>
              </div>
              <div style={{ 
                fontSize: '0.6875rem', 
                color: 'var(--text-muted)', 
                marginTop: 6,
                lineHeight: 1.5,
              }}>
                형식: <code style={{ 
                  background: 'var(--bg-tertiary)', 
                  padding: '2px 6px', 
                  borderRadius: 4,
                  fontFamily: 'var(--font-mono)',
                }}>시작-끝 제목</code>
                <br />
                예: 10-11 점심, 19.5-20.5 수영 (.5 = 30분)
              </div>
            </div>

            {/* Existing Events */}
            {selectedDayEvents.length > 0 && (
              <>
                <div style={{ 
                  borderTop: '1px solid var(--border-color)', 
                  margin: '16px 0',
                }} />
                <div className="event-list" style={{ marginTop: 0 }}>
                  {selectedDayEvents.map(event => (
                    <div key={event.id} className="event-item">
                      <span className="event-time">{event.time || '--:--'}</span>
                      <span className="event-title">{event.title}</span>
                      <button 
                        className="event-delete" 
                        onClick={() => handleDeleteEvent(event.id)}
                        style={{ opacity: 1 }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={handleCloseModal} style={{ flex: 1 }}>
                닫기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
