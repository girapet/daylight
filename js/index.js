import { findTimes } from './astro.js';

// eslint-disable-next-line no-undef
const { DateTime, Duration } = luxon;
  
const dateFormat = 'yyyy<br/>MMM d';
const timeFormat = 'h:mm';
const durationFormat = 'h:mm';

const roundMinute = (millis) => Math.round(millis / 60000) * 60000;
const formatTime = (millis) => DateTime.fromMillis(roundMinute(millis)).setZone('default').toFormat(timeFormat);
const formatDuration = (millis) => Duration.fromMillis(roundMinute(millis)).toFormat(durationFormat);

const scroll = document.getElementById('scroll');
let todayColumn;
const visibleDates = [];

const intersectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.intersectionRatio == 1) {
      if (!visibleDates.find((d) => d === entry.target.id)) {
        visibleDates.push(entry.target.id);
      }
    }
    else {
      const i = visibleDates.findIndex((d) =>d === entry.target.id);

      if (i >= 0) {
        visibleDates.splice(i, 1);
      }
    }
  })
}, { root: scroll, threshold: [1] });

const addCell = (column, text, significance) => {
  const cell = document.createElement('div');
  cell.className = `cell ${significance}`;
  column.appendChild(cell);
  cell.innerHTML = text;
};

const timeEvents = ['startCivilTwilight', 'sunrise', 'noon', 'sunset', 'endCivilTwilight'];
const durationEvents = ['sunlight', 'daylight', 'night'];

const loadTimes = (position) => {
  const location = { lat: position.coords.latitude, lon: position.coords.longitude };

  // load the times for all days from six months before to six months after today's date

  const today = DateTime.now();
  let currentDate = DateTime.now().minus(Duration.fromObject({ months: 6 })).set({ hour: 12, minute: 0, second: 0, millisecond: 0 });
  const endDate = currentDate.plus(Duration.fromObject({ months: 12 }));
  const days = [];

  while (currentDate <= endDate) {
    const currentDateValue = currentDate.valueOf();
    const times = findTimes(currentDateValue, location);
  
    const day = { date: currentDate };
    days.push(day);
    
    timeEvents.forEach((e) => {
      day[e] = { value: times[e] - currentDateValue, time: formatTime(times[e]) };
    });
    durationEvents.forEach((e) => {
      day[e] = { value: times[e], duration: formatDuration(times[e]) };
    });

    currentDate = currentDate.plus({ days: 1 });
  }

  //  significant events for the year (earliest, latest, shortest, longest)

  const sigEvents = {};

  timeEvents.forEach((e) => {
    sigEvents[e] = { 
      earliest: { date: days[0].date, value: days[0][e].value },
      latest: { date: days[0].date, value: days[0][e].value }
    };
  });
  durationEvents.forEach((e) => {
    sigEvents[e] = {
      shortest: { date: days[0].date, value: days[0][e].value },
      longest: { date: days[0].date, value: days[0][e].value }
    }
  });

  // search the days for significant events

  for (let day of days) {
    timeEvents.forEach((e) => {
      if (day[e].value < sigEvents[e].earliest.value) {
        sigEvents[e].earliest.date  = day.date
        sigEvents[e].earliest.value = day[e].value;  
      }
      if (day[e].value > sigEvents[e].latest.value) {
        sigEvents[e].latest.date  = day.date
        sigEvents[e].latest.value = day[e].value;  
      }
    });
    durationEvents.forEach((e) => {
      if (day[e].value < sigEvents[e].shortest.value) {
        sigEvents[e].shortest.date  = day.date
        sigEvents[e].shortest.value = day[e].value;  
      }
      if (day[e].value > sigEvents[e].longest.value) {
        sigEvents[e].longest.date  = day.date
        sigEvents[e].longest.value = day[e].value;  
      }
    });
  }

  // display the days
  
  scroll.replaceChildren();

  for (let day of days) {
    const currentDate = day.date;
    const column = document.createElement('div');
    column.className = 'column';
    scroll.appendChild(column);
  
    if (day.date.year === today.year && day.date.month === today.month && day.date.day === today.day) {
      column.className += ' today';
      todayColumn = column;
    }
    
    if (day.date.weekday === 6) {
      column.className += ' saturday';
    }
    else if (day.date.weekday === 7) {
      column.className += ' sunday';
    }
  
    addCell(column, day.date.toFormat('ccc'));
    addCell(column, day.date.toFormat(dateFormat));

    timeEvents.forEach((e) => {
      const significance = day.date == sigEvents[e].earliest.date ? 'earliest' : (day.date == sigEvents[e].latest.date ? 'latest' : '');
      addCell(column, day[e].time, significance);
    });
    durationEvents.forEach((e) => {
      const significance = day.date == sigEvents[e].shortest.date ? 'shortest' : (day.date == sigEvents[e].longest.date ? 'longest' : '');
      addCell(column, day[e].duration, significance);
    });
  
    column.id = `d${currentDate.toMillis()}`;
    intersectionObserver.observe(column);
  }

  todayColumn.scrollIntoView({ inline: 'center' });
};

const scrollTo = (duration) => {
  visibleDates.sort();
  const middle = visibleDates[Math.floor((visibleDates.length + 1) * 0.5) - 1];
  const middleMillis = Number(middle.substr(1))
  const targetDate = DateTime.fromMillis(middleMillis).plus(duration).toMillis();
  const column = document.getElementById(`d${targetDate}`);

  if (column) {
    column.scrollIntoView({ inline: 'center', behavior: 'smooth' });
  }
};

// enable navigation buttons

const addClickHandler = (id, handler) => {
  document.getElementById(id).addEventListener('click', handler);
}

addClickHandler('backmonth', () => { scrollTo(Duration.fromObject({ months: -1 })); });
addClickHandler('backweek', () => { scrollTo(Duration.fromObject({ weeks: -1 })); });
addClickHandler('today', () => { todayColumn.scrollIntoView({ inline: 'center', behavior: 'smooth' }); })
addClickHandler('forwardweek', () => { scrollTo(Duration.fromObject({ weeks: 1 })); });
addClickHandler('forwardmonth', () => { scrollTo(Duration.fromObject({ months: 1 })); });

// startup

const scrim = document.getElementById('scrim');

navigator.geolocation.getCurrentPosition(async (position) => {
  loadTimes(position);
  scrim.className = 'fadeOut';

  window.addEventListener('focus', () => {
    navigator.geolocation.getCurrentPosition(async (position) => {
      loadTimes(position);
    });
  });
}, () => {
  scrim.innerHTML = 'This app needs your location.<br/><br/>Please enable location services on<br/>your device and allow access to<br/>your location if asked.';
});

