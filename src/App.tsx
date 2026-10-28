import { useState, useReducer } from 'react'
import { WeatherChart, type HourlyPoint } from './WeatherChart.tsx'
import { LocationSearch, type Place } from './LocationSearch.tsx'
import './App.css'

const LS_KEY_fetchesToday = "fetchesTodaySoFar";
const LS_KEY_fetchesTrackerDay = "fetchesTrackerDay";
const LS_KEY_weatherOMDataUpdateDate = "weatherOMData_updateDate";
const LS_KEY_weatherOMData = "weatherOMData";
const LS_KEY_location = "weatherLocation";

const MS_IN_DAY = 24 * 3600 * 1000;
let TOKEN_LIMIT = 100;
let forceReRender: (() => void);

interface OpenMeteoData
{
    latitude: 52.23009;
    longitude: 21.017075;
    generationtime_ms: 88.19019794464111;
    utc_offset_seconds: 0;
    timezone: "GMT";
    timezone_abbreviation: "GMT";
    elevation: 113.0;
    hourly_units: OpenMeteo_HourlyUnits;
    hourly: OpenMeteo_Hourly;
}

interface OpenMeteo_HourlyUnits
{
    time: "iso8601";
    temperature_2m: "°C";
}

interface OpenMeteo_Hourly
{
    time: string[];
    temperature_2m: number[];
    precipitation_probability: number[];
    precipitation: number[];
}

const defaultLocation: Place =
{
    admin1:"Mazovia",
    country:"Poland",
    id:756135,
    latitude:52.22977,
    longitude:21.01178,
    name:"Warsaw"
}

function App() {

    const [, forceRender] = useReducer((x) => x + 1, 0);
    forceReRender = forceRender;
    const [weatherOMData, setWeatherOMData] = useState<OpenMeteoData | null>(null);
    const [currentDayNumber, setDayNumber] = useState<number | null>(null);
    const [location, setLocation] = useState<Place>(defaultLocation);
    const [showForecasts, setShowForecasts] = useState(false);

    const fetchesTodaySoFar = parseInt(localStorage.getItem(LS_KEY_fetchesToday) ?? "0");
    const weatherUpdateInMS = parseInt(localStorage.getItem(LS_KEY_weatherOMDataUpdateDate) ?? "0");

    if (DayNumberWasTooOld(currentDayNumber, setDayNumber)) return;
    if (NewLocationAvailable(location, setLocation)) return;
    UpdateFetchesTodayTracker();

    const lacksCurrentData = weatherOMData == null;
    if (NewLocalOMDataAvailable(lacksCurrentData, weatherUpdateInMS, setWeatherOMData)) return;
    TryFetchNewerData(fetchesTodaySoFar, lacksCurrentData, weatherUpdateInMS, location, setWeatherOMData);

    if (fetchesTodaySoFar > TOKEN_LIMIT)
    {
        if (TOKEN_LIMIT == 120)
        {
            return (<p style={{ marginTop: '15vh' }}>Osiągnięto limit tokenów.<br />(za często zmieniano lokalizację, odnowią się jutro)</p>);
        }
        else
        {
            TOKEN_LIMIT = -1;
            return (
                <>
                <p style={{ marginTop: '15vh' }}>Aktywowano rezerwę tokenów.<br />(zużywa je zmiana lokalizacji, odnowią się jutro)</p>
                    <div style={{ marginTop: '4vh' }}>
                        <button onClick={() => { TOKEN_LIMIT = 120; forceReRender(); }}>Ok</button>
                    </div>
                </>
            );
        }
    }

    if (weatherOMData == null)
        return (<p style={{ marginTop: '15vh' }}>Błąd pobierania danych pogodowych.</p>);

    const forecastRowsAmount = Math.max(Math.ceil(25 / Math.floor(screen.width / 250)), 7);
    const [forecasts, forecastsHP, currentHour] = FilterData(currentDayNumber, weatherOMData);

    function setDayNumber_Relative(offset: number) { return setDayNumber(GetDayNumber_Relative(offset)); }

  return (
      <>
          <span style={{ marginTop: '5vh', marginBottom: '5vh' }}>
              <p style={{ display: "inline", marginRight: '1vw'}}>
                  {location.name}, {location.admin1}, {location.country}.
              </p>

              <LocationSearch onSelect={(p) => {
                  setLocation(p);
                  localStorage.setItem(LS_KEY_location, JSON.stringify(p));
                  localStorage.removeItem(LS_KEY_weatherOMData);
                  setWeatherOMData(null);
                  }} />
          </span>

          <WeatherChart data={forecastsHP[0]} currentHour={currentHour} />
          <span style={{ display: "inline" }}>
              <button className="dayBtn" onClick={() => setDayNumber_Relative(0)}>Dzisiaj ({GetDayOfWeek(0)})</button>
              <button className="dayBtn" onClick={() => setDayNumber_Relative(1)}>{GetDayOfWeek(1)}</button>
              <button className="dayBtn" onClick={() => setDayNumber_Relative(2)}>{GetDayOfWeek(2)}</button>
              <button className="dayBtn" onClick={() => setDayNumber_Relative(3)}>{GetDayOfWeek(3)}</button>
              <button className="dayBtn" onClick={() => setDayNumber_Relative(4)}>{GetDayOfWeek(4)}</button>
              <button className="dayBtn" onClick={() => setDayNumber_Relative(5)}>{GetDayOfWeek(5)}</button>
              <button className="dayBtn" onClick={() => setDayNumber_Relative(6)}>{GetDayOfWeek(6)}</button>
          </span>

          <div style={{ marginTop: '4vh' }}>
              <button className="textForecastsBtn" onClick={() => setShowForecasts(!showForecasts)}>Prognozy</button>
          </div>

          {showForecasts && (
              <div>
                  <p style={{ marginTop: '1vh' }}>Prognozy: <br /></p>
                  <div style={{
                      display: 'grid', gridTemplateRows: `repeat(${forecastRowsAmount}, auto)`,
                      gridAutoFlow: 'column', marginBottom: "5vh"
                  }}>
                      {forecasts}
                  </div>
              </div>
          )}
    </>
  )
}

