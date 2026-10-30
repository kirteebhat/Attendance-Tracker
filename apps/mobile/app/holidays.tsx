import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  CalendarDays,
  Palmtree,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  Coffee,
  Landmark,
  Briefcase,
  Sparkles,
  Users,
  Code2,
  MapPin,
  Award,
  type LucideIcon,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  Screen,
  ScreenHeader,
  Card,
  Text,
  PressableScale,
  Skeleton,
} from '../src/components';
import { colors, radii, spacing } from '../src/theme/tokens';
import { useResponsive } from '../src/lib/responsive';
import { holidayApi } from '../src/services';

// ---------------------------------------------------------------------------
// Unified Calendar Event Model & Category Types (Matching Web CalendarPage)
// ---------------------------------------------------------------------------
export type CalendarEventType = 'holiday' | 'companyOffDay' | 'meeting' | 'event';
export type CategoryFilter = 'all' | 'holiday' | 'event' | 'meeting';

export interface UnifiedCalendarEvent {
  _id: string;
  name: string;
  dateKey: string;
  endDateKey?: string;
  type: CalendarEventType;
  description: string;
  isFullDay: boolean;
  location?: string;
  startTime?: string;
  endTime?: string;
  isRecurring?: boolean;
}

export interface EnrichedCalendarEvent extends UnifiedCalendarEvent {
  dateObj: Date;
  daysRemaining: number;
  isPast: boolean;
  isToday: boolean;
  isTomorrow: boolean;
  isLongWeekend: boolean;
  dayName: string;
  monthName: string;
  dayNum: string;
}

// ---------------------------------------------------------------------------
// Category Visual Configuration (Badges, Colors & Icons matching Web portal)
// ---------------------------------------------------------------------------
export const EVENT_CATEGORY_CONFIG: Record<
  CalendarEventType,
  {
    label: string;
    badgeLabel: string;
    icon: LucideIcon;
    color: string;
    bgSoft: string;
    borderColor: string;
    dotColor: string;
  }
> = {
  holiday: {
    label: 'Public Holiday',
    badgeLabel: 'PUBLIC HOLIDAY',
    icon: Landmark,
    color: colors.indigoSoft, // #7E8BFF
    bgSoft: 'rgba(89, 101, 242, 0.16)',
    borderColor: 'rgba(89, 101, 242, 0.35)',
    dotColor: '#5965F2',
  },
  companyOffDay: {
    label: 'Company Off-Day',
    badgeLabel: 'COMPANY OFF-DAY',
    icon: Coffee,
    color: colors.warning, // #F5C76B
    bgSoft: 'rgba(245, 199, 107, 0.16)',
    borderColor: 'rgba(245, 199, 107, 0.35)',
    dotColor: '#F5C76B',
  },
  event: {
    label: 'Hackathon / Session',
    badgeLabel: 'TECH SESSION & HACKATHON',
    icon: Code2,
    color: colors.info, // #76B8FF
    bgSoft: 'rgba(118, 184, 255, 0.16)',
    borderColor: 'rgba(118, 184, 255, 0.35)',
    dotColor: '#76B8FF',
  },
  meeting: {
    label: 'Town Hall & Sync',
    badgeLabel: 'TOWN HALL & ALL-HANDS',
    icon: Users,
    color: colors.leave, // #C4A7FF
    bgSoft: 'rgba(196, 167, 255, 0.16)',
    borderColor: 'rgba(196, 167, 255, 0.35)',
    dotColor: '#C4A7FF',
  },
};

