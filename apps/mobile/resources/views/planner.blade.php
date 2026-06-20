@extends('layouts.app')

@section('title', config('app.name', 'Today'))

@php
    use Today\Core\CheckItem;
    // Initial state handed to the Alpine planner component.
    $initCheck = array_map(fn (CheckItem $i) => $i->toArray(), $day->checkItems);
@endphp

@section('body')
<div class="flex min-h-full justify-center px-4 pt-8 pb-28">
    {{-- Centered notebook page — mirrors the browser extension's planner card. --}}
    <main
        x-data="planner({ date: @js($date), checkItems: @js($initCheck), agenda: @js((object) $day->agenda) })"
        class="relative w-full max-w-xl rounded-sm border border-stone-200 bg-[#fcfcfb] px-6 pb-16 pt-7 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(0,0,0,0.12)] dark:border-stone-700 dark:bg-stone-900 dark:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_12px_32px_-12px_rgba(0,0,0,0.6)]"
    >
        {{-- Date header (server-rendered; navigation = full page loads) --}}
        <header class="mb-7">
            {{-- Date + Today --}}
            <div class="flex items-end gap-2">
                <a href="{{ route('planner', ['date' => $prevDate]) }}" aria-label="Previous day"
                   class="pb-1 text-xl leading-none text-stone-300 transition-colors hover:text-stone-600 dark:text-stone-600 dark:hover:text-stone-300">‹</a>
                <div class="relative pl-3">
                    <span aria-hidden class="absolute -left-1 top-0 h-full w-px -rotate-[24deg] bg-stone-300 dark:bg-stone-600"></span>
                    <span class="block text-[10px] font-medium uppercase tracking-[0.2em] text-stone-400 dark:text-stone-500">Date</span>
                    <span class="block whitespace-nowrap text-2xl font-semibold leading-tight tracking-tight text-stone-800 tabular-nums dark:text-stone-100">{{ $longDate }}</span>
                </div>
                <a href="{{ route('planner', ['date' => $nextDate]) }}" aria-label="Next day"
                   class="pb-1 text-xl leading-none text-stone-300 transition-colors hover:text-stone-600 dark:text-stone-600 dark:hover:text-stone-300">›</a>
                <a href="{{ route('planner', ['date' => $todayDate]) }}"
                   class="mb-1 ml-1 rounded-full border border-stone-300 px-2.5 py-0.5 text-[11px] font-medium text-stone-500 transition-colors hover:border-stone-500 hover:text-stone-800 dark:border-stone-600 dark:text-stone-400 dark:hover:border-stone-400 dark:hover:text-stone-100 {{ $isToday ? 'invisible' : '' }}">Today</a>
            </div>

            {{-- Weekday strip — below the date so it never overflows on narrow screens --}}
            <div class="mt-4 flex items-center gap-1.5 text-sm font-medium text-stone-400 dark:text-stone-500">
                <span class="mr-1 text-[10px] uppercase tracking-[0.2em] text-stone-400 dark:text-stone-500">Day</span>
                @foreach ($weekdays as $wd)
                    <a href="{{ route('planner', ['date' => $wd['date']]) }}"
                       aria-label="Go to {{ $wd['name'] }} this week"
                       class="{{ $wd['active']
                           ? 'flex h-7 w-7 items-center justify-center rounded-full border-2 border-rose-400 font-semibold text-stone-700 dark:text-stone-100'
                           : 'flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200' }}">{{ $wd['letter'] }}</a>
                @endforeach
            </div>
            <div class="mt-4 border-b-2 border-stone-300 dark:border-stone-700"></div>
        </header>

        {{-- Check --}}
        <section>
            <h2 class="mb-2 text-base font-semibold tracking-tight text-stone-700 dark:text-stone-200">Check</h2>
            <ul>
                <template x-for="item in sortedItems" :key="item.id">
                    <li class="group flex items-center gap-2.5 border-b border-stone-200 py-2 dark:border-stone-700/70">
                        <button type="button" @click="toggle(item.id)" :aria-pressed="item.done" aria-label="Toggle done"
                            class="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[3px] border text-[11px] leading-none transition-colors"
                            :class="item.done ? 'border-stone-700 bg-stone-700 text-white dark:border-stone-300 dark:bg-stone-300 dark:text-stone-900' : 'border-stone-400 bg-white text-transparent dark:border-stone-500 dark:bg-transparent'">
                            <span x-text="item.done ? '✓' : ''"></span>
                        </button>
                        <input :value="item.text" @input="editText(item.id, $event.target.value)"
                            class="flex-1 bg-transparent text-[15px] outline-none placeholder:text-stone-300 dark:placeholder:text-stone-600"
                            :class="item.done ? 'text-stone-400 line-through dark:text-stone-500' : 'text-stone-700 dark:text-stone-200'" />
                        <button type="button" aria-label="Delete item" @click="remove(item.id)"
                            class="shrink-0 px-1 text-stone-300 transition-colors hover:text-stone-600 dark:text-stone-600 dark:hover:text-stone-300">✕</button>
                    </li>
                </template>

                {{-- Add row --}}
                <li class="flex items-center gap-2.5 border-b border-stone-200 py-2 dark:border-stone-700/70">
                    <span aria-hidden class="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[3px] border border-dashed border-stone-300 text-xs leading-none text-stone-300 dark:border-stone-600 dark:text-stone-600">+</span>
                    <input x-model="draft" @keydown.enter="addItem()"
                        :placeholder="checkItems.length ? 'Add a task…' : 'Add your first task…'"
                        class="flex-1 bg-transparent text-[15px] text-stone-700 outline-none placeholder:text-stone-300 dark:text-stone-200 dark:placeholder:text-stone-600" />
                </li>
            </ul>
        </section>

        {{-- Agenda --}}
        <section class="mt-8">
            <h2 class="mb-2 text-base font-semibold tracking-tight text-stone-700 dark:text-stone-200">Agenda</h2>
            <ul>
                @for ($hour = $startHour; $hour <= $endHour; $hour++)
                    @php $even = $hour % 2 === 0; $isNow = $hour === $currentHour; @endphp
                    <li class="flex items-stretch {{ $even ? 'border-t border-stone-300 dark:border-stone-700' : 'border-t border-stone-200/60 dark:border-stone-700/40' }} {{ $isNow ? 'bg-amber-50/70 dark:bg-amber-400/10' : '' }}">
                        <span class="w-14 shrink-0 select-none border-r border-stone-300 py-1 pr-3 text-right text-[11px] tabular-nums dark:border-stone-700 {{ $even ? 'text-stone-400 dark:text-stone-500' : 'text-transparent' }} {{ $isNow ? '!text-amber-600 font-semibold dark:!text-amber-400' : '' }}">{{ $even ? sprintf('%d:00', $hour > 24 ? $hour - 24 : $hour) : '' }}</span>
                        <div class="flex min-h-[34px] min-w-0 flex-1 items-center py-1">
                            <input :value="agenda[{{ $hour }}] ?? ''" @input="setAgenda({{ $hour }}, $event.target.value)"
                                aria-label="Agenda at {{ sprintf('%d:00', $hour > 24 ? $hour - 24 : $hour) }}"
                                class="w-full bg-transparent px-3 text-[15px] text-stone-700 outline-none dark:text-stone-200" />
                        </div>
                    </li>
                @endfor
                <li class="border-t border-stone-300 dark:border-stone-700" aria-hidden></li>
            </ul>
        </section>
    </main>
