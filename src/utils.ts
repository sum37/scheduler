import { format, startOfWeek, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';

export function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function formatDisplayDate(date: Date): string {
  return format(date, 'M월 d일 (EEEE)', { locale: ko });
}

export function formatMonthYear(date: Date): string {
  return format(date, 'yyyy년 M월', { locale: ko });
}

export function formatWeekRange(date: Date): string {
  const weekStart = getWeekStart(date);
  const weekEnd = addDays(weekStart, 6);
  return `${format(weekStart, 'M/d')} - ${format(weekEnd, 'M/d')}`;
}

export function getWeekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 }); // Monday
}

export function getWeekDays(date: Date): Date[] {
  const weekStart = getWeekStart(date);
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function getMonthDays(date: Date): { date: Date; isCurrentMonth: boolean; isToday: boolean }[] {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = addDays(startOfWeek(monthEnd, { weekStartsOn: 1 }), 6);

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  
  return days.map(d => ({
    date: d,
    isCurrentMonth: isSameMonth(d, date),
    isToday: isToday(d),
  }));
}

export function isSameDateString(date1: string, date2: string): boolean {
  return date1 === date2;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

export function formatHourKorean(hour: number): string {
  if (hour < 12) return `오전 ${hour === 0 ? 12 : hour}시`;
  return `오후 ${hour === 12 ? 12 : hour - 12}시`;
}

