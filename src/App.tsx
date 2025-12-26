import { useState, useEffect, useRef } from 'react';
import { ViewType } from './types';
import { formatDate, formatDisplayDate, formatWeekRange, getWeekStart, formatMonthYear } from './utils';
import { addDays, subDays, addWeeks, subWeeks, addMonths, subMonths } from 'date-fns';
import DailyView from './components/DailyView';
import WeeklyView from './components/WeeklyView';
import MonthlyView from './components/MonthlyView';
import ProfileView from './components/ProfileView';
import { FirebaseProvider } from './FirebaseContext';
import './index.css';

function App() {
  const [currentView, setCurrentView] = useState<ViewType>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const scrollTimeoutRef = useRef<number | null>(null);

  // 스크롤 시 스크롤바 표시, 1초 후 숨김
  useEffect(() => {
    const handleScroll = () => {
      document.body.classList.add('scrolling');
      
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      scrollTimeoutRef.current = window.setTimeout(() => {
        document.body.classList.remove('scrolling');
      }, 1000);
    };

    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const handlePrev = () => {
    switch (currentView) {
      case 'daily':
        setSelectedDate(prev => subDays(prev, 1));
        break;
      case 'weekly':
      case 'stats':
        setSelectedDate(prev => subWeeks(prev, 1));
        break;
      case 'monthly':
        setSelectedDate(prev => subMonths(prev, 1));
        break;
    }
  };

  const handleNext = () => {
    switch (currentView) {
      case 'daily':
        setSelectedDate(prev => addDays(prev, 1));
        break;
      case 'weekly':
      case 'stats':
        setSelectedDate(prev => addWeeks(prev, 1));
        break;
      case 'monthly':
        setSelectedDate(prev => addMonths(prev, 1));
        break;
    }
  };

  const getTitle = () => {
    switch (currentView) {
      case 'daily':
        return formatDisplayDate(selectedDate);
      case 'weekly':
      case 'stats':
        return formatWeekRange(selectedDate);
      case 'monthly':
        return formatMonthYear(selectedDate);
    }
  };

  const handleToday = () => {
    setSelectedDate(new Date());
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    if (currentView === 'monthly') {
      setCurrentView('daily');
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="date-navigator">
          <button className="date-navigator-btn" onClick={handlePrev}>
            &lt;
          </button>
          <div className="header-title">{getTitle()}</div>
          <button className="date-navigator-btn" onClick={handleNext}>
            &gt;
          </button>
        </div>
      </header>

      <main className="main-content">
        {currentView === 'daily' && (
          <DailyView 
            date={selectedDate} 
            dateString={formatDate(selectedDate)} 
          />
        )}
        {currentView === 'weekly' && (
          <WeeklyView 
            date={selectedDate}
            weekStart={formatDate(getWeekStart(selectedDate))}
            onDateSelect={handleDateSelect}
          />
        )}
        {currentView === 'monthly' && (
          <MonthlyView 
            date={selectedDate}
            onDateSelect={handleDateSelect}
          />
        )}
        {currentView === 'stats' && (
          <ProfileView 
            date={selectedDate}
            weekStart={formatDate(getWeekStart(selectedDate))}
          />
        )}
      </main>

      <nav className="bottom-nav">
        <button 
          className={`bottom-nav-item ${currentView === 'daily' ? 'active' : ''}`}
          onClick={() => setCurrentView('daily')}
        >
          <span className="nav-label">Today</span>
        </button>
        <button 
          className={`bottom-nav-item ${currentView === 'weekly' ? 'active' : ''}`}
          onClick={() => setCurrentView('weekly')}
        >
          <span className="nav-label">Weekly</span>
        </button>
        <button 
          className={`bottom-nav-item ${currentView === 'monthly' ? 'active' : ''}`}
          onClick={() => setCurrentView('monthly')}
        >
          <span className="nav-label">Monthly</span>
        </button>
        <button 
          className={`bottom-nav-item ${currentView === 'stats' ? 'active' : ''}`}
          onClick={() => setCurrentView('stats')}
        >
          <span className="nav-label">Profile</span>
        </button>
      </nav>
    </div>
  );
}

function AppWrapper() {
  return (
    <FirebaseProvider>
      <App />
    </FirebaseProvider>
  );
}

export default AppWrapper;