function GetHourInPolishTime(date: Date): number
{
    return parseInt(
        new Intl.DateTimeFormat('en-US', {
            timeZone: 'Europe/Warsaw',
            hour: 'numeric',
            hour12: false
        }).format(date)
    );
}

function GetDayOfWeek(todayOffset: number): string
{
    const days = ["Niedz.", "Pon.", "Wt.", "Sr.", "Czw.", "Pt.", "Sob."];

    return days[(new Date(Date.now()).getDay() + todayOffset) % 7];
}

function GetDayNumber_Relative(relative: number): number
{
    return GetDayNumber(Date.now() + MS_IN_DAY * relative);
}

function GetDayNumber(ms: number): number
{
    return Math.ceil((ms - new Date(ms).getTimezoneOffset() * 60 * 1000) / 1000 / 3600 / 24);
}

function FilterData(
    currentDayNumber: number | null,
    weatherOMData: OpenMeteoData
): [React.JSX.Element[], HourlyPoint[][], number]
{
    let currentHour = GetHourInPolishTime(new Date(Date.now()));
    const dayNumber = currentDayNumber ?? GetDayNumber(Date.now());
    if (dayNumber != GetDayNumber(Date.now()) || currentHour == 0) currentHour = -1;

    const timeDataLength = (weatherOMData?.hourly?.time?.length ?? 0);
    if (timeDataLength == 0) return [[], [], currentHour];

    let forecasts = [];
    for (let i = 0; i < timeDataLength; i++)
    {
        const date = new Date(weatherOMData?.hourly.time[i] ?? '');
        let hour = date.getHours();
        if (hour == 0) hour = 24;

        if (GetDayNumber(date.getTime()) - dayNumber != 0) continue;

        if (forecasts.length == 0) forecasts.push(<p key={-1}>({date.toDateString()})</p>);
        forecasts.push(<p key={i}>{hour}:00 --- {weatherOMData?.hourly.temperature_2m[i]}&deg; C ,
            ({weatherOMData?.hourly.precipitation_probability[i]}%, {weatherOMData?.hourly.precipitation[i]}mm)
            < br /></p>);
    }

    let forecastsHP: HourlyPoint[][] = [];
    for (let i = 0; i < 7; i++) forecastsHP[i] = [];

    for (let i = 0; i < timeDataLength; i++)
    {
        const time = new Date(weatherOMData?.hourly?.time[i] ?? '');
        const daySince1970 = GetDayNumber(time.getTime());
        const dayIndex = daySince1970 - dayNumber;
        const hourData = weatherOMData?.hourly;

        if (hourData == undefined) continue;
        if (dayIndex < 0 || dayIndex >= 7) continue;

        forecastsHP[dayIndex].push({
            time: hourData.time[i], temp: hourData.temperature_2m[i],
            precipitation: hourData.precipitation[i],
            precipitation_probability: Math.round(hourData.precipitation_probability[i] / 10) * 10
        });
    }

    return [forecasts, forecastsHP, currentHour];
}