</div>

{{-- Settings — fixed bottom-left. --}}
<a href="{{ route('settings') }}" aria-label="Settings"
   class="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-10 flex h-9 items-center gap-1.5 rounded-full border border-stone-200 bg-white/85 px-3 text-[12px] font-medium text-stone-500 shadow-sm backdrop-blur transition-colors hover:text-stone-800 dark:border-stone-700 dark:bg-stone-800/85 dark:text-stone-400 dark:hover:text-stone-100">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
    Settings
</a>

{{-- Theme segmented control (light / auto / dark) — fixed bottom-right. --}}
<div class="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-10 flex items-center gap-1 rounded-full border border-stone-200 bg-white/85 p-1 shadow-sm backdrop-blur dark:border-stone-700 dark:bg-stone-800/85">
    @foreach (['light' => 'Light', 'auto' => 'Auto', 'dark' => 'Dark'] as $value => $label)
        <button type="button" data-set-theme="{{ $value }}" aria-pressed="false"
            class="rounded-full px-3 py-1 text-[12px] font-medium text-stone-500 transition-colors hover:text-stone-800 aria-pressed:bg-stone-800 aria-pressed:text-white dark:text-stone-400 dark:hover:text-stone-100 dark:aria-pressed:bg-stone-100 dark:aria-pressed:text-stone-900">{{ $label }}</button>
    @endforeach
</div>
@endsection
