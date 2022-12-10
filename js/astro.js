
// trigonometric functions in degrees

const radiansPerDegree = Math.PI / 180;
const degreesPerRadian = 180 / Math.PI;

const cosd = (x) => Math.cos(x * radiansPerDegree);
const sind = (x) => Math.sin(x * radiansPerDegree);
const acosd = (x) => Math.acos(x) * degreesPerRadian;
const asind = (x) => Math.asin(x) * degreesPerRadian;
const atan2d = (x, y) => Math.atan2(y, x) * degreesPerRadian;

const rev = (x) => {
  x = x % 360;
  return x >= 0 ? x : x + 360;
};

const rev180 = (x) => {
  x = rev(x);
  return x <= 180 ? x : x - 360;
};

// point conversion

const rectToPolar = (r) => {
  return {
    lon: rev(atan2d(r.x, r.y)),
    lat: atan2d(Math.sqrt(r.x * r.x + r.y * r.y), r.z)
  };
};

// epoch time functions

const epoch = Date.UTC(1999, 11, 31);
const millsecondsPerDay = 86400000;

const unixToEpochTime = (unixTime) => (unixTime - epoch) / millsecondsPerDay;
const epochToUnixTime = (epochTime) => epochTime * millsecondsPerDay + epoch;

// astronomical functions - note that these orbital elements assume that the Sun orbits the Earth!

const eclipticToEquatorial = (time, r)  =>  {
  const o = obliquityOfEcliptic(time);
  return {
    x: r.x,
    y: r.y * cosd(o) - r.z * sind(o),
    z: r.y * sind(o) + r.z * cosd(o)
  };
};

const obliquityOfEcliptic = (time) => 23.4393 - (3.563e-7 * time);

const siderealTime = (time, lon) => {
  time -= 1.5;
  const t = time / 36525;
  const st = 280.46061837 + 360.98564736629 * time + (0.000387933 * Math.pow(t, 2)) - (Math.pow(t, 3) / 38710000);
  return rev(st + lon);
};

const sunArgOfPerihelion = (time) => rev(282.9404 + 4.70935e-5 * time);
const sunEccentricity = (time) => 0.016709 - 1.151e-9 * time;

const sunEclipticPosition = (time) => {

  // orbital elements

  const w = sunArgOfPerihelion(time);
  const e = sunEccentricity(time);
  const M = sunMeanAnomaly(time);

  // eccentric anomaly

  let ea = M + e * degreesPerRadian * sind(M) * (1 + e * cosd(M));
  let ea0;

  do {
    ea0 = ea;
    ea = ea0 - (ea0 - e * degreesPerRadian * sind(ea0) - M) / (1 - e * cosd(ea0));
  } while (Math.abs(ea0 - ea) > 0.0002);

  // true anomaly and distance

  const xv = cosd(ea) - e;
  const yv = Math.sqrt(1 - e * e) * sind(ea);
  const v = atan2d(xv, yv);
  const r = Math.sqrt(xv * xv + yv * yv);

  // position in space

  return {
    x: r * cosd(v + w),
    y: r * sind(v + w),
    z: 0
  };
};

const sunEquatorialPosition = (time) => eclipticToEquatorial(time, sunEclipticPosition(time));
const sunMeanAnomaly = (time) => rev(356.0470 + 0.9856002585 * time);

const findTransitTime = (time, observer, atNoon) => {
  const offset = atNoon || atNoon === undefined ? 0 : 180;
  let delta = 0;

  do {
    time = time + delta / 360;
    const sun = rectToPolar(sunEquatorialPosition(time));
    delta = rev180(sun.lon - siderealTime(time, observer.lon + offset));
  } while (Math.abs(delta) > 0.0001);

  return time;
};

const findAltitudeTime = (time, observer, rising, altitude) => {
  const noon = findTransitTime(time, observer);
  let sun = rectToPolar(sunEquatorialPosition(time));
  const cosh0 = (sind(altitude) - sind(observer.lat) * sind(sun.lat)) / (cosd(observer.lat) * cosd(sun.lat));

  if (cosh0 > 1) {
    return noon;
  }

  const direction = rising ? -1 : 1;
  const midnight = findTransitTime(noon + direction * 0.5, observer, false);

  if (cosh0 < -1) {
    return midnight;
  }

  time = noon + direction * acosd(cosh0) / 360;
  let delta = 0;
  let i = -1;

  do {
    time += direction * delta / 360;
    sun = rectToPolar(sunEquatorialPosition(time));
    const h = rev(siderealTime(time, observer.lon) - sun.lon);
    const newAltitude = asind(sind(observer.lat) * sind(sun.lat) + cosd(observer.lat) * cosd(sun.lat) * cosd(h));
    delta = newAltitude - altitude;
    i += 1;
  } while (Math.abs(delta) > 0.000001 && i < 2000);

  if (rising) {
    return time < midnight ? midnight : time <= noon ? time : noon;
  }

  return time < noon ? noon : time <= midnight ? time : midnight;
};

export const findTimes = (clockNoon, observer) => {
  const solarNoon = findTransitTime(unixToEpochTime(clockNoon), observer);

  const startCivilTwilight = epochToUnixTime(findAltitudeTime(solarNoon - 0.25, observer, true, -6));
  const sunrise = epochToUnixTime(findAltitudeTime(solarNoon - 0.25, observer, true, -0.833));
  const noon = epochToUnixTime(solarNoon);
  const sunset = epochToUnixTime(findAltitudeTime(solarNoon + 0.25, observer, false, -0.833));
  const endCivilTwilight = epochToUnixTime(findAltitudeTime(solarNoon + 0.25, observer, false, -6));
  const sunlight = sunset - sunrise;
  const daylight = endCivilTwilight - startCivilTwilight;
  const night = 86400000 - daylight
  
  return { startCivilTwilight, sunrise, noon, sunset, endCivilTwilight, sunlight, daylight, night };
};
