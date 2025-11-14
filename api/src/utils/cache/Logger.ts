
import chalk from "chalk";
import * as fs from "fs";
import { config } from "../../index";

type LogType = "errors" | "service" | "actions" | "connections";

const console_colors: object | any  = {
    'service': 'green',
    'errors': 'red',
    'actions': 'magenta',
    'connections': 'yellow',
}

// In-memory log storage (max 1000 logs)
export interface LogEntry {
    timestamp: Date;
    type: LogType;
    message: string;
}

const logStore: LogEntry[] = [];
const MAX_LOGS = 1000;

/**
 * This will colorize and prettify console content
 * @param log_type type of log
 * @param contents type of contents
 * @returns string
 */
function edit_ConsoleLogContent(log_type: LogType, contents: string): string {

    const dateString: string = chalk.yellow(`[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}]`);
    const logString: string = (chalk as any)[console_colors[log_type]](`[${log_type.toUpperCase()}]`);

    return `${dateString} ${logString} ${contents}`;

}

/**
 * This will prettify the content of a string into something that can be formatted in a .log file
 * @param log_type string
 * @param contents string
 * @returns string
 */
function edit_LogContent(log_type: LogType, contents: string): string {

    const dateString: string = `[${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}]`;
    const logString: string = `[${log_type.toUpperCase()}]`;

    return `${dateString} ${logString} ${contents}`;

}

/**
 * This will log into a log file, and will log into console if console_log is true
 * @param log_type string
 * @param contents string
 * @param console_log boolean
 */
export function write_to_logs(log_type: LogType, contents: string, console_log: boolean = false): void {

    const log_contents: string = edit_ConsoleLogContent(log_type, contents);
    contents = edit_LogContent(log_type, contents);

    console.log(log_contents);

    // Store in memory
    logStore.push({
        timestamp: new Date(),
        type: log_type,
        message: contents
    });

    // Keep only the last MAX_LOGS entries
    if (logStore.length > MAX_LOGS) {
        logStore.shift();
    }
}

/**
 * Get all stored logs
 * @returns LogEntry[]
 */
export function getLogs(): LogEntry[] {
    return [...logStore];
}

/**
 * Get logs filtered by type
 * @param log_type LogType
 * @returns LogEntry[]
 */
export function getLogsByType(log_type: LogType): LogEntry[] {
    return logStore.filter(log => log.type === log_type);
}

/**
 * Get logs from a specific time range
 * @param startTime Date
 * @param endTime Date
 * @returns LogEntry[]
 */
export function getLogsByTimeRange(startTime: Date, endTime: Date): LogEntry[] {
    return logStore.filter(log => log.timestamp >= startTime && log.timestamp <= endTime);
}

/**
 * Clear all logs
 */
export function clearLogs(): void {
    logStore.length = 0;
}