async function FetchOpenMeteoData(latitude: number, longitude: number): Promise<OpenMeteoData> {

    UpdateFetchesTodayTracker(1);
    console.log("External API fetch -> fetching OM weather data");

    //const url = 'https://api.open-meteo.com/v1/forecast?latitude=52.2298&longitude=21.0118&hourly=temperature_2m';
    //const url = 'https://api.open-meteo.com/v1/forecast?latitude=52.2298&longitude=21.0118&hourly=temperature_2m,precipitation_probability,precipitation';
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,precipitation_probability,precipitation`;
    const response = await fetch(url);

    if (!response.ok) throw new Error('Response not ok');
    const data: OpenMeteoData = await response.json();

    return data;
}

function NewLocationAvailable(location: Place, setLocation: (place:Place) => void): boolean
{
    const loadedLocation = localStorage.getItem(LS_KEY_location) ?? "";

    if (loadedLocation != null && loadedLocation != "") {
        const parsedLocation = JSON.parse(loadedLocation);
        if (parsedLocation.id != location.id || parsedLocation.name != location.name
            || parsedLocation.admin1 != location.admin1 || parsedLocation.country != location.country) {
            setLocation(parsedLocation);
            return true;
        }
    }

    return false;
}

function NewLocalOMDataAvailable(
    lacksCurrentData: boolean,
    weatherUpdateInMS: number,
    setWeatherOMData: (data: OpenMeteoData) => void
): boolean
{
    if (lacksCurrentData && localStorage.getItem(LS_KEY_weatherOMData) != null
        && Math.abs(weatherUpdateInMS - Date.now()) < 1000 * 3600) {
        const loadedData: OpenMeteoData = JSON.parse(localStorage.getItem(LS_KEY_weatherOMData) ?? "");
        setWeatherOMData(loadedData);
        return true;
    }

    return false;
}

function TryFetchNewerData(
    fetchesTodaySoFar: number,
    lacksCurrentData: boolean,
    weatherUpdateInMS: number,
    location: Place,
    setWeatherOMData: (data: OpenMeteoData) => void
)
{
    if (fetchesTodaySoFar < TOKEN_LIMIT && (lacksCurrentData
        || Math.abs(weatherUpdateInMS - Date.now()) > 1000 * 3600 * 3))
        FetchOpenMeteoData(location.latitude, location.longitude).then(x => {
            setWeatherOMData(x);
            localStorage.setItem(LS_KEY_weatherOMData, JSON.stringify(x));
            localStorage.setItem(LS_KEY_weatherOMDataUpdateDate, Date.now().toString());
        });
}

function DayNumberWasTooOld(currentDayNumber: number | null, setDayNumber: (day: number | null) => void): boolean
{
    if (currentDayNumber == null) return false;
    const daysDifference = Math.abs(currentDayNumber - GetDayNumber(Date.now()));
    if (daysDifference <= 6) return false;

    setDayNumber(null);
    return true;
}

export function UpdateFetchesTodayTracker(increment = 0)
{
    //take current day into account
    const trackerDay = parseInt(localStorage.getItem(LS_KEY_fetchesTrackerDay) ?? "0");
    const today = GetDayNumber(Date.now());

    if (today != trackerDay)
    {
        SetFetchesTracker(0);
        localStorage.setItem(LS_KEY_fetchesTrackerDay, today.toString());
    }

    const loadedValue = parseInt(localStorage.getItem(LS_KEY_fetchesToday) ?? "0");
    SetFetchesTracker(loadedValue + increment);
    if (loadedValue <= TOKEN_LIMIT && loadedValue + increment > TOKEN_LIMIT)
    {
        forceReRender();
    }
}

function SetFetchesTracker(newValue: number)
{
    localStorage.setItem(LS_KEY_fetchesToday, newValue.toString());
}

//async function FetchOpenMeteoData_mockup(): Promise<OpenMeteoData> {

//    UpdateFetchesTodayTracker(1);
//    console.log("Sth3 - fetch data");

//    const result: OpenMeteoData =
//    {
//        latitude: 52.23009,
//        longitude: 21.017075,
//        generationtime_ms: 88.19019794464111,
//        utc_offset_seconds: 0,
//        timezone: "GMT",
//        timezone_abbreviation: "GMT",
//        elevation: 113.0,
//        hourly_units:
//        {
//            time: "iso8601",
//            temperature_2m: "°C",
//        },
//        hourly:
//        {
//            time: ['2026-10-15T11:00', '2026-10-15T12:00', '2026-10-15T13:00', '2026-10-15T14:00', '2026-10-15T15:00', '2026-10-15T16:00'],
//            temperature_2m: [3.3, 5.6, 7.7, 9.8, 11.3, 13.1],
//        }
//    };

//    return result;
//}

export default App
