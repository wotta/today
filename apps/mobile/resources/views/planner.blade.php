@extends('layouts.app')

@section('title', config('app.name', 'Today'))

@php
    use Today\Core\CheckItem;
    // Initial state handed to the Alpine planner component.
    $initCheck = array_map(fn (CheckItem $i) => $i->toArray(), $day->checkItems);
@endphp

@section('body')
<div class="min-h-screen">
    {{-- Full-screen notebook page. Background runs edge to edge (under the
         Dynamic Island); content is kept clear of the bezel via safe-area
         padding. Wider screens still cap the content column at max-w-xl. --}}
    <main
        x-data="planner({ date: @js($date), checkItems: @js($initCheck), agenda: @js((object) $day->agenda) })"
        data-swipe
        data-prev="{{ route('planner', ['date' => $prevDate]) }}"
        data-next="{{ route('planner', ['date' => $nextDate]) }}"
        style="padding-top: calc(env(safe-area-inset-top) + 1.5rem); padding-bottom: calc(env(safe-area-inset-bottom) + 2rem); padding-left: max(1.5rem, env(safe-area-inset-left)); padding-right: max(1.5rem, env(safe-area-inset-right));"
        class="relative mx-auto min-h-screen w-full max-w-xl touch-pan-y bg-[#fcfcfb] dark:bg-stone-900"
    >
        {{-- Date header --}}
        <header class="mb-7">
            {{-- Title: weekday + date, Today pinned right --}}
            <div class="flex w-full items-start justify-between gap-2">
                <div class="min-w-0">
                    <span class="block text-[13px] font-medium text-stone-500 dark:text-stone-400">{{ $weekdayName }}</span>
                    <span class="block whitespace-nowrap text-3xl font-semibold leading-tight tracking-tight text-stone-800 dark:text-stone-100">{{ $monthDay }}</span>
                </div>
                <a href="{{ route('planner', ['date' => $todayDate]) }}"
                   class="mt-1 shrink-0 rounded-full border border-stone-300 px-3 py-1 text-[12px] font-medium text-stone-500 transition-colors hover:border-stone-500 hover:text-stone-800 dark:border-stone-600 dark:text-stone-400 dark:hover:border-stone-400 dark:hover:text-stone-100 {{ $isToday ? 'invisible' : '' }}">Today</a>
            </div>

            {{-- Week selector: each day taps to navigate; active = filled pill, today = rose --}}
            <div class="mt-5 flex justify-between">
                @foreach ($weekdays as $wd)
                    <a href="{{ route('planner', ['date' => $wd['date']]) }}"
                       aria-label="Go to {{ $wd['name'] }} {{ $wd['dom'] }}"
                       class="flex flex-1 flex-col items-center gap-1.5">
                        <span class="text-[11px] font-medium uppercase tracking-wide {{ $wd['active'] ? 'text-stone-500 dark:text-stone-300' : 'text-stone-400 dark:text-stone-500' }}">{{ $wd['letter'] }}</span>
                        <span class="flex h-9 w-9 items-center justify-center rounded-full text-[14px] tabular-nums transition-colors
                            {{ $wd['active']
                                ? 'bg-stone-800 font-semibold text-white dark:bg-stone-100 dark:text-stone-900'
                                : ($wd['isToday']
                                    ? 'font-semibold text-rose-500 dark:text-rose-400'
                                    : 'text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800') }}">{{ $wd['dom'] }}</span>
                    </a>
                @endforeach
            </div>
            <div class="mt-5 border-b border-stone-200 dark:border-stone-700/70"></div>
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
{{-- Bottom navigation + theme control live natively now (NativePHP EDGE bottom
     nav in the layout; theme picker on the Settings screen). --}}
@endsection
