const { addDays, isAfter, isBefore, parseISO, getDay, compareAsc } = require("date-fns");

function getWindowBounds(reference = new Date()) {
  const start = reference;
  const end = addDays(reference, 7);
  return { start, end };
}

function isWithinWindow(dateIso, start, end) {
  const date = parseISO(dateIso);
  return (
    (isAfter(date, start) || date.getTime() === start.getTime()) &&
    isBefore(date, end)
  );
}

function filterMatchesWithinWindow(matches, start, end) {
  return matches.filter((match) => isWithinWindow(match.startTime, start, end));
}

const WEEKEND_DAYS = new Set([5, 6, 0]); // Fri, Sat, Sun

function pickMatchesWithWeekendBias(matches, quota, getCloseness) {
  const scored = matches.map((match) => {
    const date = new Date(match.startTime);
    const closeness = getCloseness(match);
    const weekend = WEEKEND_DAYS.has(getDay(date));
    return { match, closeness, weekend, date };
  });

  scored.sort((a, b) => {
    if (a.closeness !== b.closeness) {
      return a.closeness - b.closeness;
    }
    if (a.weekend !== b.weekend) {
      return a.weekend ? -1 : 1;
    }
    return compareAsc(a.date, b.date);
  });

  return {
    selected: scored
      .slice(0, quota)
      .map(({ match, closeness }) => ({ match, closeness })),
    discarded: scored
      .slice(quota)
      .map(({ match, closeness }) => ({ match, closeness })),
  };
}

module.exports = {
  getWindowBounds,
  isWithinWindow,
  filterMatchesWithinWindow,
  pickMatchesWithWeekendBias,
};

