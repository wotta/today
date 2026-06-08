import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { store, isValidHour } from './store';
import { todayKey } from './date';
import { AGENDA_END_HOUR, AGENDA_START_HOUR, DATE_RE } from './types';

const dateArg = z
  .string()
  .regex(DATE_RE, 'Use YYYY-MM-DD')
  .optional()
  .describe('Day in YYYY-MM-DD (local time). Defaults to today.');

const hourArg = z
  .number()
  .int()
  .min(AGENDA_START_HOUR)
  .max(AGENDA_END_HOUR)
  .describe(
    `Agenda hour, ${AGENDA_START_HOUR}–${AGENDA_END_HOUR}. Hours 24/25/26 mean 0/1/2am the next morning.`,
  );

function ok(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function fail(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

const resolve = (date?: string): string => date ?? todayKey();

export function buildMcpServer(): McpServer {
  const server = new McpServer(
    { name: 'today', version: '0.1.0' },
    {
      instructions:
        'Read and write the "Today" planner. Each day has a checklist ("Check") and an ' +
        'hourly agenda spanning hours 6–26 (24/25/26 = 0/1/2am the next morning). ' +
        'Date arguments are YYYY-MM-DD in local time and default to today when omitted.',
    },
  );

  server.registerTool(
    'get_day',
    {
      title: 'Get day',
      description:
        'Fetch the full checklist and agenda for a day. Defaults to today. ' +
        'Returns { date, checkItems[], agenda{ hour: text } }.',
      inputSchema: { date: dateArg },
    },
    async ({ date }) => ok(await store.getDay(resolve(date))),
  );

  server.registerTool(
    'list_days',
    {
      title: 'List days',
      description: 'List all days that have any saved content, with item/entry counts. Most recent first.',
      inputSchema: {},
    },
    async () => ok(await store.listDays()),
  );

  server.registerTool(
    'add_check_item',
    {
      title: 'Add checklist item',
      description: 'Append a new task to a day\'s checklist. Returns the created item.',
      inputSchema: { date: dateArg, text: z.string().min(1).describe('The task text.') },
    },
    async ({ date, text }) => ok(await store.addCheckItem(resolve(date), text)),
  );

  server.registerTool(
    'update_check_item',
    {
      title: 'Update checklist item',
      description: 'Edit a checklist item\'s text and/or done state by id. Provide at least one of text/done.',
      inputSchema: {
        date: dateArg,
        id: z.string().describe('The check item id (from get_day).'),
        text: z.string().optional().describe('New text.'),
        done: z.boolean().optional().describe('New done state.'),
      },
    },
    async ({ date, id, text, done }) => {
      if (text === undefined && done === undefined) return fail('Provide at least one of: text, done.');
      const item = await store.updateCheckItem(resolve(date), id, { text, done });
      return item ? ok(item) : fail(`No check item with id "${id}" on ${resolve(date)}.`);
    },
  );

  server.registerTool(
    'toggle_check_item',
    {
      title: 'Toggle checklist item',
      description: 'Flip a checklist item\'s done state by id.',
      inputSchema: { date: dateArg, id: z.string().describe('The check item id.') },
    },
    async ({ date, id }) => {
      const d = resolve(date);
      const current = (await store.getDay(d)).checkItems.find((it) => it.id === id);
      if (!current) return fail(`No check item with id "${id}" on ${d}.`);
      const item = await store.updateCheckItem(d, id, { done: !current.done });
      return ok(item);
    },
  );

  server.registerTool(
    'remove_check_item',
    {
      title: 'Remove checklist item',
      description: 'Delete a checklist item by id.',
      inputSchema: { date: dateArg, id: z.string().describe('The check item id.') },
    },
    async ({ date, id }) => {
      const removed = await store.removeCheckItem(resolve(date), id);
      return removed ? ok({ removed: true, id }) : fail(`No check item with id "${id}" on ${resolve(date)}.`);
    },
  );

  server.registerTool(
    'reorder_check_items',
    {
      title: 'Reorder checklist',
      description: 'Set the checklist order by listing item ids in the desired order. Returns the updated day.',
      inputSchema: {
        date: dateArg,
        ordered_ids: z.array(z.string()).describe('Item ids in the new order.'),
      },
    },
    async ({ date, ordered_ids }) => ok(await store.reorderCheckItems(resolve(date), ordered_ids)),
  );

  server.registerTool(
    'set_agenda',
    {
      title: 'Set agenda entry',
      description:
        'Set the agenda text for a given hour. Passing empty text clears that hour. Returns the updated day.',
      inputSchema: { date: dateArg, hour: hourArg, text: z.string().describe('Text for that hour (empty clears it).') },
    },
    async ({ date, hour, text }) => {
      if (!isValidHour(hour)) return fail(`Hour must be ${AGENDA_START_HOUR}–${AGENDA_END_HOUR}.`);
      return ok(await store.setAgenda(resolve(date), hour, text));
    },
  );

  server.registerTool(
    'clear_agenda',
    {
      title: 'Clear agenda entry',
      description: 'Remove the agenda entry for a given hour. Returns the updated day.',
      inputSchema: { date: dateArg, hour: hourArg },
    },
    async ({ date, hour }) => {
      if (!isValidHour(hour)) return fail(`Hour must be ${AGENDA_START_HOUR}–${AGENDA_END_HOUR}.`);
      return ok(await store.setAgenda(resolve(date), hour, ''));
    },
  );

  return server;
}
