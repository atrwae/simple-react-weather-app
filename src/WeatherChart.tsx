import React from "react";

// ---- Adjust this type to match your data ---------------------------------
export type HourlyPoint = {
    time: string; // ISO string, e.g. "2026-10-13T14:00"
    temp: number; // degrees
    precipitation: number; // mm
    precipitation_probability: number; // %
};
// --------------------------------------------------------------------------

type Props = {
    data: HourlyPoint[];
    unit?: string; // shown after temperature labels
    height?: number; // chart height in px
    hourWidthVw?: number; // horizontal vw per hour
    currentHour: number;
};

const PAD = { top: 32, bottom: 48, left: 20, right: 20 };

const COLORS = {
    line: "rgb(243, 222, 138)",
    fill: "rgba(243, 222, 138, 0.12)",
    lineRain: "#A9FFF7",
    grid: "#F9F8F8",
    text: "#4b5563",
    strong: "#111827",
    bg: "#7E7F9A",
    nowMarker: "#4b5563"
};

export function WeatherChart({
    data,
    //unit = <p>&deg;C<p/>,
    height = 240,
    hourWidthVw = 4.35,
    currentHour
}: Props) {

    const hourWidth = Math.min((screen.width - 60) / 100 * hourWidthVw, 46);
    const hideMarkerLabelIfSelectionCloserThan = Math.floor(60 / hourWidth) + 1;
    const [active, setActive] = React.useState(0);
    const i = Math.min(active, data.length - 1); // stays valid when you switch days

    const handlePointer = (e: React.PointerEvent<SVGSVGElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const idx = Math.round((e.clientX - rect.left - PAD.left) / hourWidth);
        setActive(Math.max(0, Math.min(data.length - 1, idx)));
    };

    if (data.length < 2) {
        return <div style={{ color: COLORS.text }}>Not enough data to draw a chart.</div>;
    }

    const temps = data.map((d) => d.temp);
    const precipitations = data.map((d) => d.precipitation);
    const min = Math.floor(Math.min(...temps)) - 1;
    const max = Math.ceil(Math.max(...temps)) + 1;
    const min_rain = 0;
    const max_rain = Math.ceil(Math.max(...precipitations)) + 1;

    const width = PAD.left + PAD.right + (data.length - 1) * hourWidth;
    const innerH = height - PAD.top - PAD.bottom;
    const baseY = PAD.top + innerH;

    const x = (i: number) => PAD.left + i * hourWidth;
    const y = (t: number) => PAD.top + innerH - ((t - min) / (max - min)) * innerH;
    const y_rain = (t: number) => PAD.top + innerH - ((t - min_rain) / (max_rain - min_rain)) * innerH;

    const line = data
        .map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.temp)}`)
        .join(" ");
    const area = `${line} L${x(data.length - 1)},${baseY} L${x(0)},${baseY} Z`;

    const rainLine = data
        .map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y_rain(d.precipitation)}`)
        .join(" ");

    const hiIndex = temps.indexOf(Math.max(...temps));
    const loIndex = temps.indexOf(Math.min(...temps));
    const nowIndex = currentHour - 1;

    return (
        <div
            style={{
                overflowX: "auto",
                background: COLORS.bg,
                borderRadius: 12,
                border: `1px solid ${COLORS.grid}`,
                fontFamily: "system-ui, sans-serif",
                margin: "10px"
            }}
        >
            <svg
                width={width}
                height={height}
                onPointerMove={handlePointer}
                onPointerDown={handlePointer}
                style={{ display: "block", touchAction: "pan-y" }}>

                {/* baseline */}
                <line x1={PAD.left} x2={width - PAD.right} y1={baseY} y2={baseY} stroke={COLORS.grid} />

                {/* area + line */}
                <path d={area} fill={COLORS.fill} />
                <path d={line} fill="none" stroke={COLORS.line} strokeWidth={2.5} strokeLinejoin="round" />
                <path d={rainLine} fill="none" stroke={COLORS.lineRain} strokeWidth={2.5} strokeLinejoin="round" />

                {/* hour labels + day separators */}
                {data.map((d, i) => {
                    const date = new Date(d.time);
                    const hour = date.getHours();
                    const isMidnight = hour === 0 || hour === 1;
                    const isNow = hour === currentHour;
                    return (
                        <g key={d.time}>
                            {isMidnight && (
                                <>
                                    <line
                                        x1={x(i)}
                                        x2={x(i)}
                                        y1={PAD.top - 8}
                                        y2={baseY}
                                        stroke={COLORS.grid}
                                        strokeDasharray="4 4"
                                    />
                                    <text
                                        x={x(i) + 6}
                                        y={height - 8}
                                        fontSize={12}
                                        fontWeight={600}
                                        fill={COLORS.strong}
                                    >
                                        {date.toLocaleDateString(undefined, { weekday: "short" })}
                                    </text>
                                </>
                            )}
                            {isNow && (
                                <>
                                    <line
                                        x1={x(i)}
                                        x2={x(i)}
                                        y1={PAD.top - 8}
                                        y2={baseY}
                                        stroke={COLORS.nowMarker}
                                        strokeDasharray="4 4"
                                        strokeWidth="2"
                                    />
                                </>
                            )}
                            {hour % 3 === 0 && (
                                <text
                                    x={x(i)}
                                    y={baseY + 18}
                                    fontSize={11}
                                    textAnchor="middle"
                                    fill={COLORS.text}
                                >
                                    {String(hour).padStart(2, "0")}
                                </text>
                            )}
                        </g>
                    );
                })}

                {/* now marker */}
                {currentHour != -1 && (
                    <>
                        <circle cx={x(nowIndex)} cy={y(data[nowIndex].temp)} r={5} fill={COLORS.nowMarker} />
                        {Math.abs(active - nowIndex) >= hideMarkerLabelIfSelectionCloserThan && (
                            <text
                                x={x(nowIndex)}
                                y={y(temps[nowIndex]) - 10}
                                fontSize={12}
                                fontWeight={600}
                                textAnchor="middle"
                                fill={COLORS.strong}
                            >
                                {Math.round(temps[nowIndex])}
                                &deg;C
                            </text>
                        )}
                    </>
                )}

                {/* mouse selector marker */}
                <line x1={x(i)} x2={x(i)} y1={PAD.top - 8} y2={baseY} stroke={COLORS.line} strokeWidth={1.5} />
                <circle cx={x(i)} cy={y(data[i].temp)} r={5} fill={COLORS.line} />
                <circle cx={x(i)} cy={y_rain(data[i].precipitation)} r={5} fill={COLORS.lineRain} />
                <text
                    x={x(i)}
                    y={y(data[i].temp) - 12}
                    fontSize={13}
                    fontWeight={600}
                    fill={COLORS.strong}
                    textAnchor={i < 2 ? "start" : i > data.length - 3 ? "end" : "middle"}
                >
                    {new Date(data[i].time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    &nbsp;&middot;&nbsp;
                    {Math.round(data[i].temp)}&deg;C
                </text>
                <text
                    x={x(i)}
                    y={y(data[i].temp) + 18}
                    fontSize={13}
                    fontWeight={600}
                    fill={COLORS.strong}
                    textAnchor={i < 2 ? "start" : i > data.length - 3 ? "end" : "middle"}
                >
                    {data[i].precipitation}mm
                    &nbsp;&middot;&nbsp;
                    {data[i].precipitation_probability}%
                </text>

                {/* high / low labels */}
                {[hiIndex, loIndex].map((i, n) => (
                    <g key={n}>
                        <circle cx={x(i)} cy={y(temps[i])} r={3.5} fill={COLORS.bg} stroke={COLORS.line} strokeWidth={2} />
                        {Math.abs(active - i) >= hideMarkerLabelIfSelectionCloserThan && (
                            <text
                                x={x(i)}
                                y={y(temps[i]) + (i === hiIndex ? -10 : 18)}
                                fontSize={12}
                                fontWeight={600}
                                textAnchor="middle"
                                fill={COLORS.strong}
                            >
                                {Math.round(temps[i])}
                                &deg;C
                            </text>
                        )}
                    </g>
                ))}
            </svg>
        </div>
    );
}

// ---- Sample data for quick testing (delete once you wire up your own) -----
//export function makeSampleData(hours = 100): HourlyPoint[] {
//    const start = new Date();
//    start.setMinutes(0, 0, 0);
//    return Array.from({ length: hours }, (_, i) => {
//        const t = new Date(start.getTime() + i * 3600_000);
//        const daily = Math.sin(((t.getHours() - 9) / 24) * 2 * Math.PI) * 5;
//        return { time: t.toISOString(), temp: 11 + daily + Math.sin(i / 17) * 2 };
//    });
//}

// Usage:
// <WeatherChart data={yourHourlyData} />
// <WeatherChart data={makeSampleData()} />
export default WeatherChart;
