// app/(tabs)/calendar.tsx - Clean Working Calendar
// @ts-nocheck

import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ImageBackground,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Calendar } from 'react-native-calendars';

const backgroundPattern = require('../../assets/background.png');

type SelectionMode = 'single' | 'range';

export default function CalendarScreen() {
  const router = useRouter();
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('single');
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  const formatDateRange = () => {
    if (selectionMode === 'single') {
      const date = new Date(selectedDate);
      return date.toLocaleDateString('en-GB', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
      });
    }
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      return `${start.getDate()}-${end.getDate()} ${start.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`;
    }
    
    if (startDate) {
      const start = new Date(startDate);
      return `${start.getDate()} ${start.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })} - ...`;
    }
    
    return 'Select period';
  };

  const getMarkedDates = () => {
    if (selectionMode === 'single') {
      return {
        [selectedDate]: {
          selected: true,
          selectedColor: 'rgba(194, 164, 120, 0.8)', // Gold/tan accent color
          selectedTextColor: '#000000'
        }
      };
    }

    const marked: any = {};
    
    if (startDate && !endDate) {
      marked[startDate] = {
        selected: true,
        selectedColor: 'rgba(194, 164, 120, 0.8)', // Gold/tan accent color
        selectedTextColor: '#000000'
      };
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const current = new Date(start);
      
      while (current <= end) {
        const dateStr = current.toISOString().slice(0, 10);
        marked[dateStr] = {
          selected: true,
          selectedColor: 'rgba(194, 164, 120, 0.8)', // Gold/tan accent color
          selectedTextColor: '#000000'
        };
        current.setDate(current.getDate() + 1);
      }
    }
    
    return marked;
  };

  const onDayPress = (day: { dateString: string }) => {
    if (selectionMode === 'single') {
      setSelectedDate(day.dateString);
      router.push(`/?date=${day.dateString}`);
    } else {
      if (!startDate || (startDate && endDate)) {
        setStartDate(day.dateString);
        setEndDate(null);
      } else if (startDate && !endDate) {
        if (new Date(day.dateString) >= new Date(startDate)) {
          setEndDate(day.dateString);
        } else {
          setEndDate(startDate);
          setStartDate(day.dateString);
        }
      }
    }
  };

  const resetSelection = () => {
    setStartDate(null);
    setEndDate(null);
    setSelectedDate(new Date().toISOString().slice(0, 10));
    // Navigate back to clean What's On feed (removes all date filters)
    router.replace('/(tabs)');
  };

  const setPeriod = () => {
    if (selectionMode === 'range' && startDate && endDate) {
      router.push(`/?startDate=${startDate}&endDate=${endDate}`);
    }
  };

  return (
    <ImageBackground 
      source={backgroundPattern} 
      style={styles.background}
      resizeMode="repeat"
    >
      <LinearGradient 
        colors={['rgba(255, 255, 255, 0.96)', 
  'rgb(30, 120, 120)']} 
        style={StyleSheet.absoluteFillObject}
      />
      
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <Text style={styles.header}>Select custom period</Text>
          
          <TouchableOpacity onPress={resetSelection} style={styles.resetButton}>
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
        </View>

        {/* Current Selection Display */}
        <View style={styles.selectionDisplay}>
          <Text style={styles.selectionText}>{formatDateRange()}</Text>
        </View>

        {/* Mode Toggle */}
        <View style={styles.modeToggle}>
          <TouchableOpacity 
            style={[styles.modeButton, selectionMode === 'single' && styles.modeButtonActive]}
            onPress={() => setSelectionMode('single')}
          >
            <Text style={[styles.modeButtonText, selectionMode === 'single' && styles.modeButtonTextActive]}>
              Single Date
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.modeButton, selectionMode === 'range' && styles.modeButtonActive]}
            onPress={() => setSelectionMode('range')}
          >
            <Text style={[styles.modeButtonText, selectionMode === 'range' && styles.modeButtonTextActive]}>
              Date Range
            </Text>
          </TouchableOpacity>
        </View>

        {/* Calendar - Simple and Clean */}
        <View style={styles.calendarWrapper}>
          <Calendar
            current={selectedDate}
            onDayPress={onDayPress}
            markedDates={getMarkedDates()}
            style={styles.calendar}
            theme={{
              calendarBackground: '#FFFFFF',
              dayTextColor: '#000000',
              textSectionTitleColor: '#666666',
              monthTextColor: '#000000',
              arrowColor: 'rgba(194, 164, 120, 1)', // Gold/tan accent color
              selectedDayBackgroundColor: 'rgba(194, 164, 120, 0.8)', // Gold/tan accent color
              selectedDayTextColor: '#000000',
              todayTextColor: 'rgba(194, 164, 120, 1)', // Gold/tan accent color
              textDayFontSize: 16,
              textMonthFontSize: 18,
              textDayHeaderFontSize: 14,
              textDayFontWeight: '400',
              textMonthFontWeight: '600',
              textDayHeaderFontWeight: '500',
            }}
            hideExtraDays={true}
            disableMonthChange={false}
            firstDay={1}
            showWeekNumbers={false}
            enableSwipeMonths={true}
          />
        </View>

        {/* Spacer for single date mode to maintain consistent layout */}
        {selectionMode === 'single' && <View style={styles.spacer} />}

        {/* Set Period Button - Now positioned same as continue button */}
        {selectionMode === 'range' && (
          <View style={styles.bottomContainer}>
            <TouchableOpacity 
              style={[
                styles.setPeriodButton, 
                (!startDate || !endDate) && styles.setPeriodButtonDisabled
              ]}
              onPress={setPeriod}
              disabled={!startDate || !endDate}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={(!startDate || !endDate) ? ['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.2)'] : ['#c2a478', '#a08960']}
                style={styles.buttonGradient}
              >
                <Text style={[
                  styles.setPeriodButtonText,
                  (!startDate || !endDate) && styles.setPeriodButtonTextDisabled
                ]}>
                  Set period
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </ImageBackground>
  );
}

CalendarScreen.options = { headerShown: false };

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  safe: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 24 : 0,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)', // Light border for dark theme
  },
  header: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(0, 0, 0, 0.8)', // Dark text to match interests page
    flex: 1,
  },
  resetButton: {
    padding: 8,
  },
  resetText: {
    fontSize: 16,
    color: 'rgba(194, 164, 120, 1)', // Gold/tan accent color
    fontWeight: '500',
  },
  selectionDisplay: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  selectionText: {
    fontSize: 24,
    fontWeight: '500',
    color: 'rgba(0, 0, 0, 0.8)', // Dark text to match interests page
  },
  modeToggle: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.09)', // Dark background to match interests page
    borderRadius: 8,
    padding: 4,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  modeButtonActive: {
    backgroundColor: 'rgba(194, 164, 120, 1)', // Gold/tan accent color
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgb(0, 0, 0)', // Dark text to match interests page
  },
  modeButtonTextActive: {
    color: '#000000', // Black text on gold background
  },
  calendarWrapper: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    // Fixed height for consistency between modes
    height: 400,
  },
  calendar: {
    borderRadius: 12,
    paddingBottom: 20,
  },
  spacer: {
    // Height equivalent to the bottom container + set period button
    height: 76, // 20 padding + 16 button padding + 16 button padding + 24 button height
  },
  bottomContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20, // Changed from paddingBottom: 20 to match interests page
  },
  setPeriodButton: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  setPeriodButtonDisabled: {
    elevation: 2,
    shadowOpacity: 0.1,
  },
  buttonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  setPeriodButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  setPeriodButtonTextDisabled: {
    color: 'rgba(255,255,255,0.5)',
  },
});