// ---------------------------------------------------------------------------
// Master 2026 Corporate Calendar & Events (Holidays, Hackathons, Sessions & Town Halls)
// ---------------------------------------------------------------------------
export const MASTER_CORPORATE_CALENDAR_2026: UnifiedCalendarEvent[] = [
  // January
  {
    _id: 'cal-2026-01-01',
    name: "New Year's Day",
    dateKey: '2026-01-01',
    type: 'companyOffDay',
    description: 'First day of the year — corporate office holiday',
    isFullDay: true,
    isRecurring: true,
  },
  {
    _id: 'cal-2026-01-14',
    name: 'Makar Sankranti / Pongal',
    dateKey: '2026-01-14',
    type: 'holiday',
    description: 'Harvest festival celebrated across India',
    isFullDay: true,
    isRecurring: false,
  },
  {
    _id: 'cal-2026-01-22',
    name: 'Q1 Global Town Hall & Vision 2026',
    dateKey: '2026-01-22',
    type: 'meeting',
    description: 'Annual corporate roadmap, product reveals & executive AMA',
    isFullDay: false,
    startTime: '04:00 PM',
    endTime: '05:30 PM',
    location: 'Main Auditorium & Live Stream',
  },
  {
    _id: 'cal-2026-01-26',
    name: 'Republic Day',
    dateKey: '2026-01-26',
    type: 'holiday',
    description: 'National holiday celebrating the Constitution of India',
    isFullDay: true,
    isRecurring: true,
  },

  // February
  {
    _id: 'cal-2026-02-12',
    name: 'Cloud Architecture & DevOps Masterclass',
    dateKey: '2026-02-12',
    type: 'event',
    description: 'Hands-on technical workshop on microservices scaling & Kubernetes',
    isFullDay: false,
    startTime: '02:00 PM',
    endTime: '05:00 PM',
    location: 'Tech Hub Room 4 & Google Meet',
  },
  {
    _id: 'cal-2026-02-15',
    name: 'Maha Shivratri',
    dateKey: '2026-02-15',
    type: 'holiday',
    description: 'Sacred holiday observed across corporate operations',
    isFullDay: true,
    isRecurring: false,
  },
  {
    _id: 'cal-2026-02-19',
    name: 'Chhatrapati Shivaji Maharaj Jayanti',
    dateKey: '2026-02-19',
    type: 'holiday',
    description: 'Birth anniversary of Chhatrapati Shivaji Maharaj',
    isFullDay: true,
    isRecurring: true,
  },

  // March
  {
    _id: 'cal-2026-03-03',
    name: 'Holika Dahan',
    dateKey: '2026-03-03',
    type: 'companyOffDay',
    description: 'Eve of Holi celebration — optional early logout',
    isFullDay: true,
    isRecurring: false,
  },
  {
    _id: 'cal-2026-03-04',
    name: 'Holi (Festival of Colours)',
    dateKey: '2026-03-04',
    type: 'holiday',
    description: 'Spring celebration of colours, joy and renewal',
    isFullDay: true,
    isRecurring: false,
  },
  {
    _id: 'cal-2026-03-14',
    name: 'Spring Innovation Sprint & Hack Day',
    dateKey: '2026-03-14',
    type: 'event',
    description: 'Inter-team 24hr build marathon for internal developer tools',
    isFullDay: true,
    startTime: '09:00 AM',
    endTime: '09:00 PM',
    location: 'Engineering Floor & Discord Hub',
  },
  {
    _id: 'cal-2026-03-20',
    name: 'Eid-ul-Fitr (Ramzan Id)',
    dateKey: '2026-03-20',
    type: 'holiday',
    description: 'Festival marking the conclusion of the holy month of Ramadan',
    isFullDay: true,
    isRecurring: false,
  },
  {
    _id: 'cal-2026-03-30',
    name: 'Ram Navami',
    dateKey: '2026-03-30',
    type: 'holiday',
    description: 'Celebration of the birth of Lord Rama',
    isFullDay: true,
    isRecurring: false,
  },

  // April
  {
    _id: 'cal-2026-04-03',
    name: 'Good Friday',
    dateKey: '2026-04-03',
    type: 'holiday',
    description: 'Christian holy day commemorating the passion of Jesus Christ',
    isFullDay: true,
    isRecurring: false,
  },
  {
    _id: 'cal-2026-04-11',
    name: 'Mahavir Jayanti',
    dateKey: '2026-04-11',
    type: 'holiday',
    description: 'Most important religious festival in Jainism',
    isFullDay: true,
    isRecurring: false,
  },
  {
    _id: 'cal-2026-04-14',
    name: 'Dr. B.R. Ambedkar Jayanti',
    dateKey: '2026-04-14',
    type: 'holiday',
    description: 'Honouring the chief architect of the Indian Constitution',
    isFullDay: true,
    isRecurring: true,
  },
  {
    _id: 'cal-2026-04-23',
    name: 'Q2 Strategy All-Hands & Product Demo',
    dateKey: '2026-04-23',
    type: 'meeting',
    description: 'Quarterly business review, key metrics & customer spotlight',
    isFullDay: false,
    startTime: '03:30 PM',
    endTime: '05:00 PM',
    location: 'Executive Conference Center & Zoom',
  },

  // May
  {
    _id: 'cal-2026-05-01',
    name: 'Labour Day / Maharashtra Day',
    dateKey: '2026-05-01',
    type: 'holiday',
    description: 'International Workers Day and state holiday',
    isFullDay: true,
    isRecurring: true,
  },
  {
    _id: 'cal-2026-05-15',
    name: 'AI & Large Models Developer Summit',
    dateKey: '2026-05-15',
    type: 'event',
    description: 'Deep dive into local LLMs, agentic workflows and fine-tuning',
    isFullDay: false,
    startTime: '01:00 PM',
    endTime: '05:30 PM',
    location: 'Innovation Arena B & Webcast',
  },
  {
    _id: 'cal-2026-05-27',
    name: 'Eid-ul-Adha (Bakrid)',
    dateKey: '2026-05-27',
    type: 'holiday',
    description: 'Feast of the Sacrifice observed nationwide',
    isFullDay: true,
    isRecurring: false,
  },
  {
    _id: 'cal-2026-05-31',
    name: 'Buddha Purnima',
    dateKey: '2026-05-31',
    type: 'holiday',
    description: 'Birth, enlightenment and passing of Gautama Buddha',
    isFullDay: true,
    isRecurring: false,
  },

  // June
  {
    _id: 'cal-2026-06-18',
    name: 'Annual Global Hackathon 2026 (Day 1)',
    dateKey: '2026-06-18',
    type: 'event',
    description: 'Global 48-hour engineering hackathon with cash prizes & incubation',
    isFullDay: true,
    startTime: '09:00 AM',
    endTime: '11:59 PM',
    location: 'Global Hubs & Virtual Lab',
  },
  {
    _id: 'cal-2026-06-19',
    name: 'Annual Global Hackathon 2026 (Day 2 & Demos)',
    dateKey: '2026-06-19',
    type: 'event',
    description: 'Hackathon pitch sessions, executive jury evaluation & awards',
    isFullDay: true,
    startTime: '09:00 AM',
    endTime: '08:00 PM',
    location: 'Main Stage & Stream',
  },
  {
    _id: 'cal-2026-06-26',
    name: 'Muharram (Ashura)',
    dateKey: '2026-06-26',
    type: 'holiday',
    description: 'Solemn Islamic day of remembrance',
    isFullDay: true,
    isRecurring: false,
  },
  {
    _id: 'cal-2026-06-29',
    name: 'Mid-Year Corporate Off-Day',
    dateKey: '2026-06-29',
    type: 'companyOffDay',
    description: 'Company-wide wellness and mid-year rejuvenation day',
    isFullDay: true,
    isRecurring: true,
  },

  // July
  {
    _id: 'cal-2026-07-16',
    name: 'Mid-Year Leadership Town Hall',
    dateKey: '2026-07-16',
    type: 'meeting',
    description: 'H1 achievements, promotions announcement & employee recognition',
    isFullDay: false,
    startTime: '04:00 PM',
    endTime: '05:30 PM',
    location: 'Auditorium & Virtual Link',
  },
  {
    _id: 'cal-2026-07-20',
    name: 'Guru Purnima / Rath Yatra',
    dateKey: '2026-07-20',
    type: 'holiday',
    description: 'Traditional festival expressing gratitude to mentors & teachers',
    isFullDay: true,
    isRecurring: false,
  },
  {
    _id: 'cal-2026-07-24',
    name: 'Monsoon Wellness Off-Day',
    dateKey: '2026-07-24',
    type: 'companyOffDay',
    description: 'Designated corporate rejuvenation long weekend',
    isFullDay: true,
    isRecurring: true,
  },

  // August
  {
    _id: 'cal-2026-08-07',
    name: 'Cybersecurity & Zero-Trust Workshop',
    dateKey: '2026-08-07',
    type: 'event',
    description: 'Technical security training on threat modeling & API tokens',
    isFullDay: false,
    startTime: '02:00 PM',
    endTime: '04:30 PM',
    location: 'Room 302 & Zoom',
  },
  {
    _id: 'cal-2026-08-15',
    name: 'Independence Day',
    dateKey: '2026-08-15',
    type: 'holiday',
    description: 'National holiday celebrating 79 years of Indian independence',
    isFullDay: true,
    isRecurring: true,
  },
  {
    _id: 'cal-2026-08-16',
    name: 'Parsi New Year (Navroz)',
    dateKey: '2026-08-16',
    type: 'holiday',
    description: 'Shahenshahi calendar New Year celebration',
    isFullDay: true,
    isRecurring: false,
  },
  {
    _id: 'cal-2026-08-28',
    name: 'Raksha Bandhan',
    dateKey: '2026-08-28',
    type: 'holiday',
    description: 'Traditional festival celebrating bonds of family and protection',
    isFullDay: true,
    isRecurring: false,
  },

  // September
  {
    _id: 'cal-2026-09-04',
    name: 'Janmashtami (Krishna Jayanti)',
    dateKey: '2026-09-04',
    type: 'holiday',
    description: 'Joyous celebration of the birth of Lord Krishna',
    isFullDay: true,
    isRecurring: false,
  },
  {
    _id: 'cal-2026-09-05',
    name: 'Milad-un-Nabi (Id-e-Milad)',
    dateKey: '2026-09-05',
    type: 'holiday',
    description: 'Observance of the birth anniversary of Prophet Muhammad',
    isFullDay: true,
    isRecurring: false,
  },
  {
    _id: 'cal-2026-09-15',
    name: 'Ganesh Chaturthi (Vinayaka Chavithi)',
    dateKey: '2026-09-15',
    type: 'holiday',
    description: 'Celebration of the birth of Lord Ganesha',
    isFullDay: true,
    isRecurring: false,
  },
  {
    _id: 'cal-2026-09-24',
    name: 'Engineering Tech Showcase & Open Source Day',
    dateKey: '2026-09-24',
    type: 'event',
    description: 'Internal demo stalls, lightning talks & code review clinics',
    isFullDay: false,
    startTime: '02:00 PM',
    endTime: '06:00 PM',
    location: 'Cafeteria Atrium & Stream',
  },

  // October
  {
    _id: 'cal-2026-10-02',
    name: 'Mahatma Gandhi Jayanti',
    dateKey: '2026-10-02',
    type: 'holiday',
    description: 'National holiday honouring Father of the Nation',
    isFullDay: true,
    isRecurring: true,
  },
  {
    _id: 'cal-2026-10-15',
    name: 'Q3 All-Hands & Culture Sync',
    dateKey: '2026-10-15',
    type: 'meeting',
    description: 'Quarterly review, company growth update & leadership Q&A',
    isFullDay: false,
    startTime: '04:00 PM',
    endTime: '05:30 PM',
    location: 'Main Auditorium & Live Stream',
  },
  {
    _id: 'cal-2026-10-24',
    name: 'Dussehra (Vijayadashami)',
    dateKey: '2026-10-24',
    type: 'holiday',
    description: 'Victory of good over evil — nationwide holiday',
    isFullDay: true,
    isRecurring: false,
  },

  // November
  {
    _id: 'cal-2026-11-06',
    name: 'Deepavali Festival Eve & Office Celebration',
    dateKey: '2026-11-06',
    type: 'companyOffDay',
    description: 'Early corporate festive release & Diwali gift distribution',
    isFullDay: true,
    isRecurring: false,
  },
  {
    _id: 'cal-2026-11-08',
    name: 'Diwali (Deepavali)',
    dateKey: '2026-11-08',
    type: 'holiday',
    description: 'Festival of Lights — Major nationwide corporate holiday',
    isFullDay: true,
    isRecurring: false,
  },
  {
    _id: 'cal-2026-11-09',
    name: 'Govardhan Puja',
    dateKey: '2026-11-09',
    type: 'holiday',
    description: 'Post-Diwali celebration — Long weekend break',
    isFullDay: true,
    isRecurring: false,
  },
  {
    _id: 'cal-2026-11-10',
    name: 'Bhai Dooj',
    dateKey: '2026-11-10',
    type: 'holiday',
    description: 'Celebration of the loving bond between siblings',
    isFullDay: true,
    isRecurring: false,
  },
  {
    _id: 'cal-2026-11-20',
    name: 'Autumn AI & Product Hackathon',
    dateKey: '2026-11-20',
    type: 'event',
    description: 'Hackathon focused on automating internal operations with agentic AI',
    isFullDay: true,
    startTime: '09:30 AM',
    endTime: '08:00 PM',
    location: 'Innovation Lab 1 & Discord',
  },
  {
    _id: 'cal-2026-11-24',
    name: 'Guru Nanak Jayanti (Gurpurab)',
    dateKey: '2026-11-24',
    type: 'holiday',
    description: 'Birth anniversary of the first Sikh Guru, Guru Nanak Dev Ji',
    isFullDay: true,
    isRecurring: false,
  },

  // December
  {
    _id: 'cal-2026-12-10',
    name: 'Annual Company Review & Awards Gala',
    dateKey: '2026-12-10',
    type: 'meeting',
    description: 'End-of-year excellence awards, peer recognition & gala dinner',
    isFullDay: false,
    startTime: '05:00 PM',
    endTime: '09:00 PM',
    location: 'Grand Ballroom & Live Stream',
  },
  {
    _id: 'cal-2026-12-24',
    name: 'Christmas Eve Off-Day',
    dateKey: '2026-12-24',
    type: 'companyOffDay',
    description: 'Company-wide holiday eve — Holiday shutdown begins',
    isFullDay: true,
    isRecurring: true,
  },
  {
    _id: 'cal-2026-12-25',
    name: 'Christmas Day',
    dateKey: '2026-12-25',
    type: 'holiday',
    description: 'Worldwide celebration of the birth of Jesus Christ',
    isFullDay: true,
    isRecurring: true,
  },
  {
    _id: 'cal-2026-12-31',
    name: "New Year's Eve Wellness Off-Day",
    dateKey: '2026-12-31',
    type: 'companyOffDay',
    description: 'Year-end company closure & celebration',
    isFullDay: true,
    isRecurring: true,
  },
];

