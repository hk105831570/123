/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Calculator, Clock, Calendar as CalendarIcon, DollarSign, Info, AlertCircle, Settings2, Briefcase, Coins, ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const STANDARD_DAYS_PER_MONTH = 21.75;
const STANDARD_HOURS_PER_DAY = 8;

const calculateHours = (start: string, end: string, breakHrs: number) => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let diff = (eh + em / 60) - (sh + sm / 60);
  if (diff < 0) diff += 24; // Handle cross-midnight
  return Math.max(0, diff - (breakHrs || 0));
};

const formatDate = (y: number, m: number, d: number) => 
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const isWeekday = (y: number, m: number, d: number) => {
  const day = new Date(y, m, d).getDay();
  return day !== 0 && day !== 6;
};

export default function App() {
  // Income State
  const [baseSalary, setBaseSalary] = useState<number>(2000);
  const [allowances, setAllowances] = useState<number>(0);

  // Calendar State
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dateOverrides, setDateOverrides] = useState<Record<string, boolean>>({});
  const [statutoryHolidays, setStatutoryHolidays] = useState<Record<string, boolean>>({});
  const [rateOverrides, setRateOverrides] = useState<Record<string, 'weekday' | 'weekend'>>({});

  // Interaction State
  const [editMode, setEditMode] = useState<'work' | 'holiday' | 'rate'>('work');

  // Schedule State
  const [weekdayStart, setWeekdayStart] = useState<string>('09:00');
  const [weekdayEnd, setWeekdayEnd] = useState<string>('18:00');
  const [weekdayBreak, setWeekdayBreak] = useState<number>(1);
  
  const [weekendStart, setWeekendStart] = useState<string>('10:00');
  const [weekendEnd, setWeekendEnd] = useState<string>('18:00');
  const [weekendBreak, setWeekendBreak] = useState<number>(1);

  // Settings State
  const [useMultipliers, setUseMultipliers] = useState<boolean>(true);

  // Calendar Navigation
  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const offset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // Make Monday = 0
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanksArray = Array.from({ length: offset }, (_, i) => i);

  const toggleDate = (d: number) => {
    const dateStr = formatDate(year, month, d);
    
    if (editMode === 'holiday') {
      setStatutoryHolidays(prev => ({
        ...prev,
        [dateStr]: !prev[dateStr]
      }));
    } else if (editMode === 'rate') {
      setRateOverrides(prev => {
        const current = prev[dateStr];
        const isWkday = isWeekday(year, month, d);
        
        // Cycle: Default -> Override to Weekday (1.5) -> Override to Weekend (2.0) -> Back to Default
        if (!current) return { ...prev, [dateStr]: isWkday ? 'weekend' : 'weekday' };
        if (current === (isWkday ? 'weekend' : 'weekday')) return { ...prev, [dateStr]: isWkday ? 'weekday' : 'weekend' };
        
        const { [dateStr]: _, ...rest } = prev;
        return rest;
      });
    } else {
      const defaultWorked = isWeekday(year, month, d);
      const currentlyWorked = dateOverrides[dateStr] !== undefined ? dateOverrides[dateStr] : defaultWorked;
      
      setDateOverrides(prev => ({
        ...prev,
        [dateStr]: !currentlyWorked
      }));
    }
  };

  // Calculations
  const stats = useMemo(() => {
    let workedWeekdays = 0;
    let workedWeekends = 0;
    let workedHolidays = 0;
    let totalWeekdaysInMonth = 0;
    let absenceDays = 0;
    let totalActualHours = 0;

    let weekdayOtHoursTotal = 0;
    let weekendOtHoursTotal = 0;
    let holidayOtHoursTotal = 0;

    const weekdayDailyHours = calculateHours(weekdayStart, weekdayEnd, weekdayBreak);
    const weekendDailyHours = calculateHours(weekendStart, weekendEnd, weekendBreak);

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = formatDate(year, month, d);
      const isWkday = isWeekday(year, month, d);
      const isHoliday = statutoryHolidays[dateStr] || false;
      
      // Determine Effective Rate Type (1.5x vs 2.0x)
      const rateType = rateOverrides[dateStr] || (isWkday ? 'weekday' : 'weekend');
      
      if (isWkday) totalWeekdaysInMonth++;
      
      const worked = dateOverrides[dateStr] !== undefined ? dateOverrides[dateStr] : isWkday;
      
      if (isHoliday) {
        if (worked) {
          workedHolidays++;
          holidayOtHoursTotal += weekdayDailyHours; 
          totalActualHours += weekdayDailyHours;
        }
      } else {
        if (worked) {
          if (rateType === 'weekday') {
            workedWeekdays++;
            const dailyOt = Math.max(weekdayDailyHours - STANDARD_HOURS_PER_DAY, 0);
            weekdayOtHoursTotal += dailyOt;
            totalActualHours += weekdayDailyHours;
          } else {
            workedWeekends++;
            weekendOtHoursTotal += weekendDailyHours;
            totalActualHours += weekendDailyHours;
          }
        } else if (isWkday) {
          absenceDays++;
        }
      }
    }

    // 1. Standard Wage Calculation (21.75 days, 8 hours)
    const standardHourlyWage = baseSalary / STANDARD_DAYS_PER_MONTH / STANDARD_HOURS_PER_DAY;
    const weekdayOtHourlyWage = standardHourlyWage * 1.5;
    const weekendOtHourlyWage = standardHourlyWage * 2.0;
    const holidayOtHourlyWage = standardHourlyWage * 3.0;

    // 2. Overtime Pay Calculation
    const weekdayOtPay = useMultipliers ? weekdayOtHoursTotal * weekdayOtHourlyWage : 0;
    const weekendOtPay = useMultipliers ? weekendOtHoursTotal * weekendOtHourlyWage : 0;
    const holidayOtPay = useMultipliers ? holidayOtHoursTotal * holidayOtHourlyWage : 0;
    const totalOtPay = weekdayOtPay + weekendOtPay + holidayOtPay;

    // 3. Absence Deduction
    const absenceDeduction = absenceDays * STANDARD_HOURS_PER_DAY * standardHourlyWage;
    const effectiveBaseSalary = Math.max(0, baseSalary - absenceDeduction);

    // 4. Total Income
    const totalIncome = effectiveBaseSalary + allowances + totalOtPay;

    // 5. Real Blended Hourly Wage
    const realHourlyWage = totalActualHours > 0 ? totalIncome / totalActualHours : 0;

    return {
      workedWeekdays,
      workedWeekends,
      workedHolidays,
      totalWeekdaysInMonth,
      absenceDays,
      absenceDeduction,
      effectiveBaseSalary,
      standardHourlyWage,
      weekdayOtHourlyWage,
      weekendOtHourlyWage,
      holidayOtHourlyWage,
      weekdayOtHoursTotal,
      weekendOtHoursTotal,
      holidayOtHoursTotal,
      totalActualHours,
      weekdayOtPay,
      weekendOtPay,
      holidayOtPay,
      totalOtPay,
      totalIncome,
      realHourlyWage,
      weekdayDailyHours,
      weekendDailyHours
    };
  }, [baseSalary, allowances, weekdayStart, weekdayEnd, weekdayBreak, weekendStart, weekendEnd, weekendBreak, useMultipliers, year, month, daysInMonth, dateOverrides, statutoryHolidays, rateOverrides]);

  // Chart Data
  const pieData = [
    { name: '基本工资(出勤)', value: Math.round(stats.effectiveBaseSalary), color: '#3b82f6' }, 
    { name: '补贴/奖金', value: Math.round(allowances), color: '#10b981' }, 
    { name: '工作日加班费', value: Math.round(stats.weekdayOtPay), color: '#f59e0b' },
    { name: '周末加班费', value: Math.round(stats.weekendOtPay), color: '#ef4444' },
    { name: '法定节假日费', value: Math.round(stats.holidayOtPay), color: '#8b5cf6' },
  ].filter(d => d.value > 0);

  const barData = [
    {
      name: '法定基础',
      '时薪': Number(stats.standardHourlyWage.toFixed(2)),
      fill: '#3b82f6'
    },
    {
      name: '法定节假日',
      '时薪': Number(stats.holidayOtHourlyWage.toFixed(2)),
      fill: '#8b5cf6'
    },
    {
      name: '综合真实',
      '时薪': Number(stats.realHourlyWage.toFixed(2)),
      fill: '#06b6d4'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
              <Calculator size={20} />
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">真实时薪计算器</h1>
          </div>
          <div className="text-sm text-slate-500 hidden sm:block">
            看透薪资背后的时间成本
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Inputs */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Income Section */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-6">
              <Coins className="text-indigo-600" size={20} />
              <h2 className="text-lg font-semibold">月度薪资组成</h2>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">基本工资 (元)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-slate-400 sm:text-sm">¥</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={baseSalary || ''}
                    onChange={(e) => setBaseSalary(Number(e.target.value))}
                    className="block w-full pl-8 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 sm:text-sm transition-shadow"
                    placeholder="2000"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">绩效/补贴/奖金 (元)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-slate-400 sm:text-sm">¥</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={allowances || ''}
                    onChange={(e) => setAllowances(Number(e.target.value))}
                    className="block w-full pl-8 pr-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 sm:text-sm transition-shadow"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Schedule Section */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-6">
              <Clock className="text-indigo-600" size={20} />
              <h2 className="text-lg font-semibold">工作时间安排</h2>
            </div>
            
            <div className="space-y-6">
              {/* Calendar */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <button onClick={prevMonth} className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-600"><ChevronLeft size={18}/></button>
                  <span className="font-semibold text-slate-800">{year}年 {month + 1}月</span>
                  <button onClick={nextMonth} className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-600"><ChevronRight size={18}/></button>
                </div>

                <div className="flex items-center justify-center gap-2 mb-4 bg-white p-1 rounded-lg border border-slate-200 text-[10px]">
                  <button 
                    onClick={() => setEditMode('work')}
                    className={cn(
                      "flex-1 py-1 rounded-md transition-all font-medium",
                      editMode === 'work' ? "bg-blue-50 text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    记加班
                  </button>
                  <button 
                    onClick={() => setEditMode('holiday')}
                    className={cn(
                      "flex-1 py-1 rounded-md transition-all font-medium",
                      editMode === 'holiday' ? "bg-purple-50 text-purple-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    法定假
                  </button>
                  <button 
                    onClick={() => setEditMode('rate')}
                    className={cn(
                      "flex-1 py-1 rounded-md transition-all font-medium",
                      editMode === 'rate' ? "bg-amber-50 text-amber-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    调班/倍率
                  </button>
                </div>
                
                <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
                  {['一', '二', '三', '四', '五', '六', '日'].map(d => (
                    <div key={d} className="text-slate-500 font-medium py-1">{d}</div>
                  ))}
                </div>
                
                <div className="grid grid-cols-7 gap-1">
                  {blanksArray.map(b => <div key={`blank-${b}`} className="aspect-square"></div>)}
                  {daysArray.map(d => {
                    const dateStr = formatDate(year, month, d);
                    const isWkday = isWeekday(year, month, d);
                    const isHoliday = statutoryHolidays[dateStr] || false;
                    const isWorked = dateOverrides[dateStr] !== undefined ? dateOverrides[dateStr] : isWkday;
                    const rateOverride = rateOverrides[dateStr];
                    const effectiveRate = rateOverride || (isWkday ? 'weekday' : 'weekend');
                    
                    let btnClass = "aspect-square rounded-md flex flex-col items-center justify-center text-xs transition-all border relative ";
                    if (isHoliday) {
                      if (isWorked) btnClass += "bg-purple-600 text-white border-purple-700 font-bold shadow-md";
                      else btnClass += "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100";
                    } else if (isWorked) {
                      if (effectiveRate === 'weekday') btnClass += "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200 font-semibold shadow-sm";
                      else btnClass += "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200 font-semibold shadow-sm";
                    } else {
                      if (isWkday) btnClass += "bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200 line-through";
                      else btnClass += "bg-white text-slate-500 border-slate-200 hover:bg-slate-100";
                    }

                    return (
                      <button key={d} onClick={() => toggleDate(d)} className={btnClass}>
                        {d}
                        {isHoliday ? (
                          <span className={cn("text-[7px] mt-0.5", isWorked ? "text-purple-100" : "text-purple-400")}>法定</span>
                        ) : (
                          rateOverride && <span className={cn("text-[7px] mt-0.5", isWorked ? "text-current" : "text-slate-400")}>{rateOverride === 'weekday' ? '1.5x' : '2.0x'}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                
                <div className="flex flex-wrap gap-x-3 gap-y-2 mt-4 text-[10px] justify-center text-slate-600 leading-tight">
                  <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-blue-100 border border-blue-200 rounded-sm"></div>工作</div>
                  <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-slate-100 border border-slate-200 rounded-sm"></div>休假</div>
                  <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-amber-100 border border-amber-200 rounded-sm"></div>周末加班</div>
                  <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-purple-50 border border-purple-200 rounded-sm"></div>法定假</div>
                  <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-purple-600 border border-purple-700 rounded-sm"></div>法定班</div>
                </div>
                <p className="text-[11px] text-slate-400 mt-3 text-center italic">
                  点击“记加班”可切换出勤；点击“定法定假”可标记法定节假日（三倍工资）。
                </p>
              </div>

              {/* Weekday Times */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-sm font-medium text-slate-800">工作日作息</label>
                  <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
                    {stats.weekdayDailyHours.toFixed(1)} 小时/天
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">上班时间</label>
                    <input
                      type="time"
                      value={weekdayStart}
                      onChange={(e) => setWeekdayStart(e.target.value)}
                      className="block w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 sm:text-sm transition-shadow"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">下班时间</label>
                    <input
                      type="time"
                      value={weekdayEnd}
                      onChange={(e) => setWeekdayEnd(e.target.value)}
                      className="block w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 sm:text-sm transition-shadow"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">休息/就餐时间 (小时)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={weekdayBreak}
                    onChange={(e) => setWeekdayBreak(Number(e.target.value))}
                    className="block w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 sm:text-sm transition-shadow"
                  />
                </div>
              </div>

              {/* Weekend Times */}
              <div className="pt-5 border-t border-slate-100">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-sm font-medium text-slate-800">周末作息</label>
                  <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
                    {stats.weekendDailyHours.toFixed(1)} 小时/天
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">上班时间</label>
                    <input
                      type="time"
                      value={weekendStart}
                      onChange={(e) => setWeekendStart(e.target.value)}
                      className="block w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 sm:text-sm transition-shadow"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">下班时间</label>
                    <input
                      type="time"
                      value={weekendEnd}
                      onChange={(e) => setWeekendEnd(e.target.value)}
                      className="block w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 sm:text-sm transition-shadow"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">休息/就餐时间 (小时)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={weekendBreak}
                    onChange={(e) => setWeekendBreak(Number(e.target.value))}
                    className="block w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 sm:text-sm transition-shadow"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Settings Section */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Settings2 className="text-indigo-600" size={20} />
              <h2 className="text-lg font-semibold">计算设置</h2>
            </div>
            
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative flex items-center mt-1">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={useMultipliers}
                  onChange={(e) => setUseMultipliers(e.target.checked)}
                />
                <div className={cn(
                  "w-11 h-6 rounded-full transition-colors duration-200 ease-in-out",
                  useMultipliers ? "bg-indigo-600" : "bg-slate-300"
                )}></div>
                <div className={cn(
                  "absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out shadow-sm",
                  useMultipliers ? "translate-x-5" : "translate-x-0"
                )}></div>
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900 group-hover:text-indigo-600 transition-colors">
                  开启加班费计算
                </div>
                <div className="text-xs text-slate-500 mt-1 leading-relaxed">
                  开启后，将按照法定标准（工作日1.5倍，周末2倍）计算加班费并计入总月薪。关闭则表示加班无额外报酬（即义务加班）。
                </div>
              </div>
            </label>
          </section>

        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
              <div className="absolute -right-4 -top-4 opacity-10">
                <DollarSign size={100} />
              </div>
              <div className="relative z-10">
                <div className="text-indigo-100 text-sm font-medium mb-1">当月综合真实时薪</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight">{stats.realHourlyWage.toFixed(2)}</span>
                  <span className="text-indigo-200">元/小时</span>
                </div>
                <div className="mt-3 text-xs text-indigo-200 bg-indigo-700/50 inline-block px-2 py-1 rounded-md">
                  基于当月总收入 / 实际总工时计算
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-center">
              <div className="text-slate-500 text-sm font-medium mb-1 flex items-center gap-1.5">
                <Briefcase size={16} />
                法定基础时薪
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-slate-800">{stats.standardHourlyWage.toFixed(2)}</span>
                <span className="text-slate-500 text-sm">元/小时</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-center">
              <div className="text-slate-500 text-sm font-medium mb-1 flex items-center gap-1.5">
                <CalendarIcon size={16} />
                预估当月总薪资
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-slate-800">{stats.totalIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                <span className="text-slate-500 text-sm">元</span>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pie Chart */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="text-base font-semibold text-slate-800 mb-4">
                当月收入构成
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      formatter={(value: number) => [`${value} 元`, '金额']}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bar Chart */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="text-base font-semibold text-slate-800 mb-4 flex items-center justify-between">
                <span>各类时薪对比</span>
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                    <RechartsTooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number) => [`${value} 元/小时`, '时薪']}
                    />
                    <Bar dataKey="时薪" radius={[4, 4, 0, 0]} maxBarSize={50}>
                      {barData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
            <div className="flex items-start gap-3">
              <Info className="text-blue-600 mt-0.5 shrink-0" size={20} />
              <div>
                <h3 className="text-sm font-semibold text-blue-900 mb-2">数据洞察 ({year}年{month + 1}月)</h3>
                <div className="text-sm text-blue-800 space-y-2 leading-relaxed">
                  <p>
                    本月你实际出勤 <strong>{stats.workedWeekdays + stats.workedWeekends + stats.workedHolidays}</strong> 天
                    （包含 <strong>{stats.workedWeekends}</strong> 天周末加班，<strong>{stats.workedHolidays}</strong> 天法定假加班，缺勤 <strong>{stats.absenceDays}</strong> 天），
                    总计工作 <strong>{Math.round(stats.totalActualHours)}</strong> 小时。
                  </p>
                  {stats.workedHolidays > 0 && (
                    <p className="text-purple-800 bg-purple-100/50 px-2 py-1 rounded inline-block">
                      法定节假日工作 {stats.workedHolidays} 天，额外获得 3 倍时薪奖励合计 <strong>¥{Math.round(stats.holidayOtPay)}</strong> 元。
                    </p>
                  )}
                  {stats.absenceDeduction > 0 && (
                    <p className="text-slate-600">
                      因工作日缺勤 {stats.absenceDays} 天，基本工资预计扣除 {Math.round(stats.absenceDeduction)} 元。
                    </p>
                  )}
                  {useMultipliers ? (
                    <p>
                      包含法定加班费后，你本月的预估总薪资为 <strong>{stats.totalIncome.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> 元，
                      综合真实时薪为 <strong>{stats.realHourlyWage.toFixed(2)}</strong> 元。
                    </p>
                  ) : (
                    <div className="text-amber-700 flex items-center gap-1.5 mt-2">
                      <AlertCircle size={14} className="shrink-0" />
                      <span>
                        由于未开启加班费计算，本月综合真实时薪被稀释至 <strong>{stats.realHourlyWage.toFixed(2)}</strong> 元。
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Footer Signature */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-4 border-t border-slate-200">
        <div className="flex flex-col items-center justify-center text-slate-400 text-sm italic">
          <p>何康昕制作</p>
        </div>
      </footer>
    </div>
  );
}