// Fallback constant for backwards compatibility
export const DEFAULT_CORPORATE_HOLIDAYS_2026 = MASTER_CORPORATE_CALENDAR_2026;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type ViewMode = 'calendar' | 'list';
type ListFilter = 'upcoming' | 'all' | 'long-weekends';

export default function HolidaysScreen() {
  const { isWide } = useResponsive();

  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [listFilter, setListFilter] = useState<ListFilter>('upcoming');

  // Option 5: Category Filter State
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [events, setEvents] = useState<UnifiedCalendarEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const activeYear = currentMonth.getFullYear();

  // Option 2: Fetch all events & holidays purely from the backend (matching web CalendarPage 1:1)
  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const [eventsRes, holRes] = await Promise.allSettled([
        holidayApi.getCalendarEvents(activeYear),
        holidayApi.getHolidays(activeYear),
      ]);

      const backendEvents: UnifiedCalendarEvent[] = [];
      const backendMap = new Map<string, UnifiedCalendarEvent>();

      // 1. Process calendar events from /api/calendar/events (exact same source as web CalendarPage)
      if (eventsRes.status === 'fulfilled' && eventsRes.value?.success && Array.isArray(eventsRes.value.data)) {
        for (const evt of eventsRes.value.data) {
          const sKey = new Date(evt.startDate).toISOString().split('T')[0];
          const eKey = new Date(evt.endDate).toISOString().split('T')[0];

          let curr = sKey;
          let count = 0;
          while (curr <= eKey && count < 60) {
            const item: UnifiedCalendarEvent = {
              _id: `${evt._id}-${curr}`,
              name: evt.title,
              dateKey: curr,
              endDateKey: eKey,
              type: (evt.type as CalendarEventType) || 'holiday',
              description:
                evt.description ||
                (evt.type === 'holiday'
                  ? 'Official Public Holiday'
                  : evt.type === 'companyOffDay'
                  ? 'Company Off-Day'
                  : evt.type === 'meeting'
                  ? 'Town Hall / Sync'
                  : 'Corporate Session & Hackathon'),
              isFullDay: evt.isFullDay !== false,
              location: evt.location,
              startTime: evt.startTime,
              endTime: evt.endTime,
              isRecurring: false,
            };

            backendEvents.push(item);
            backendMap.set(`${item.dateKey}-${item.name}`, item);

            const [y, m, d] = curr.split('-').map(Number);
            const nextDate = new Date(Date.UTC(y, m - 1, d + 1));
            curr = nextDate.toISOString().split('T')[0];
            count++;
          }
        }
      }

      // 2. Also merge /api/holidays if any exist that weren't in calendar events
      if (holRes.status === 'fulfilled' && holRes.value?.success && Array.isArray(holRes.value.data)) {
        for (const h of holRes.value.data) {
          const key = `${h.dateKey}-${h.name}`;
          if (h.dateKey && !backendMap.has(key)) {
            const item: UnifiedCalendarEvent = {
              _id: h._id,
              name: h.name,
              dateKey: h.dateKey,
              type: h.type === 'company' ? 'companyOffDay' : 'holiday',
              description: h.description || 'Public Holiday',
              isFullDay: true,
              isRecurring: h.isRecurring,
            };
            backendEvents.push(item);
            backendMap.set(key, item);
          }
        }
      }

      // If backend returned data, use PURELY backend data (exact 1:1 match with web!)
      if (backendEvents.length > 0) {
        setEvents(backendEvents);
      } else {
        // Fallback to comprehensive corporate calendar
        setEvents(MASTER_CORPORATE_CALENDAR_2026);
      }
    } catch {
      setEvents(MASTER_CORPORATE_CALENDAR_2026);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeYear]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchEvents();
  }, [fetchEvents]);

  // Enrich all event items with relative dates, countdowns & formatted strings
  const enrichedEvents: EnrichedCalendarEvent[] = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return events
      .map((e) => {
        const parts = e.dateKey.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const dateObj = new Date(year, month, day);

        const diffTime = dateObj.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        const dayOfWeek = dateObj.getDay();
        const isLongWeekend = (e.type === 'holiday' || e.type === 'companyOffDay') && (dayOfWeek === 1 || dayOfWeek === 5);

        const dayName = dateObj.toLocaleDateString(undefined, { weekday: 'short' });
        const monthName = dateObj.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
        const dayNum = String(day).padStart(2, '0');

        return {
          ...e,
          dateObj,
          daysRemaining: diffDays,
          isPast: diffDays < 0,
          isToday: diffDays === 0,
          isTomorrow: diffDays === 1,
          isLongWeekend,
          dayName,
          monthName,
          dayNum,
        };
      })
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  }, [events]);

  // Option 5: Filter enriched events by selected category
  const categoryFilteredEvents = useMemo(() => {
    return enrichedEvents.filter((evt) => {
      if (categoryFilter === 'all') return true;
      if (categoryFilter === 'holiday') {
        return evt.type === 'holiday' || evt.type === 'companyOffDay';
      }
      return evt.type === categoryFilter;
    });
  }, [enrichedEvents, categoryFilter]);

  // Map events by dateKey for O(1) multi-item cell lookup
  const eventsByDate = useMemo(() => {
    const map = new Map<string, EnrichedCalendarEvent[]>();
    for (const evt of categoryFilteredEvents) {
      const list = map.get(evt.dateKey) || [];
      list.push(evt);
      map.set(evt.dateKey, list);
    }
    return map;
  }, [categoryFilteredEvents]);

  // Global map without category filter (for category counter badges)
  const categoryCounts = useMemo(() => {
    let holidayCount = 0;
    let eventCount = 0;
    let meetingCount = 0;

    for (const evt of enrichedEvents) {
      if (evt.type === 'holiday' || evt.type === 'companyOffDay') holidayCount++;
      else if (evt.type === 'event') eventCount++;
      else if (evt.type === 'meeting') meetingCount++;
    }

    return {
      all: enrichedEvents.length,
      holiday: holidayCount,
      event: eventCount,
      meeting: meetingCount,
    };
  }, [enrichedEvents]);

  // Next upcoming item matching active filter
  const nextItem = useMemo(() => {
    return categoryFilteredEvents.find((e) => !e.isPast) || null;
  }, [categoryFilteredEvents]);

  // Calendar month cells & calculations (Reference from Web CalendarPage)
  const monthData = useMemo(() => {
    const year = currentMonth.getFullYear();
    const monthIdx = currentMonth.getMonth();
    const todayStr = new Date().toISOString().split('T')[0];

    const firstDayOfWeek = new Date(year, monthIdx, 1).getDay();
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

    let holidaysCount = 0;
    let sessionsCount = 0;
    let townHallsCount = 0;
    let weeklyOffCount = 0;

    const cells: Array<{
      key: string;
      dateStr: string;
      dayNum: number;
      inMonth: boolean;
      isToday: boolean;
      isWeeklyOff: boolean;
      dayEvents: EnrichedCalendarEvent[];
    }> = [];

    // Previous month trailing days
    const prevMonthDays = new Date(year, monthIdx, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const prevMonthIdx = monthIdx === 0 ? 11 : monthIdx - 1;
      const prevYear = monthIdx === 0 ? year - 1 : year;
      const dateStr = `${prevYear}-${String(prevMonthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = new Date(prevYear, prevMonthIdx, d).getDay();
      cells.push({
        key: `prev-${d}`,
        dateStr,
        dayNum: d,
        inMonth: false,
        isToday: dateStr === todayStr,
        isWeeklyOff: dayOfWeek === 0 || dayOfWeek === 6,
        dayEvents: eventsByDate.get(dateStr) || [],
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayOfWeek = new Date(year, monthIdx, d).getDay();
      const isWeeklyOff = dayOfWeek === 0 || dayOfWeek === 6;
      const dayEvents = eventsByDate.get(dateStr) || [];

      for (const ev of dayEvents) {
        if (ev.type === 'holiday' || ev.type === 'companyOffDay') holidaysCount++;
        else if (ev.type === 'event') sessionsCount++;
        else if (ev.type === 'meeting') townHallsCount++;
      }
      if (isWeeklyOff) weeklyOffCount++;

      cells.push({
        key: `curr-${d}`,
        dateStr,
        dayNum: d,
        inMonth: true,
        isToday: dateStr === todayStr,
        isWeeklyOff,
        dayEvents,
      });
    }

    // Next month leading days
    const remaining = 7 - (cells.length % 7);
    if (remaining < 7) {
      for (let d = 1; d <= remaining; d++) {
        const nextMonthIdx = monthIdx === 11 ? 0 : monthIdx + 1;
        const nextYear = monthIdx === 11 ? year + 1 : year;
        const dateStr = `${nextYear}-${String(nextMonthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayOfWeek = new Date(nextYear, nextMonthIdx, d).getDay();
        cells.push({
          key: `next-${d}`,
          dateStr,
          dayNum: d,
          inMonth: false,
          isToday: dateStr === todayStr,
          isWeeklyOff: dayOfWeek === 0 || dayOfWeek === 6,
          dayEvents: eventsByDate.get(dateStr) || [],
        });
      }
    }

    const workingDaysCount = Math.max(0, daysInMonth - weeklyOffCount - holidaysCount);

    return {
      cells,
      daysInMonth,
      holidaysCount,
      sessionsCount,
      townHallsCount,
      weeklyOffCount,
      workingDaysCount,
    };
  }, [currentMonth, eventsByDate]);

  // Events occurring in the currently navigated month
  const currentMonthEvents = useMemo(() => {
    const year = currentMonth.getFullYear();
    const monthStr = String(currentMonth.getMonth() + 1).padStart(2, '0');
    const prefix = `${year}-${monthStr}`;
    return categoryFilteredEvents.filter((e) => e.dateKey.startsWith(prefix));
  }, [currentMonth, categoryFilteredEvents]);

  // Selected date events list
  const selectedDateEvents = useMemo(() => {
    return categoryFilteredEvents.filter((e) => e.dateKey === selectedDateKey);
  }, [categoryFilteredEvents, selectedDateKey]);

  // Filtered list for "Directory" view
  const displayedListEvents = useMemo(() => {
    if (listFilter === 'upcoming') {
      return categoryFilteredEvents.filter((e) => !e.isPast);
    }
    if (listFilter === 'long-weekends') {
      return categoryFilteredEvents.filter((e) => e.isLongWeekend);
    }
    return categoryFilteredEvents;
  }, [categoryFilteredEvents, listFilter]);

  const upcomingCount = useMemo(() => categoryFilteredEvents.filter((e) => !e.isPast).length, [categoryFilteredEvents]);
  const longWeekendsCount = useMemo(() => categoryFilteredEvents.filter((e) => e.isLongWeekend).length, [categoryFilteredEvents]);

  // Navigation handlers
  const prevMonth = () => {
    void Haptics.selectionAsync().catch(() => undefined);
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    void Haptics.selectionAsync().catch(() => undefined);
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const goToday = () => {
    void Haptics.selectionAsync().catch(() => undefined);
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDateKey(today.toISOString().split('T')[0]);
  };

  const monthLabel = currentMonth.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <Screen
      edges={['left', 'right', 'bottom']}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.indigoSoft}
          colors={[colors.indigo]}
        />
      }
    >
      <ScreenHeader
        title="Calendar & Events"
        subtitle={`Holidays, hackathons, town halls & corporate sessions (${activeYear})`}
        right={
          <View style={styles.headerYearBadge}>
            <CalendarIcon size={13} color={colors.indigoSoft} strokeWidth={2.2} />
            <Text variant="small" weight="bold" color={colors.indigoSoft}>
              {activeYear}
            </Text>
          </View>
        }
      />

      {/* MATCHES THE EXACT WIDTH & ASPECT RATIO OF HISTORY & HOME SECTIONS */}
      <View style={[styles.container, isWide && styles.containerWide]}>
        {/* ============================================================= */}
        {/* OPTION 5: CATEGORY FILTER TABS (All / Holidays / Sessions / Town Halls) */}
        {/* ============================================================= */}
        <View style={styles.categoryPillsWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryPillsContainer}
          >
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                void Haptics.selectionAsync().catch(() => undefined);
                setCategoryFilter('all');
              }}
              style={[
                styles.categoryPill,
                categoryFilter === 'all' && styles.categoryPillActive,
              ]}
            >
              <Sparkles
                size={13}
                color={categoryFilter === 'all' ? colors.white : colors.textSecondary}
                strokeWidth={2.2}
              />
              <Text
                variant="small"
                weight="bold"
                color={categoryFilter === 'all' ? colors.white : colors.textSecondary}
              >
                All ({categoryCounts.all})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                void Haptics.selectionAsync().catch(() => undefined);
                setCategoryFilter('holiday');
              }}
              style={[
                styles.categoryPill,
                categoryFilter === 'holiday' && styles.categoryPillActive,
              ]}
            >
              <Landmark
                size={13}
                color={categoryFilter === 'holiday' ? colors.white : colors.indigoSoft}
                strokeWidth={2.2}
              />
              <Text
                variant="small"
                weight="bold"
                color={categoryFilter === 'holiday' ? colors.white : colors.textSecondary}
              >
                Holidays & Off-Days ({categoryCounts.holiday})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                void Haptics.selectionAsync().catch(() => undefined);
                setCategoryFilter('event');
              }}
              style={[
                styles.categoryPill,
                categoryFilter === 'event' && styles.categoryPillActive,
              ]}
            >
              <Code2
                size={13}
                color={categoryFilter === 'event' ? colors.white : colors.info}
                strokeWidth={2.2}
              />
              <Text
                variant="small"
                weight="bold"
                color={categoryFilter === 'event' ? colors.white : colors.textSecondary}
              >
                Hackathons & Sessions ({categoryCounts.event})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                void Haptics.selectionAsync().catch(() => undefined);
                setCategoryFilter('meeting');
              }}
              style={[
                styles.categoryPill,
                categoryFilter === 'meeting' && styles.categoryPillActive,
              ]}
            >
              <Users
                size={13}
                color={categoryFilter === 'meeting' ? colors.white : colors.leave}
                strokeWidth={2.2}
              />
              <Text
                variant="small"
                weight="bold"
                color={categoryFilter === 'meeting' ? colors.white : colors.textSecondary}
              >
                Town Halls ({categoryCounts.meeting})
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* ============================================================= */}
        {/* VIEW SELECTOR TABS: CALENDAR VS DIRECTORY */}
        {/* ============================================================= */}
        <View style={styles.viewModeTabs}>
          <PressableScale
            onPress={() => {
              void Haptics.selectionAsync().catch(() => undefined);
              setViewMode('calendar');
            }}
            style={[styles.viewModeTab, viewMode === 'calendar' && styles.viewModeTabActive]}
          >
            <CalendarIcon
              size={15}
              color={viewMode === 'calendar' ? colors.white : colors.textSecondary}
              strokeWidth={2.2}
            />
            <Text
              variant="small"
              weight="bold"
              color={viewMode === 'calendar' ? colors.white : colors.textSecondary}
            >
              Calendar View
            </Text>
          </PressableScale>

          <PressableScale
            onPress={() => {
              void Haptics.selectionAsync().catch(() => undefined);
              setViewMode('list');
            }}
            style={[styles.viewModeTab, viewMode === 'list' && styles.viewModeTabActive]}
          >
            <CalendarDays
              size={15}
              color={viewMode === 'list' ? colors.white : colors.textSecondary}
              strokeWidth={2.2}
            />
            <Text
              variant="small"
              weight="bold"
              color={viewMode === 'list' ? colors.white : colors.textSecondary}
            >
              Directory ({categoryFilteredEvents.length})
            </Text>
          </PressableScale>
        </View>

        {/* ============================================================= */}
        {/* VIEW A: INTERACTIVE MONTHLY CALENDAR */}
        {/* ============================================================= */}
        {viewMode === 'calendar' ? (
          <>
            {/* MONTH METRICS SUMMARY CHIPS (Reference from Web Calendar) */}
            <View style={styles.monthMetricsRow}>
              <View style={[styles.metricChip, styles.metricChipHolidays]}>
                <Landmark size={14} color={colors.indigoSoft} strokeWidth={2.2} />
                <Text variant="small" weight="bold" color={colors.indigoSoft}>
                  {monthData.holidaysCount} Holidays
                </Text>
              </View>

              {monthData.sessionsCount > 0 ? (
                <View style={[styles.metricChip, styles.metricChipSessions]}>
                  <Code2 size={14} color={colors.info} strokeWidth={2.2} />
                  <Text variant="small" weight="bold" color={colors.info}>
                    {monthData.sessionsCount} Sessions
                  </Text>
                </View>
              ) : null}

              {monthData.townHallsCount > 0 ? (
                <View style={[styles.metricChip, styles.metricChipTownHalls]}>
                  <Users size={14} color={colors.leave} strokeWidth={2.2} />
                  <Text variant="small" weight="bold" color={colors.leave}>
                    {monthData.townHallsCount} Town Hall
                  </Text>
                </View>
              ) : null}

              <View style={styles.metricChip}>
                <Briefcase size={14} color={colors.textSecondary} strokeWidth={2.2} />
                <Text variant="small" weight="medium" color={colors.textSecondary}>
                  {monthData.workingDaysCount} Workdays
                </Text>
              </View>
            </View>

            {/* INTERACTIVE CALENDAR CARD */}
            <Card variant="raised" padding={18} style={styles.calendarCard}>
              {/* Calendar Navigation Toolbar */}
              <View style={styles.calendarNavHeader}>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel="Previous month"
                  haptic="selection"
                  onPress={prevMonth}
                  style={styles.navArrowBtn}
                >
                  <ChevronLeft size={19} color={colors.textSecondary} strokeWidth={2.2} />
                </PressableScale>

                <View style={styles.calendarCenterTitle}>
                  <Text variant="subheading" weight="bold" color={colors.text}>
                    {monthLabel}
                  </Text>
                  <PressableScale onPress={goToday} style={styles.todayPill}>
                    <Text variant="small" weight="bold" color={colors.indigoSoft}>
                      Today
                    </Text>
                  </PressableScale>
                </View>

                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel="Next month"
                  haptic="selection"
                  onPress={nextMonth}
                  style={styles.navArrowBtn}
                >
                  <ChevronRight size={19} color={colors.textSecondary} strokeWidth={2.2} />
                </PressableScale>
              </View>

              {/* Day of Week Headers */}
              <View style={styles.weekdayRow}>
                {WEEKDAYS.map((w, idx) => (
                  <View key={w} style={styles.weekdayCell}>
                    <Text
                      variant="caption"
                      color={idx === 0 || idx === 6 ? colors.muted : colors.textSecondary}
                      weight={idx === 0 || idx === 6 ? 'medium' : 'semibold'}
                    >
                      {w}
                    </Text>
                  </View>
                ))}
              </View>

              {/* 35/42 Cell Calendar Grid */}
              <View style={styles.calendarGrid}>
                {monthData.cells.map((cell) => {
                  const isSelected = selectedDateKey === cell.dateStr;
                  const hasEvents = cell.dayEvents.length > 0;
                  const primaryEvent = cell.dayEvents[0];
                  const primaryConfig = primaryEvent ? EVENT_CATEGORY_CONFIG[primaryEvent.type] : null;

                  return (
                    <TouchableOpacity
                      key={cell.key}
                      activeOpacity={0.7}
                      onPress={() => {
                        void Haptics.selectionAsync().catch(() => undefined);
                        setSelectedDateKey(cell.dateStr);
                      }}
                      style={[
                        styles.calendarDayCell,
                        !cell.inMonth && styles.dayCellOutside,
                      ]}
                    >
                      <View
                        style={[
                          styles.dayCellCircle,
                          hasEvents && {
                            backgroundColor: isSelected ? colors.indigo : primaryConfig?.bgSoft,
                            borderColor: primaryConfig?.borderColor,
                            borderWidth: 1,
                          },
                          cell.isToday && !isSelected && styles.dayCellToday,
                          isSelected && styles.dayCellSelected,
                        ]}
                      >
                        <Text
                          variant="small"
                          weight={isSelected || hasEvents ? 'bold' : 'medium'}
                          color={
                            isSelected
                              ? colors.white
                              : hasEvents
                              ? primaryConfig?.color
                              : !cell.inMonth
                              ? colors.muted
                              : cell.isWeeklyOff
                              ? colors.muted
                              : colors.text
                          }
                          style={styles.dayNumText}
                        >
                          {cell.dayNum}
                        </Text>

                        {/* Multi-Event Dot Indicators */}
                        {hasEvents && !isSelected && (
                          <View style={styles.eventDotsRow}>
                            {cell.dayEvents.slice(0, 3).map((ev, i) => {
                              const dotColor = EVENT_CATEGORY_CONFIG[ev.type]?.dotColor || colors.indigo;
                              return (
                                <View
                                  key={`${ev._id}-${i}`}
                                  style={[styles.multiDot, { backgroundColor: dotColor }]}
                                />
                              );
                            })}
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Legend Row (Reference from Web) */}
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#5965F2' }]} />
                  <Text variant="caption" color={colors.indigoSoft}>
                    Holiday
                  </Text>
                </View>

                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#76B8FF' }]} />
                  <Text variant="caption" color={colors.info}>
                    Hackathon
                  </Text>
                </View>

                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#C4A7FF' }]} />
                  <Text variant="caption" color={colors.leave}>
                    Town Hall
                  </Text>
                </View>

                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#F5C76B' }]} />
                  <Text variant="caption" color={colors.warning}>
                    Off-Day
                  </Text>
                </View>
              </View>
            </Card>

            {/* SELECTED DAY EVENTS DETAILS (Option 2: Corporate Events, Sessions & Holidays) */}
            {selectedDateEvents.length > 0 ? (
              <View style={styles.selectedEventsStack}>
                {selectedDateEvents.map((eventItem) => {
                  const cfg = EVENT_CATEGORY_CONFIG[eventItem.type] || EVENT_CATEGORY_CONFIG.holiday;
                  const IconComp = cfg.icon;

                  return (
                    <Card
                      key={eventItem._id}
                      variant="raised"
                      padding={18}
                      style={[
                        styles.selectedEventCard,
                        { borderColor: cfg.borderColor, borderWidth: 1 },
                      ]}
                    >
                      <View style={styles.selectedHolidayHeader}>
                        <View style={[styles.selectedBadgePill, { backgroundColor: cfg.bgSoft }]}>
                          <IconComp size={13} color={cfg.color} strokeWidth={2.4} />
                          <Text variant="small" weight="bold" color={cfg.color}>
                            {cfg.badgeLabel}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.countdownPill,
                            eventItem.isToday ? styles.countdownPillToday : null,
                          ]}
                        >
                          <Clock
                            size={11}
                            color={eventItem.isToday ? colors.success : cfg.color}
                            strokeWidth={2.2}
                          />
                          <Text
                            variant="small"
                            weight="bold"
                            color={eventItem.isToday ? colors.success : cfg.color}
                          >
                            {eventItem.isToday
                              ? 'Today! 🎉'
                              : eventItem.isTomorrow
                              ? 'Tomorrow! ⏰'
                              : eventItem.isPast
                              ? 'Concluded'
                              : `In ${eventItem.daysRemaining} days`}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.selectedHolidayMain}>
                        <Text variant="heading" color={colors.white} style={styles.selectedTitle}>
                          {eventItem.name}
                        </Text>
                        <Text variant="body" color={cfg.color} style={styles.selectedDateText}>
                          {eventItem.dateObj.toLocaleDateString(undefined, {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </Text>

                        {/* Location or Timing row if present */}
                        {(eventItem.startTime || eventItem.location) ? (
                          <View style={styles.eventMetaRow}>
                            {eventItem.startTime ? (
                              <View style={styles.eventMetaChip}>
                                <Clock size={11} color={colors.textSecondary} strokeWidth={2} />
                                <Text variant="small" color={colors.textSecondary}>
                                  {eventItem.startTime}{eventItem.endTime ? ` - ${eventItem.endTime}` : ''}
                                </Text>
                              </View>
                            ) : null}

                            {eventItem.location ? (
                              <View style={styles.eventMetaChip}>
                                <MapPin size={11} color={colors.textSecondary} strokeWidth={2} />
                                <Text variant="small" color={colors.textSecondary} numberOfLines={1}>
                                  {eventItem.location}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        ) : null}

                        {eventItem.description ? (
                          <Text variant="caption" color={colors.muted} style={styles.selectedDesc}>
                            {eventItem.description}
                          </Text>
                        ) : null}
                      </View>

                      <View style={styles.selectedHolidayFooter}>
                        {eventItem.isLongWeekend ? (
                          <View style={styles.longWeekendTag}>
                            <Palmtree size={12} color={colors.warning} strokeWidth={2.2} />
                            <Text variant="small" weight="bold" color={colors.warning}>
                              🎉 3-Day Long Weekend
                            </Text>
                          </View>
                        ) : eventItem.type === 'holiday' || eventItem.type === 'companyOffDay' ? (
                          <View style={styles.exemptionTag}>
                            <CheckCircle2 size={12} color={colors.info} strokeWidth={2.2} />
                            <Text variant="small" weight="medium" color={colors.info}>
                              Punching & Attendance Exempted
                            </Text>
                          </View>
                        ) : (
                          <View style={[styles.exemptionTag, { backgroundColor: cfg.bgSoft }]}>
                            <Award size={12} color={cfg.color} strokeWidth={2.2} />
                            <Text variant="small" weight="medium" color={cfg.color}>
                              Open Company Session • Calendar Synced
                            </Text>
                          </View>
                        )}
                      </View>
                    </Card>
                  );
                })}
              </View>
            ) : (
              <Card variant="glass" padding={16} style={styles.emptySelectedDateCard}>
                <CalendarIcon size={18} color={colors.muted} strokeWidth={1.8} />
                <Text variant="caption" color={colors.muted}>
                  No {categoryFilter === 'all' ? 'events or holidays' : categoryFilter === 'holiday' ? 'holidays' : categoryFilter === 'event' ? 'sessions' : 'town halls'} scheduled for {new Date(selectedDateKey + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}.
                </Text>
              </Card>
            )}

            {/* EVENTS THIS MONTH SECTION */}
            <View style={styles.monthSectionHeader}>
              <Text variant="subheading" weight="bold" color={colors.text}>
                Schedule in {currentMonth.toLocaleDateString(undefined, { month: 'long' })}
              </Text>
              <Text variant="caption" color={colors.muted}>
                {currentMonthEvents.length} items
              </Text>
            </View>

            {currentMonthEvents.length === 0 ? (
              <Card variant="glass" padding={20} style={styles.emptyMonthCard}>
                <Coffee size={24} color={colors.muted} strokeWidth={1.8} />
                <Text variant="small" color={colors.muted} align="center">
                  No {categoryFilter === 'all' ? 'scheduled corporate events or holidays' : 'items matching this category'} in {currentMonth.toLocaleDateString(undefined, { month: 'long' })}.
                </Text>
              </Card>
            ) : (
              <View style={styles.monthHolidaysList}>
                {currentMonthEvents.map((eventItem) => {
                  const isSelected = selectedDateKey === eventItem.dateKey;
                  const cfg = EVENT_CATEGORY_CONFIG[eventItem.type] || EVENT_CATEGORY_CONFIG.holiday;

                  return (
                    <PressableScale
                      key={eventItem._id}
                      onPress={() => {
                        void Haptics.selectionAsync().catch(() => undefined);
                        setSelectedDateKey(eventItem.dateKey);
                      }}
                      style={[
                        styles.monthHolidayItem,
                        isSelected && styles.monthHolidayItemSelected,
                        { borderLeftColor: cfg.dotColor, borderLeftWidth: 3 },
                      ]}
                    >
                      <View style={styles.monthHolidayDateBox}>
                        <Text variant="small" weight="bold" color={cfg.color}>
                          {eventItem.dayNum}
                        </Text>
                        <Text variant="caption" color={colors.muted}>
                          {eventItem.dayName}
                        </Text>
                      </View>

                      <View style={styles.monthHolidayInfo}>
                        <View style={styles.monthItemHeaderRow}>
                          <Text variant="body" weight="bold" color={colors.text} numberOfLines={1} style={styles.monthEventTitle}>
                            {eventItem.name}
                          </Text>
                        </View>
                        <Text variant="caption" color={colors.muted} numberOfLines={1}>
                          {eventItem.description || cfg.label}
                        </Text>
                      </View>

                      <View style={styles.monthHolidayBadge}>
                        {eventItem.isLongWeekend && (
                          <View style={styles.miniLongWeekendPill}>
                            <Palmtree size={10} color={colors.warning} strokeWidth={2} />
                          </View>
                        )}
                        <Text
                          variant="small"
                          weight="bold"
                          color={eventItem.isPast ? colors.muted : cfg.color}
                        >
                          {eventItem.isPast ? 'Passed' : `In ${eventItem.daysRemaining}d`}
                        </Text>
                      </View>
                    </PressableScale>
                  );
                })}
              </View>
            )}
          </>
        ) : (
          /* ============================================================= */
          /* VIEW B: ALL EVENTS DIRECTORY LIST */
          /* ============================================================= */
          <>
            {/* Filter Tabs */}
            <View style={styles.tabsRow}>
              <PressableScale
                onPress={() => {
                  void Haptics.selectionAsync().catch(() => undefined);
                  setListFilter('upcoming');
                }}
                style={[styles.tabBtn, listFilter === 'upcoming' && styles.tabBtnActive]}
              >
                <Text
                  variant="small"
                  weight="bold"
                  color={listFilter === 'upcoming' ? colors.white : colors.textSecondary}
                >
                  Upcoming ({upcomingCount})
                </Text>
              </PressableScale>

              <PressableScale
                onPress={() => {
                  void Haptics.selectionAsync().catch(() => undefined);
                  setListFilter('all');
                }}
                style={[styles.tabBtn, listFilter === 'all' && styles.tabBtnActive]}
              >
                <Text
                  variant="small"
                  weight="bold"
                  color={listFilter === 'all' ? colors.white : colors.textSecondary}
                >
                  All Year ({categoryFilteredEvents.length})
                </Text>
              </PressableScale>

              <PressableScale
                onPress={() => {
                  void Haptics.selectionAsync().catch(() => undefined);
                  setListFilter('long-weekends');
                }}
                style={[styles.tabBtn, listFilter === 'long-weekends' && styles.tabBtnActive]}
              >
                <Text
                  variant="small"
                  weight="bold"
                  color={listFilter === 'long-weekends' ? colors.white : colors.textSecondary}
                >
                  Long Weekends ({longWeekendsCount})
                </Text>
              </PressableScale>
            </View>

            {/* Events Directory List */}
            {loading ? (
              <View style={styles.skeletonList}>
                <Skeleton style={styles.skeletonItem} />
                <Skeleton style={styles.skeletonItem} />
                <Skeleton style={styles.skeletonItem} />
              </View>
            ) : displayedListEvents.length === 0 ? (
              <Card variant="glass" padding={32} style={styles.emptyCard}>
                <CalendarDays size={40} color={colors.muted} strokeWidth={1.5} />
                <Text variant="subheading" color={colors.text} style={styles.emptyTitle}>
                  No Events Found
                </Text>
                <Text variant="caption" color={colors.muted} style={styles.emptyDesc}>
                  {listFilter === 'upcoming'
                    ? 'All scheduled events in this category have concluded.'
                    : 'No events matching this filter were found.'}
                </Text>
              </Card>
            ) : (
              <View style={styles.holidayList}>
                {displayedListEvents.map((eventItem) => {
                  const isNext = nextItem?._id === eventItem._id;
                  const cfg = EVENT_CATEGORY_CONFIG[eventItem.type] || EVENT_CATEGORY_CONFIG.holiday;
                  const IconComp = cfg.icon;

                  return (
                    <Card
                      key={eventItem._id}
                      variant={isNext ? 'raised' : 'glass'}
                      padding={16}
                      style={[
                        styles.holidayCard,
                        isNext && styles.holidayCardNext,
                        eventItem.isPast && styles.holidayCardPast,
                        { borderLeftColor: cfg.dotColor, borderLeftWidth: 3 },
                      ]}
                    >
                      <View style={styles.holidayCardInner}>
                        {/* Left: Date Box */}
                        <View
                          style={[
                            styles.dateBox,
                            isNext && styles.dateBoxNext,
                            eventItem.isPast && styles.dateBoxPast,
                          ]}
                        >
                          <Text
                            variant="small"
                            weight="bold"
                            color={isNext ? colors.white : cfg.color}
                            style={styles.dateMonth}
                          >
                            {eventItem.monthName}
                          </Text>
                          <Text
                            variant="heading"
                            weight="bold"
                            color={isNext ? colors.white : colors.text}
                            style={styles.dateDay}
                          >
                            {eventItem.dayNum}
                          </Text>
                          <Text
                            variant="small"
                            weight="medium"
                            color={isNext ? 'rgba(255,255,255,0.85)' : colors.muted}
                            style={styles.dateWeekday}
                          >
                            {eventItem.dayName}
                          </Text>
                        </View>

                        {/* Middle: Details */}
                        <View style={styles.holidayDetails}>
                          <View style={styles.holidayNameRow}>
                            <Text
                              variant="body"
                              weight="bold"
                              color={eventItem.isPast ? colors.muted : colors.text}
                              numberOfLines={1}
                              style={styles.holidayName}
                            >
                              {eventItem.name}
                            </Text>
                            {isNext && (
                              <View style={styles.nextTinyPill}>
                                <Text variant="small" weight="bold" color={colors.indigo}>
                                  NEXT
                                </Text>
                              </View>
                            )}
                          </View>

                          {eventItem.description ? (
                            <Text
                              variant="caption"
                              color={colors.muted}
                              numberOfLines={2}
                              style={styles.holidayDesc}
                            >
                              {eventItem.description}
                            </Text>
                          ) : null}

                          <View style={styles.tagsRow}>
                            <View style={[styles.tagCategory, { backgroundColor: cfg.bgSoft }]}>
                              <IconComp size={10} color={cfg.color} strokeWidth={2.4} />
                              <Text variant="small" weight="bold" color={cfg.color}>
                                {cfg.label}
                              </Text>
                            </View>

                            {eventItem.location ? (
                              <View style={styles.tagLocation}>
                                <MapPin size={9} color={colors.textSecondary} strokeWidth={2} />
                                <Text variant="small" color={colors.textSecondary} numberOfLines={1}>
                                  {eventItem.location}
                                </Text>
                              </View>
                            ) : null}

                            {eventItem.isLongWeekend && (
                              <View style={styles.tagLongWeekend}>
                                <Palmtree size={10} color={colors.warning} strokeWidth={2.2} />
                                <Text variant="small" weight="bold" color={colors.warning}>
                                  Long Weekend
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>

                        {/* Right: Status Pill */}
                        <View style={styles.holidayRight}>
                          {eventItem.isToday ? (
                            <View style={[styles.statusBadge, styles.statusToday]}>
                              <Text variant="small" weight="bold" color={colors.success}>
                                Today!
                              </Text>
                            </View>
                          ) : eventItem.isTomorrow ? (
                            <View style={[styles.statusBadge, styles.statusTomorrow]}>
                              <Text variant="small" weight="bold" color={colors.indigo}>
                                Tomorrow
                              </Text>
                            </View>
                          ) : eventItem.isPast ? (
                            <View style={[styles.statusBadge, styles.statusPast]}>
                              <Text variant="small" weight="medium" color={colors.muted}>
                                Passed
                              </Text>
                            </View>
                          ) : (
                            <View
                              style={[
                                styles.statusBadge,
                                isNext ? styles.statusNext : styles.statusFuture,
                              ]}
                            >
                              <Text
                                variant="small"
                                weight="bold"
                                color={isNext ? colors.indigo : colors.textSecondary}
                              >
                                In {eventItem.daysRemaining}d
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </Card>
                  );
                })}
              </View>
            )}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.lg,
    width: '100%',
  },
  containerWide: {
    maxWidth: 620,
    alignSelf: 'center',
  },
  headerYearBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(89, 101, 242, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(89, 101, 242, 0.25)',
  },

  // Category Filter Pills (Option 5)
  categoryPillsWrapper: {
    marginHorizontal: -spacing.sm,
  },
  categoryPillsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryPillActive: {
    backgroundColor: colors.indigo,
    borderColor: colors.indigo,
  },

  // View Mode Tabs
  viewModeTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radii.md,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  viewModeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 8,
    borderRadius: radii.sm,
  },
  viewModeTabActive: {
    backgroundColor: 'rgba(89, 101, 242, 0.28)',
    borderWidth: 1,
    borderColor: 'rgba(89, 101, 242, 0.45)',
  },

  // Month Metrics Row
  monthMetricsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricChipHolidays: {
    backgroundColor: 'rgba(89, 101, 242, 0.12)',
    borderColor: 'rgba(89, 101, 242, 0.3)',
  },
  metricChipSessions: {
    backgroundColor: 'rgba(118, 184, 255, 0.12)',
    borderColor: 'rgba(118, 184, 255, 0.3)',
  },
  metricChipTownHalls: {
    backgroundColor: 'rgba(196, 167, 255, 0.12)',
    borderColor: 'rgba(196, 167, 255, 0.3)',
  },

  // Calendar Card
  calendarCard: {
    gap: spacing.md,
  },
  calendarNavHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.xs,
  },
  navArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  calendarCenterTitle: {
    alignItems: 'center',
    gap: 4,
  },
  todayPill: {
    backgroundColor: 'rgba(89, 101, 242, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDayCell: {
    width: '14.28%',
    aspectRatio: 1,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellOutside: {
    opacity: 0.3,
  },
  dayCellCircle: {
    width: '100%',
    height: '100%',
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: colors.info,
  },
  dayCellSelected: {
    backgroundColor: colors.indigo,
    borderColor: colors.indigo,
  },
  dayNumText: {
    fontSize: 13,
  },
  eventDotsRow: {
    position: 'absolute',
    bottom: 3,
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  multiDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  // Legend Row
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Selected Day Events Details
  selectedEventsStack: {
    gap: spacing.md,
  },
  selectedEventCard: {
    gap: spacing.md,
  },
  selectedHolidayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  countdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  countdownPillToday: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
  },
  selectedHolidayMain: {
    gap: 4,
  },
  selectedTitle: {
    fontSize: 18,
    lineHeight: 24,
  },
  selectedDateText: {
    fontSize: 14,
    fontWeight: '600',
  },
  eventMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: 4,
  },
  eventMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.xs,
  },
  selectedDesc: {
    marginTop: 4,
    lineHeight: 18,
  },
  selectedHolidayFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  longWeekendTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(245, 199, 107, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  exemptionTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(118, 184, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  emptySelectedDateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    justifyContent: 'center',
  },

  // Month Schedule List
  monthSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  emptyMonthCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  monthHolidaysList: {
    gap: spacing.sm,
  },
  monthHolidayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthHolidayItemSelected: {
    backgroundColor: 'rgba(89, 101, 242, 0.1)',
    borderColor: 'rgba(89, 101, 242, 0.4)',
  },
  monthHolidayDateBox: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: 6,
    borderRadius: radii.sm,
  },
  monthHolidayInfo: {
    flex: 1,
    gap: 2,
  },
  monthItemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  monthEventTitle: {
    fontSize: 14,
  },
  monthHolidayBadge: {
    alignItems: 'flex-end',
    gap: 4,
  },
  miniLongWeekendPill: {
    backgroundColor: 'rgba(245, 199, 107, 0.15)',
    padding: 3,
    borderRadius: radii.full,
  },

  // Directory View Tabs
  tabsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabBtnActive: {
    backgroundColor: colors.indigo,
    borderColor: colors.indigo,
  },

  // Directory Cards List
  holidayList: {
    gap: spacing.sm,
  },
  holidayCard: {
    borderRadius: radii.md,
  },
  holidayCardNext: {
    borderColor: 'rgba(89, 101, 242, 0.45)',
    borderWidth: 1,
  },
  holidayCardPast: {
    opacity: 0.65,
  },
  holidayCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dateBox: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  dateBoxNext: {
    backgroundColor: colors.indigo,
    borderColor: colors.indigo,
  },
  dateBoxPast: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  dateMonth: {
    fontSize: 10,
    textTransform: 'uppercase',
  },
  dateDay: {
    fontSize: 18,
    lineHeight: 22,
  },
  dateWeekday: {
    fontSize: 10,
  },
  holidayDetails: {
    flex: 1,
    gap: 3,
  },
  holidayNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  holidayName: {
    fontSize: 14,
    flex: 1,
  },
  nextTinyPill: {
    backgroundColor: colors.white,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radii.full,
  },
  holidayDesc: {
    lineHeight: 16,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  tagCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  tagLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.xs,
    maxWidth: 130,
  },
  tagLongWeekend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(245, 199, 107, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  holidayRight: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  statusToday: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
  },
  statusTomorrow: {
    backgroundColor: 'rgba(89, 101, 242, 0.18)',
  },
  statusPast: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  statusNext: {
    backgroundColor: colors.white,
  },
  statusFuture: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },

  // Skeletons & Empty State
  skeletonList: {
    gap: spacing.sm,
  },
  skeletonItem: {
    height: 72,
    borderRadius: radii.md,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  emptyTitle: {
    marginTop: spacing.xs,
  },
  emptyDesc: {
    textAlign: 'center',
    maxWidth: 260,
  },
});
